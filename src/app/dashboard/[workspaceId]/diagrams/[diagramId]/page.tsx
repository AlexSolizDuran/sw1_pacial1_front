"use client";

import { useCallback, useEffect, useState } from "react";
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
import { VersionsPanel } from "@/components/editor/Versions/VersionsPanel";
import { useVersionesStore } from "@/store/versiones-store";
import { downloadXmi, type XmiFormat } from "@/lib/export-xmi";
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
  showPanel,
  onTogglePanel,
  showDebug,
  onToggleDebug,
}: {
  onOpenCollaborators: () => void;
  showPanel: boolean;
  onTogglePanel: () => void;
  showDebug: boolean;
  onToggleDebug: () => void;
}) {
  const diagramName = useEditorStore((s) => s.diagramName);
  const addClass = useEditorStore((s) => s.addClass);
  const addNode = useEditorStore((s) => s.addNode);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const versionesCount = useVersionesStore((s) => s.versiones.length);
  const versionesOpen = useVersionesStore((s) => s.open);
  const setVersionesOpen = useVersionesStore((s) => s.setOpen);
  const { screenToFlowPosition } = useReactFlow();

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
      <div className="relative">
        <button
          type="button"
          onClick={() => setExportOpen((v) => !v)}
          className="rounded-md bg-surface-container-high px-3 py-1.5 text-sm text-on-surface transition-colors hover:bg-surface-container-highest"
          title="Exportar el diagrama a formato XMI"
        >
          Exportar XMI
        </button>
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
            </div>
          </>
        )}
      </div>
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
      useEditorStore.setState({ nodes: nodes as Node[], edges: edges as Edge[] });
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
