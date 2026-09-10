"use client";

import { useEditorStore } from "@/store/editor-store";
import { useCollaborationStore } from "@/store/collaboration-store";
import type {
  UMLField,
  UMLMethod,
  UMLParameter,
  UMLNodeData,
  UMLNodeType,
  UMLEdgeData,
  UMLEdgeType,
} from "@/types/diagram";
import { NODE_TYPE_LABELS } from "@/types/diagram";
import {
  MULTIPLICITY_OPTIONS,
  DATA_TYPE_OPTIONS,
  VISIBILITY_OPTIONS,
  EDGE_DEFAULT_MULTIPLICITY,
} from "@/constants/uml";

/** Genera un id unico para atributos, metodos y parametros. */
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

const EDGE_TYPES = [
  { value: "inheritance", label: "Herencia" },
  { value: "implementation", label: "Implementacion" },
  { value: "association", label: "Asociacion" },
  { value: "aggregation", label: "Agregacion" },
  { value: "composition", label: "Composicion" },
  { value: "dependency", label: "Dependencia" },
] as const;

/**
 * Panel lateral de propiedades del elemento seleccionado.
 * Si se selecciona una CLASE: muestra campos para editar nombre, atributos y metodos.
 * Si se selecciona una ARISTA: muestra campos para editar tipo, label y multiplicidades.
 * Si no hay seleccion: muestra instrucciones.
 */
