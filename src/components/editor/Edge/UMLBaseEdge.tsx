"use client";

import { type EdgeProps, Handle, Position } from "@xyflow/react";
import type { UMLEdgeData, UMLEdgeType } from "@/types/diagram";
import { useCollaborationStore } from "@/store/collaboration-store";

/**
 * Tamanios y offsets de los marcadores SVG para cada tipo de relacion.
 * refX es la distancia desde el borde del marcador hasta el punto donde se
 * "engancha" al path (debe compensar el tamanio del marker para que el
 * simbolo quede justo en el borde del nodo destino/origen).
 */
const MARKER_CONFIG: Record<
  UMLEdgeType,
  {
    sourceMarker: string | null;
    targetMarker: string | null;
    dashed: boolean;
  }
> = {
  inheritance: {
    sourceMarker: null,
    targetMarker: "url(#uml-hollow-triangle)",
    dashed: false,
  },
  implementation: {
    sourceMarker: null,
    targetMarker: "url(#uml-hollow-triangle)",
    dashed: true,
  },
  association: {
    sourceMarker: null,
    targetMarker: "url(#uml-arrow)",
    dashed: false,
  },
  aggregation: {
    sourceMarker: "url(#uml-hollow-diamond)",
    targetMarker: null,
    dashed: false,
  },
  composition: {
    sourceMarker: "url(#uml-diamond)",
    targetMarker: null,
    dashed: false,
  },
  dependency: {
    sourceMarker: null,
    targetMarker: "url(#uml-open-arrow)",
    dashed: true,
  },
};

/**
 * Edge UML base que dibuja una linea con marcadores SVG diferenciados
 * por tipo de relacion (triangulo, rombo, flecha, linea punteada).
 * Muestra label (nombre) y multiplicidades en los extremos.
 */
export function UMLBaseEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  label,
  style,
}: EdgeProps) {
  const edgeData = (data as unknown as UMLEdgeData) ?? {};
  const edgeType: UMLEdgeType = edgeData.type ?? "association";
  const config = MARKER_CONFIG[edgeType] ?? MARKER_CONFIG.association;

  // Si la arista esta bloqueada por otro usuario (CU-2.5), muestra su nombre
  const lockedBy = useCollaborationStore((s) => {
    const lock = s.lockedElements[id];
    if (!lock) return null;
    return lock.userId === s.userId ? null : lock.userName;
  });

  // Distancia euclidea entre origen y destino
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Vector unitario de la direccion
  const ux = dist > 0 ? dx / dist : 0;
  const uy = dist > 0 ? dy / dist : 0;

  // Offset para que el marker no quede encima del borde del nodo.
  // Los markers tienen ~14px de ancho; el refX compensa, pero agregamos
  // un margen para que la linea no se superponga al borde del nodo.
  const MARKER_OFFSET = 6;

  // Puntos ajustados: se retroceden un poco del borde del nodo
  const sx = sourceX + ux * MARKER_OFFSET;
  const sy = sourceY + uy * MARKER_OFFSET;
  const tx = targetX - ux * MARKER_OFFSET;
  const ty = targetY - uy * MARKER_OFFSET;

  // Path: linea recta (suficiente para UML; las curvas deforman los markers)
  const path = `M ${sx} ${sy} L ${tx} ${ty}`;

  // Punto medio para el label
  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;

  // Estilo de linea punteada para dependencia/implementacion
  const strokeStyle: React.CSSProperties = {
    ...(style ?? {}),
    strokeDasharray: config.dashed ? "6 4" : undefined,
  };

  return (
    <g style={{ zIndex: -1 }}>
      {/* Handle en el origen */}
      <Handle
        type="source"
        position={Position.Top}
        id={`${id}-source`}
        className="!w-3 !h-3 !bg-primary !border-2 !border-primary-container"
        style={{ zIndex: -1 }}
      />

      {/* Linea principal con marcadores */}
      <path
        d={path}
        fill="none"
        stroke="#849495"
        strokeWidth={1.5}
        markerStart={config.sourceMarker ?? undefined}
        markerEnd={config.targetMarker ?? undefined}
        className="hover:stroke-primary transition-colors cursor-pointer"
        style={strokeStyle}
      />

      {/* Label central */}
      {typeof label === "string" && label && (
        <text
          x={midX}
          y={midY - 8}
          textAnchor="middle"
          fill="#b9cacb"
          fontSize={11}
          fontFamily="Inter, sans-serif"
          className="pointer-events-none select-none"
        >
          {label}
        </text>
      )}

      {/* Candado si la arista esta bloqueada por otro usuario (CU-2.5) */}
      {lockedBy && (
        <g
          transform={`translate(${midX + 4}, ${midY - 20})`}
          className="pointer-events-none select-none"
        >
          <rect x="0" y="2" width="7" height="6" rx="1.5" fill="#ef5350" />
          <path
            d="M1.75 2 V0.5 a1.75 1.75 0 0 1 3.5 0 V2"
            fill="none"
            stroke="#ef5350"
            strokeWidth="1.1"
          />
          <text x="10" y="8" fill="#ef5350" fontSize="9" fontFamily="Inter, sans-serif">
            {lockedBy}
          </text>
        </g>
      )}

      {/* Multiplicidad origen */}
      {edgeData.sourceMultiplicity && (
        <text
          x={sx + ux * 14 - uy * 8}
          y={sy + uy * 14 + ux * 8}
          fill="#b9cacb"
          fontSize={10}
          fontFamily="Inter, sans-serif"
          className="pointer-events-none select-none"
        >
          {edgeData.sourceMultiplicity}
        </text>
      )}

      {/* Multiplicidad destino */}
      {edgeData.targetMultiplicity && (
        <text
          x={tx - ux * 14 - uy * 8}
          y={ty - uy * 14 + ux * 8}
          textAnchor="end"
          fill="#b9cacb"
          fontSize={10}
          fontFamily="Inter, sans-serif"
          className="pointer-events-none select-none"
        >
          {edgeData.targetMultiplicity}
        </text>
      )}

      {/* Handle en el destino */}
      <Handle
        type="target"
        position={Position.Bottom}
        id={`${id}-target`}
        className="!w-3 !h-3 !bg-primary !border-2 !border-primary-container"
        style={{ zIndex: -1 }}
      />
    </g>
  );
}
