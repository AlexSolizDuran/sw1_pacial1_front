/**
 * Panel global de ayuda (agente SUPPORT).
 * Boton flotante "?" abajo a la derecha, visible en toda la zona
 * post-login. Chat puramente informativo con streaming, sin tocar
 * diagramas. La conversacion vive en el localStorage por usuario.
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import {
  HELP_CONTEXTO_MAX,
  guardarHistorial,
  leerHistorial,
  limpiarHistorial,
  preguntarAyudaStream,
} from "@/lib/help";
import type { HelpHistorialItem, HelpStreamEvent } from "@/types/help";
import { MicButton } from "@/components/common/MicButton";

/** Burbuja visible en el panel (incluye errores de sistema). */
interface Burbuja {
  id: string;
  rol: "user" | "assistant" | "sistema";
  texto: string;
}

/** Convierte una burbuja al formato que persiste y se envia. */
function aHistorial(b: Burbuja): HelpHistorialItem | null {
  if (b.rol === "sistema") return null;
  return {
    rol: b.rol === "user" ? "USER" : "ASSISTANT",
    contenido: b.texto,
  };
}

const SUGERENCIAS = [
  "¿Cómo invito colaboradores a un diagrama?",
  "¿Cómo genero el backend Spring Boot?",
  "¿Qué puede hacer cada rol?",
  "¿Cómo exporto el diagrama a XMI?",
];

/**
 * Panel de ayuda global. Se monta una vez en el layout del dashboard,
 * por lo que el estado se conserva al navegar entre paginas.
 */
export function HelpPanel() {
  const user = useAuthStore((s) => s.user);
  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Burbuja[]>([]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [cargadoPara, setCargadoPara] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Carga la conversacion del usuario actual (una vez por cuenta)
  useEffect(() => {
    if (!abierto || !user || cargadoPara === user.id) return;
    setCargadoPara(user.id);
    const guardados = leerHistorial(user.id);
    setMensajes(
      guardados.map((m, i) => ({
        id: `h-${i}`,
        rol: m.rol === "USER" ? ("user" as const) : ("assistant" as const),
        texto: m.contenido,
      })),
    );
  }, [abierto, user, cargadoPara]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes, cargando, abierto]);

  /** Persiste las burbujas de conversacion en el localStorage del usuario. */
  const persistir = useCallback(
    (burbujas: Burbuja[]) => {
      if (!user) return;
      const historial = burbujas
        .map(aHistorial)
        .filter((m): m is HelpHistorialItem => m !== null);
      guardarHistorial(user.id, historial);
    },
    [user],
  );

  const enviarPregunta = useCallback(
    async (texto: string) => {
      const pregunta = texto.trim();
      if (!pregunta || cargando || !user) return;

      const historialPrevio = mensajes
        .map(aHistorial)
        .filter((m): m is HelpHistorialItem => m !== null)
        .slice(-HELP_CONTEXTO_MAX);

      const userBubble: Burbuja = {
        id: `user-${Date.now()}`,
        rol: "user",
        texto: pregunta,
      };
      const aiId = `ai-${Date.now()}`;
      const base = [...mensajes, userBubble];
      setMensajes([...base, { id: aiId, rol: "assistant", texto: "" }]);
      setEntrada("");
      setCargando(true);

      let acumulado = "";
      const onEvent = (ev: HelpStreamEvent) => {
        switch (ev.tipo) {
          case "inicio":
            break;
          case "token":
            acumulado += ev.texto;
            setMensajes((prev) =>
              prev.map((b) =>
                b.id === aiId ? { ...b, texto: acumulado } : b,
              ),
            );
            break;
          case "fin": {
            const final = [...base, { id: aiId, rol: "assistant" as const, texto: ev.texto }];
            setMensajes(final);
            persistir(final);
            break;
          }
          case "error":
            throw new Error(ev.mensaje);
        }
      };

      try {
        await preguntarAyudaStream(
          { pregunta, historial: historialPrevio },
          onEvent,
        );
      } catch (error) {
        const mensaje =
          error instanceof Error ? error.message : "Error desconocido de la ayuda";
        setMensajes((prev) =>
          prev.map((b) =>
            b.id === aiId ? { ...b, rol: "sistema" as const, texto: mensaje } : b,
          ),
        );
      } finally {
        setCargando(false);
      }
    },
    [cargando, mensajes, persistir, user],
  );

  /** Borra la conversacion del usuario actual. */
  const handleLimpiar = useCallback(() => {
    if (!user) return;
    limpiarHistorial(user.id);
    setMensajes([]);
  }, [user]);

  if (!user) return null;

  return (
    <>
      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          title="Ayuda de la plataforma"
          className="fixed right-4 bottom-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-tertiary-container text-xl font-bold text-on-tertiary-container shadow-lg transition-transform hover:scale-105"
        >
          ?
        </button>
      )}

      {abierto && (
        <div className="fixed right-4 bottom-4 z-50 flex h-[70vh] w-96 max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container shadow-xl">
          {/* Cabecera */}
          <div className="flex items-center gap-2 border-b border-outline-variant px-4 py-3">
            <h2 className="font-headline text-base font-semibold text-on-surface">
              Ayuda
            </h2>
            <span className="text-xs text-on-surface-variant">
              Solo uso de la plataforma
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleLimpiar}
              title="Borrar mi conversacion"
              className="rounded-md px-2 py-1 text-xs text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-md bg-surface-container-high px-3 py-1 text-xs text-on-surface hover:bg-surface-container-highest"
            >
              Cerrar
            </button>
          </div>

          {/* Mensajes */}
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-2 overflow-auto p-3"
          >
            {mensajes.length === 0 && !cargando && (
              <div className="space-y-2">
                <p className="text-sm text-on-surface-variant">
                  ¡Hola! Pregúntame cómo usar la plataforma:
                </p>
                {SUGERENCIAS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => void enviarPregunta(s)}
                    className="block w-full rounded-md border border-outline-variant bg-surface px-3 py-2 text-left text-sm text-on-surface hover:bg-surface-container-high"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={`max-w-[90%] rounded-md px-3 py-2 text-sm whitespace-pre-wrap ${
                  m.rol === "user"
                    ? "ml-auto bg-primary-container text-on-primary-container"
                    : m.rol === "sistema"
                      ? "mx-auto bg-error-container text-center text-on-error-container"
                      : "bg-surface-container-high text-on-surface"
                }`}
              >
                {m.texto === "" ? "…" : m.texto}
              </div>
            ))}
          </div>

          {/* Entrada */}
          <form
            className="flex gap-2 border-t border-outline-variant p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void enviarPregunta(entrada);
            }}
          >
            <input
              type="text"
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              placeholder="¿Cómo invito colaboradores?"
              maxLength={1000}
              disabled={cargando}
              className="min-w-0 flex-1 rounded-md border border-outline-variant bg-surface px-3 py-2 text-sm text-on-surface disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={cargando || entrada.trim() === ""}
              className="rounded-md bg-primary-container px-4 py-2 text-sm font-medium text-on-primary-container hover:bg-primary-fixed disabled:opacity-50"
            >
              {cargando ? "…" : "Enviar"}
            </button>
            <MicButton onTranscrito={setEntrada} deshabilitado={cargando} />
          </form>
        </div>
      )}
    </>
  );
}
