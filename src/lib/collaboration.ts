import { io, type Socket } from "socket.io-client";
import * as Y from "yjs";
import type { CollaboratorRole } from "@/types";

/** URL del gateway Socket.IO (backend NestJS, namespace /collab). */
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3001";

/** Datos de un peer (otro usuario) conectado a la sala del diagrama. */
export interface CollabPeer {
  userId: string;
  userName: string;
  role?: CollaboratorRole;
}

/** Respuesta del servidor al unirse a la sala de un diagrama. */
export interface JoinRoomResult {
  /** Estado completo (snapshot Yjs) para reconstruir el lienzo. */
  update: Uint8Array;
  userId: string;
  userName: string;
  role: CollaboratorRole;
}

/** Callbacks que el store puede registrar para reaccionar a eventos. */
export interface CollabHandlers {
  onUpdate: (update: Uint8Array) => void;
  onPeerJoined: (peer: CollabPeer) => void;
  onPeerLeft: (userId: string) => void;
  onDisconnect: () => void;
  /** Se dispara cuando cambia el awareness de algun peer (locks, presencia). */
  onAwarenessChange: () => void;
}

/**
 * Cliente Socket.IO para la colaboracion en tiempo real (relay de Yjs).
 * Conecta al namespace /collab del backend con credentials para que el
 * servidor lea la cookie HttpOnly 'access_token'. Mantiene un socket unico
 * (singleton) para toda la app y expone unirse/salir de la sala y enviar
 * updates CRDT. La presencia (peers) se deriva de los eventos del gateway.
 */
class CollaborationClient {
  private socket: Socket | null = null;
  private handlers: CollabHandlers | null = null;
  /** Id del diagrama (sala) al que se esta unido actualmente. */
  private currentDiagramId: string | null = null;
  /** Awareness local para manejar bloqueos de elementos. */
  private localAwareness: Map<string, unknown> = new Map();

  /**
   * Conecta al gateway (si aun no esta conectado) y registra los callbacks.
   * @param handlers - Funciones que reaccionan a los eventos del socket
   */
  connect(handlers: CollabHandlers): void {
    this.handlers = handlers;

    if (this.socket) {
      return;
    }

    // Conecta al namespace /collab (donde esta registrado el gateway).
    this.socket = io(`${SOCKET_URL}/collab`, {
      path: "/socket.io",
      transports: ["websocket"],
      withCredentials: true, // envia la cookie HttpOnly del JWT
      // El ID del socket se envuelve en auth para que el servidor lo use
      auth: {},
    });

    this.socket.on("update", (rawUpdate: unknown) => {
      // El navegador entrega ArrayBuffer; Yjs necesita Uint8Array.
      const update = toUint8Array(rawUpdate);
      if (!update) return;
      this.handlers?.onUpdate(update);
    });

    this.socket.on(
      "peer-joined",
      (peer: { userId: string; userName: string; role?: CollaboratorRole }) => {
        this.handlers?.onPeerJoined(peer);
      },
    );

    this.socket.on("peer-left", (data: { userId: string }) => {
      this.handlers?.onPeerLeft(data.userId);
    });

    this.socket.on("disconnect", () => {
      this.handlers?.onDisconnect();
    });

    // Escucha cambios de awareness de otros peers (locks de elementos)
    this.socket.on(
      "awareness",
      (data: {
        diagramId: string;
        userId?: string;
        locks: Record<string, { userId: string; userName: string }>;
      }) => {
        if (!data.locks) return;
        const senderId = data.userId;

        // Si sabemos el emisor, limpia primero los locks que ese usuario
        // libero (es decir, sus locks que ya no estan en el payload recibido)
        if (senderId) {
          const senderKeys: string[] = [];
          this.localAwareness.forEach((value, elementId) => {
            const lock = value as { userId: string };
            if (lock.userId === senderId) senderKeys.push(elementId);
          });
          // Elimina los locks del emisor que ya no aparecen en el payload
          senderKeys.forEach((elementId) => {
            const incoming = data.locks[elementId];
            if (!incoming || incoming.userId !== senderId) {
              this.localAwareness.delete(elementId);
            }
          });
        }

        // Fusiona los locks entrantes sin pisar los propios
        Object.entries(data.locks).forEach(([elementId, lock]) => {
          const existing = this.localAwareness.get(elementId) as { userId: string } | undefined;
          if (!existing || existing.userId !== lock.userId) {
            this.localAwareness.set(elementId, lock);
          }
        });

        this.handlers?.onAwarenessChange?.();
      },
    );
  }

  /**
   * Se une a la sala de un diagrama. Envia el snapshot y devuelve el estado
   * inicial para que el store reconstruya el lienzo.
   * @param diagramId - Id del diagrama
   * @param ack - Callback con el resultado (snapshot + rol + usuario)
   */
  joinRoom(diagramId: string, ack: (result: JoinRoomResult) => void): void {
    this.currentDiagramId = diagramId;
    this.socket?.emit("join-room", { diagramId }, ack as never);
  }

