import type { NodeTypes, EdgeTypes } from "@xyflow/react";
import { UMLClassNode } from "@/components/editor/Node/ClassNode";
import {
  InheritanceEdge,
  ImplementationEdge,
  AssociationEdge,
  AggregationEdge,
  CompositionEdge,
  DependencyEdge,
} from "@/components/editor/Edge";

/**
 * Tipos de nodo registrados en el lienzo (los 4 UML: clase, interfaz,
 * abstracta y enumeracion). Todas usan la misma tarjeta reutilizable.
 */
export const nodeTypes = {
  class: UMLClassNode,
  interface: UMLClassNode,
  abstract: UMLClassNode,
  enumeration: UMLClassNode,
} satisfies NodeTypes;

/** Tipos de relacion registrados en el lienzo (los 6 UML). */
export const edgeTypes = {
  inheritance: InheritanceEdge,
  implementation: ImplementationEdge,
  association: AssociationEdge,
  aggregation: AggregationEdge,
  composition: CompositionEdge,
  dependency: DependencyEdge,
} satisfies EdgeTypes;