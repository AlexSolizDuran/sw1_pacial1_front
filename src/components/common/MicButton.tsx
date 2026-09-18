/**
 * Boton de microfono para los chats (Soporte y Copilot).
 * Graba audio con MediaRecorder, lo transcribe con el motor voz->texto del
 * backend y entrega el texto via onTranscrito; NO envia la pregunta.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { transcribirAudio } from "@/lib/speech";

/** Duracion maxima de grabacion (segundos): evita audios largos y lentos. */
const MAX_SEGUNDOS = 60;

/** Estado interno del boton de grabacion. */
type Estado =
  | "idle" // listo para grabar
  | "grabando" // capturando audio ahora mismo
  | "transcribiendo"; // enviando al servidor y esperando texto

interface Props {
  /** Recibe el texto transcrito para llenar el input del chat. */
  onTranscrito: (texto: string) => void;
  /** Deshabilita el boton mientras el chat esta ocupado (enviando). */
  deshabilitado?: boolean;
}

/**
 * Componente reutilizable: graba con el microfono del navegador y transcribe.
 */
export function MicButton({ onTranscrito, deshabilitado = false }: Props) {
  const [estado, setEstado] = useState<Estado>("idle");
  const [error, setError] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const abandonadoRef = useRef(false);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Muestra un error temporal y lo oculta tras unos segundos. */
  const mostrarError = (mensaje: string) => {
    setError(mensaje);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => setError(null), 5000);
  };

  // Limpia el microfono y el timer si el componente se desmonta a mitad de
  // la grabacion (p.ej. el chat se cierra mientras se graba).
  // Se resetea al montar: en dev, StrictMode corre montaje->cleanup->montaje
  // y el cleanup de la simulacion no debe dejar el guardado como desmontado.
  useEffect(() => {
    abandonadoRef.current = false;
    return () => {
      abandonadoRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, []);

  const limpiarStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    mediaRef.current = null;
  };

  const comenzarGrabacion = async () => {
    setError(null);
    setEstado("grabando");
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (abandonadoRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        setEstado("idle");
        return;
      }
      streamRef.current = stream;

      // Prefiere webm/opus (soportado por Chrome/Firefox); si el browser no
      // soporta mime explicito, MediaRecorder elige el formato por defecto.
      const tipo = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";
      const recorder = new MediaRecorder(stream, tipo ? { mimeType: tipo } : {});
      mediaRef.current = recorder;
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => void transcribir(recorder.mimeType);
      recorder.onerror = () => {
        setEstado("idle");
        mostrarError("No se pudo grabar el audio con el microfono.");
        limpiarStream();
      };

      recorder.start();
      // Tope de grabacion: detiene y transcribe lo capturado hasta ahora.
      setTimeout(() => {
        if (recorder.state === "recording") recorder.stop();
      }, MAX_SEGUNDOS * 1000);
    } catch (err) {
      setEstado("idle");
      mostrarError(mensajeErrorMicrofono(err));
    }
  };

  const detenerGrabacion = () => {
    const recorder = mediaRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  /** Envia el audio grabado al backend y entrega el texto al chat. */
  const transcribir = async (mimeType: string) => {
    const chunks = chunksRef.current;
    limpiarStream();
    if (chunks.length === 0) {
      setEstado("idle");
      mostrarError("No se capturo audio. Intenta de nuevo.");
      return;
    }
    setEstado("transcribiendo");
    try {
      const blob = new Blob(chunks, { type: mimeType });
      const { text } = await transcribirAudio(blob);
      if (text.trim()) onTranscrito(text.trim());
    } catch (err) {
      mostrarError(
        err instanceof Error ? err.message : "Error al transcribir el audio.",
      );
    } finally {
      setEstado("idle");
    }
  };

  const activo = estado === "grabando" || estado === "transcribiendo";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (estado === "grabando") detenerGrabacion();
          else void comenzarGrabacion();
        }}
        disabled={deshabilitado || (activo && estado !== "grabando")}
        title={estado === "grabando" ? "Detener y transcribir" : "Grabar con el microfono"}
        className={`flex h-9 shrink-0 items-center justify-center rounded-md border border-outline-variant bg-surface-container-high px-2.5 text-on-surface transition-colors hover:bg-surface-container-highest disabled:opacity-40 ${
          estado === "grabando"
            ? "bg-error-container text-on-error-container hover:bg-error-container"
            : ""
        }`}
      >
        {estado === "grabando" && (
          <span className="mr-1 inline-block h-2 w-2 animate-pulse rounded-full bg-error" />
        )}
        {estado === "transcribiendo" ? (
          <span className="animate-pulse">…</span>
        ) : (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <path d="M12 19v4" />
          </svg>
        )}
      </button>
      {error && (
        <p role="status" className="shrink-0 text-[11px] text-error">
          {error}
        </p>
      )}
    </>
  );
}

/** Traduce los errores comunes de getUserMedia a mensajes claros. */
function mensajeErrorMicrofono(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
        return "Permiso de microfono denegado. Habilitalo en el navegador.";
      case "NotFoundError":
        return "No se encontro ningun microfono conectado.";
      case "NotReadableError":
        return "El microfono esta siendo usado por otra aplicacion.";
    }
  }
  return "No se pudo acceder al microfono.";
}