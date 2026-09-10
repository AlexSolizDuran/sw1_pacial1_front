"use client";

import { create } from "zustand";
import { useEditorStore } from "@/store/editor-store";
import {
  LIMITE_VERSIONES,
  flagAutoCaptura,
  leerVersiones,
  persistirVersiones,
  firmaDiagrama,
  toDiagramState,
  diagramStateToNodes,
  diagramStateToEdges,
  uidVersion,
  type Version,
} from "@/lib/versions";
import type { Node, Edge } from "@xyflow/react";

/**
 * Historial automatico de versiones del diagrama (solo navegador).
 * Cada cambio de nodos/aristas genera una version; el suscriptor se registra
 * al importar este modulo y reutiliza los datos del editor-store.
 */
interface VersionesState {
  versiones: Version[];
  /** True si el panel flotante esta abierto. */
  open: boolean;
  /** Carga las versiones de un diagrama desde localStorage. */
  cargar: (diagramId: string) => void;
  /** Restaura una version sobre el lienzo (via editor-store). */
  restaurar: (versionId: string) => void;
  /** Elimina una version del historial. */
  eliminar: (versionId: string) => void;
  setOpen: (abierto: boolean) => void;
  /** Captura interna usada por el suscriptor de cambios. */
  capturarInterno: (nodes: Node[], edges: Edge[]) => void;
}

/** Ultima firma capturada para dedupicar (evita versiones repetidas). */
let ultimaFirma = "";
/** Debounce para agrupar drags de nodos en una sola version. */
let timerPosicion: ReturnType<typeof setTimeout> | null = null;

export const useVersionesStore = create<VersionesState>((set, get) => {
  /** Genera la version y la persiste, sin repetir estados. */
  const push = (nodes: Node[], edges: Edge[]) => {
    const diagramId = useEditorStore.getState().diagramId;
    if (!diagramId) return;

    const version: Version = {
      id: uidVersion("v"),
      fecha: Date.now(),
      estado: toDiagramState(nodes, edges),
    };

    const versiones = [version, ...get().versiones].slice(0, LIMITE_VERSIONES);
    set({ versiones });
    persistirVersiones(diagramId, versiones);
  };

  return {
    versiones: [],
    open: false,

    cargar: (diagramId) => {
      set({ versiones: leerVersiones(diagramId) });
      // Resincroniza la de-dupe con el estado actual del lienzo
      const { nodes, edges } = useEditorStore.getState();
      ultimaFirma = firmaDiagrama(nodes, edges);
    },

    restaurar: (versionId) => {
      const version = get().versiones.find((v) => v.id === versionId);
      if (!version) return;
      useEditorStore
        .getState()
        .restaurarVersion(
          diagramStateToNodes(version.estado),
          diagramStateToEdges(version.estado),
        );
    },

    eliminar: (versionId) => {
      const diagramId = useEditorStore.getState().diagramId;
      const versiones = get().versiones.filter((v) => v.id !== versionId);
      set({ versiones });
      if (diagramId) persistirVersiones(diagramId, versiones);
    },

    setOpen: (abierto) => set({ open: abierto }),

    capturarInterno: (nodes, edges) => {
      const firma = firmaDiagrama(nodes, edges);
      if (firma === ultimaFirma) return;
      ultimaFirma = firma;
      push(nodes, edges);
    },
  };
});

/**
 * Suscriptor automatico: cualquier cambio en nodes/edges del editor genera
 * una version. Los drags de nodos (solo posicion) se agrupan a 800ms.
 */
let registrada = false;
function registrarCapturas() {
  if (registrada) return;
  registrada = true;

  /** True si el cambio de nodos fue unicamente de posicion (drag). */
  function soloPosicion(prev: Node[], cur: Node[]): boolean {
    if (prev.length !== cur.length) return false;
    return cur.every((n, i) => {
      const ant = prev[i];
      return (
        ant?.id === n.id &&
        JSON.stringify(ant?.data) === JSON.stringify(n.data)
      );
    });
  }

  useEditorStore.subscribe(
    (s) => s.nodes,
    (prevNodos, nodos) => {
      if (flagAutoCaptura.suspender || !useEditorStore.getState().diagramId)
        return;

      if (soloPosicion(prevNodos, nodos)) {
        if (timerPosicion) clearTimeout(timerPosicion);
        timerPosicion = setTimeout(() => {
          useVersionesStore
            .getState()
            .capturarInterno(nodos, useEditorStore.getState().edges);
        }, 800);
        return;
      }

      if (timerPosicion) {
        clearTimeout(timerPosicion);
        timerPosicion = null;
      }
      useVersionesStore.getState().capturarInterno(nodos, useEditorStore.getState().edges);
    },
  );

  useEditorStore.subscribe(
    (s) => s.edges,
    (_prevAristas, aristas) => {
      if (flagAutoCaptura.suspender || !useEditorStore.getState().diagramId)
        return;
      if (timerPosicion) {
        clearTimeout(timerPosicion);
        timerPosicion = null;
      }
      useVersionesStore.getState().capturarInterno(useEditorStore.getState().nodes, aristas);
    },
  );
}

registrarCapturas();