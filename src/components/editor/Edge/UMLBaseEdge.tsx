"use client";

import {
  type EdgeProps,
  type InternalNode,
  Handle,
  Position,
  useNodes,
} from "@xyflow/react";
import { useMemo } from "react";
import type { UMLEdgeData, UMLEdgeType } from "@/types/diagram";
import { useCollaborationStore } from "@/store/collaboration-store";
import {
  advance,
  directionFromPosition,
  findOrthogonalRoute,
  orthogonalizeEnds,
  pointsToSVGPath,
  segmentIntersectsRect,
  type Point,
  type Rect,
} from "@/lib/reactflow/path-routing";

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
 * Punto de la polilinea ubicado a la mitad de su recorrido total.
 * Se usa para centrar el label en el tramo visual real (no en el centro
 * geometrico, que quedaria mal ubicado cuando la relacion se desvia).
 */
function midPointOf(pts: Point[]): Point {
  if (pts.length < 2) return { x: pts[0]?.x ?? 0, y: pts[0]?.y ?? 0 };
  let total = 0;
  const lens: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const len = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    lens.push(len);
    total += len;
  }
  let target = total / 2;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i]) {
      const t = lens[i] === 0 ? 0 : target / lens[i];
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * t,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * t,
      };
    }
    target -= lens[i];
  }
  return pts[pts.length - 1];
}

/**
 * Edge UML base que dibuja una linea con marcadores SVG diferenciados
 * por tipo de relacion (triangulo, rombo, flecha, linea punteada).
 *
 * Trazado inteligente:
 * - Si la linea recta no cruza ninguna clase, se mantiene simple (original).
 * - Si pasaria por encima de una tabla, se calcula una ruta ortogonal (A*) que
 *   rodea la tabla y llega al destino por un lado libre ("por otro campo").
 * - Respeta el lado exacto (top/bottom/left/right) donde se anclo la relacion.
 */
export function UMLBaseEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
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

  // Obstaculos = todas las tablas de clase menos el origen y el destino.
  // useNodes devuelve los nodos internos con ancho/alto medido en pantalla.
  const allNodes = useNodes() as InternalNode[];
  const obstacles = useMemo<Rect[]>(() => {
    return allNodes
      .filter((n) => n.id !== source && n.id !== target)
      .filter((n) => n.measured?.width != null && n.measured?.height != null)
      .map((n) => ({
        x: n.internals.positionAbsolute.x,
        y: n.internals.positionAbsolute.y,
        width: n.measured?.width ?? 0,
        height: n.measured?.height ?? 0,
      }));
  }, [allNodes, source, target]);

  // Rectangulos de las tablas origen y destino (se pasan al router para que
  // el A* no re-entre al cuerpo de estas al dar la vuelta).
  const anchors = useMemo(() => {
    const rectOf = (id: string): Rect | null => {
      const n = allNodes.find((nd) => nd.id === id);
      if (!n || n.measured?.width == null || n.measured?.height == null)
        return null;
      return {
        x: n.internals.positionAbsolute.x,
        y: n.internals.positionAbsolute.y,
        width: n.measured.width,
        height: n.measured.height,
      };
    };
    return {
      sourceRect: rectOf(source) ?? undefined,
      targetRect: rectOf(target) ?? undefined,
    };
  }, [allNodes, source, target]);

  // Geometria de la linea: recta si esta libre, si no ruta ortogonal (A*)
  const geometry = useMemo(() => {
    const src: Point = { x: sourceX, y: sourceY };
    const tgt: Point = { x: targetX, y: targetY };
    const srcDir = directionFromPosition(sourcePosition);
    const tgtDir = directionFromPosition(targetPosition);

    // Puntos de "trabajo": un poco alejados del borde del nodo, en la
    // direccion perpendicular a la salida, para que la ruta no roze la tabla.
    // Se usa 32 para que el lead no caiga dentro del area expandida (pad) de
    // una tabla vecina (lo que dejaba al router sin camino y degradaba a
    // la recta directa que pasaba por debajo de la clase).
    const LEAD = 32;
    const srcLead = advance(src, srcDir, LEAD);
    const tgtLead = advance(tgt, tgtDir, LEAD);

    // Se conserva la recta original si no cruza ninguna clase intermedia
    const crossesObstacle = obstacles.some((o) =>
      segmentIntersectsRect(src, tgt, o),
    );
    if (!crossesObstacle) return { points: [src, tgt] };

    const route = findOrthogonalRoute(srcLead, tgtLead, obstacles, anchors);
    // Sin ruta posible (tablas muy juntas): se degrada a la recta directa
    if (!route) return { points: [src, tgt] };

    // Ajusta salida/entrada para que queden perfectamente ortogonales
    const aligned = orthogonalizeEnds(route, srcDir, tgtDir);
    return { points: [src, ...aligned, tgt] };
  }, [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, obstacles, anchors]);

  // Convierte la polilinea en el path SVG, recorta los extremos para que el
  // marker no tapen el borde del nodo y calcula posiciones de labels/multiplicidades
  const MARKER_OFFSET = 6;
  const { pathD, firstDir, lastDir, mid, start, end } = useMemo(() => {
    const pts = geometry.points.map((p) => ({ ...p }));

    // Direccion unitaria del primer y ultimo tramo (pueden no coincidir
    // cuando la linea se desvia para esquivar una tabla).
    const f0 = pts[0];
    const f1 = pts[1] ?? pts[0];
    const l0 = pts[pts.length - 1];
    const l1 = pts[pts.length - 2] ?? l0;
    const fLen = Math.hypot(f1.x - f0.x, f1.y - f0.y) || 1;
    const lLen = Math.hypot(l0.x - l1.x, l0.y - l1.y) || 1;
    const fx = (f1.x - f0.x) / fLen;
    const fy = (f1.y - f0.y) / fLen;
    const lx = (l0.x - l1.x) / lLen;
    const ly = (l0.y - l1.y) / lLen;

    // Retrocede los extremos un poco para que el marker quede pegado al borde
    pts[0] = { x: f0.x + fx * MARKER_OFFSET, y: f0.y + fy * MARKER_OFFSET };
    pts[pts.length - 1] = {
      x: l0.x - lx * MARKER_OFFSET,
      y: l0.y - ly * MARKER_OFFSET,
    };

    return {
      pathD: pointsToSVGPath(pts, 6),
      firstDir: { x: fx, y: fy },
      lastDir: { x: lx, y: ly },
      mid: midPointOf(pts),
      start: pts[0],
      end: pts[pts.length - 1],
    };
  }, [geometry.points]);

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
        d={pathD}
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
          x={mid.x}
          y={mid.y - 8}
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
          transform={`translate(${mid.x + 4}, ${mid.y - 20})`}
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
          x={start.x + firstDir.x * 14 - firstDir.y * 8}
          y={start.y + firstDir.y * 14 + firstDir.x * 8}
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
          x={end.x - lastDir.x * 14 - lastDir.y * 8}
          y={end.y - lastDir.y * 14 + lastDir.x * 8}
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
