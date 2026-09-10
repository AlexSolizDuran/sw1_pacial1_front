"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuthStore } from "@/store/auth-store";

/**
 * Modo del formulario: login o registro.
 */
type AuthMode = "login" | "register";

/**
 * Campos de error de validacion por campo.
 */
interface FieldErrors {
  name?: string;
  username?: string;
  email?: string;
  password?: string;
}

/**
 * Formulario de autenticacion (login o registro) con estilo Proton.
 * Valida los campos en el cliente, llama al backend y redirige a la landing.
 */
export function AuthForm({ mode }: { mode: AuthMode }) {
  const isRegister = mode === "register";

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const router = useRouter();

  /**
   * Valida los campos del formulario en el cliente.
   * @returns true si no hay errores, false en caso contrario
   */
  const validate = (): boolean => {
    const nextErrors: FieldErrors = {};

    if (isRegister) {
      if (name.trim().length < 2) {
        nextErrors.name = "El nombre debe tener al menos 2 caracteres";
      }
      if (username.trim().length < 2) {
        nextErrors.username = "El usuario debe tener al menos 2 caracteres";
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        nextErrors.email = "Ingresa un email valido";
      }
    } else {
      if (username.trim().length < 2) {
        nextErrors.username = "El usuario debe tener al menos 2 caracteres";
      }
    }
    if (password.length < 8) {
      nextErrors.password = "La contrasena debe tener al menos 8 caracteres";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  /**
   * Envia el formulario: registra o inicia sesion segun el modo.
   * @param e - Evento del submit
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (!validate()) {
      return;
    }

    setSubmitting(true);
    try {
      if (isRegister) {
        await register(name, username, email, password);
      } else {
        await login(username, password);
      }
      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Ocurrio un error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "h-11 rounded-md bg-surface-container-lowest px-3 text-sm text-on-surface outline-none transition-colors border border-outline-variant placeholder:text-on-surface-variant focus:border-primary-container focus:ring-1 focus:ring-primary-container";

  return (
    <div className="w-full max-w-md rounded-xl border border-outline-variant bg-surface-container p-8">
      <h2 className="mb-1 font-headline text-2xl font-semibold tracking-tight text-on-surface">
        {isRegister ? "Crear cuenta" : "Iniciar sesion"}
      </h2>
      <p className="mb-6 text-sm text-on-surface-variant">
        {isRegister
          ? "Registrate para empezar a crear diagramas."
          : "Bienvenido de vuelta. Ingresa tus credenciales."}
      </p>

      <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        {!isRegister && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-on-surface">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              placeholder="Nombre de usuario"
            />
            {errors.username && (
              <span className="text-xs text-error">{errors.username}</span>
            )}
          </div>
        )}

        {isRegister && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="name" className="text-sm font-medium text-on-surface">
              Nombre
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
              placeholder="Tu nombre"
            />
            {errors.name && (
              <span className="text-xs text-error">{errors.name}</span>
            )}
          </div>
        )}

        {isRegister && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="username" className="text-sm font-medium text-on-surface">
              Usuario
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className={inputClass}
              placeholder="Nombre de usuario"
            />
            {errors.username && (
              <span className="text-xs text-error">{errors.username}</span>
            )}
          </div>
        )}

        {isRegister && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium text-on-surface">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="email@ejemplo.com"
            />
            {errors.email && (
              <span className="text-xs text-error">{errors.email}</span>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <label htmlFor="password" className="text-sm font-medium text-on-surface">
            Contrasena
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
            placeholder="Minimo 8 caracteres"
          />
          {errors.password && (
            <span className="text-xs text-error">{errors.password}</span>
          )}
        </div>

        {submitError && (
          <span className="rounded-md bg-error-container px-3 py-2 text-sm text-on-error-container">
            {submitError}
          </span>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="h-11 rounded-md bg-primary-container text-sm font-medium text-on-primary-container transition-colors hover:bg-primary-fixed disabled:opacity-50"
        >
          {submitting
            ? "Procesando..."
            : isRegister
              ? "Registrarse"
              : "Iniciar sesion"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-on-surface-variant">
        {isRegister ? "Ya tienes cuenta?" : "No tienes cuenta?"}{" "}
        <Link
          href={isRegister ? "/login" : "/register"}
          className="font-medium text-secondary underline underline-offset-4"
        >
          {isRegister ? "Inicia sesion" : "Registrate"}
        </Link>
      </p>
    </div>
  );
}
