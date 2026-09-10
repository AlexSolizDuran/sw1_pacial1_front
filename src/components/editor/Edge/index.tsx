"use client";

import type { EdgeProps } from "@xyflow/react";
import { UMLBaseEdge } from "./UMLBaseEdge";

/**
 * Los 6 tipos de relacion UML.
 * Ahora todos usan el mismo UMLBaseEdge sin marcadores de flecha.
 * El tipo se identifica por el label en el sidebar, no por la forma de la linea.
 */
export function InheritanceEdge(props: EdgeProps) {
  return <UMLBaseEdge {...props} />;
}

export function ImplementationEdge(props: EdgeProps) {
  return <UMLBaseEdge {...props} />;
}

export function AssociationEdge(props: EdgeProps) {
  return <UMLBaseEdge {...props} />;
}

export function AggregationEdge(props: EdgeProps) {
  return <UMLBaseEdge {...props} />;
}

export function CompositionEdge(props: EdgeProps) {
  return <UMLBaseEdge {...props} />;
}

export function DependencyEdge(props: EdgeProps) {
  return <UMLBaseEdge {...props} />;
}
