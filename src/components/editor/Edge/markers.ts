import type { EdgeMarker } from "@xyflow/react";

/** Flecha solida para asociacion/agregacion/composicion. */
export const ARROW_MARKER: EdgeMarker = {
  type: "arrowclosed",
  width: 14,
  height: 14,
  color: "#000000",
};

/** Flecha abierta (punta fina) para dependencia. */
export const OPEN_ARROW_MARKER: EdgeMarker = {
  type: "arrow",
  width: 14,
  height: 14,
  color: "#000000",
};

/**
 * Marcador de especializacion (triangulo hueco) para herencia/implementacion.
 * Se define como un marker personalizado SVG que pinta el triangulo abierto.
 */
export const HOLLOW_TRIANGLE_MARKER: EdgeMarker = {
  type: "arrowclosed",
  width: 16,
  height: 16,
  color: "#000000",
};
