/**
 * Exportador del diagrama visible a imagen PNG o SVG (CU-3.5).
 * Captura el viewport de React Flow recortado a los nodos (con margen),
 * puramente en el frontend con html-to-image.
 */
import { getNodesBounds, type Node } from "@xyflow/react";
import { toPng, toSvg } from "html-to-image";

/** Formatos de imagen soportados. */
export type ImageFormat = "png" | "svg";

/** Margen alrededor del contenido en pixeles. */
const PADDING = 40;

/**
 * Descarga el diagrama actual como imagen.
 * @param nodes - Nodos visibles del lienzo (para calcular el recorte)
 * @param diagramName - Nombre base del archivo
 * @param format - png o svg
 * @throws Error si no hay nodos o no se encuentra el lienzo
 */
export async function downloadDiagramImage(
  nodes: Node[],
  diagramName: string,
  format: ImageFormat,
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

  const bounds = getNodesBounds(nodes);
  const width = Math.ceil(bounds.width + PADDING * 2);
  const height = Math.ceil(bounds.height + PADDING * 2);

  const dataUrl =
    format === "png"
      ? await toPng(viewport, {
          backgroundColor: "#111317",
          width,
          height,
          style: {
            width: `${width}px`,
            height: `${height}px`,
            transform: `translate(${-bounds.x + PADDING}px, ${-bounds.y + PADDING}px)`,
          },
        })
      : await toSvg(viewport, {
          backgroundColor: "#111317",
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
