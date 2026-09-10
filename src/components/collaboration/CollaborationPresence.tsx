"use client";

import { useCollaborationStore } from "@/store/collaboration-store";

/** Etiqueta corta del rol del usuario actual. */
const ROLE_LABEL: Record<string, string> = {
  OWNER: "Owner",
  EDITOR: "Editor",
  VIEWER: "Viewer",
};

/**
 * Indicador de presencia colaborativa: avatares de los usuarios conectados
 * a la misma sala y el rol del usuario autenticado. Se muestra junto a la
 * barra superior del editor (UC-2.7 / UC-2.8).
 */
export function CollaborationPresence() {
  const connected = useCollaborationStore((s) => s.connected);
  const peers = useCollaborationStore((s) => s.peers);
  const role = useCollaborationStore((s) => s.role);

  if (!connected) {
    return null;
  }

  // Avatar con la inicial de cada peer. Se colorean segun el rol para
  // distinguir a los que pueden editar (EDITOR/OWNER) de los que solo leen.
  const avatarColor = (p: { role?: string }) =>
    p.role === "EDITOR" || p.role === "OWNER"
      ? "bg-primary-container text-on-primary-container"
      : "bg-secondary-container text-on-secondary-container";

  return (
    <div className="flex items-center gap-3">
      {/* Avatar del propio usuario + rol */}
      <div className="flex items-center gap-2">
        {role && (
          <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-xs font-medium text-on-surface-variant">
            {ROLE_LABEL[role] ?? role}
          </span>
        )}
      </div>

      {/* Peers conectados a la sala */}
      {peers.length > 0 && (
        <div className="flex items-center">
          <div className="flex -space-x-2">
            {peers.map((p) => (
              <div
                key={p.userId}
                title={p.userName}
                className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-surface-container text-xs font-semibold ${avatarColor(p)}`}
              >
                {(p.userName || "?").charAt(0).toUpperCase()}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
