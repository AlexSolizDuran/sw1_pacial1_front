"use client";

import type { Node, Edge } from "@xyflow/react";
import type {
  DiagramState,
  UMLNodeData,
  UMLEdgeData,
} from "@/types/diagram";

/**
 * Versionado automatico de diagramas, SOLO en el navegador (localStorage).
 * No se guarda nada en la base de datos: cada captura es el reactFlowState
 * serializado y la clave es por diagrama (uml.versiones.{diagramId}).
 */
export const LIMITE_VERSIONES = 30;

/** Clave de localStorage por diagrama. */
export function claveVersiones(diagramId: string): string {
  return `uml.versiones.${diagramId}`;
}

/** Version capturada automaticamente ante cualquier cambio del diagrama. */
export interface Version {
  id: string;
  /** Fecha (epoch ms) en que se capturo. */
  fecha: number;
  /** Estado serializado (reactFlowState) al momento de la captura. */
  estado: DiagramState;
}

/**
 * Bandera global para suspender capturas durante operaciones internas
 * (carga inicial y restauracion): no generan versiones por si mismas.
 */
export const flagAutoCaptura = { suspender: false };

/** Genera un id unico local. */
export function uidVersion(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Reduce nodos/aristas del store a un DiagramState (misma forma que el
 * reactFlowState que se envia a la API/DB).
 */
export function toDiagramState(
  nodes: Node[],
  edges: Edge[],
): DiagramState {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type ?? "class",
      position: n.position,
      data: n.data as unknown as DiagramState["nodes"][number]["data"],
    })),
    edges: edges.map((e) => {
      const edgeData = (e.data as unknown as UMLEdgeData) ?? {};
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

/** Firma del estado para dedupicar capturas (esta misma estado no se repite). */
export function firmaDiagrama(nodes: Node[], edges: Edge[]): string {
  return JSON.stringify(toDiagramState(nodes, edges));
}

/** Convierte el estado de una version de vuelta a nodos de React Flow. */
export function diagramStateToNodes(estado: DiagramState): Node[] {
  return (estado.nodes ?? []).map(
    (n) =>
      ({
        id: n.id,
        type: n.type ?? "class",
        position: n.position,
        data: n.data as unknown as UMLNodeData,
      }) as Node,
  );
}

/** Convierte el estado de una version de vuelta a aristas de React Flow. */
export function diagramStateToEdges(estado: DiagramState): Edge[] {
  return (estado.edges ?? []).map(
    (e) =>
      ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type ?? "association",
        label: e.label,
        data: {
          type: e.type ?? "association",
          label: e.label,
          sourceMultiplicity: e.sourceMultiplicity,
          targetMultiplicity: e.targetMultiplicity,
        },
      }) as Edge,
  );
}

/** Lee las versiones guardadas de un diagrama (JSON seguro). */
export function leerVersiones(diagramId: string): Version[] {
  try {
    const crudo = window.localStorage.getItem(claveVersiones(diagramId));
    if (!crudo) return [];
    const data = JSON.parse(crudo) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (v): v is Version =>
        typeof v === "object" &&
        v !== null &&
        typeof (v as Version).id === "string" &&
        typeof (v as Version).fecha === "number" &&
        (v as Version).estado !== null &&
        typeof (v as Version).estado === "object",
    );
  } catch {
    return [];
  }
}

/** Persiste las versiones de un diagrama en localStorage. */
export function persistirVersiones(
  diagramId: string,
  versiones: Version[],
): void {
  try {
    window.localStorage.setItem(
      claveVersiones(diagramId),
      JSON.stringify(versiones),
    );
  } catch {
    // Cuota llena o modo incognito: se descartan sin romper el editor
  }
}