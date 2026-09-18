/**
 * Tipos del agente SUPPORT (ayuda de uso).
 * Espejan el contrato del backend NestJS (POST /ai/support/chat y
 * /ai/support/chat/stream): solo texto informativo, sin acciones.
 */

/** Mensaje previo de la conversacion (vive en el localStorage del front). */
export interface HelpHistorialItem {
  rol: "USER" | "ASSISTANT";
  contenido: string;
}

/** Cuerpo de POST /ai/support/chat. */
export interface HelpRequest {
  pregunta: string;
  /** Ultimos mensajes como contexto (maximo 12). */
  historial?: HelpHistorialItem[];
}

/** Respuesta completa de POST /ai/support/chat. */
export interface HelpResponse {
  texto: string;
  modelo: string;
}

/** Evento del stream SSE de POST /ai/support/chat/stream. */
export type HelpStreamEvent =
  | { tipo: "inicio"; modelo: string }
  | { tipo: "token"; texto: string }
  | { tipo: "fin"; texto: string }
  | { tipo: "error"; mensaje: string };
