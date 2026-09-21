"use client";

import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import {
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
} from "@xyflow/react";
import { getDiagram, saveDiagramState } from "@/lib/api";
import { useCollaboratorsStore } from "@/store/collaborators-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import { canonicalEntityToUMLData, canonicalRelationToEdgeData } from "@/lib/ai";
import { flagAutoCaptura } from "@/lib/versions";
import type { DiagramAction } from "@/types/ai";
import type {
  UMLNodeData,
  UMLNodeType,
  UMLEdgeData,
  UMLEdgeType,
  DiagramState,
} from "@/types/diagram";

/** Datos iniciales por tipo de nodo. */
const NODE_DEFAULTS: Record<UMLNodeType, { name: string; data: UMLNodeData }> = {
  class: {
    name: "NuevaClase",
    data: { name: "NuevaClase", fields: [], methods: [] },
  },
  interface: {
    name: "NuevaInterfaz",
    data: { name: "NuevaInterfaz", fields: [], methods: [] },
  },
  abstract: {
    name: "ClaseAbstracta",
    data: { name: "ClaseAbstracta", fields: [], methods: [] },
  },
  enumeration: {
    name: "NuevaEnumeracion",
    data: { name: "NuevaEnumeracion", fields: [], methods: [], literals: [] },
  },
};

interface EditorState {
  diagramId: string;
  diagramName: string;
  nodes: Node[];
  edges: Edge[];
  selectedId: string | null;
  dirty: boolean;
  saving: boolean;
  loadDiagram: (id: string) => Promise<void>;
  applyNodesChange: OnNodesChange;
  applyEdgesChange: OnEdgesChange;
  addClass: (position: { x: number; y: number }) => void;
  addNode: (type: UMLNodeType, position: { x: number; y: number }) => void;
  updateNode: (id: string, data: Partial<UMLNodeData>) => void;
  deleteNode: (id: string) => void;
  addEdge: (
    source: string,
    target: string,
    type: UMLEdgeType,
    sourceHandle?: string,
    targetHandle?: string,
  ) => void;
  updateEdge: (id: string, data: Partial<UMLEdgeData>) => void;
  /** Re-ancla una relacion a otro handle/nodo conservando su data (multiplicidades). */
  reconnectEdge: (
    id: string,
    connection: {
      source: string;
      target: string;
      sourceHandle?: string | null;
      targetHandle?: string | null;
    },
  ) => void;
  deleteEdge: (id: string) => void;
  select: (id: string | null) => void;
  save: () => Promise<void>;
  /** Aplica las acciones generadas por la IA (vista previa confirmada). */
  applyDiagramActions: (acciones: DiagramAction[]) => void;
  /** Restaura una version guardada (reemplaza nodos/aristas, sin capturar). */
  restaurarVersion: (nodes: Node[], edges: Edge[]) => void;
}

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Verifica si el usuario puede editar (no es VIEWER). */
function canEdit(): boolean {
  return useCollaboratorsStore.getState().myRole !== "VIEWER";
}

/** Verifica si un elemento esta bloqueado por otro usuario. */
function isElementLocked(elementId: string): boolean {
  const collab = useCollaborationStore.getState();
  if (!collab.connected) return false;
  const { locked } = collab.isLocked(elementId);
  return locked;
}

function syncToDoc(nodes: Node[], edges: Edge[]): void {
  const collaboration = useCollaborationStore.getState();
  if (collaboration.doc && collaboration.connected) {
    collaboration.publishDiagram(nodes, edges);
  }
}

function serializeState(nodes: Node[], edges: Edge[]): DiagramState {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "class",
      position: n.position,
      data: n.data as unknown as UMLNodeData,
    })),
    edges: edges.map((e) => {
      const edgeData = (e.data as unknown as UMLEdgeData) ?? {};
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type ?? "association",
        label: typeof e.label === "string" ? e.label : edgeData.label,
        sourceMultiplicity: edgeData.sourceMultiplicity,
        targetMultiplicity: edgeData.targetMultiplicity,
        // Persiste el lado exacto del nodo donde se ancla la relacion
        sourceHandle: e.sourceHandle ?? edgeData.sourceHandle,
        targetHandle: e.targetHandle ?? edgeData.targetHandle,
      };
    }),
  };
}

