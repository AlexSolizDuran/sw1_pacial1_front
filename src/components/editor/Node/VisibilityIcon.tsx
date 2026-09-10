import type { UMLVisibility } from "@/types/diagram";
import { VISIBILITY_GLYPHS } from "@/constants/uml";

/**
 * Icono de visibilidad UML que precede a atributos y metodos.
 * + publico, - privado, # protegido, ~ paquete.
 */

/** Simbolo de visibilidad para un atributo o metodo. */
export function VisibilityIcon({
  visibility,
}: {
  visibility: UMLVisibility;
}) {
  return (
    <span className="w-4 shrink-0 text-on-surface-variant">
      {VISIBILITY_GLYPHS[visibility]}
    </span>
  );
}
