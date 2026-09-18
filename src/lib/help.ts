/**
 * Cliente del agente SUPPORT y persistencia local de la conversacion.
 * El backend es stateless: la sesion vive en el localStorage del navegador,
 * separada por usuario, y cada peticion manda los ultimos 12 mensajes.
 */
import { apiFetch, API_BASE_URL } from "./api";
import type {
  HelpHistorialItem,
  HelpRequest,
  HelpResponse,
  HelpStreamEvent,
} from "@/types/help";

/** Maximo de mensajes guardados por usuario (se envian los ultimos 12). */
export const HELP_GUARDADOS_MAX = 50;

/** Maximo de mensajes enviados como contexto en cada peticion. */
export const HELP_CONTEXTO_MAX = 12;

/** Clave de localStorage por usuario. */
function clave(userId: string): string {
  return `support-history:${userId}`;
}

/**
 * Envia una pregunta y devuelve la respuesta completa.
 * @param payload - Pregunta + historial
 * @returns Texto de ayuda y modelo usado
 */
export function preguntarAyuda(payload: HelpRequest): Promise<HelpResponse> {
  return apiFetch<HelpResponse>("/ai/support/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Envia una pregunta consumiendo el flujo SSE del backend (streaming).
 * @param payload - Pregunta + historial
 * @param onEvent - Callback por cada evento { tipo: inicio|token|fin|error }
 * @throws Error con el mensaje del backend si la peticion falla al iniciar
 */
export async function preguntarAyudaStream(
  payload: HelpRequest,
  onEvent: (evento: HelpStreamEvent) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/ai/support/chat/stream`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message ?? "Error desconocido de la ayuda";
    throw new Error(message);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // Los eventos vienen separados por \n\n con prefijo "data: "
    let corte: number;
    while ((corte = buffer.indexOf("\n\n")) !== -1) {
      const bloque = buffer.slice(0, corte).trim();
      buffer = buffer.slice(corte + 2);
      const data = bloque.startsWith("data:") ? bloque.slice(5).trim() : bloque;
      if (data) {
        onEvent(JSON.parse(data) as HelpStreamEvent);
      }
    }
  }
}

/**
 * Lee la conversacion guardada de un usuario.
 * @param userId - Id del usuario autenticado
 * @returns Mensajes guardados (o [] si no hay o estan corruptos)
 */
export function leerHistorial(userId: string): HelpHistorialItem[] {
  if (typeof window === "undefined") return [];
  try {
    const crudo = window.localStorage.getItem(clave(userId));
    if (!crudo) return [];
    const parsed: unknown = JSON.parse(crudo);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (m): m is HelpHistorialItem =>
        typeof m === "object" &&
        m !== null &&
        ((m as { rol?: unknown }).rol === "USER" ||
          (m as { rol?: unknown }).rol === "ASSISTANT") &&
        typeof (m as { contenido?: unknown }).contenido === "string",
    );
  } catch {
    return [];
  }
}

/**
 * Guarda la conversacion de un usuario (capada a HELP_GUARDADOS_MAX).
 * @param userId - Id del usuario autenticado
 * @param mensajes - Conversacion completa a guardar
 */
export function guardarHistorial(
  userId: string,
  mensajes: HelpHistorialItem[],
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      clave(userId),
      JSON.stringify(mensajes.slice(-HELP_GUARDADOS_MAX)),
    );
  } catch {
    // localStorage lleno o bloqueado: se ignora sin romper el chat
  }
}

/**
 * Borra la conversacion guardada de un usuario.
 * @param userId - Id del usuario autenticado
 */
export function limpiarHistorial(userId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(clave(userId));
}
