/**
 * Cliente del generador Spring Boot (POST /spring-boot/modules).
 * Reutiliza apiFetch (cookie JWT HttpOnly) como el resto del front.
 */
import { apiFetch } from "./api";
import type {
  GenerateModulesRequest,
  GenerateModulesResponse,
} from "@/types/spring-boot";

/** Paquete base por defecto si el usuario no escribe otro. */
export const DEFAULT_PACKAGE_BASE = "com.ejemplo.tienda";

/** Clave de localStorage para recordar el ultimo packageBase. */
const PACKAGE_BASE_KEY = "springboot-package-base";

/**
 * Genera los modulos Spring Boot del diagrama actual.
 * @param payload - Diagrama, snapshot del lienzo y packageBase
 * @returns Modulos/archivos generados por el backend
 */
export function generarModulos(
  payload: GenerateModulesRequest,
): Promise<GenerateModulesResponse> {
  return apiFetch<GenerateModulesResponse>("/spring-boot/modules", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

/** Lee el ultimo packageBase guardado (o el default). */
export function leerPackageBase(): string {
  if (typeof window === "undefined") return DEFAULT_PACKAGE_BASE;
  return window.localStorage.getItem(PACKAGE_BASE_KEY) ?? DEFAULT_PACKAGE_BASE;
}

/** Guarda el packageBase para la proxima vez. */
export function guardarPackageBase(packageBase: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PACKAGE_BASE_KEY, packageBase);
}
