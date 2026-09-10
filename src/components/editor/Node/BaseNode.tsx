"use client";

import type { ReactNode } from "react";
import { Handle, Position } from "@xyflow/react";

/**
 * Contenedor base de un nodo clase.
 * Agrega los handles de conexion (4 lados) para arrastrar relaciones y el
 * recuadro con el tema oscuro. Los nodos hijos dibujan header y compartimentos.
 */
export function BaseNode({ children }: { children: ReactNode }) {
  return (
    <div className="min-w-[160px] overflow-hidden rounded-md border border-outline bg-surface-container-high shadow-lg shadow-black/30" style={{ zIndex: 1 }}>
      {/* Handles: permiten conectar relaciones desde cualquier lado */}
      <Handle
        type="target"
        position={Position.Top}
        className="h-2 w-2 bg-primary-fixed"
      />
      <Handle
        type="source"
        position={Position.Top}
        className="h-2 w-2 bg-primary-fixed"
      />
      <Handle
        type="target"
        position={Position.Bottom}
        className="h-2 w-2 bg-primary-fixed"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="h-2 w-2 bg-primary-fixed"
      />
      <Handle
        type="target"
        position={Position.Left}
        className="h-2 w-2 bg-primary-fixed"
      />
      <Handle
        type="source"
        position={Position.Left}
        className="h-2 w-2 bg-primary-fixed"
      />
      <Handle
        type="target"
        position={Position.Right}
        className="h-2 w-2 bg-primary-fixed"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="h-2 w-2 bg-primary-fixed"
      />
      {children}
    </div>
  );
}
