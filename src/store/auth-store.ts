"use client";

import { create } from "zustand";
import {
  apiFetch,
  updateProfile,
  type User,
  type UpdateProfilePayload,
} from "@/lib/api";

/**
 * Estado global de autenticacion.
 * Guarda el usuario de la sesion y expone acciones para iniciar sesion,
 * registrarse, cargar el perfil y cerrar sesion.
 */
interface AuthState {
  /** Usuario autenticado, null si no hay sesion. */
  user: User | null;
  /** True mientras se carga el perfil al iniciar la app. */
  loading: boolean;
  /** Carga el perfil del usuario desde el backend (GET /auth/profile). */
  fetchProfile: () => Promise<void>;
  /** Inicia sesion (POST /auth/login). */
  login: (username: string, password: string) => Promise<void>;
  /** Registra un usuario nuevo (POST /auth/register). */
  register: (name: string, username: string, email: string, password: string) => Promise<void>;
  /** Cierra sesion (POST /auth/logout) y limpia el estado local. */
  logout: () => Promise<void>;
  /** Actualiza el perfil del usuario (PATCH /auth/profile). */
  updateProfile: (payload: UpdateProfilePayload) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  fetchProfile: async () => {
    try {
      const user = await apiFetch<User>("/auth/profile");
      set({ user, loading: false });
    } catch {
      // Sin sesion o token invalido: se deja en null
      set({ user: null, loading: false });
    }
  },

  login: async (username, password) => {
    const { user } = await apiFetch<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
    set({ user });
  },

  register: async (name, username, email, password) => {
    const { user } = await apiFetch<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, username, email, password }),
    });
    set({ user });
  },

  logout: async () => {
    await apiFetch("/auth/logout", { method: "POST" }).catch(() => {
      // El logout local se hace igual aunque falle el backend
    });
    set({ user: null });
  },

  updateProfile: async (payload) => {
    const user = await updateProfile(payload);
    set({ user });
  },
}));
