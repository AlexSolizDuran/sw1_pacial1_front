/**
 * Tipos de dominio del diagrama de clases UML.
 * Modelan los nodos (clases) y las relaciones (edges) que se dibujan en el lienzo
 * de React Flow y se persisten como reactFlowState en la BD.
 */

/** Visibilidad de un atributo o metodo UML. */
export type UMLVisibility = "public" | "private" | "protected" | "package";

/** Parametro de un metodo UML. */
export interface UMLParameter {
  id: string;
  name: string;
  type: string;
  defaultValue?: string;
}

/** Atributo de una clase UML. */
export interface UMLField {
  id: string;
  visibility: UMLVisibility;
  name: string;
  type: string;
  isStatic: boolean;
  isReadonly: boolean;
  defaultValue?: string;
}

/** Metodo de una clase UML. */
export interface UMLMethod {
  id: string;
  visibility: UMLVisibility;
  name: string;
  params: UMLParameter[];
  returnType: string;
  isStatic: boolean;
  isAbstract: boolean;
}

/** Tipo de nodo UML (clase, interfaz, abstracta o enumeracion). */
export type UMLNodeType =
  | "class"
  | "interface"
  | "abstract"
  | "enumeration";

/** Datos internos de un nodo de clase. */
export interface UMLNodeData {
  name: string;
  fields: UMLField[];
  methods: UMLMethod[];
  /** Literales de una enumeracion (solo para nodos type="enumeration"). */
  literals?: string[];
  // Permite que el tipo satisfaga Record<string, unknown> exigido por React Flow
  [key: string]: unknown;
}

/** Etiqueta base de cada tipo de nodo (para el selector/tooltip). */
export const NODE_TYPE_LABELS: Record<UMLNodeType, string> = {
  class: "Clase",
  interface: "Interfaz",
  abstract: "Clase abstracta",
  enumeration: "Enumeracion",
};

/** Tipo de relacion UML entre dos clases. */
export type UMLEdgeType =
  | "inheritance" // Herencia (flecha hueca, continua)
  | "implementation" // Realizacion (flecha hueca, punteada)
  | "association" // Asociacion (flecha, continua)
  | "aggregation" // Agregacion (rombo hueco)
  | "composition" // Composicion (rombo lleno)
  | "dependency"; // Dependencia (punteada)

/** Datos internos de una relacion UML. */
export interface UMLEdgeData {
  type: UMLEdgeType;
  label?: string;
  sourceMultiplicity?: string;
  targetMultiplicity?: string;
  /** Lado del nodo origen donde se ancla la relacion (top/bottom/left/right). */
  sourceHandle?: string;
  /** Lado del nodo destino donde se ancla la relacion (top/bottom/left/right). */
  targetHandle?: string;
  // Permite que el tipo satisfaga Record<string, unknown> exigido por React Flow
  [key: string]: unknown;
}

/** Etiqueta base de cada tipo de relacion (para el selector/tooltip). */
export const EDGE_TYPE_LABELS: Record<UMLEdgeType, string> = {
  inheritance: "Herencia",
  implementation: "Realizacion",
  association: "Asociacion",
  aggregation: "Agregacion",
  composition: "Composicion",
  dependency: "Dependencia",
};

/** Forma del estado del lienzo que se persiste en reactFlowState. */
export interface DiagramState {
  nodes: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    data: UMLNodeData;
  }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    type: string;
    label?: string;
    sourceMultiplicity?: string;
    targetMultiplicity?: string;
    /** Lado del nodo origen donde se ancla la relacion (top/bottom/left/right). */
    sourceHandle?: string;
    /** Lado del nodo destino donde se ancla la relacion (top/bottom/left/right). */
    targetHandle?: string;
  }>;
}
