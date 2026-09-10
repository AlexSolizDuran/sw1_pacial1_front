import type { ReactNode } from "react";

/**
 * Definiciones SVG de marcadores reutilizables para las relaciones UML.
 * Se montan una sola vez dentro del canvas para que los edges puedan
 * referenciarlos por id (url(#...)).
 */
export function EdgeMarkers(): ReactNode {
  return (
    <svg style={{ position: "absolute", width: 0, height: 0 }}>
      <defs>
        {/* Flecha solida (asociacion, agregacion, composicion) */}
        <marker
          id="uml-arrow"
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={10}
          markerHeight={10}
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#849495" />
        </marker>

        {/* Flecha abierta (dependencia, navegabilidad) */}
        <marker
          id="uml-open-arrow"
          viewBox="0 0 10 10"
          refX={9}
          refY={5}
          markerWidth={10}
          markerHeight={10}
          orient="auto-start-reverse"
        >
          <path d="M 0 1 L 8 5 L 0 9" fill="none" stroke="#849495" strokeWidth={1.5} />
        </marker>

        {/* Triangulo hueco (herencia, implementacion) */}
        <marker
          id="uml-hollow-triangle"
          viewBox="0 0 16 16"
          refX={15}
          refY={8}
          markerWidth={16}
          markerHeight={16}
          orient="auto-start-reverse"
        >
          <path
            d="M 1 1 L 13 8 L 1 15 z"
            fill="#111317"
            stroke="#849495"
            strokeWidth={1.5}
          />
        </marker>

        {/* Rombo hueco (agregacion) */}
        <marker
          id="uml-hollow-diamond"
          viewBox="0 0 16 16"
          refX={8}
          refY={8}
          markerWidth={16}
          markerHeight={16}
          orient="auto-start-reverse"
        >
          <path
            d="M 8 1 L 14 8 L 8 15 L 2 8 z"
            fill="#111317"
            stroke="#849495"
            strokeWidth={1.5}
          />
        </marker>

        {/* Rombo lleno (composicion) */}
        <marker
          id="uml-diamond"
          viewBox="0 0 16 16"
          refX={8}
          refY={8}
          markerWidth={16}
          markerHeight={16}
          orient="auto-start-reverse"
        >
          <path d="M 8 1 L 14 8 L 8 15 L 2 8 z" fill="#849495" />
        </marker>
      </defs>
    </svg>
  );
}
