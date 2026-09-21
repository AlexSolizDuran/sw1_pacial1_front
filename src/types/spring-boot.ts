/**
 * Tipos del generador Spring Boot (front).
 * Espejan el contrato del backend NestJS (POST /spring-boot/modules):
 * 1 carpeta por tabla, archivos planos con prefijo, sin subcarpetas.
 * Incluye el DSL de screens (config CRUD por pantalla).
 */
import type { DiagramState } from "./diagram";

/** Tipo de campo soportado por el DSL de screens. */
export type ScreenFieldType =
  | "text"
  | "textarea"
  | "number"
  | "integer"
  | "boolean"
  | "date"
  | "datetime"
  | "select"
  | "object"
  | "array";

export type ScreenHttpMethod = "GET" | "POST" | "PUT" | "DELETE";

/** Endpoint CRUD de una screen. */
export interface ScreenEndpoint {
  method: ScreenHttpMethod;
  path: string;
}

/** Campo de una screen (espeja screens/parser.ts del backend). */
export interface ScreenField {
  name: string;
  type: ScreenFieldType;
  required?: boolean;
  readOnly?: boolean;
  nullable?: boolean;
  default?: unknown;
  maxLength?: number;
  pattern?: string;
  min?: number;
  max?: number;
  /** Para select: lista fija de options o FK hacia otra screen. */
  options?: Array<{ label: string; value: string } | string>;
  from?: { screen: string; of: string };
  /** Para array: campos del item embebido. */
  fields?: ScreenField[];
}

/** Config CRUD de una pantalla (genera un modulo en el proyecto Spring). */
export interface ScreenConfig {
  id: string;
  title?: string;
  idField?: string;
  itemsField?: string;
  queryParams?: Record<string, string>;
  searchFields?: string[];
  list: ScreenEndpoint;
  search?: ScreenEndpoint;
  create?: ScreenEndpoint;
  update?: ScreenEndpoint;
  delete?: ScreenEndpoint;
  fields: ScreenField[];
}

/** Cuerpo de POST /spring-boot/modules. */
export interface GenerateModulesRequest {
  diagramId: string;
  /** Estado observable del lienzo al momento de generar. */
  snapshot: DiagramState;
  /** Paquete base Java (ej. com.ejemplo.tienda). */
  packageBase?: string;
  /** Config CRUD por pantalla (DSL de screens) que deja el UML en segundo plano. */
  screens?: ScreenConfig[];
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
