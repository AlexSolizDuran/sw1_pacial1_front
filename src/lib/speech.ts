import { API_BASE_URL } from "./api";

/**
 * Transcribe un audio grabado con el microfono del navegador.
 * Envia multipart/form-data al backend (POST /ai/voice-transcribe), que lo
 * reenvia al motor voz->texto (Space de Hugging Face).
 * Usa fetch crudo (no apiFetch) porque se envia FormData y no JSON.
 * @param audio - Blob con el audio (webm/mp4/ogg...) grabado con MediaRecorder
 * @param filename - Nombre de archivo opcional para el campo "file"
 * @returns El texto transcrito por el motor
 * @throws Error con el mensaje del backend si la peticion falla
 */
export async function transcribirAudio(
  audio: Blob,
  filename = "nota.webm",
): Promise<{ text: string }> {
  const formulario = new FormData();
  // Se envuelve el Blob como File para que parta con nombre y mimetype.
  formulario.append("file", new File([audio], filename, { type: audio.type }));

  const res = await fetch(`${API_BASE_URL}/ai/voice-transcribe`, {
    method: "POST",
    credentials: "include",
    body: formulario,
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const message = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message ?? "Error desconocido al transcribir el audio";
    throw new Error(message);
  }

  return (await res.json()) as { text: string };
}