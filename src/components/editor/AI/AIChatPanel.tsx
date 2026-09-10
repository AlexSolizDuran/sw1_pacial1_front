"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { useCollaboratorsStore } from "@/store/collaborators-store";
import {
  chatearStream,
  listarModelos,
  listarSesiones,
  listarMensajes,
  snapshotDesdeEstado,
} from "@/lib/ai";
import type {
  AiMessage,
  AiModel,
  ChatStreamEvent,
  DiagramAction,
} from "@/types/ai";
import type { ChatRequest } from "@/types/ai";

/** Burbuja de mensaje usada en la interfaz del chat. */
interface Burbuja {
  id: string;
  rol: "user" | "assistant" | "sistema";
  texto: string;
  advertencias?: string[];
  /** True si en modo Build los cambios ya se aplicaron al lienzo. */
  aplicado?: boolean;
}

const SUGERENCIAS = [
  "Crea una clase Autenticacion con usuario y contrasena",
  "Convierte la clase seleccionada en una enumeracion",
  "Agrega una relacion de composicion entre las entidades",
];

/**
 * Panel de chat con el agente COPILOT.
 * Boton flotante abajo a la izquierda que despliega/oculta el panel
 * (menu desplegable). Permite streaming del asistente, selector de modelo,
 * modo agregar/reemplazar, filtro por seleccion y vista previa de cambios
 * con botones Aplicar/Descartar.
 */
