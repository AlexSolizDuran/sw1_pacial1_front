/**
 * Cliente de la API del agente COPILOT y adaptadores DSL canonico <-> UML.
 * El DSL canonico que devuelve el backend usa claves en espanol con valores
 * en ingles (private, class, inheritance...); aca se convierte a las formas
 * UML que consume el editor (UMLField, UMLMethod, UMLNodeData, Node/Edge).
 */
import { apiFetch, API_BASE_URL } from "./api";
import type {
  ChatRequest,
  ChatResponse,
  ChatStreamEvent,
  AiModel,
  AiSession,
  AiMessage,
  CanonicalEntity,
  CanonicalField,
  CanonicalMethod,
  CanonicalRelation,
} from "@/types/ai";
import type {
  DiagramState,
  UMLField,
  UMLMethod,
  UMLNodeData,
  UMLParameter,
  UMLEdgeData,
} from "@/types/diagram";

/** Genera un id unico local (mismo formato que el editor). */
export function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Envia una instruccion completa y devuelve el resultado aplicable.
 * @param payload - Instruccion, snapshot y seleccion
 * @returns Respuesta con texto, acciones y advertencias
 */
export function enviarInstruccion(payload: ChatRequest): Promise<ChatResponse> {
  return apiFetch<ChatResponse>("/ai/chat", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/**
 * Envia una instruccion consumiendo el flujo SSE del backend (streaming).
 * @param payload - Instruccion, snapshot y seleccion
 * @param onEvent - Callback por cada evento { tipo: inicio|token|fin|error }
 * @throws Error con el mensaje del backend si la peticion falla al iniciar
 */
export async function chatearStream(
  payload: ChatRequest,
  onEvent: (evento: ChatStreamEvent) => void,
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/ai/chat/stream`, {
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
      : body.message ?? "Error desconocido de la IA";
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
        onEvent(JSON.parse(data) as ChatStreamEvent);
      }
    }
  }
}

/** Lista los modelos disponibles (GET /ai/models). */
export function listarModelos(): Promise<AiModel[]> {
  return apiFetch<AiModel[]>("/ai/models");
}

/** Lista las sesiones COPILOT del usuario en el diagrama (GET /ai/sessions). */
export function listarSesiones(diagramId: string): Promise<AiSession[]> {
  return apiFetch<AiSession[]>(`/ai/sessions?diagramId=${diagramId}`);
}

/** Crea una sesion COPILOT nueva (POST /ai/sessions). */
export function crearSesion(diagramId: string): Promise<AiSession> {
  return apiFetch<AiSession>("/ai/sessions", {
    method: "POST",
    body: JSON.stringify({ diagramId }),
  });
}

/** Historial de mensajes de una sesion (GET /ai/sessions/:id/messages). */
export function listarMensajes(sessionId: string): Promise<AiMessage[]> {
  return apiFetch<AiMessage[]>(`/ai/sessions/${sessionId}/messages`);
}

// ─────────────────────────── Adaptadores DSL -> UML ───────────────────────────

/** Convierte un atributo canonico a UMLField. */
export function canonicalFieldToUML(f: CanonicalField): UMLField {
  return {
    id: uid("f"),
    visibility: f.visibilidad,
    name: f.nombre,
    type: f.tipo,
    isStatic: f.estatico === true,
    isReadonly: f.readonly === true,
    ...(f.valor ? { defaultValue: f.valor } : {}),
  };
}

/** Convierte un metodo canonico a UMLMethod. */
export function canonicalMethodToUML(m: CanonicalMethod): UMLMethod {
  return {
    id: uid("m"),
    visibility: m.visibilidad,
    name: m.nombre,
    params: (m.params ?? []).map(
      (p): UMLParameter => ({
        id: uid("p"),
        name: p.nombre,
        type: p.tipo,
      }),
    ),
    returnType: m.ret,
    isStatic: m.estatico === true,
    isAbstract: m.abstracto === true,
  };
}

/** Convierte una entidad canonica a UMLNodeData (sin id/posicion). */
export function canonicalEntityToUMLData(e: CanonicalEntity): UMLNodeData {
  const data: UMLNodeData = {
    name: e.nombre,
    fields: (e.atributos ?? []).map(canonicalFieldToUML),
    methods: (e.metodos ?? []).map(canonicalMethodToUML),
  };
  if (e.tipo === "enumeration") {
    data.literals = e.literales ?? [];
  }
  return data;
}

/** Convierte una relacion canonica a los datos de una Edge de React Flow. */
export function canonicalRelationToEdgeData(
  r: CanonicalRelation,
): Partial<UMLEdgeData> {
  return {
    type: r.tipo,
    ...(r.label ? { label: r.label } : {}),
    ...(r.multiplicidadOrigen ? { sourceMultiplicity: r.multiplicidadOrigen } : {}),
    ...(r.multiplicidadDestino ? { targetMultiplicity: r.multiplicidadDestino } : {}),
  };
}

// ─────────────────────────── Snapshot del lienzo ───────────────────────────

/**
 * Construye el DiagramState (reactFlowState) desde nodos/aristas del store.
 * Es la forma que espera el endpoint /ai/chat en el campo "snapshot".
 */
export function snapshotDesdeEstado(
  nodes: Array<{
    id: string;
    type?: string | null;
    position: { x: number; y: number };
    data: unknown;
  }>,
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type?: string | null;
    label?: unknown;
    data?: unknown;
  }>,
): DiagramState {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "class",
      position: n.position,
      data: n.data as unknown as DiagramState["nodes"][number]["data"],
    })),
    edges: edges.map((e) => {
      const edgeData = (e.data ?? {}) as Partial<UMLEdgeData>;
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type ?? "association",
        label: typeof e.label === "string" ? e.label : edgeData.label,
        sourceMultiplicity: edgeData.sourceMultiplicity,
        targetMultiplicity: edgeData.targetMultiplicity,
      };
    }),
  };
}