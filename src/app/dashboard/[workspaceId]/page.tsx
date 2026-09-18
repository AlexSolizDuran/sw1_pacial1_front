"use client";

import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useDiagramStore } from "@/store/diagram-store";
import type { DiagramSummary, WorkspaceDetail } from "@/types";

/**
 * Detalle de un workspace: muestra sus diagramas y permite crear,
 * editar, eliminar y reordenar diagramas. Tambien permite renombrar
 * o eliminar el workspace.
 */
export default function WorkspaceDetailPage() {
  const params = useParams<{ workspaceId: string }>();
  const workspaceId = params.workspaceId;
  const router = useRouter();

  const fetchWorkspace = useDiagramStore((s) => s.fetchWorkspace);
  const createDiagram = useDiagramStore((s) => s.createDiagram);
  const renameWorkspace = useDiagramStore((s) => s.renameWorkspace);
  const removeWorkspace = useDiagramStore((s) => s.removeWorkspace);
  const renameDiagram = useDiagramStore((s) => s.renameDiagram);
  const removeDiagram = useDiagramStore((s) => s.removeDiagram);
  const reorderDiagramsInWorkspace = useDiagramStore(
    (s) => s.reorderDiagramsInWorkspace,
  );
  const setDiagramGroup = useDiagramStore((s) => s.setDiagramGroup);

  const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Formulario de nuevo diagrama
  const [showForm, setShowForm] = useState(false);
  const [diagramName, setDiagramName] = useState("");
  const [diagramError, setDiagramError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Estado para renombrar workspace
  const [renamingWs, setRenamingWs] = useState(false);
  const [wsName, setWsName] = useState("");
  const [wsNameError, setWsNameError] = useState<string | null>(null);
  const [savingWs, setSavingWs] = useState(false);

  // Estado para renombrar diagrama
  const [editingDiagramId, setEditingDiagramId] = useState<string | null>(null);
  const [editDiagramName, setEditDiagramName] = useState("");
  const [editDiagramError, setEditDiagramError] = useState<string | null>(null);
  const [savingDiagram, setSavingDiagram] = useState(false);

  // Estado para cambiar el grupo de un diagrama (CU-1.3)
  const [groupEditingId, setGroupEditingId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [savingGroup, setSavingGroup] = useState(false);

  /**
   * Diagramas agrupados para la vista: primero "Sin grupo" y luego cada
   * grupo por orden alfabetico. Dentro de cada seccion se respeta `position`.
   */
  const grupos = useMemo(() => {
    const mapa = new Map<string | null, DiagramSummary[]>();
    for (const d of workspace?.diagrams ?? []) {
      const key = d.group ?? null;
      const lista = mapa.get(key) ?? [];
      lista.push(d);
      mapa.set(key, lista);
    }
    const sinGrupo = mapa.get(null) ?? [];
    const conGrupo = [...mapa.entries()]
      .filter(([nombre]) => nombre !== null)
      .sort(([a], [b]) => (a ?? "").localeCompare(b ?? ""))
      .map(([nombre, items]) => ({ nombre, items }));
    return [
      ...(sinGrupo.length > 0
        ? [{ nombre: null as string | null, items: sinGrupo }]
        : []),
      ...conGrupo,
    ];
  }, [workspace]);

  /** Nombres de grupos existentes (para sugerir al asignar). */
  const gruposExistentes = useMemo(
    () =>
      grupos
        .map((g) => g.nombre)
        .filter((n): n is string => n !== null),
    [grupos],
  );

  /** Carga el detalle del workspace la primera vez. */
  useEffect(() => {
    fetchWorkspace(workspaceId)
      .then((ws) => {
        setWorkspace(ws);
        setWsName(ws.name);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Ocurrio un error"),
      )
      .finally(() => setLoading(false));
  }, [workspaceId, fetchWorkspace]);

  /** Recarga el workspace para reflejar cambios. */
  const reloadWorkspace = async () => {
    try {
      const ws = await fetchWorkspace(workspaceId);
      setWorkspace(ws);
      setWsName(ws.name);
    } catch {
      // ignora errores en recarga
    }
  };

  /** Crea un diagrama en este workspace y navega hacia el. */
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setDiagramError(null);

    if (diagramName.trim().length < 2) {
      setDiagramError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    setCreating(true);
    try {
      const diagram = await createDiagram(workspaceId, diagramName);
      router.push(`/dashboard/${workspaceId}/diagrams/${diagram.id}`);
    } catch (err) {
      setDiagramError(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setCreating(false);
    }
  };

  /** Guarda el nuevo nombre del workspace. */
  const handleSaveWsName = async (e: FormEvent) => {
    e.preventDefault();
    setWsNameError(null);

    if (wsName.trim().length < 2) {
      setWsNameError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    setSavingWs(true);
    try {
      await renameWorkspace(workspaceId, wsName);
      setRenamingWs(false);
      await reloadWorkspace();
    } catch (err) {
      setWsNameError(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setSavingWs(false);
    }
  };

  /** Elimina el workspace y vuelve al dashboard. */
  const handleDeleteWorkspace = async () => {
    if (!workspace) return;
    if (!confirm(`¿Eliminar el workspace "${workspace.name}"? Esta accion no se puede deshacer.`)) return;
    try {
      await removeWorkspace(workspaceId);
      router.push("/dashboard");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ocurrio un error");
    }
  };

  /** Activa el modo edicion para un diagrama. */
  const startEditingDiagram = (id: string, currentName: string) => {
    setEditingDiagramId(id);
    setEditDiagramName(currentName);
    setEditDiagramError(null);
  };

  /** Guarda el nuevo nombre del diagrama. */
  const handleSaveDiagram = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingDiagramId) return;
    setEditDiagramError(null);

    if (editDiagramName.trim().length < 2) {
      setEditDiagramError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    setSavingDiagram(true);
    try {
      await renameDiagram(editingDiagramId, editDiagramName);
      setEditingDiagramId(null);
      await reloadWorkspace();
    } catch (err) {
      setEditDiagramError(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setSavingDiagram(false);
    }
  };

  /** Elimina un diagrama tras confirmacion. */
  const handleDeleteDiagram = async (id: string, diagramName: string) => {
    if (!confirm(`¿Eliminar el diagrama "${diagramName}"? Esta accion no se puede deshacer.`)) return;
    try {
      await removeDiagram(id);
      await reloadWorkspace();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ocurrio un error");
    }
  };

  /**
   * Mueve un diagrama una posicion dentro de su seccion (CU-1.3).
   * Recalcula las posiciones de toda la lista visible y las persiste.
   */
  const handleMoveDiagram = async (id: string, direccion: -1 | 1) => {
    if (!workspace) return;
    // Orden visual plano: secciones en orden, items en orden de position
    const plano = grupos.flatMap((g) => g.items);
    const i = plano.findIndex((d) => d.id === id);
    const j = i + direccion;
    if (i < 0 || j < 0 || j >= plano.length) return;
    const actual = plano[i];
    const vecino = plano[j];
    if (!actual || !vecino) return;
    const reordenado = [...plano];
    reordenado[i] = vecino;
    reordenado[j] = actual;
    try {
      await reorderDiagramsInWorkspace(
        workspaceId,
        reordenado.map((d, position) => ({ id: d.id, position })),
      );
      await reloadWorkspace();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ocurrio un error");
    }
  };

  /** Abre el editor de grupo para un diagrama. */
  const startEditingGroup = (id: string, current: string | null) => {
    setGroupEditingId(id);
    setGroupName(current ?? "");
  };

  /**
   * Guarda el grupo de un diagrama (nombre nuevo/existente o null para
   * quitarlo), lo que lo mueve de seccion (CU-1.3).
   */
  const handleSaveGroup = async (e: FormEvent, id: string) => {
    e.preventDefault();
    const nombre = groupName.trim();
    setSavingGroup(true);
    try {
      await setDiagramGroup(id, nombre === "" ? null : nombre);
      setGroupEditingId(null);
      await reloadWorkspace();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setSavingGroup(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <span className="text-sm text-on-surface-variant">Cargando...</span>
      </div>
    );
  }

  if (error || !workspace) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="rounded-xl border border-outline-variant bg-surface-container p-6 text-center">
          <p className="text-on-surface">{error ?? "No se encontro el workspace"}</p>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-4 h-10 rounded-md bg-primary-container px-5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed"
          >
            Volver al dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mb-2 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
          >
            ← Dashboard
          </button>

          {renamingWs ? (
            <form onSubmit={handleSaveWsName} className="flex items-center gap-2">
              <input
                type="text"
                value={wsName}
                onChange={(e) => setWsName(e.target.value)}
                autoFocus
                className="h-10 rounded-md bg-surface-container-lowest px-3 text-lg font-semibold text-on-surface outline-none border border-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container"
              />
              {wsNameError && <span className="text-xs text-error">{wsNameError}</span>}
              <button
                type="submit"
                disabled={savingWs}
                className="h-10 rounded-md bg-primary-container px-4 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50"
              >
                {savingWs ? "Guardando..." : "Guardar"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenamingWs(false);
                  setWsName(workspace.name);
                }}
                className="h-10 rounded-md bg-surface-container-lowest px-4 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest"
              >
                Cancelar
              </button>
            </form>
          ) : (
            <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface">
              {workspace.name}
            </h1>
          )}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setRenamingWs(true);
              setWsName(workspace.name);
            }}
            className="h-10 rounded-md bg-surface-container-lowest px-4 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest border border-outline-variant"
          >
            Renombrar
          </button>
          <button
            type="button"
            onClick={handleDeleteWorkspace}
            className="h-10 rounded-md bg-error-container px-4 text-sm font-medium text-on-error-container transition-colors hover:opacity-80"
          >
            Eliminar
          </button>
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="h-10 rounded-md bg-primary-container px-5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed"
          >
            Nuevo diagrama
          </button>
        </div>
      </div>

      {/* Formulario de nuevo diagrama */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="dg-name" className="text-sm font-medium text-on-surface">
              Nombre del diagrama
            </label>
            <input
              id="dg-name"
              type="text"
              value={diagramName}
              onChange={(e) => setDiagramName(e.target.value)}
              autoFocus
              className="h-11 rounded-md bg-surface-container-lowest px-3 text-sm text-on-surface outline-none transition-colors border border-outline-variant placeholder:text-on-surface-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container"
              placeholder="Ej: Diagrama de clases"
            />
            {diagramError && <span className="text-xs text-error">{diagramError}</span>}
          </div>
          <button
            type="submit"
            disabled={creating}
            className="h-11 rounded-md bg-primary-container px-5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50"
          >
            {creating ? "Creando..." : "Crear"}
          </button>
        </form>
      )}

      {/* Lista de diagramas del workspace, por grupos (CU-1.3) */}
      {workspace.diagrams.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant p-10 text-center">
          <p className="text-on-surface-variant">
            Este workspace no tiene diagramas todavia.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {grupos.map((seccion) => (
            <section key={seccion.nombre ?? "sin-grupo"}>
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-on-surface-variant">
                {seccion.nombre ?? "Sin grupo"}
                <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-xs">
                  {seccion.items.length}
                </span>
              </h2>
              <div className="flex flex-col gap-3">
                {seccion.items.map((diagram: DiagramSummary, idx: number) => (
                  <div
                    key={diagram.id}
                    className="group flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container p-5 transition-colors hover:border-primary-container hover:bg-surface-container-high"
                  >
                    <div className="flex items-center gap-3">
                      {editingDiagramId === diagram.id ? (
                        /* Formulario inline de edicion */
                        <form onSubmit={handleSaveDiagram} className="flex flex-1 items-center gap-3">
                          <input
                            type="text"
                            value={editDiagramName}
                            onChange={(e) => setEditDiagramName(e.target.value)}
                            autoFocus
                            className="flex-1 h-9 rounded-md bg-surface-container-lowest px-3 text-sm text-on-surface outline-none border border-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container"
                          />
                          {editDiagramError && <span className="text-xs text-error">{editDiagramError}</span>}
                          <button
                            type="submit"
                            disabled={savingDiagram}
                            className="h-9 rounded-md bg-primary-container px-3 text-xs font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50"
                          >
                            {savingDiagram ? "Guardando..." : "Guardar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingDiagramId(null)}
                            className="h-9 rounded-md bg-surface-container-lowest px-3 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                          >
                            Cancelar
                          </button>
                        </form>
                      ) : (
                        /* Fila normal del diagrama */
                        <>
                          <div className="flex flex-col">
                            <button
                              type="button"
                              onClick={() => void handleMoveDiagram(diagram.id, -1)}
                              disabled={idx === 0}
                              title="Subir"
                              className="flex h-6 w-8 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-surface-container-highest disabled:opacity-30"
                            >
                              ▲
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleMoveDiagram(diagram.id, 1)}
                              disabled={idx === seccion.items.length - 1}
                              title="Bajar"
                              className="flex h-6 w-8 items-center justify-center rounded text-on-surface-variant transition-colors hover:bg-surface-container-highest disabled:opacity-30"
                            >
                              ▼
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/dashboard/${workspaceId}/diagrams/${diagram.id}`)
                            }
                            className="flex flex-1 items-center justify-between text-left"
                          >
                            <span className="font-medium text-on-surface">{diagram.name}</span>
                            <span className="text-sm text-on-surface-variant">
                              {new Date(diagram.lastModified).toLocaleString()}
                            </span>
                          </button>
                          <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => startEditingDiagram(diagram.id, diagram.name)}
                              className="h-8 w-8 flex items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                              title="Renombrar"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDiagram(diagram.id, diagram.name)}
                              className="h-8 w-8 flex items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                              title="Eliminar"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                              </svg>
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                    {/* Grupo del diagrama (CU-1.3) */}
                    <div className="flex items-center gap-2 pl-11">
                      {groupEditingId === diagram.id ? (
                        <form
                          onSubmit={(e) => void handleSaveGroup(e, diagram.id)}
                          className="flex flex-1 items-center gap-2"
                        >
                          <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            autoFocus
                            list="grupos-existentes"
                            placeholder="Nombre del grupo (vacio = sin grupo)"
                            maxLength={255}
                            className="h-8 flex-1 rounded-md bg-surface-container-lowest px-2 text-xs text-on-surface outline-none border border-outline-variant focus:border-primary-container"
                          />
                          <datalist id="grupos-existentes">
                            {gruposExistentes.map((g) => (
                              <option key={g} value={g} />
                            ))}
                          </datalist>
                          <button
                            type="submit"
                            disabled={savingGroup}
                            className="h-8 rounded-md bg-primary-container px-3 text-xs font-medium text-on-primary-container hover:bg-primary-fixed disabled:opacity-50"
                          >
                            {savingGroup ? "Guardando..." : "Guardar"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setGroupEditingId(null)}
                            className="h-8 rounded-md bg-surface-container-lowest px-3 text-xs text-on-surface-variant hover:bg-surface-container-highest"
                          >
                            Cancelar
                          </button>
                        </form>
                      ) : (
                        <>
                          {diagram.group && (
                            <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs text-on-primary-container">
                              {diagram.group}
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => startEditingGroup(diagram.id, diagram.group)}
                            className="rounded px-2 py-0.5 text-xs text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-on-surface"
                            title="Cambiar de grupo (mover de seccion)"
                          >
                            {diagram.group ? "Cambiar grupo" : "Asignar grupo"}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
