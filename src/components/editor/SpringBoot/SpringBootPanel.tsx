/**
 * Panel del generador Spring Boot.
 * Modal que pide el packageBase, genera 1 carpeta por tabla del diagrama
 * (POST /spring-boot/modules) y muestra arbol + vista previa de solo
 * lectura con copiar, descarga individual y descarga total en .zip.
 */
"use client";

import { useMemo, useState } from "react";
import { useEditorStore } from "@/store/editor-store";
import { snapshotDesdeEstado } from "@/lib/ai";
import {
  generarModulos,
  guardarPackageBase,
  leerPackageBase,
} from "@/lib/spring-boot";
import type {
  GeneratedFile,
  GenerateModulesResponse,
} from "@/types/spring-boot";

/** Agrupa archivos por directorio (soporta rutas Maven anidadas). */
function agruparPorCarpeta(files: GeneratedFile[]): Array<{
  dir: string;
  etiqueta: string;
  archivos: GeneratedFile[];
}> {
  const mapa = new Map<string, GeneratedFile[]>();
  for (const f of files) {
    const partes = f.path.split("/");
    // Directorio completo como clave; la etiqueta es el ultimo segmento
    // (ej. src/main/java/.../producto -> "producto", pom.xml -> "(raiz)")
    const dir =
      partes.length > 1 ? partes.slice(0, -1).join("/") : "(raiz)";
    const lista = mapa.get(dir) ?? [];
    lista.push(f);
    mapa.set(dir, lista);
  }
  return [...mapa.entries()]
    .map(([dir, archivos]) => ({
      dir,
      etiqueta: dir === "(raiz)" ? "(raiz)" : (dir.split("/").pop() ?? dir),
      archivos: archivos.sort((a, b) => a.path.localeCompare(b.path)),
    }))
    .sort((a, b) => a.dir.localeCompare(b.dir));
}

