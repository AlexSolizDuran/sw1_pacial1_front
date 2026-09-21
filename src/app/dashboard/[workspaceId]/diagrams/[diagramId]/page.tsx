"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { ReactFlowProvider, useReactFlow } from "@xyflow/react";
import type { Node, Edge } from "@xyflow/react";
import { useEditorStore } from "@/store/editor-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import { useCollaboratorsStore } from "@/store/collaborators-store";
import { DiagramCanvas } from "@/components/editor/DiagramCanvas";
import { PropertiesPanel } from "@/components/editor/Sidebar/PropertiesPanel";
import { CollaboratorsModal } from "@/components/collaboration/CollaboratorsModal";
import { CollaborationPresence } from "@/components/collaboration/CollaborationPresence";
import { AIChatPanel } from "@/components/editor/AI/AIChatPanel";
import { SpringBootPanel } from "@/components/editor/SpringBoot/SpringBootPanel";
import { VersionsPanel } from "@/components/editor/Versions/VersionsPanel";
import { useVersionesStore } from "@/store/versiones-store";
import { downloadXmi, type XmiFormat } from "@/lib/export-xmi";
import { parseXmi } from "@/lib/import-xmi";
import {
  snapshotDesdeEstado,
  importarImagenDesdeArchivo,
} from "@/lib/ai";
import {
  downloadDiagramImage,
  type ImageFormat,
} from "@/lib/export-image";
import type {
  UMLNodeType,
  DiagramState,
} from "@/types/diagram";
import { NODE_TYPE_LABELS } from "@/types/diagram";

/**
 * Panel de debug que muestra el JSON actual del diagrama.
 */
function DebugPanel() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);

  const state = {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      type: e.type,
      source: e.source,
      target: e.target,
      data: e.data,
    })),
  };

  return (
    <div className="border-b border-outline-variant bg-surface-container-lowest p-4">
      <p className="mb-2 text-xs font-medium text-on-surface-variant">
        Estado actual del diagrama ({nodes.length} nodos, {edges.length} aristas)
      </p>
      <pre className="max-h-64 overflow-auto rounded-md bg-surface-container p-3 text-xs text-on-surface">
        {JSON.stringify(state, null, 2)}
      </pre>
    </div>
  );
}

/**
 * Barra superior del editor con nombre del diagrama, botones de accion.
 */
