/**
 * Exportador del diagrama visible a imagen PNG o SVG (CU-3.5).
 * Captura el viewport de React Flow recortado a los nodos (con margen),
 * puramente en el frontend con html-to-image.
 *
 * Los bounds se reciben calculados desde el componente con
 * `useReactFlow().getNodesBounds()`: esa API lee el nodeLookup interno
 * (medicion real del DOM), a diferencia de la funcion pura getNodesBounds
 * que depende de `measured` en los nodos del store y puede dar un recorte
 * incompleto si el nodo no tiene dimensiones (p. ej. al cargar via Yjs).
 */
import type { Node } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

/** Formatos de imagen soportados. */
export type ImageFormat = "png" | "svg";

/** Margen alrededor del contenido en pixeles. */
const PADDING = 40;

/** Rectangulo que encierra todos los nodos del diagrama. */
export interface DiagramBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Descarga el diagrama actual como imagen.
 * @param nodes - Nodos visibles del lienzo (para validar contenido)
 * @param diagramName - Nombre base del archivo
 * @param format - png o svg
 * @param bounds - Rectangulo (coordenadas de flujo) que encierra los nodos,
 *   calculado con el hook de React Flow cuando esta disponible
 * @throws Error si no hay nodos o no se encuentra el lienzo
 */
export async function downloadDiagramImage(
  nodes: Node[],
  diagramName: string,
  format: ImageFormat,
  bounds: DiagramBounds,
): Promise<void> {
  if (nodes.length === 0) {
    throw new Error("El diagrama no tiene nodos para exportar.");
  }
  const viewport = document.querySelector(
    ".react-flow__viewport",
  ) as HTMLElement | null;
  if (!viewport) {
    throw new Error("No se encontro el lienzo del diagrama.");
  }

  const width = Math.ceil(bounds.width + PADDING * 2);
  const height = Math.ceil(bounds.height + PADDING * 2);

  const dataUrl =
    format === "png"
      ? await toPng(viewport, {
          backgroundColor: "#ffffff",
          width,
          height,
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${-bounds.x + PADDING}px, ${-bounds.y + PADDING}px)`,
          },
        })
      : await toSvg(viewport, {
          backgroundColor: "#ffffff",
          width,
          height,
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${-bounds.x + PADDING}px, ${-bounds.y + PADDING}px)`,
          },
        });

  const safeName = diagramName.replace(/[^a-zA-Z0-9_-]/g, "_") || "diagrama";
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${safeName}.${format}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
