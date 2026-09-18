"use client";

import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";

/**
 * Contenedor base de un nodo clase.
 * Agrega los handles de conexion (4 lados) para arrastrar relaciones y el
 * recuadro con el tema oscuro. Los nodos hijos dibujan header y compartimentos.
 */
/**
 * Los handles deben tener un `id` unico para que React Flow resuelva el lado
 * exacto (top/bottom/left/right) al crear y dibujar la relacion. Con 4 handles
 * de tipo `source` y ConnectionMode.Loose basta para anclar en cualquiera de
 * los 4 puntos, tanto como origen como destino.
 */
const HANDLES: Array<{ id: string; position: Position }> = [
  { id: "top", position: Position.Top },
  { id: "bottom", position: Position.Bottom },
  { id: "left", position: Position.Left },
  { id: "right", position: Position.Right },
];

export function BaseNode({ children }: { children: ReactNode }) {
  return (
    <div
      className="group min-w-[160px] overflow-hidden rounded-md border border-outline bg-surface-container-high shadow-lg shadow-black/30"
      style={{ zIndex: 1 }}
    >
      {/* Handles: permiten conectar relaciones desde cualquiera de los 4 lados.
          Se muestran al pasar el mouse sobre la clase. */}
      {HANDLES.map((h) => (
        <Handle
          key={h.id}
          id={h.id}
          type="source"
          position={h.position}
          className="h-2 w-2 bg-primary-fixed opacity-0 transition-opacity group-hover:opacity-100"
        />
      ))}
      {children}
    </div>
  );
}
