/**
 * Tipos del generador Spring Boot (front).
 * Espejan el contrato del backend NestJS (POST /spring-boot/modules):
 * 1 carpeta por tabla, archivos planos con prefijo, sin subcarpetas.
 */
import type { DiagramState } from "./diagram";

/** Cuerpo de POST /spring-boot/modules. */
export interface GenerateModulesRequest {
  diagramId: string;
  /** Estado observable del lienzo al momento de generar. */
  snapshot: DiagramState;
  /** Paquete base Java (ej. com.ejemplo.tienda). */
  packageBase?: string;
}

/** Archivo Java generado (ruta relativa + contenido). */
export interface GeneratedFile {
  /** Ruta relativa (ej. producto/ProductoController.java). */
  path: string;
  /** Contenido completo del archivo. */
  content: string;
}

/** Respuesta de POST /spring-boot/modules. */
export interface GenerateModulesResponse {
  /** Cantidad de modulos (carpetas) generados. */
  moduloCount: number;
  /** Cantidad total de archivos. */
  fileCount: number;
  /** Archivos generados. */
  files: GeneratedFile[];
}
