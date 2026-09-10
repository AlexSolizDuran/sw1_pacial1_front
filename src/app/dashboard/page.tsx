"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useDiagramStore } from "@/store/diagram-store";

/**
 * Dashboard principal: lista los workspaces del usuario y los diagramas
 * donde es colaborador, con formularios para crear/editar/eliminar workspace.
 */
export default function DashboardPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const {
    workspaces,
    sharedDiagrams,
    loading,
    fetchWorkspaces,
    fetchSharedDiagrams,
    createWorkspace,
    renameWorkspace,
    removeWorkspace,
  } = useDiagramStore();

  // Estado del formulario de nuevo workspace
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  // Estado para editar workspace
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetchWorkspaces();
    void fetchSharedDiagrams();
  }, [fetchWorkspaces, fetchSharedDiagrams]);

  /** Crea un workspace y navega hacia el. */
  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (name.trim().length < 2) {
      setError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    setCreating(true);
    try {
      const workspace = await createWorkspace(name);
      router.push(`/dashboard/${workspace.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setCreating(false);
    }
  };

  /** Activa el modo edicion para un workspace. */
  const startEditing = (id: string, currentName: string) => {
    setEditingId(id);
    setEditName(currentName);
    setEditError(null);
  };

  /** Guarda el nuevo nombre del workspace. */
  const handleSaveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingId) return;
    setEditError(null);

    if (editName.trim().length < 2) {
      setEditError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    setSaving(true);
    try {
      await renameWorkspace(editingId, editName);
      setEditingId(null);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setSaving(false);
    }
  };

  /** Elimina un workspace tras confirmacion. */
  const handleDelete = async (id: string, wsName: string) => {
    if (!confirm(`¿Eliminar el workspace "${wsName}"? Esta accion no se puede deshacer.`)) return;
    try {
      await removeWorkspace(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ocurrio un error");
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface">
            Tus workspaces
          </h1>
          <p className="mt-1 text-sm text-on-surface-variant">
            Hola {user?.name}, organiza y crea tus diagramas de clases UML.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="h-10 rounded-md bg-primary-container px-5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed"
        >
          Nuevo workspace
        </button>
      </div>

      {/* Formulario de nuevo workspace */}
      {showForm && (
        <form
          onSubmit={handleCreate}
          className="mb-8 flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4 sm:flex-row sm:items-center"
        >
          <div className="flex flex-1 flex-col gap-1.5">
            <label htmlFor="ws-name" className="text-sm font-medium text-on-surface">
              Nombre del workspace
            </label>
            <input
              id="ws-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="h-11 rounded-md bg-surface-container-lowest px-3 text-sm text-on-surface outline-none transition-colors border border-outline-variant placeholder:text-on-surface-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container"
              placeholder="Ej: Proyecto final"
            />
            {error && <span className="text-xs text-error">{error}</span>}
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

      {/* Workspaces del usuario */}
      {loading ? (
        <p className="text-sm text-on-surface-variant">Cargando workspaces...</p>
      ) : workspaces.length === 0 ? (
        <div className="rounded-xl border border-dashed border-outline-variant p-10 text-center">
          <p className="text-on-surface-variant">
            Aun no tienes workspaces. Crea uno para empezar.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              className="group flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container p-5 transition-colors hover:border-primary-container hover:bg-surface-container-high"
            >
              {editingId === ws.id ? (
                /* Formulario inline de edicion */
                <form onSubmit={handleSaveEdit} className="flex flex-col gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    autoFocus
                    className="h-9 rounded-md bg-surface-container-lowest px-3 text-sm text-on-surface outline-none border border-outline-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container"
                  />
                  {editError && <span className="text-xs text-error">{editError}</span>}
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="h-8 rounded-md bg-primary-container px-3 text-xs font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50"
                    >
                      {saving ? "Guardando..." : "Guardar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="h-8 rounded-md bg-surface-container-lowest px-3 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                /* Tarjeta normal del workspace */
                <>
                  <div className="flex items-start justify-between">
                    <button
                      type="button"
                      onClick={() => router.push(`/dashboard/${ws.id}`)}
                      className="flex flex-1 flex-col gap-1 text-left"
                    >
                      <span className="font-headline text-lg font-semibold text-on-surface">
                        {ws.name}
                      </span>
                      <span className="text-sm text-on-surface-variant">
                        {ws.diagramCount ?? 0} diagramas
                      </span>
                    </button>
                    <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => startEditing(ws.id, ws.name)}
                        className="h-8 w-8 flex items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-surface-container-highest"
                        title="Renombrar"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ws.id, ws.name)}
                        className="h-8 w-8 flex items-center justify-center rounded-md text-on-surface-variant transition-colors hover:bg-error-container hover:text-on-error-container"
                        title="Eliminar"
                      >
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Diagramas compartidos */}
      <div className="mt-12">
        <h2 className="mb-4 font-headline text-xl font-semibold tracking-tight text-on-surface">
          Compartidos contigo
        </h2>
        {sharedDiagrams.length === 0 ? (
          <p className="text-sm text-on-surface-variant">
            Cuando alguien comparta un diagrama contigo, aparecera aqui.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sharedDiagrams.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() =>
                  d.workspaceId
                    ? router.push(
                        `/dashboard/${d.workspaceId}/diagrams/${d.id}`,
                      )
                    : undefined
                }
                disabled={!d.workspaceId}
                className="flex flex-col gap-2 rounded-xl border border-outline-variant bg-surface-container p-5 text-left transition-colors hover:border-primary-container hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-70"
              >
                <span className="font-headline text-base font-semibold text-on-surface">
                  {d.name}
                </span>
                <span className="text-sm text-on-surface-variant">
                  {d.workspaceName ?? "Workspace"}
                </span>
                <span className="mt-1 inline-flex w-fit items-center rounded-md bg-secondary-container px-2 py-0.5 text-xs font-medium text-on-secondary-container">
                  {d.role ?? "VIEWER"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