export function AIChatPanel() {
  const diagramId = useEditorStore((s) => s.diagramId);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const selectedId = useEditorStore((s) => s.selectedId);
  const applyDiagramActions = useEditorStore((s) => s.applyDiagramActions);
  const myRole = useCollaboratorsStore((s) => s.myRole);

  const [abierto, setAbierto] = useState(false);
  const [mensajes, setMensajes] = useState<Burbuja[]>([]);
  const [entrada, setEntrada] = useState("");
  const [cargando, setCargando] = useState(false);
  const [modelos, setModelos] = useState<AiModel[]>([]);
  const [modelo, setModelo] = useState("");
  const [modo, setModo] = useState<"agregar" | "reemplazar">("agregar");
  const [ejecucion, setEjecucion] = useState<"plan" | "build">("build");
  const [alcance, setAlcance] = useState<"todo" | "seleccion">("todo");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    acciones: DiagramAction[];
    puedeAplicar: boolean;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const historyLoaded = useRef(false);

  // Determina si la seleccion actual es una entidad o una relacion
  const nodeSel = nodes.find((n) => n.id === selectedId);
  const edgeSel = edges.find((e) => e.id === selectedId);
  const seleccionKind = nodeSel ? "entidad" : edgeSel ? "relacion" : undefined;
  const seleccionEtiqueta = nodeSel
    ? (nodeSel.data as { name?: string })?.name ?? "Entidad"
    : edgeSel
      ? (edgeSel.data as { label?: string })?.label ?? "Relacion"
      : undefined;

  const puedeEditar = myRole !== "VIEWER";
  const soloSeleccion = alcance === "seleccion" && Boolean(seleccionKind);

  useEffect(() => {
    if (!abierto) return;
    listarModelos()
      .then((m) => {
        setModelos(m);
        if (m.length > 0) setModelo((actual) => actual || m[0].id);
      })
      .catch(() => {});
  }, [abierto]);

  // Restaura el historial de la sesion mas reciente del diagrama
  useEffect(() => {
    if (!abierto || historyLoaded.current) return;
    historyLoaded.current = true;
    listarSesiones(diagramId)
      .then((sesiones) => {
        const sesion = sesiones.find((s) => s.mensajes > 0);
        if (!sesion) return;
        setSessionId(sesion.id);
        return listarMensajes(sesion.id).then((msgs) => {
          const burbujas: Burbuja[] = msgs
            .filter((m) => m.rol !== "TOOL")
            .map((m: AiMessage) => ({
              id: m.id,
              rol:
                m.rol === "USER"
                  ? "user"
                  : m.rol === "ASSISTANT"
                    ? "assistant"
                    : "sistema",
              texto: m.contenido,
            }));
          setMensajes(burbujas);
        });
      })
      .catch(() => {});
  }, [abierto, diagramId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [mensajes, preview, cargando]);

  const actualizarBurbuja = useCallback((id: string, patch: Partial<Burbuja>) => {
    setMensajes((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  }, []);

  const manejarEnvio = useCallback(async () => {
    const instruccion = entrada.trim();
    if (!instruccion || cargando) return;

    const snapshot = snapshotDesdeEstado(nodes, edges);
    const payload: ChatRequest = {
      diagramId,
      sessionId: sessionId ?? undefined,
      instruccion,
      modo,
      ...(modelo ? { modelo } : {}),
      snapshot,
      ...(soloSeleccion && seleccionKind && selectedId
        ? { seleccionId: selectedId, seleccionKind }
        : {}),
    };

    const userBubble: Burbuja = {
      id: `user-${Date.now()}`,
      rol: "user",
      texto: instruccion,
    };
    const aiBubbleId = `ai-${Date.now()}`;
    const aiBubble: Burbuja = { id: aiBubbleId, rol: "assistant", texto: "" };

    setMensajes((prev) => [...prev, userBubble, aiBubble]);
    setEntrada("");
    setCargando(true);
    setPreview(null);

    let acumulado = "";

    const onEvent = (ev: ChatStreamEvent) => {
      switch (ev.tipo) {
        case "inicio":
          setSessionId(ev.sessionId);
          setPreview({
            acciones: [],
            puedeAplicar: ev.puedeAplicar && puedeEditar,
          });
          break;
        case "token":
          acumulado += ev.texto;
          actualizarBurbuja(aiBubbleId, { texto: acumulado });
          break;
        case "fin":
          {
            const tieneAcciones = ev.acciones.length > 0;
            // Build ejecuta todo; los VIEWER solo pueden planificar
            const aplicado = ejecucion === "build" && tieneAcciones && puedeEditar;
            setMensajes((prev) =>
              prev.map((b) =>
                b.id === aiBubbleId
                  ? {
                      ...b,
                      texto: ev.texto,
                      advertencias: ev.advertencias,
                      ...(aplicado ? { aplicado: true } : {}),
                    }
                  : b,
              ),
            );
            if (aplicado) {
              // Build: ejecuta todo lo pedido sin preguntar (estilo opencode)
              applyDiagramActions(ev.acciones);
              setPreview(null);
            } else {
              // Plan: solo muestra el plan, no ejecuta nada
              setPreview((actual) => ({
                acciones: ev.acciones,
                puedeAplicar:
                  (actual?.puedeAplicar ?? puedeEditar) && puedeEditar,
              }));
            }
          }
          break;
        case "error":
          throw new Error(ev.mensaje);
      }
    };

    try {
      await chatearStream(payload, onEvent);
    } catch (error) {
      const mensaje =
        error instanceof Error ? error.message : "Error desconocido de la IA";
      actualizarBurbuja(aiBubbleId, {
        texto: mensaje,
        rol: "sistema",
      });
      setPreview(null);
    } finally {
      setCargando(false);
    }
  }, [
    entrada,
    cargando,
    nodes,
    edges,
    diagramId,
    sessionId,
    modo,
    modelo,
    ejecucion,
    soloSeleccion,
    seleccionKind,
    selectedId,
    actualizarBurbuja,
    puedeEditar,
    applyDiagramActions,
  ]);

  return (
    <>
      {!abierto && (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          title="Asistente IA"
          className="fixed bottom-4 left-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-on-primary shadow-lg transition-transform hover:scale-105"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {abierto && (
        <div className="fixed bottom-20 left-4 z-40 flex h-[28rem] w-80 flex-col overflow-hidden rounded-xl border border-outline-variant bg-surface-container shadow-2xl">
          {/* Encabezado */}
          <div className="flex items-center gap-2 border-b border-outline-variant bg-surface-container-high px-3 py-2">
            <span className="text-sm font-semibold text-on-surface">
              Asistente IA
            </span>
            <span className="text-[11px] text-on-surface-variant">
              {cargando ? "pensando..." : `${(mensajes.length / 2) | 0} turnos`}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setAbierto(false)}
              title="Cerrar chat"
              className="rounded p-1 text-on-surface-variant transition-colors hover:bg-surface-container-highest"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          {/* Controles (modelo, modo, alcance) */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-outline-variant px-3 py-1.5">
            <select
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              title="Modelo"
              className="rounded border border-outline-variant bg-surface-container-lowest px-1.5 py-1 text-xs text-on-surface focus:outline-none"
            >
              {modelos.length === 0 && <option value="">Sin modelos</option>}
              {modelos.map((m) => (
                <option key={m.id} value={m.id} disabled={!m.disponible}>
                  {m.disponible ? m.nombre : `${m.nombre} (sin URL)`}
                </option>
              ))}
            </select>

            <div className="flex overflow-hidden rounded border border-outline-variant">
              {(
                [
                  ["agregar", "Agregar"],
                  ["reemplazar", "Reemplazar"],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setModo(valor)}
                  title={
                    valor === "agregar"
                      ? "Edita el diagrama actual"
                      : "Genera el diagrama desde cero"
                  }
                  className={`px-1.5 py-1 text-[11px] transition-colors ${
                    modo === valor
                      ? "bg-primary-container text-on-primary-container"
                      : "text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            {/* Plan/Build: como opencode. Build aplica al ejecutar; Plan solo muestra */}
            <div className="flex overflow-hidden rounded border border-outline-variant">
              {(
                [
                  ["plan", "Plan"],
                  ["build", "Build"],
                ] as const
              ).map(([valor, etiqueta]) => (
                <button
                  key={valor}
                  type="button"
                  onClick={() => setEjecucion(valor)}
                  title={
                    valor === "plan"
                      ? "Solo muestra el plan: no modifica el lienzo"
                      : "Ejecuta directamente todo lo que se le pide"
                  }
                  className={`px-1.5 py-1 text-[11px] transition-colors ${
                    ejecucion === valor
                      ? "bg-secondary-container text-on-secondary-container"
                      : "text-on-surface-variant hover:bg-surface-container-highest"
                  }`}
                >
                  {etiqueta}
                </button>
              ))}
            </div>

            <label
              className={`flex items-center gap-1 text-[11px] ${
                seleccionKind ? "" : "opacity-50"
              }`}
              title={
                seleccionKind
                  ? `Solo trabajar sobre: ${seleccionEtiqueta}`
                  : "Selecciona una entidad o relacion para acotar"
              }
            >
              <input
                type="checkbox"
                checked={alcance === "seleccion"}
                disabled={!seleccionKind}
                onChange={(e) =>
                  setAlcance(e.target.checked ? "seleccion" : "todo")
                }
                className="h-3 w-3 accent-primary"
              />
              <span className="text-on-surface-variant">
                {seleccionEtiqueta
                  ? `Solo: ${seleccionEtiqueta}`
                  : "Solo selección"}
              </span>
            </label>
          </div>

          {/* Mensajes */}
          <div
            ref={scrollRef}
            className="flex-1 space-y-2 overflow-y-auto px-3 py-2"
          >
            {mensajes.length === 0 && !cargando && (
              <div className="flex h-full flex-col items-start justify-center gap-1.5">
                <p className="text-xs text-on-surface-variant">
                  Pedile cambios al diagrama:
                </p>
                {SUGERENCIAS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    onClick={() => setEntrada(sug)}
                    className="rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1 text-left text-[11px] text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            )}

            {mensajes.map((b) => (
              <div key={b.id}>
                <div
                  className={`max-w-[88%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-xs ${
                    b.rol === "user"
                      ? "ml-auto bg-secondary-container text-on-secondary-container"
                      : b.rol === "sistema"
                        ? "bg-error-container text-on-error-container"
                        : "bg-surface-container-high text-on-surface"
                  }`}
                >
                  {b.texto || (cargando && b.rol === "assistant" ? "…" : "")}
                </div>
                {b.advertencias && b.advertencias.length > 0 && (
<div className="mt-1 space-y-0.5">
                  {b.advertencias.map((w, i) => (
                    <p
                      key={i}
                      className="rounded bg-tertiary-container px-2 py-1 text-[10px] text-on-tertiary-container"
                    >
                      {w}
                    </p>
                  ))}
                </div>
                )}
                {b.aplicado && (
                  <p className="mt-1 rounded bg-secondary-container px-2 py-1 text-[10px] font-medium text-on-secondary-container">
                    Cambios aplicados al lienzo (reversible desde Versiones)
                  </p>
                )}
              </div>
            ))}

            {/* Vista previa (solo en modo Plan: no ejecuta nada) */}
            {preview && preview.acciones.length > 0 && (
              <div className="rounded-lg border border-primary bg-surface-container-lowest p-2">
                <p className="mb-1 text-[11px] font-medium text-on-surface">
                  Plan propuesto
                </p>
                <ul className="mb-2 max-h-28 space-y-0.5 overflow-y-auto">
                  {preview.acciones.map((a, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-1 text-[11px] text-on-surface-variant"
                    >
                      <span className="font-mono text-[9px]">
                        {etiquetaAccion(a)}
                      </span>
                      {a.descripcion}
                    </li>
                  ))}
                </ul>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreview(null)}
                    className="flex-1 rounded bg-surface-container-high px-2 py-1 text-[11px] font-medium text-on-surface transition-colors hover:bg-surface-container-highest"
                  >
                    Descartar
                  </button>
                  <span className="text-[10px] text-on-surface-variant">
                    Cambia a Build para ejecutar
                  </span>
                </div>
              </div>
            )}

            {cargando && !preview && (
              <div className="text-[11px] text-on-surface-variant">
                La IA está generando el diagrama…
              </div>
            )}
          </div>

          {/* Entrada */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void manejarEnvio();
            }}
            className="flex items-end gap-1.5 border-t border-outline-variant px-3 py-2"
          >
            <textarea
              value={entrada}
              onChange={(e) => setEntrada(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void manejarEnvio();
                }
              }}
              rows={2}
              placeholder="Describe el cambio…"
              className="max-h-24 min-h-[2.5rem] flex-1 resize-none rounded-md border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none"
            />
            <button
              type="submit"
              disabled={!entrada.trim() || cargando}
              title="Enviar"
              className="rounded-md bg-primary px-2.5 py-2 text-on-primary transition-colors hover:bg-primary-fixed disabled:opacity-40"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}

/** Etiqueta corta para cada tipo de accion de la vista previa. */
function etiquetaAccion(accion: DiagramAction): string {
  switch (accion.tipo) {
    case "createEntidad":
      return "AGREGAR";
    case "updateEntidad":
      return "EDITAR";
    case "deleteEntidad":
      return "ELIMINAR";
    case "createRelacion":
      return "CONECTAR";
    case "updateRelacion":
      return "EDITAR ↕";
    case "deleteRelacion":
      return "ELIMINAR ↕";
  }
}