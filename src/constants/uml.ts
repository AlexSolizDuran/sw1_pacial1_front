import type { UMLVisibility, UMLEdgeType } from "@/types/diagram";

/** Simbolos de visibilidad UML (+ - # ~). */
export const VISIBILITY_GLYPHS: Record<UMLVisibility, string> = {
  public: "+",
  private: "-",
  protected: "#",
  package: "~",
};

/** Opciones de visibilidad con nombre en espanol para el selector del panel. */
export const VISIBILITY_OPTIONS: Array<{
  value: UMLVisibility;
  label: string;
}> = [
  { value: "public", label: "+ publico" },
  { value: "private", label: "- privado" },
  { value: "protected", label: "# protegido" },
  { value: "package", label: "~ paquete" },
];

/** Multiplicidades UML por defecto sugeridas segun el tipo de relacion. */
export const MULTIPLICITY_OPTIONS = [
  "1",
  "0..1",
  "1..*",
  "0..*",
  "*",
  "2",
  "2..3",
  "3",
  "4",
  "5..10",
];

/**
 * Multiplicidades por defecto al cambiar el tipo de relacion.
 * Asociacion/agregacion/composicion traen valores sugeridos editables.
 * Herencia/implementacion/dependencia no manejan multiplicidad.
 */
export const EDGE_DEFAULT_MULTIPLICITY: Record<
  UMLEdgeType,
  { sourceMultiplicity: string; targetMultiplicity: string }
> = {
  inheritance: { sourceMultiplicity: "", targetMultiplicity: "" },
  implementation: { sourceMultiplicity: "", targetMultiplicity: "" },
  association: { sourceMultiplicity: "1", targetMultiplicity: "*" },
  aggregation: { sourceMultiplicity: "0..*", targetMultiplicity: "1" },
  composition: { sourceMultiplicity: "0..1", targetMultiplicity: "1" },
  dependency: { sourceMultiplicity: "", targetMultiplicity: "" },
};

/** Tipos de datos basicos para clases UML. */
export const DATA_TYPE_OPTIONS = [
  "String",
  "int",
  "boolean",
  "double",
  "float",
  "long",
  "char",
  "void",
  "Date",
  "List",
  "Map",
  "Set",
];
