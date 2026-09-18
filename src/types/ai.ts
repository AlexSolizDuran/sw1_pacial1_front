/**
 * Tipos del agente COPILOT (IA) para el editor.
 * Espejan el DSL canonico definido en el backend (backend/src/modules/ai/dsl)
 * para construir/cargar peticiones y aplicar las acciones en el lienzo.
 */
import type {
  UMLEdgeType,
  UMLNodeType,
  UMLVisibility,
  DiagramState,
} from "./diagram";

/** Tipos rechazados por la API (mismos valores enumerados del DSL). */
export type AiEntidadTipo = UMLNodeType;
export type AiTipoRelacion = UMLEdgeType;
export type AiVisibilidad = UMLVisibility;

/** Atributo canonico devuelto/modelado por la IA. */
export interface CanonicalField {
  visibilidad: AiVisibilidad;
  nombre: string;
  tipo: string;
  estatico?: true;
  readonly?: true;
  valor?: string;
}

/** Parametro de un metodo canonico. */
export interface CanonicalParam {
  nombre: string;
  tipo: string;
}

/** Metodo canonico devuelto/modelado por la IA. */
export interface CanonicalMethod {
  visibilidad: AiVisibilidad;
  nombre: string;
  params: CanonicalParam[];
  ret: string;
  estatico?: true;
  abstracto?: true;
}

/** Entidad canonica (clase, interfaz, abstracta o enumeracion). */
export interface CanonicalEntity {
  id: string;
  tipo: AiEntidadTipo;
  nombre: string;
  atributos: CanonicalField[];
  metodos: CanonicalMethod[];
  literales?: string[];
}

/** Relacion canonica entre dos entidades. */
export interface CanonicalRelation {
  id: string;
  tipo: AiTipoRelacion;
  origen: string;
  destino: string;
  label?: string;
  multiplicidadOrigen?: string;
  multiplicidadDestino?: string;
}

/**
 * Acciones que el backend devuelve para aplicar en el lienzo.
 * Los ids de entidades/relaciones EXISTENTES ya estan resueltos al id real de
 * React Flow; los de entidades NUEVAS son canonicos (n11...) y el frontend los
 * mapea al id real generado al aplicar.
 */
export type DiagramAction =
  | {
      tipo: "createEntidad";
      descripcion: string;
      entidad: CanonicalEntity;
    }
  | {
      tipo: "updateEntidad";
      descripcion: string;
      id: string;
      entidad: CanonicalEntity;
    }
  | { tipo: "deleteEntidad"; descripcion: string; id: string }
  | {
      tipo: "createRelacion";
      descripcion: string;
      relacion: CanonicalRelation;
    }
  | {
      tipo: "updateRelacion";
      descripcion: string;
      id: string;
      relacion: CanonicalRelation;
    }
  | { tipo: "deleteRelacion"; descripcion: string; id: string };

/** Cuerpo de POST /ai/chat. */
export interface ChatRequest {
  diagramId: string;
  sessionId?: string;
  instruccion: string;
  modo?: "agregar" | "reemplazar";
  /** Enviar contexto de los últimos mensajes de la sesión (default true). */
  conContexto?: boolean;
  modelo?: string;
  params?: { temperatura?: number; topP?: number; maxTokens?: number };
  /** Estado observable del lienzo al momento del envio. */
  snapshot: DiagramState;
  seleccionId?: string;
  seleccionKind?: "entidad" | "relacion";
  seleccionREstrictiva?: boolean;
}

/** Respuesta completa de POST /ai/chat. */
export interface ChatResponse {
  sessionId: string;
  mensajeId: string | null;
  texto: string;
  acciones: DiagramAction[];
  advertencias: string[];
  rol: "OWNER" | "EDITOR" | "VIEWER" | null;
  puedeAplicar: boolean;
  cache: boolean;
  modelo: string;
}

/** Respuesta de POST /ai/diagram-from-image (importar un diagrama por imagen). */
export interface ImportarImagenResponse {
  /** Acciones aplicables al lienzo (ids existentes ya resueltos). */
  acciones: DiagramAction[];
  /** Avisos de lo que se descarto (ej. relacion con entidad inexistente). */
  advertencias: string[];
}

/** Evento del stream SSE de POST /ai/chat/stream. */
export type ChatStreamEvent =
  | {
      tipo: "inicio";
      sessionId: string;
      rol: ChatResponse["rol"];
      puedeAplicar: boolean;
      cache: boolean;
      modelo: string;
    }
  | { tipo: "token"; texto: string }
  | {
      tipo: "fin";
      texto: string;
      acciones: DiagramAction[];
      advertencias: string[];
      mensajeId: string | null;
    }
  | { tipo: "error"; mensaje: string };

/** Modelo visible en el selector del chat (GET /ai/models). */
export interface AiModel {
  id: string;
  nombre: string;
  contextoMax: number;
  soportaDesdeCero: boolean;
  /** False si el modelo no tiene Space configurado en el backend. */
  disponible: boolean;
}

/** Sesion de chat listada (GET /ai/sessions). */
export interface AiSession {
  id: string;
  agentType: string;
  startedAt: string;
  mensajes: number;
}

/** Mensaje del historial de una sesion. */
export interface AiMessage {
  id: string;
  rol: "USER" | "ASSISTANT" | "TOOL";
  toolName: string | null;
  contenido: string;
  createdAt: string;
}