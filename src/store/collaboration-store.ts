"use client";

import { create } from "zustand";
import * as Y from "yjs";
import {
  collaborationClient,
  toUint8Array,
  type CollabPeer,
} from "@/lib/collaboration";
import type { CollaboratorRole } from "@/types";

/**
 * Estado global de la sesion colaborativa de un diagrama.
 *
 * El lienzo vive SOLO en el Y.Doc compartido (nodos y aristas). Este store:
 * - Conecta al gateway Socket.IO y se une a la sala del diagrama.
 * - Aplica los updates remotos al Y.Doc (origin "remote") y difunde al relay
 *   los cambios locales (origin distinto) para alcanzar a los demas peers.
 * - Notifica al editor-store cada vez que el Y.Doc cambia (local o remoto)
 *   para que reconstruya nodos/aristas en React Flow (N integrantes).
 * - Maneja bloqueo de elementos via awareness (CU-2.5).
 */

/** Origen con el que se marcan los updates aplicados desde el socket. */
const REMOTE_ORIGIN = "remote";

/** Callback que notifica al editor cuando el Y.Doc cambia (poblar lienzo). */
let onDiagramChange: (() => void) | null = null;

/** Callback que notifica cuando cambia el estado de locks. */
let onLocksChange: (() => void) | null = null;

/** Tipo de cada elemento lockeado: { userId, userName }. */
export interface LockInfo {
  userId: string;
  userName: string;
}

interface CollaborationState {
  /** Socket conectado y dentro de una sala. */
  connected: boolean;
  /** Id del diagrama de la sesion activa. */
  diagramId: string | null;
  /** Documento Yjs compartido (fuente de verdad del lienzo). */
  doc: Y.Doc | null;
  /** Peers (otros usuarios) conectados a la misma sala. */
  peers: CollabPeer[];
  /** Rol del usuario autenticado en el diagrama (del join). */
  role: CollaboratorRole | null;
  /** Id del usuario autenticado (para distinguir locks propios). */
  userId: string | null;
  /** Nombre del usuario autenticado. */
  userName: string | null;
  /** Mapa de elementos bloqueados: elementId -> { userId, userName }. */
  lockedElements: Record<string, LockInfo>;
  /** Se une a la sala de un diagrama y procesa el snapshot inicial. */
  join: (diagramId: string) => Promise<void>;
  /** Sale de la sala y cierra la conexion. */
  leave: () => void;
  /** Registra los handlers del socket y observa el Y.Doc. */
  setup: (onDiagramChange: () => void, onLocksChange?: () => void) => void;
  /** Escribe nodos y aristas en el Y.Doc (convierte React Flow -> Yjs). */
  publishDiagram: (nodes: unknown[], edges: unknown[]) => void;
  /** Serializa el Y.Doc actual a nodos y aristas (Yjs -> React Flow). */
  readDiagram: () => { nodes: unknown[]; edges: unknown[] };
  // ─── Bloqueo de elementos (CU-2.5) ──────────────────────────────────
  /** Bloquea un elemento para el usuario actual. */
  acquireLock: (elementId: string) => void;
  /** Libera el bloqueo de un elemento. */
  releaseLock: (elementId: string) => void;
  /** Libera todos los locks del usuario actual. */
  releaseAllLocks: () => void;
  /** Verifica si un elemento esta bloqueado por OTRO usuario. */
  isLocked: (elementId: string) => { locked: boolean; lockedBy?: string };
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  connected: false,
  diagramId: null,
  doc: null,
  peers: [],
  role: null,
  userId: null,
  userName: null,
  lockedElements: {},

  setup: (onChange, onLocks) => {
    onDiagramChange = onChange;
    onLocksChange = onLocks ?? null;

    collaborationClient.connect({
      onUpdate: (update) => {
        const doc = get().doc;
        if (!doc) return;
        Y.applyUpdate(doc, update, REMOTE_ORIGIN);
      },
      onPeerJoined: (peer) => {
        set((s) => ({
          peers: s.peers.some((p) => p.userId === peer.userId)
            ? s.peers.map((p) => (p.userId === peer.userId ? peer : p))
            : [...s.peers, peer],
        }));
      },
      onPeerLeft: (userId) => {
        set((s) => ({ peers: s.peers.filter((p) => p.userId !== userId) }));
      },
      onDisconnect: () => {
        set({ connected: false, peers: [], lockedElements: {} });
      },
      onAwarenessChange: () => {
        const locks = collaborationClient.getLockedElements();
        set({ lockedElements: locks });
        onLocksChange?.();
      },
    });
  },