/** Descarga un blob como archivo en el navegador. */
function descargarBlob(blob: Blob, nombre: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * Modal del generador Spring Boot.
 * @param onClose - Cierra el modal (el ultimo resultado se conserva al reabrir
 *   solo dentro de esta montada; al desmontar se limpia)
 */
export function SpringBootPanel({ onClose }: { onClose: () => void }) {
  const diagramId = useEditorStore((s) => s.diagramId);
  const diagramName = useEditorStore((s) => s.diagramName);
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);

  const [packageBase, setPackageBase] = useState<string>(() =>
    leerPackageBase(),
  );
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] =
    useState<GenerateModulesResponse | null>(null);
  const [archivoSel, setArchivoSel] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [zipCargando, setZipCargando] = useState(false);
  // Huella del lienzo al generar (para avisar "el diagrama cambio")
  const [huella, setHuella] = useState<string | null>(null);

  const huellaActual = `${nodes.length}:${edges.length}`;
  const desactualizado =
    resultado !== null && huella !== null && huella !== huellaActual;

  const grupos = useMemo(
    () => (resultado ? agruparPorCarpeta(resultado.files) : []),
    [resultado],
  );
  const archivoActual = useMemo(
    () =>
      resultado?.files.find((f) => f.path === archivoSel) ??
      resultado?.files[0] ??
      null,
    [resultado, archivoSel],
  );

  /** Genera (o regenera) los modulos con el snapshot actual del lienzo. */
  async function handleGenerar(): Promise<void> {
    if (nodes.length === 0) {
      setError("El diagrama no tiene clases para generar.");
      return;
    }
    setCargando(true);
    setError(null);
    setCopiado(false);
    try {
      const snapshot = snapshotDesdeEstado(nodes, edges);
      const res = await generarModulos({
        diagramId,
        snapshot,
        packageBase: packageBase.trim(),
      });
      guardarPackageBase(packageBase.trim());
      setResultado(res);
      setArchivoSel(res.files[0]?.path ?? null);
      setHuella(huellaActual);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al generar los modulos");
    } finally {
      setCargando(false);
    }
  }

  /** Copia el archivo visible al portapapeles. */
  async function handleCopiar(): Promise<void> {
    if (!archivoActual) return;
    try {
      await navigator.clipboard.writeText(archivoActual.content);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setError("No se pudo copiar al portapapeles.");
    }
  }

  /** Descarga solo el archivo visible. */
  function handleDescargarArchivo(): void {
    if (!archivoActual) return;
    const nombre = archivoActual.path.split("/").pop() ?? "archivo.java";
    descargarBlob(
      new Blob([archivoActual.content], { type: "text/x-java-source" }),
      nombre,
    );
  }

  /** Descarga todos los archivos como .zip (carpetas por tabla). */
  async function handleDescargarZip(): Promise<void> {
    if (!resultado) return;
    setZipCargando(true);
    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      for (const f of resultado.files) {
        zip.file(f.path, f.content);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const base = (diagramName || "springboot")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      descargarBlob(blob, `${base || "springboot"}-springboot.zip`);
    } catch {
      setError("No se pudo armar el archivo .zip.");
    } finally {
      setZipCargando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-outline-variant bg-surface-container shadow-xl">
        {/* Cabecera */}
        <div className="flex items-center gap-3 border-b border-outline-variant px-4 py-3">
          <h2 className="font-headline text-base font-semibold text-on-surface">
            Generar Spring Boot
          </h2>
          {resultado && (
            <span className="rounded-full bg-primary-container px-2.5 py-0.5 text-xs text-on-primary-container">
              {resultado.moduloCount} módulos · {resultado.fileCount} archivos
            </span>
          )}
          <div className="flex-1" />
          <button
            type="button"
            onClick={onClose}
            className="rounded-md bg-surface-container-high px-3 py-1.5 text-sm text-on-surface hover:bg-surface-container-highest"
          >
            Cerrar
          </button>
        </div>

        {/* Configuracion */}
        <div className="flex flex-wrap items-end gap-3 border-b border-outline-variant px-4 py-3">
          <label className="flex min-w-64 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-on-surface-variant">
              Paquete base Java
            </span>
            <input
              type="text"
              value={packageBase}
              onChange={(e) => setPackageBase(e.target.value)}
              placeholder="com.ejemplo.tienda"
              className="rounded-md border border-outline-variant bg-surface px-3 py-1.5 text-sm text-on-surface"
            />
          </label>
          <button
            type="button"
            onClick={() => void handleGenerar()}
            disabled={cargando || nodes.length === 0}
            className="rounded-md bg-primary-container px-4 py-1.5 text-sm font-medium text-on-primary-container hover:bg-primary-fixed disabled:opacity-50"
          >
            {cargando
              ? "Generando…"
              : resultado
                ? "Regenerar"
                : "Generar"}
          </button>
        </div>

        <p className="border-b border-outline-variant bg-surface-container-high px-4 py-2 text-xs text-on-surface-variant">
          Nota: si una clase tiene un atributo llamado <code>id</code> (en
          cualquier mayúscula), ese atributo es la llave primaria: se genera
          como <code>Long</code> autoincremental y no se duplica en el API.
        </p>

        {error && (
          <p className="border-b border-outline-variant bg-error-container px-4 py-2 text-sm text-on-error-container">
            {error}
          </p>
        )}
        {desactualizado && (
          <p className="border-b border-outline-variant bg-tertiary-container px-4 py-2 text-sm text-on-tertiary-container">
            El diagrama cambió desde la última generación. Presiona
            Regenerar para actualizar el código.
          </p>
        )}

        {/* Contenido: arbol + preview */}
        {resultado ? (
          <div className="flex min-h-0 flex-1">
            <aside className="w-64 shrink-0 overflow-auto border-r border-outline-variant p-2">
              {grupos.map((g) => (
                <div key={g.dir} className="mb-2">
                  <p
                    className="px-2 py-1 text-xs font-semibold text-on-surface-variant"
                    title={g.dir}
                  >
                    {g.etiqueta}/
                  </p>
                  {g.archivos.map((f) => {
                    const activo = archivoActual?.path === f.path;
                    const nombre = f.path.split("/").pop() ?? f.path;
                    return (
                      <button
                        key={f.path}
                        type="button"
                        onClick={() => {
                          setArchivoSel(f.path);
                          setCopiado(false);
                        }}
                        className={`block w-full truncate rounded px-3 py-1 text-left text-sm ${
                          activo
                            ? "bg-primary-container text-on-primary-container"
                            : "text-on-surface hover:bg-surface-container-high"
                        }`}
                        title={f.path}
                      >
                        {nombre}
                      </button>
                    );
                  })}
                </div>
              ))}
            </aside>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-2 border-b border-outline-variant px-4 py-2">
                <span className="truncate font-mono text-xs text-on-surface-variant">
                  {archivoActual?.path}
                </span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => void handleCopiar()}
                  className="rounded-md bg-surface-container-high px-3 py-1 text-xs text-on-surface hover:bg-surface-container-highest"
                >
                  {copiado ? "¡Copiado!" : "Copiar"}
                </button>
                <button
                  type="button"
                  onClick={handleDescargarArchivo}
                  className="rounded-md bg-surface-container-high px-3 py-1 text-xs text-on-surface hover:bg-surface-container-highest"
                >
                  Descargar archivo
                </button>
              </div>
              <pre className="min-h-0 flex-1 overflow-auto bg-surface p-4 font-mono text-xs leading-relaxed text-on-surface">
                {archivoActual?.content ?? ""}
              </pre>
            </div>
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-on-surface-variant">
            {nodes.length === 0
              ? "El diagrama no tiene clases para generar."
              : "Presiona Generar para crear 1 módulo CRUD por clase (screen) con sus archivos Java."}
          </p>
        )}

        {/* Pie: descarga total */}
        {resultado && (
          <div className="flex items-center gap-3 border-t border-outline-variant px-4 py-3">
            <span className="text-xs text-on-surface-variant">
              {resultado.moduloCount} carpetas · {resultado.fileCount} archivos
              .java
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => void handleDescargarZip()}
              disabled={zipCargando}
              className="rounded-md bg-primary-container px-4 py-1.5 text-sm font-medium text-on-primary-container hover:bg-primary-fixed disabled:opacity-50"
            >
              {zipCargando ? "Armando zip…" : "Descargar todo (.zip)"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