let saveTimeout: ReturnType<typeof setTimeout> | null = null;

function debounceSave(
  get: () => EditorState,
  set: (partial: Partial<EditorState>) => void,
) {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    const state = get();
    if (!state.diagramId || !state.dirty) return;
    set({ saving: true });
    try {
      const reactFlowState = serializeState(state.nodes, state.edges);
      await saveDiagramState(state.diagramId, reactFlowState);
      set({ dirty: false });
    } catch (error) {
      console.error("Error guardando diagrama:", error);
    } finally {
      set({ saving: false });
    }
  }, 300);
}

export const useEditorStore = create<EditorState>()(
  subscribeWithSelector((set, get) => ({
  diagramId: "",
  diagramName: "Diagrama",
  nodes: [],
  edges: [],
  selectedId: null,
  dirty: false,
  saving: false,

  loadDiagram: async (id) => {
    const diagram = await getDiagram(id);
    const state = diagram.reactFlowState;
    const collaboration = useCollaborationStore.getState();
    const hasSharedDoc = Boolean(collaboration.doc && collaboration.connected);

    const edgesFromDb = (state?.edges ?? []) as Array<{
      id: string;
      source: string;
      target: string;
      type: string;
      label?: string;
      sourceMultiplicity?: string;
      targetMultiplicity?: string;
      sourceHandle?: string;
      targetHandle?: string;
    }>;

    const restoredEdges: Edge[] = edgesFromDb.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type ?? "association",
      label: e.label,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      data: {
        type: e.type ?? "association",
        label: e.label,
        sourceMultiplicity: e.sourceMultiplicity,
        targetMultiplicity: e.targetMultiplicity,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      },
    }));

    flagAutoCaptura.suspender = true;
    try {
      set({
        diagramId: diagram.id,
        diagramName: diagram.name,
        nodes: hasSharedDoc
          ? get().nodes
          : ((state?.nodes ?? []) as unknown as Node[]),
        edges: hasSharedDoc ? get().edges : restoredEdges,
        selectedId: null,
        dirty: false,
      });
    } finally {
      flagAutoCaptura.suspender = false;
    }
  },

  applyNodesChange: (changes) => {
    if (!canEdit()) return;
    // Los cambios de medicion ("dimensions") NO se publican al Y.Doc ni se
    // guardan: si se sincronizan generan un ciclo infinito
    // (doc -> setState -> re-medicion -> doc → ...). Aun asi se aplican en
    // el store local para que cada nodo conserve su `measured` y el MiniMap
    // pueda dibujar la miniatura (si se ignoran, queda todo en negro).
    const dimensiones = changes.filter((c) => c.type === "dimensions");
    if (dimensiones.length > 0) {
      set({ nodes: applyNodeChanges(dimensiones, get().nodes) });
    }
    const filtered = changes.filter((c) => c.type !== "dimensions");
    if (filtered.length === 0) return;
    const next = applyNodeChanges(filtered, get().nodes);
    set({ nodes: next, dirty: true });
    syncToDoc(next, get().edges);
    debounceSave(get, set);
  },

  applyEdgesChange: (changes) => {
    if (!canEdit()) return;
    const next = applyEdgeChanges(changes, get().edges);
    set({ edges: next, dirty: true });
    syncToDoc(get().nodes, next);
    debounceSave(get, set);
  },

  addClass: (position) => {
    if (!canEdit()) return;
    const { name, data } = NODE_DEFAULTS.class;
    const id = makeId("class");
    const node: Node = {
      id,
      type: "class",
      position,
      data,
    };
    const nodes = [...get().nodes, node];
    set({ nodes, selectedId: id, dirty: true });
    syncToDoc(nodes, get().edges);
    debounceSave(get, set);
  },

  addNode: (type, position) => {
    if (!canEdit()) return;
    const { name, data } = NODE_DEFAULTS[type] ?? NODE_DEFAULTS.class;
    const id = makeId(type);
    const node: Node = {
      id,
      type,
      position,
      data,
    };
    const nodes = [...get().nodes, node];
    set({ nodes, selectedId: id, dirty: true });
    syncToDoc(nodes, get().edges);
    debounceSave(get, set);
  },

  updateNode: (id, data) => {
    if (!canEdit()) return;
    if (isElementLocked(id)) return;
    const nodes = get().nodes.map((n) => {
      if (n.id !== id) return n;
      return { ...n, data: { ...(n.data as unknown as UMLNodeData), ...data } };
    });
    set({ nodes, dirty: true });
    syncToDoc(nodes, get().edges);
    debounceSave(get, set);
  },

  deleteNode: (id) => {
    if (!canEdit()) return;
    if (isElementLocked(id)) return;
    const nodes = get().nodes.filter((n) => n.id !== id);
    const edges = get().edges.filter((e) => e.source !== id && e.target !== id);
    set({
      nodes,
      edges,
      selectedId: get().selectedId === id ? null : get().selectedId,
      dirty: true,
    });
    syncToDoc(nodes, edges);
    debounceSave(get, set);
  },

  addEdge: (source, target, type, sourceHandle, targetHandle) => {
    if (!canEdit()) return;
    const id = makeId("edge");
    // Guarda el lado exacto (sourceHandle/targetHandle) para que el trazado de
    // la relacion se ancle en el punto del nodo donde el usuario la creo.
    const edge: Edge = {
      id,
      source,
      target,
      type,
      sourceHandle,
      targetHandle,
      data: { type, sourceHandle, targetHandle },
    };
    const edges = [...get().edges, edge];
    set({ edges, selectedId: id, dirty: true });
    syncToDoc(get().nodes, edges);
    debounceSave(get, set);
  },

  updateEdge: (id, data) => {
    if (!canEdit()) return;
    if (isElementLocked(id)) return;
    const edges = get().edges.map((e) => {
      if (e.id !== id) return e;
      const edgeData = { ...(e.data as unknown as UMLEdgeData), ...data };
      const reactFlowType = data.type ?? e.type;
      return { ...e, type: reactFlowType, data: edgeData };
    });
    set({ edges, dirty: true });
    syncToDoc(get().nodes, edges);
    debounceSave(get, set);
  },

  reconnectEdge: (id, connection) => {
    if (!canEdit()) return;
    if (isElementLocked(id)) return;
    const edges = get().edges.map((e) => {
      if (e.id !== id) return e;
      // Solo cambia el anclaje (source/target + handles). data queda intacta,
      // asi label y multiplicidades de la relacion no se pierden.
      return {
        ...e,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
      };
    });
    set({ edges, selectedId: id, dirty: true });
    syncToDoc(get().nodes, edges);
    debounceSave(get, set);
  },

  deleteEdge: (id) => {
    if (!canEdit()) return;
    if (isElementLocked(id)) return;
    const edges = get().edges.filter((e) => e.id !== id);
    set({
      edges,
      selectedId: get().selectedId === id ? null : get().selectedId,
      dirty: true,
    });
    syncToDoc(get().nodes, edges);
    debounceSave(get, set);
  },

  /**
   * Selecciona un elemento.
   * Al cambiar de seleccion, libera el lock del anterior y adquiere lock del nuevo.
   * (Solo si estamos en sesion colaborativa y el usuario tiene permiso de edicion).
   */
  select: (id) => {
    const collab = useCollaborationStore.getState();
    const prevId = get().selectedId;

    // Libera el lock del elemento anterior si era nuestro
    if (prevId && collab.connected && canEdit()) {
      const { locked } = collab.isLocked(prevId);
      // Si no esta locked por otro, podemos liberar (era nuestro)
      if (!locked) {
        collab.releaseLock(prevId);
      }
    }

    // Adquiere lock del nuevo elemento seleccionado
    if (id && collab.connected && canEdit()) {
      collab.acquireLock(id);
    }

    set({ selectedId: id });
  },

  save: async () => {
    const { diagramId, nodes, edges } = get();
    if (!diagramId) return;
    set({ saving: true });
    try {
      const reactFlowState = serializeState(nodes, edges);
      await saveDiagramState(diagramId, reactFlowState);
      set({ dirty: false });
    } finally {
      set({ saving: false });
    }
  },

  applyDiagramActions: (acciones) => {
    if (!canEdit()) return;
    let nodes = [...get().nodes];
    let edges = [...get().edges];
    // Mapea id canonico (n11, e21...) -> id real generado para entidades nuevas
    const creadas = new Map<string, string>();

    for (const accion of acciones) {
      switch (accion.tipo) {
        case "createEntidad": {
          const entidad = accion.entidad;
          const id = makeId(entidad.tipo);
          creadas.set(entidad.id, id);
          const node: Node = {
            id,
            type: entidad.tipo,
            // Ubicacion escalonada para no superponer las entidades nuevas
            position: {
              x: 150 + (nodes.length % 4) * 60,
              y: 120 + Math.floor(nodes.length / 4) * 80,
            },
            data: canonicalEntityToUMLData(entidad),
          };
          nodes = [...nodes, node];
          break;
        }
        case "updateEntidad": {
          const entidad = accion.entidad;
          nodes = nodes.map((n) =>
            n.id === accion.id
              ? { ...n, type: entidad.tipo, data: canonicalEntityToUMLData(entidad) }
              : n,
          );
          break;
        }
        case "deleteEntidad": {
          nodes = nodes.filter((n) => n.id !== accion.id);
          edges = edges.filter(
            (e) => e.source !== accion.id && e.target !== accion.id,
          );
          break;
        }
        case "updateRelacion": {
          const data = canonicalRelationToEdgeData(accion.relacion);
          edges = edges.map((e) =>
            e.id === accion.id
              ? { ...e, ...data, data: { ...(e.data ?? {}), ...data } }
              : e,
          );
          break;
        }
        case "createRelacion": {
          const rel = accion.relacion;
          // Los extremos pueden ser ids reales (existentes) o canonicos (nuevas)
          const source = creadas.get(rel.origen) ?? rel.origen;
          const target = creadas.get(rel.destino) ?? rel.destino;
          if (!source || !target) break;
          const data = canonicalRelationToEdgeData(rel);
          const edge: Edge = {
            id: makeId("edge"),
            source,
            target,
            type: rel.tipo,
            label: typeof rel.label === "string" ? rel.label : undefined,
            data,
          };
          edges = [...edges, edge];
          break;
        }
        case "deleteRelacion": {
          edges = edges.filter((e) => e.id !== accion.id);
          break;
        }
      }
    }

    const selectedId = get().selectedId;
    const seleccionSigue =
      selectedId !== null &&
      (nodes.some((n) => n.id === selectedId) ||
        edges.some((e) => e.id === selectedId));

    set({
      nodes,
      edges,
      selectedId: seleccionSigue ? selectedId : null,
      dirty: true,
    });
    syncToDoc(nodes, edges);
    debounceSave(get, set);
  },

  /**
   * Restaura una version guardada: reemplaza nodos/aristas y dispara el
   * guardado automatico. Se suspende la captura automatica (rollback).
   */
  restaurarVersion: (nodes, edges) => {
    if (!canEdit()) return;
    flagAutoCaptura.suspender = true;
    try {
      // Libera cualquier lock del usuario: el canvas vuelve al estado base
      useCollaborationStore.getState().releaseAllLocks();
      set({ nodes, edges, selectedId: null, dirty: true });
      syncToDoc(nodes, edges);
      debounceSave(get, set);
    } finally {
      flagAutoCaptura.suspender = false;
    }
  },
})));
