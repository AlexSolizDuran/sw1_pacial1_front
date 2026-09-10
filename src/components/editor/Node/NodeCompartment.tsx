import type { ReactNode } from "react";

/**
 * Compartimento de la tarjeta de clase (atributos o metodos).
 * Cada lista se separa con una linea del header/compartimento anterior.
 */
export function NodeCompartment({
  title,
  children,
  isEmpty,
}: {
  title?: string;
  children: ReactNode;
  isEmpty?: boolean;
}) {
  const visible = isEmpty !== true && children != null;
  return (
    <div className="border-t border-outline-variant">
      {visible && (
        <div className="px-2 py-1 font-mono text-[10px] leading-relaxed text-on-surface">
          {children}
        </div>
      )}
    </div>
  );
}