export function PropertiesPanel() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const selectedId = useEditorStore((s) => s.selectedId);
  const updateNode = useEditorStore((s) => s.updateNode);
  const updateEdge = useEditorStore((s) => s.updateEdge);

  const node = nodes.find((n) => n.id === selectedId);
  const edge = edges.find((e) => e.id === selectedId);

  // Si el elemento seleccionado esta bloqueado por otro usuario, solo lectura
  const lockedBy = useCollaborationStore((s) => {
    if (!selectedId) return null;
    const lock = s.lockedElements[selectedId];
    if (!lock) return null;
    return lock.userId === s.userId ? null : lock.userName;
  });
  const readOnly = Boolean(lockedBy);

  const input =
    "w-full rounded border border-outline-variant bg-surface-container-high px-2 py-1 text-xs text-on-surface outline-none focus:border-primary";
  const select =
    "w-full rounded border border-outline-variant bg-surface-container-high px-2 py-1 text-xs text-on-surface outline-none focus:border-primary";
  const checkbox =
    "h-3.5 w-3.5 rounded border border-outline-variant bg-surface-container-high accent-primary cursor-pointer";

  // ─── Panel de ARISTA seleccionada ───────────────────────────────────────
  if (!node && edge) {
    const edgeData = (edge.data as unknown as UMLEdgeData) ?? {};
    const label = edgeData.label ?? "";
    const sourceMult = edgeData.sourceMultiplicity ?? "";
    const targetMult = edgeData.targetMultiplicity ?? "";

    return (
      <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-outline-variant bg-surface-container p-4">
        {/* Aviso de bloqueo por otro usuario */}
        {readOnly && (
          <div className="flex items-center gap-2 rounded-md bg-error-container/30 px-2 py-1.5 text-xs text-error">
            <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
            </svg>
            Editando por {lockedBy}
          </div>
        )}

        {/* Tipo de relacion */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Relacion
          </h2>
          <select
            className={select}
            value={edge.type ?? "association"}
            disabled={readOnly}
            onChange={(e) => {
              const newType = e.target.value as UMLEdgeType;
              const defaults = EDGE_DEFAULT_MULTIPLICITY[newType];
              updateEdge(edge.id, {
                type: newType,
                sourceMultiplicity: defaults.sourceMultiplicity,
                targetMultiplicity: defaults.targetMultiplicity,
              });
            }}
          >
            {EDGE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </section>

        {/* Nombre / label de la relacion */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Nombre
          </h2>
          <input
            className={input}
            value={label}
            disabled={readOnly}
            placeholder="Ej: usa, hereda, contiene..."
            onChange={(e) => updateEdge(edge.id, { label: e.target.value })}
          />
        </section>

        {/* Multiplicidad origen */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Multiplicidad origen
          </h2>
          <select
            className={select}
            value={sourceMult}
            disabled={readOnly}
            onChange={(e) =>
              updateEdge(edge.id, { sourceMultiplicity: e.target.value })
            }
          >
            <option value="">Sin multiplicidad</option>
            {MULTIPLICITY_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </section>

        {/* Multiplicidad destino */}
        <section>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Multiplicidad destino
          </h2>
          <select
            className={select}
            value={targetMult}
            disabled={readOnly}
            onChange={(e) =>
              updateEdge(edge.id, { targetMultiplicity: e.target.value })
            }
          >
            <option value="">Sin multiplicidad</option>
            {MULTIPLICITY_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </section>

        <p className="text-xs text-on-surface-variant">
          Los cambios se guardan automaticamente.
        </p>
      </aside>
    );
  }

  // ─── Sin seleccion ──────────────────────────────────────────────────────
  if (!node) {
    return (
      <aside className="w-72 shrink-0 border-r border-outline-variant bg-surface-container p-4">
        <p className="text-sm text-on-surface-variant">
          Selecciona una clase o relacion para editar sus propiedades.
        </p>
      </aside>
    );
  }

  // ─── Panel de CLASE seleccionada ────────────────────────────────────────
  const data = node.data as unknown as UMLNodeData;
  const nodeType = (node.type ?? "class") as UMLNodeType;
  const isEnumeration = nodeType === "enumeration";

  const patch = (partial: Partial<UMLNodeData>) =>
    updateNode(node.id, partial);

  const addField = () => {
    const field: UMLField = {
      id: uid("f"),
      visibility: "private",
      name: "campo",
      type: "string",
      isStatic: false,
      isReadonly: false,
    };
    patch({ fields: [...data.fields, field] });
  };

  const addLiteral = () => {
    patch({ literals: [...(data.literals ?? []), "VALOR"] });
  };

  const updateLiteral = (index: number, value: string) => {
    const next = [...(data.literals ?? [])];
    next[index] = value;
    patch({ literals: next });
  };

  const removeLiteral = (index: number) => {
    patch({ literals: (data.literals ?? []).filter((_, i) => i !== index) });
  };

  const addMethod = () => {
    const method: UMLMethod = {
      id: uid("m"),
      visibility: "public",
      name: "metodo",
      params: [],
      returnType: "void",
      isStatic: false,
      isAbstract: false,
    };
    patch({ methods: [...data.methods, method] });
  };

  const updateField = (id: string, partial: Partial<UMLField>) => {
    patch({
      fields: data.fields.map((f) =>
        f.id === id ? { ...f, ...partial } : f,
      ),
    });
  };

  const removeField = (id: string) => {
    patch({ fields: data.fields.filter((f) => f.id !== id) });
  };

  const updateMethod = (id: string, partial: Partial<UMLMethod>) => {
    patch({
      methods: data.methods.map((m) =>
        m.id === id ? { ...m, ...partial } : m,
      ),
    });
  };

  const removeMethod = (id: string) => {
    patch({ methods: data.methods.filter((m) => m.id !== id) });
  };

  return (
    <aside className="flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-r border-outline-variant bg-surface-container p-4">
      {/* Aviso de bloqueo por otro usuario */}
      {readOnly && (
        <div className="flex items-center gap-2 rounded-md bg-error-container/30 px-2 py-1.5 text-xs text-error">
          <svg className="h-3 w-3 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          Editando por {lockedBy}
        </div>
      )}

      {/* Nombre de la clase */}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          {NODE_TYPE_LABELS[nodeType] ?? "Elemento"}
        </h2>
        <input
          className={input}
          value={data.name}
          disabled={readOnly}
          onChange={(e) => patch({ name: e.target.value })}
        />
      </section>

      {isEnumeration ? (
        /* ──── Literales (solo enumeraciones) ──────────────────────────── */
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
              Literales
            </h2>
            <button
              type="button"
              onClick={addLiteral}
              disabled={readOnly}
              className="rounded bg-primary-container px-2 py-0.5 text-xs font-medium text-on-primary-container hover:bg-primary-fixed disabled:opacity-40"
            >
              + Literal
            </button>
          </div>
          {(data.literals ?? []).length === 0 ? (
            <p className="text-xs text-on-surface-variant">Sin literales.</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {(data.literals ?? []).map((literal, index) => (
                <li key={index} className="flex items-center gap-1">
                  <input
                    className={input}
                    value={literal}
                    disabled={readOnly}
                    onChange={(e) => updateLiteral(index, e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeLiteral(index)}
                    disabled={readOnly}
                    className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-on-surface-variant hover:bg-error-container hover:text-on-error-container disabled:opacity-40"
                    title="Eliminar literal"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : (
        <>
      {/* ──── Atributos ──────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Atributos
          </h2>
          <button
            type="button"
            onClick={addField}
            disabled={readOnly}
            className="rounded bg-primary-container px-2 py-0.5 text-xs font-medium text-on-primary-container hover:bg-primary-fixed disabled:opacity-40"
          >
            + Campo
          </button>
        </div>
        {data.fields.length === 0 ? (
          <p className="text-xs text-on-surface-variant">Sin atributos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.fields.map((f) => (
              <li
                key={f.id}
                className="flex flex-col gap-1 rounded border border-outline-variant bg-surface-container-high p-2"
              >
                {/* Nombre + boton eliminar */}
                <div className="flex items-center gap-1">
                  <input
                    className={input}
                    value={f.name}
                    disabled={readOnly}
                    onChange={(e) => updateField(f.id, { name: e.target.value })}
                  />
                  <button
                    type="button"
                    onClick={() => removeField(f.id)}
                    disabled={readOnly}
                    className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-on-surface-variant hover:bg-error-container hover:text-on-error-container disabled:opacity-40"
                    title="Eliminar atributo"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Tipo */}
                <select
                  className={select}
                  value={f.type}
                  disabled={readOnly}
                  onChange={(e) => updateField(f.id, { type: e.target.value })}
                >
                  {DATA_TYPE_OPTIONS.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>

                {/* Visibilidad */}
                <select
                  className={select}
                  value={f.visibility}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateField(f.id, {
                      visibility: e.target.value as UMLField["visibility"],
                    })
                  }
                >
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Flags: static + readonly */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                    <input
                      type="checkbox"
                      className={checkbox}
                      checked={f.isStatic}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(f.id, { isStatic: e.target.checked })
                      }
                    />
                    static
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                    <input
                      type="checkbox"
                      className={checkbox}
                      checked={f.isReadonly}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateField(f.id, { isReadonly: e.target.checked })
                      }
                    />
                    readonly
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ──── Metodos ────────────────────────────────────────────────── */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
            Metodos
          </h2>
          <button
            type="button"
            onClick={addMethod}
            disabled={readOnly}
            className="rounded bg-primary-container px-2 py-0.5 text-xs font-medium text-on-primary-container hover:bg-primary-fixed disabled:opacity-40"
          >
            + Metodo
          </button>
        </div>
        {data.methods.length === 0 ? (
          <p className="text-xs text-on-surface-variant">Sin metodos.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {data.methods.map((m) => (
              <li
                key={m.id}
                className="flex flex-col gap-1 rounded border border-outline-variant bg-surface-container-high p-2"
              >
                {/* Nombre + boton eliminar */}
                <div className="flex items-center gap-1">
                  <input
                    className={input}
                    value={m.name}
                    disabled={readOnly}
                    onChange={(e) =>
                      updateMethod(m.id, { name: e.target.value })
                    }
                  />
                  <button
                    type="button"
                    onClick={() => removeMethod(m.id)}
                    disabled={readOnly}
                    className="h-5 w-5 shrink-0 flex items-center justify-center rounded text-on-surface-variant hover:bg-error-container hover:text-on-error-container disabled:opacity-40"
                    title="Eliminar metodo"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Visibilidad */}
                <select
                  className={select}
                  value={m.visibility}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateMethod(m.id, {
                      visibility: e.target.value as UMLMethod["visibility"],
                    })
                  }
                >
                  {VISIBILITY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>

                {/* Parametros (texto libre: nombre:tipo, ...) */}
                <input
                  className={input}
                  disabled={readOnly}
                  placeholder="parametros (nombre:tipo, ...)"
                  value={m.params.map((p: UMLParameter) => `${p.name}:${p.type}`).join(", ")}
                  onChange={(e) => {
                    const parts = e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean)
                      .map((s) => {
                        const [name, type] = s.split(":").map((x) => x.trim());
                        return { id: uid("p"), name: name || "param", type: type || "void" };
                      });
                    updateMethod(m.id, { params: parts });
                  }}
                />

                {/* Retorno */}
                <select
                  className={select}
                  value={m.returnType}
                  disabled={readOnly}
                  onChange={(e) =>
                    updateMethod(m.id, { returnType: e.target.value })
                  }
                >
                  {DATA_TYPE_OPTIONS.map((dt) => (
                    <option key={dt} value={dt}>
                      {dt}
                    </option>
                  ))}
                </select>

                {/* Flags: static + abstract */}
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                    <input
                      type="checkbox"
                      className={checkbox}
                      checked={m.isStatic}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateMethod(m.id, { isStatic: e.target.checked })
                      }
                    />
                    static
                  </label>
                  <label className="flex items-center gap-1 text-[10px] text-on-surface-variant">
                    <input
                      type="checkbox"
                      className={checkbox}
                      checked={m.isAbstract}
                      disabled={readOnly}
                      onChange={(e) =>
                        updateMethod(m.id, { isAbstract: e.target.checked })
                      }
                    />
                    abstract
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
      </>
      )}
    </aside>
  );
}
