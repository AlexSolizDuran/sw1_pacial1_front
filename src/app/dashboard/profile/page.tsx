"use client";

import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { useAuthStore } from "@/store/auth-store";

/**
 * Pagina de perfil del usuario (CU-1.2).
 * Permite editar nombre, username y cambiar contrasena.
 */
export default function ProfilePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);

  // Campos editables
  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");

  // Cambio de contrasena
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const input =
    "h-11 w-full rounded-md bg-surface-container-lowest px-3 text-sm text-on-surface outline-none border border-outline-variant placeholder:text-on-surface-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container";

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (name.trim().length < 2) {
      setError("El nombre debe tener al menos 2 caracteres");
      return;
    }

    if (username.trim().length < 3) {
      setError("El username debe tener al menos 3 caracteres");
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ name: name.trim(), username: username.trim() });
      setSuccess("Perfil actualizado correctamente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!currentPassword) {
      setError("Debes ingresar tu contrasena actual");
      return;
    }

    if (newPassword.length < 8) {
      setError("La nueva contrasena debe tener al menos 8 caracteres");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Las contrasenas no coinciden");
      return;
    }

    // Validar que tenga mayuscula, minuscula y digito
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("La contrasena debe contener al menos una mayuscula, una minuscula y un digito");
      return;
    }

    setSaving(true);
    try {
      await updateProfile({ currentPassword, newPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Contrasena actualizada correctamente");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ocurrio un error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
      <div className="mb-8">
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-2 text-sm text-on-surface-variant transition-colors hover:text-on-surface"
        >
          ← Dashboard
        </button>
        <h1 className="font-headline text-2xl font-semibold tracking-tight text-on-surface">
          Mi perfil
        </h1>
        <p className="mt-1 text-sm text-on-surface-variant">
          Administra tu nombre, username y contrasena.
        </p>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="mb-6 rounded-xl border border-error/30 bg-error-container/20 px-4 py-3 text-sm text-error">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 rounded-xl border border-primary/30 bg-primary-container/20 px-4 py-3 text-sm text-primary">
          {success}
        </div>
      )}

      {/* Formulario de perfil */}
      <form
        onSubmit={handleSaveProfile}
        className="mb-10 flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container p-6"
      >
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          Datos personales
        </h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-email" className="text-sm font-medium text-on-surface">
            Email
          </label>
          <input
            id="profile-email"
            type="email"
            value={user?.email ?? ""}
            disabled
            className={`${input} opacity-60 cursor-not-allowed`}
          />
          <span className="text-xs text-on-surface-variant">
            El email no se puede cambiar.
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-name" className="text-sm font-medium text-on-surface">
            Nombre completo
          </label>
          <input
            id="profile-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={input}
            placeholder="Tu nombre"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="profile-username" className="text-sm font-medium text-on-surface">
            Username
          </label>
          <input
            id="profile-username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className={input}
            placeholder="tu_usuario"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="h-11 rounded-md bg-primary-container px-5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50 self-start"
        >
          {saving ? "Guardando..." : "Guardar cambios"}
        </button>
      </form>

      {/* Formulario de contrasena */}
      <form
        onSubmit={handleChangePassword}
        className="flex flex-col gap-4 rounded-xl border border-outline-variant bg-surface-container p-6"
      >
        <h2 className="font-headline text-lg font-semibold text-on-surface">
          Cambiar contrasena
        </h2>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="current-password" className="text-sm font-medium text-on-surface">
            Contrasena actual
          </label>
          <input
            id="current-password"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={input}
            placeholder="Ingresa tu contrasena actual"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-sm font-medium text-on-surface">
            Nueva contrasena
          </label>
          <input
            id="new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={input}
            placeholder="Minimo 8 caracteres, con mayuscula, minuscula y digito"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-sm font-medium text-on-surface">
            Confirmar contrasena
          </label>
          <input
            id="confirm-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className={input}
            placeholder="Repite la nueva contrasena"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="h-11 rounded-md bg-primary-container px-5 text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50 self-start"
        >
          {saving ? "Guardando..." : "Cambiar contrasena"}
        </button>
      </form>
    </div>
  );
}