  join: (diagramId) =>
    new Promise<void>((resolve) => {
      collaborationClient.joinRoom(diagramId, (result) => {
        const doc = new Y.Doc();
        // El snapshot llega como ArrayBuffer (ack de Socket.IO en el navegador);
        // Yjs necesita Uint8Array, de lo contrario no se aplica y el lienzo
        // queda vacio (no se visualiza el diagrama).
        const snapshot = toUint8Array(result?.update);
        if (snapshot && snapshot.length) {
          Y.applyUpdate(doc, snapshot, REMOTE_ORIGIN);
        }

        // Registra el id del usuario local para que el awareness distinga
        // los locks propios de los ajenos y pueda liberar los suyos.
        if (result?.userId) {
          collaborationClient.setMyUserId(result.userId);
        }

        doc.on("update", (update: Uint8Array, origin: unknown) => {
          // Los cambios locales ya fueron aplicados por el editor-store al
          // escribir en el Y.Doc; solo se difunden al relay para los demas.
          if (origin !== REMOTE_ORIGIN) {
            const current = get().diagramId;
            if (current) {
              collaborationClient.sendUpdate(current, update);
            }
            return;
          }
          // Un cambio llego de otro usuario: reconstruye el lienzo local.
          // (Evita re-setState en cada update local, que reintroduce la
          // re-medicion de React Flow y causa el loop de update depth.)
          onDiagramChange?.();
        });

        set({
          diagramId,
          doc,
          connected: true,
          role: result?.role ?? null,
          userId: result?.userId ?? null,
          userName: result?.userName ?? null,
        });
        resolve();
      });
    }),

  publishDiagram: (nodes, edges) => {
    const doc = get().doc;
    if (!doc) return;

    doc.transact(() => {
      const map = doc.getMap<unknown>("canvas");
      map.set("nodes", nodes);
      map.set("edges", edges);
    });
  },

  readDiagram: () => {
    const doc = get().doc;
    if (!doc) {
      return { nodes: [], edges: [] };
    }
    const map = doc.getMap<unknown>("canvas");
    return {
      nodes: (map.get("nodes") as unknown[]) ?? [],
      edges: (map.get("edges") as unknown[]) ?? [],
    };
  },

  // ─── Bloqueo de elementos (CU-2.5) ──────────────────────────────────

  acquireLock: (elementId) => {
    const { userId, userName } = get();
    if (!userId || !userName) return;
    // Verifica que no este bloqueado por otro
    const { locked } = get().isLocked(elementId);
    if (locked) return;
    collaborationClient.lockElement(elementId, userId, userName);
    // Actualiza el mapa local
    set((s) => ({
      lockedElements: { ...s.lockedElements, [elementId]: { userId, userName } },
    }));
  },

  releaseLock: (elementId) => {
    collaborationClient.unlockElement(elementId);
    set((s) => {
      const next = { ...s.lockedElements };
      delete next[elementId];
      return { lockedElements: next };
    });
  },

  releaseAllLocks: () => {
    collaborationClient.unlockAll();
    // Reconstruye el mapa desde el cliente: conserva los locks remotos,
    // solo elimina los propios.
    set({ lockedElements: collaborationClient.getLockedElements() });
  },

  isLocked: (elementId) => {
    const { lockedElements, userId } = get();
    const lock = lockedElements[elementId];
    if (!lock) return { locked: false };
    if (lock.userId === userId) return { locked: false }; // propio
    return { locked: true, lockedBy: lock.userName };
  },

  leave: () => {
    collaborationClient.disconnect();
    set({
      connected: false,
      diagramId: null,
      doc: null,
      peers: [],
      role: null,
      userId: null,
      userName: null,
      lockedElements: {},
    });
  },
}));
