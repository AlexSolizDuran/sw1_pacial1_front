"use client";

import { memo } from "react";
import { type NodeProps } from "@xyflow/react";
import type { UMLNodeData, UMLNodeType } from "@/types/diagram";
import { BaseNode } from "./BaseNode";
import { NodeHeader } from "./NodeHeader";
import { NodeCompartment } from "./NodeCompartment";
import { VisibilityIcon } from "./VisibilityIcon";
import { useCollaborationStore } from "@/store/collaboration-store";

/**
 * Estereotipo mostrado en el header segun el tipo de nodo UML.
 */
const STEREOTYPE: Partial<Record<UMLNodeType, string>> = {
  interface: "interface",
  abstract: "abstract",
  enumeration: "enumeration",
};

/**
 * Tarjeta de un elemento UML reutilizable por los 4 tipos de nodo:
 * clase, interfaz, abstracta y enumeracion.
 *
 * Convenciones de render:
 *   - Clase: nombre, atributos y metodos.
 *   - Interfaz: <<interface>>, atributos y metodos.
 *   - Abstracta: <<abstract>>, atributos y metodos (los abstractos en cursiva).
 *   - Enumeracion: <<enumeration>> y literales; sin atributos ni metodos.
 *   - Atributos: +publico, -privado, #protegido, ~paquete, __static__, {readonly}
 *   - Metodos: +metodo(), __static__, *abstract*
 * Muestra un candado si el elemento esta bloqueado por otro usuario (CU-2.5).
 */
export const UMLClassNode = memo(({ id, data, type }: NodeProps) => {
  const nodeData = data as unknown as UMLNodeData;
  const nodeType = (type ?? "class") as UMLNodeType;
  const stereotype = STEREOTYPE[nodeType];

  // Selector estable: devuelve un primitivo (string) o null en vez de un
  // objeto nuevo, para que useSyncExternalStore (zustand v5) no detecte un
  // snapshot distinto en cada render (evita "getSnapshot should be cached").
  const lockedBy = useCollaborationStore((s) => {
    const lock = s.lockedElements[id];
    if (!lock) return null;
    return lock.userId === s.userId ? null : lock.userName;
  });

  return (
    <div className="relative">
      {lockedBy && (
        <div className="absolute -top-2 right-0 z-10 flex items-center gap-1 rounded-full bg-error px-1.5 py-0.5 text-[9px] font-medium text-on-error shadow">
          <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <span>{lockedBy}</span>
        </div>
      )}
      <BaseNode>
        <NodeHeader
          name={nodeData.name}
          stereotype={stereotype}
          italic={nodeType === "abstract"}
        />

        {/* Enumeraciones: solo literales */}
        {nodeType === "enumeration" ? (
          <NodeCompartment isEmpty={(nodeData.literals ?? []).length === 0}>
            {(nodeData.literals ?? []).map((literal) => (
              <div key={literal} className="flex items-center gap-1 whitespace-nowrap">
                <span>{literal}</span>
              </div>
            ))}
          </NodeCompartment>
        ) : (
          <>
            {/* Atributos */}
            <NodeCompartment isEmpty={nodeData.fields.length === 0}>
              {nodeData.fields.map((f) => (
                <div key={f.id} className="flex items-center gap-1 whitespace-nowrap">
                  <VisibilityIcon visibility={f.visibility} />
                  {f.isStatic && (
                    <span className="text-neutral-500">__</span>
                  )}
                  <span>{f.name}</span>
                  <span className="text-neutral-500">: {f.type}</span>
                  {f.isReadonly && (
                    <span className="text-neutral-500 italic">{'{readonly}'}</span>
                  )}
                </div>
              ))}
            </NodeCompartment>

            {/* Metodos */}
            <NodeCompartment isEmpty={nodeData.methods.length === 0}>
              {nodeData.methods.map((m) => (
                <div key={m.id} className="flex items-center gap-1 whitespace-nowrap">
                  <VisibilityIcon visibility={m.visibility} />
                  {m.isStatic && (
                    <span className="text-neutral-500">__</span>
                  )}
                  {m.isAbstract ? (
                    <span className="italic">{m.name}</span>
                  ) : (
                    <span>{m.name}</span>
                  )}
                  <span className="text-neutral-500">
                    ({m.params.map((p) => `${p.name}:${p.type}`).join(", ")})
                  </span>
                  <span className="text-neutral-500">: {m.returnType}</span>
                </div>
              ))}
            </NodeCompartment>
          </>
        )}
      </BaseNode>
    </div>
  );
});

UMLClassNode.displayName = "UMLClassNode";