function EditorTopBar({
  onOpenCollaborators,
  onOpenSpringBoot,
  showPanel,
  onTogglePanel,
  showDebug,
  onToggleDebug,
}: {
  onOpenCollaborators: () => void;
  onOpenSpringBoot: () => void;
  showPanel: boolean;
  onTogglePanel: () => void;
  showDebug: boolean;
  onToggleDebug: () => void;
}) {
  const diagramName = useEditorStore((s) => s.diagramName);
  const diagramId = useEditorStore((s) => s.diagramId);
  const addClass = useEditorStore((s) => s.addClass);
  const addNode = useEditorStore((s) => s.addNode);
  const restaurarVersion = useEditorStore((s) => s.restaurarVersion);
  const applyDiagramActions = useEditorStore((s) => s.applyDiagramActions);
  const myRole = useCollaboratorsStore((s) => s.myRole);
  const soloLectura = myRole === "VIEWER";
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const versionesCount = useVersionesStore((s) => s.versiones.length);
  const versionesOpen = useVersionesStore((s) => s.open);
  const setVersionesOpen = useVersionesStore((s) => s.setOpen);
  const { screenToFlowPosition, getNodesBounds } = useReactFlow();

  const handleAddNode = useCallback(
    (type: UMLNodeType) => {
      const center = screenToFlowPosition({
        x: typeof window !== "undefined" ? window.innerWidth / 2 : 300,
        y: typeof window !== "undefined" ? window.innerHeight / 2 : 200,
      });
      if (type === "class") {
        addClass(center);
      } else {
        addNode(type, center);
      }
    },
    [screenToFlowPosition, addClass, addNode],
  );

  const handleExportXmi = useCallback(
    (format: XmiFormat) => {
      const state: DiagramState = {
        nodes: nodes.map((n) => ({
          id: n.id,
          type: n.type ?? "class",
          position: n.position,
          data: n.data as DiagramState["nodes"][number]["data"],
        })),
        edges: edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type ?? "association",
          label: typeof e.label === "string" ? e.label : undefined,
          sourceMultiplicity: (e.data as { sourceMultiplicity?: string })
            ?.sourceMultiplicity,
          targetMultiplicity: (e.data as { targetMultiplicity?: string })
            ?.targetMultiplicity,
        })),
      };
      downloadXmi(state, diagramName, format);
      setExportOpen(false);
    },
    [nodes, edges, diagramName],
  );

  const [exportOpen, setExportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [exportandoImg, setExportandoImg] = useState(false);
  const [importandoImg, setImportandoImg] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const imagenRef = useRef<HTMLInputElement | null>(null);

  /**
   * Importa un archivo XMI (Umbrello 1.2 o Enterprise 2.5.1, CU-3.4).
   * Reemplaza el lienzo tras confirmacion (restaura + guarda + sincroniza).
   */
  const handleImportXmi = useCallback(
    async (file: File) => {
      try {
        const xml = await file.text();
        const { format, state, warnings } = parseXmi(xml);
        if (nodes.length > 0) {
          const ok = confirm(
            `Reemplazar el lienzo actual con ${state.nodes.length} clases y ${state.edges.length} relaciones del XMI (${format})?`,
          );
          if (!ok) return;
        }
        const rfNodes = state.nodes.map((n) => ({
          id: n.id,
          type: n.type,
          position: n.position,
          data: n.data,
        }));
        const rfEdges = state.edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target,
          type: e.type,
          ...(e.label ? { label: e.label } : {}),
          data: {
            type: e.type,
            ...(e.label ? { label: e.label } : {}),
            ...(e.sourceMultiplicity
              ? { sourceMultiplicity: e.sourceMultiplicity }
              : {}),
            ...(e.targetMultiplicity
              ? { targetMultiplicity: e.targetMultiplicity }
              : {}),
          },
        }));
        restaurarVersion(
          rfNodes as unknown as Node[],
          rfEdges as unknown as Edge[],
        );
        if (warnings.length > 0) {
          alert(
            `Importados ${state.nodes.length} clases y ${state.edges.length} relaciones.\nAvisos:\n- ${warnings.slice(0, 5).join("\n- ")}`,
          );
        }
      } catch (err) {
        alert(err instanceof Error ? err.message : "No se pudo importar el XMI.");
      } finally {
        setExportOpen(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    },
    [nodes.length, restaurarVersion],
  );

  /** Exporta el lienzo a PNG o SVG (CU-3.5). */
  const handleExportImage = useCallback(
    async (format: ImageFormat) => {
      setExportandoImg(true);
      try {
        // getNodesBounds via el hook lee el nodeLookup interno (medicion del
        // DOM), evitando recortes por missing measured en los nodos del store.
        const bounds = getNodesBounds(nodes);
        await downloadDiagramImage(nodes, diagramName, format, bounds);
      } catch (err) {
        alert(
          err instanceof Error ? err.message : "No se pudo exportar la imagen.",
        );
      } finally {
        setExportandoImg(false);
        setExportOpen(false);
      }
    },
    [nodes, diagramName, getNodesBounds],
  );

  /**
   * Importa una imagen de diagrama de clases (vision -> DSL, CU-3.6).
   * Pide confirmacion si el lienzo no esta vacio (modo reemplazo) y aplica
   * las acciones del backend, igual que el COPILOT en modo Build.
   */
  const handleImportarImagen = useCallback(
    async (file: File) => {
      if (nodes.length > 0) {
        const ok = confirm(
          `Reemplazar el lienzo actual con el diagrama detectado en la imagen?\nSe reemplazaran ${nodes.length} clases y ${edges.length} relaciones existentes.`,
        );
        if (!ok) return;
      }
      setImportandoImg(true);
      try {
        const snapshot = snapshotDesdeEstado(nodes, edges);
        const res = await importarImagenDesdeArchivo(
          diagramId,
          file,
          snapshot,
        );
        applyDiagramActions(res.acciones);
        if (res.advertencias.length > 0) {
          alert(
            `Diagrama importado.\nSe descartaron algunos cambios:\n- ${res.advertencias.slice(0, 5).join("\n- ")}`,
          );
        }
      } catch (err) {
        alert(
          err instanceof Error ? err.message : "No se pudo importar la imagen.",
        );
      } finally {
        setImportandoImg(false);
        if (imagenRef.current) imagenRef.current.value = "";
      }
    },
    [nodes.length, edges.length, diagramId, applyDiagramActions],
  );

  return (
    <div className="flex items-center gap-3 border-b border-outline-variant bg-surface-container px-4 py-2">
      <h1 className="font-headline text-base font-semibold text-on-surface">
        {diagramName || "Diagrama"}
      </h1>
      <div className="flex-1" />
      <CollaborationPresence />
      <div className="relative">
        <button
          type="button"
          onClick={() => setAddOpen((v) => !v)}
          className="rounded-md bg-primary-container px-3 py-1.5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed"
        >
          + Agregar
        </button>
        {addOpen && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setAddOpen(false)} />
            <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-md border border-outline-variant bg-surface-container shadow-lg">
              {(Object.keys(NODE_TYPE_LABELS) as UMLNodeType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleAddNode(type)}
                  className="flex w-full px-4 py-2 text-left transition-colors hover:bg-surface-container-high"
                >
                  <span className="text-sm text-on-surface">{NODE_TYPE_LABELS[type]}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={onTogglePanel}
        className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
          showPanel
            ? "bg-primary-container text-on-primary-container"
            : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
        }`}
      >
        Propiedades
      </button>
      <button
        type="button"
        onClick={onOpenCollaborators}
        className="rounded-md bg-surface-container-high px-3 py-1.5 text-sm text-on-surface transition-colors hover:bg-surface-container-highest"
      >
        Colaboradores
      </button>
      <button
        type="button"
        onClick={onOpenSpringBoot}
        disabled={soloLectura}
        title={
          soloLectura
            ? "Solo lectura: no puedes generar codigo"
            : "Generar backend Spring Boot desde el diagrama"
        }
        className="rounded-md bg-primary-container px-3 py-1.5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50"
      >
        Spring Boot
      </button>
      <div className="relative">
        <button
          type="button"
          onClick={() => setExportOpen((v) => !v)}
          className="rounded-md bg-surface-container-high px-3 py-1.5 text-sm text-on-surface transition-colors hover:bg-surface-container-highest"
          title="Exportar o importar el diagrama"
        >
          Exportar
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".xmi,.xml"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImportXmi(file);
          }}
        />
        {exportOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setExportOpen(false)}
            />
            <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-md border border-outline-variant bg-surface-container shadow-lg">
              <button
                type="button"
                onClick={() => handleExportXmi("umbrello")}
                className="flex w-full items-start px-4 py-2.5 text-left transition-colors hover:bg-surface-container-high"
              >
                <span className="block">
                  <span className="block text-sm font-medium text-on-surface">
                    Umbrello (XMI 1.2)
                  </span>
                  <span className="block text-xs text-on-surface-variant">
                    Formato UML 1.4 para importar en Umbrello
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => handleExportXmi("enterprise")}
                className="flex w-full items-start border-t border-outline-variant px-4 py-2.5 text-left transition-colors hover:bg-surface-container-high"
              >
                <span className="block">
                  <span className="block text-sm font-medium text-on-surface">
                    Enterprise Architect (XMI 2.5.1)
                  </span>
                  <span className="block text-xs text-on-surface-variant">
                    Formato UML 2.5 estandar (Sparx EA)
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={soloLectura}
                title={
                  soloLectura
                    ? "Solo lectura: no puedes importar"
                    : "Importar un archivo .xmi (Umbrello o Enterprise)"
                }
                className="flex w-full items-start border-t border-outline-variant px-4 py-2.5 text-left transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                <span className="block">
                  <span className="block text-sm font-medium text-on-surface">
                    Importar XMI
                  </span>
                  <span className="block text-xs text-on-surface-variant">
                    Cargar clases desde un .xmi (reemplaza el lienzo)
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleExportImage("png")}
                disabled={exportandoImg}
                className="flex w-full items-start border-t border-outline-variant px-4 py-2.5 text-left transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                <span className="block">
                  <span className="block text-sm font-medium text-on-surface">
                    {exportandoImg ? "Generando..." : "Exportar PNG"}
                  </span>
                  <span className="block text-xs text-on-surface-variant">
                    Imagen del diagrama actual
                  </span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => void handleExportImage("svg")}
                disabled={exportandoImg}
                className="flex w-full items-start border-t border-outline-variant px-4 py-2.5 text-left transition-colors hover:bg-surface-container-high disabled:opacity-50"
              >
                <span className="block">
                  <span className="block text-sm font-medium text-on-surface">
                    {exportandoImg ? "Generando..." : "Exportar SVG"}
                  </span>
                  <span className="block text-xs text-on-surface-variant">
                    Vectorial, escala sin perder calidad
                  </span>
                </span>
              </button>
            </div>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={() => imagenRef.current?.click()}
        disabled={soloLectura || importandoImg}
        title={
          soloLectura
            ? "Solo lectura: no puedes importar"
            : "Detectar clases desde una imagen (reemplaza el lienzo)"
        }
        className="rounded-md bg-primary-container px-3 py-1.5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50"
      >
        {importandoImg ? "Importando..." : "Importar imagen"}
      </button>
      <input
        ref={imagenRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleImportarImagen(file);
        }}
      />
      <button
        type="button"
        onClick={() => setVersionesOpen(!versionesOpen)}
        className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
          versionesOpen
            ? "bg-primary-container text-on-primary-container"
            : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
        }`}
      >
        Versiones
        {versionesCount > 0 && (
          <span className="ml-1.5 rounded-full bg-on-surface px-1.5 text-[10px] text-surface">
            {versionesCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={onToggleDebug}
        className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
          showDebug
            ? "bg-tertiary-container text-on-tertiary-container"
            : "bg-surface-container-high text-on-surface hover:bg-surface-container-highest"
        }`}
      >
        Debug
      </button>
    </div>
  );
}

/**
 * Pagina del editor del diagrama.
 * Panel de propiedades a la izquierda, lienzo al centro.
 * Colaboradores se gestiona via modal.
 */
function DiagramEditorContent() {
  const params = useParams<{ diagramId: string }>();
  const diagramId = params.diagramId;

  const loadDiagram = useEditorStore((s) => s.loadDiagram);

  const connect = useCollaborationStore((s) => s.setup);
  const joinSession = useCollaborationStore((s) => s.join);
  const leaveSession = useCollaborationStore((s) => s.leave);

  const collaborateLoad = useCollaboratorsStore((s) => s.load);
  const cargarVersiones = useVersionesStore((s) => s.cargar);

  const [showCollaborators, setShowCollaborators] = useState(false);
  const [showSpringBoot, setShowSpringBoot] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const [showDebug, setShowDebug] = useState(false);

  useEffect(() => {
    if (diagramId) cargarVersiones(diagramId);
  }, [diagramId, cargarVersiones]);

  useEffect(() => {
    if (!diagramId) return;

    loadDiagram(diagramId).catch(() => {});

    connect(() => {
      const collaboration = useCollaborationStore.getState();
      const { nodes, edges } = collaboration.readDiagram();
      // Se re-hidrata SIN `selected` (viene limpio de readDiagram) y se re-aplica
      // SOLO la seleccion local (selectedId). Sin este paso, React Flow deriva
      // seleccion vacia al recibir cualquier edicion remota, dispara
      // onSelectionChange(null) y libera el lock propio de cada usuario.
      const selectedId = useEditorStore.getState().selectedId;
      const nodesConSeleccion = (nodes as Node[]).map((n) =>
        n.id === selectedId ? { ...n, selected: true } : n,
      );
      const edgesConSeleccion = (edges as Edge[]).map((e) =>
        e.id === selectedId ? { ...e, selected: true } : e,
      );
      useEditorStore.setState({
        nodes: nodesConSeleccion,
        edges: edgesConSeleccion,
      });
    });

    void joinSession(diagramId).then(() => {
      const role = useCollaborationStore.getState().role;
      void collaborateLoad(diagramId, role);
    });

    return () => {
      leaveSession();
    };
  }, [diagramId, loadDiagram, connect, joinSession, leaveSession, collaborateLoad]);

  return (
    <div className="flex h-screen flex-col bg-surface">
      <EditorTopBar
        onOpenCollaborators={() => setShowCollaborators(true)}
        onOpenSpringBoot={() => setShowSpringBoot(true)}
        showPanel={showPanel}
        onTogglePanel={() => setShowPanel((v) => !v)}
        showDebug={showDebug}
        onToggleDebug={() => setShowDebug((v) => !v)}
      />

      {showDebug && <DebugPanel />}

      <div className="flex min-h-0 flex-1">
        {showPanel && <PropertiesPanel />}
        <main className="min-w-0 flex-1">
          <DiagramCanvas />
        </main>
      </div>

      {showCollaborators && diagramId && (
        <CollaboratorsModal
          diagramId={diagramId}
          onClose={() => setShowCollaborators(false)}
        />
      )}

      <AIChatPanel />
      <VersionsPanel />
      {showSpringBoot && (
        <SpringBootPanel onClose={() => setShowSpringBoot(false)} />
      )}
    </div>
  );
}

export default function DiagramEditorPage() {
  return (
    <ReactFlowProvider>
      <DiagramEditorContent />
    </ReactFlowProvider>
  );
}