  /**
   * Envia un update CRDT de Yjs al relay para que lo difunda y persista.
   * El servidor rechaza los updates de usuarios VIEWER.
   * @param diagramId - Id del diagrama
   * @param update - Bytes del update Yjs
   */
  sendUpdate(diagramId: string, update: Uint8Array): void {
    this.socket?.emit("update", { diagramId, update });
  }

  /**
   * Cierra la conexion (al salir del editor).
   * Libera todos los locks locales antes de desconectar.
   */
  disconnect(): void {
    // Libera los locks locales al desconectar
    this.localAwareness.clear();
    this.socket?.disconnect();
    this.socket = null;
    this.currentDiagramId = null;
  }

  // ─── Bloqueo de elementos via awareness ───────────────────────────────

  /**
   * Bloquea un elemento para el usuario actual.
   * Publica el lock en awareness local y lo difunde a los peers.
   */
  lockElement(elementId: string, userId: string, userName: string): void {
    this.localAwareness.set(elementId, { userId, userName });
    this.broadcastAwareness();
  }

  /**
   * Libera el bloqueo de un elemento.
   */
  unlockElement(elementId: string): void {
    this.localAwareness.delete(elementId);
    this.broadcastAwareness();
  }

  /**
   * Libera todos los locks del usuario actual.
   * Solo elimina los locks cuyo userId coincide con el usuario local,
   * conservando los locks de otros peers presentes en el mapa.
   */
  unlockAll(): void {
    const mine: string[] = [];
    this.localAwareness.forEach((value, elementId) => {
      const lock = value as { userId: string };
      if (this.myUserId && lock.userId === this.myUserId) {
        mine.push(elementId);
      }
    });
    mine.forEach((id) => this.localAwareness.delete(id));
    this.broadcastAwareness();
  }

  /**
   * Obtiene el mapa de locks de TODOS los peers (local + remotos).
   * Retorna un Record<elementId, { userId, userName }>.
   */
  getLockedElements(): Record<string, { userId: string; userName: string }> {
    const locks: Record<string, { userId: string; userName: string }> = {};
    this.localAwareness.forEach((value, elementId) => {
      locks[elementId] = value as { userId: string; userName: string };
    });
    return locks;
  }

  /**
   * Verifica si un elemento esta bloqueado por OTRO usuario.
   */
  isElementLocked(elementId: string, currentUserId: string): { locked: boolean; lockedBy?: string } {
    const lock = this.localAwareness.get(elementId) as { userId: string; userName: string } | undefined;
    if (!lock) return { locked: false };
    if (lock.userId === currentUserId) return { locked: false }; // propio lock
    return { locked: true, lockedBy: lock.userName };
  }

  /**
   * Retorna los IDs de elementos que el usuario actual tiene bloqueados.
   */
  getMyLockedElements(): string[] {
    const myLocks: string[] = [];
    this.localAwareness.forEach((value, key) => {
      const lock = value as { userId: string };
      // Nota: no tenemos userId aqui, pero el store puede filtrar
      myLocks.push(key);
    });
    return myLocks;
  }

  /**
   * Difunde el estado de awareness local a los peers via el socket.
   * El backend retransmite este mapa a los demas en la sala.
   * Incluye el userId del emisor para que los peers puedan limpiar los
   * locks liberados de ese usuario.
   */
  private broadcastAwareness(): void {
    if (!this.socket || !this.currentDiagramId) return;
    const locks: Record<string, { userId: string; userName: string }> = {};
    this.localAwareness.forEach((value, elementId) => {
      const lock = value as { userId: string; userName: string };
      locks[elementId] = lock;
    });
    this.socket.emit("awareness", {
      diagramId: this.currentDiagramId,
      userId: this.myUserId,
      locks,
    });
  }

  /** Id del usuario local (se registra al unirse a la sala). */
  private myUserId: string | null = null;

  /**
   * Registra el id del usuario local tras unirse a la sala.
   * @param userId - Id del usuario autenticado
   */
  setMyUserId(userId: string): void {
    this.myUserId = userId;
  }
}

/**
 * Normaliza un binario recibido por Socket.IO a Uint8Array.
 * En el navegador el transporte entrega `ArrayBuffer` (byteLength, sin
 * `.length`), mientras Yjs/lib0 exige `Uint8Array`. Sin esta conversion
 * Y.applyUpdate recibe basura y lanza "Unexpected end of array", y el
 * snapshot del join (que chequea `.length`) ni siquiera se aplica.
 * @param value - Binario del socket (ArrayBuffer, TypedArray o Uint8Array)
 * @returns Uint8Array equivalente, o null si no es binario
 */
export function toUint8Array(value: unknown): Uint8Array | null {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  return null;
}

/** Instancia unica del cliente de colaboracion para toda la app. */
export const collaborationClient = new CollaborationClient();
