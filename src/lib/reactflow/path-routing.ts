import type { Position } from "@xyflow/react";

/**
 * Router ortogonal para aristas del diagrama de clases.
 *
 * Calcula un camino en forma de "escalera" (segmentos horizontales y
 * verticales) que evita pasar por encima de las tablas de clase (obstaculos).
 * Si la linea recta entre origen y destino no cruza ningun nodo, se respeta
 * (comportamiento original); en caso contrario se usa A* sobre una rejilla
 * para rodear los obstaculos y volver a entrar al nodo destino desde un lado
 * libre ("llegar por otro campo").
 */

/** Rectangulo (coordenadas de flujo) usado como obstaculo o tabla. */
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Punto en coordenadas de flujo. */
export interface Point {
  x: number;
  y: number;
}

/** Opciones del router. */
export interface RouteOptions {
  /** Tamano de celda de la rejilla (px). Por defecto 20 (acorde al snap). */
  cellSize?: number;
  /** Separacion minima entre la linea y cada tabla (px). Por defecto 18. */
  pad?: number;
  /** Marge extra alrededor del area de busqueda. */
  margin?: number;
  /** Rectangulo del nodo origen. Se bloquea en el A* para que la ruta no
   *  vuelva a entrar al cuerpo de la tabla de donde sale la relacion. */
  sourceRect?: Rect;
  /** Rectangulo del nodo destino (misma finalidad que `sourceRect`). */
  targetRect?: Rect;
}

/** Dirige un segmento "hacia fuera" del nodo segun la posicion del handle. */
export function directionFromPosition(pos: Position): Point {
  switch (pos) {
    case "top":
      return { x: 0, y: -1 };
    case "bottom":
      return { x: 0, y: 1 };
    case "left":
      return { x: -1, y: 0 };
    case "right":
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: -1 };
  }
}

/** Normaliza un vector a longitud 1 (retorna (0,0) si es nulo). */
function unit(p: Point): Point {
  const len = Math.hypot(p.x, p.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: p.x / len, y: p.y / len };
}

/** Interseccion segmento-rectangulo (Liang-Barsky). */
export function segmentIntersectsRect(a: Point, b: Point, r: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  let t0 = 0;
  let t1 = 1;
  const p = [-dx, dx, -dy, dy];
  const q = [
    a.x - r.x,
    r.x + r.width - a.x,
    a.y - r.y,
    r.y + r.height - a.y,
  ];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) {
      if (q[i] < 0) return false;
    } else {
      const t = q[i] / p[i];
      if (p[i] < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  // Hay cruce si el segmento [0,1] solapa el rango param [t0,t1]
  return t0 <= 1 && t1 >= 0 && t0 < t1;
}

/** Superposicion entre dos rectangulos. */
function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

/**
 * Mini heap binario para el A* (pares id-presupuesto).
 */
class MiniHeap {
  private ids: number[] = [];
  private fs: number[] = [];
  private n = 0;

  push(id: number, f: number): void {
    let i = this.n++;
    this.ids[i] = id;
    this.fs[i] = f;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.fs[p] <= this.fs[i]) break;
      this.swap(p, i);
      i = p;
    }
  }

  pop(): number {
    const top = this.ids[0];
    this.n--;
    if (this.n === 0) return top;
    const lastId = this.ids[this.n];
    const lastF = this.fs[this.n];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let smallest = i;
      if (l < this.n && this.fs[l] < this.fs[smallest]) smallest = l;
      if (r < this.n && this.fs[r] < this.fs[smallest]) smallest = r;
      if (smallest === i) break;
      this.swap(i, smallest);
      i = smallest;
    }
    this.ids[i] = lastId;
    this.fs[i] = lastF;
    return top;
  }

  get length(): number {
    return this.n;
  }

  private swap(a: number, b: number): void {
    [this.ids[a], this.ids[b]] = [this.ids[b], this.ids[a]];
    [this.fs[a], this.fs[b]] = [this.fs[b], this.fs[a]];
  }
}

/** True si dos puntos comparten fila o columna (estan alineados). */
function isAxisAligned(a: Point, b: Point): boolean {
  return Math.abs(a.x - b.x) < 0.5 || Math.abs(a.y - b.y) < 0.5;
}

/** Alisa el camino eliminando quiebres innecesarios en linea recta. */
function simplifyPath(pts: Point[], padded: Rect[]): Point[] {
  const out: Point[] = [];
  let i = 0;
  while (i < pts.length) {
    out.push(pts[i]);
    if (i === pts.length - 1) break;
    let best = i + 1;
    for (let j = i + 1; j < pts.length; j++) {
      if (!isAxisAligned(pts[i], pts[j])) break;
      let clear = true;
      for (const o of padded) {
        if (segmentIntersectsRect(pts[i], pts[j], o)) {
          clear = false;
          break;
        }
      }
      if (!clear) break;
      best = j;
    }
    i = best;
  }
  return out;
}

/**
 * Celda libre mas cercana a `cellIdx` (busqueda en anillos).
 *
 * El lead de salida/entrada de una relacion puede caer dentro de una tabla
 * expandida cuando las tablas estan muy juntas; en ese caso el A* no tendria
 * por donde salir y devolveria null. Este paso traslada el extremo a la celda
 * libre mas proxima para que siempre exista un camino posible.
 */
function nearestFreeCell(
  cellIdx: number,
  blocked: Uint8Array,
  cols: number,
  rows: number,
): number {
  const seen = new Uint8Array(blocked.length);
  const queue: number[] = [cellIdx];
  seen[cellIdx] = 1;
  let head = 0;
  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];
  while (head < queue.length) {
    const cur = queue[head++];
    if (!blocked[cur]) return cur;
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    for (const d of dirs) {
      const nx = cx + d.dx;
      const ny = cy + d.dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (seen[ni]) continue;
      seen[ni] = 1;
      queue.push(ni);
    }
  }
  return -1;
}

/**
 * Ejecuta el A* sobre una rejilla local. `blockedRects` ya son los obstaculos
 * expandidos (incluye origen y destino para que la ruta no re-entre a su
 * cuerpo); son los limites sobre los que se decide si una celda esta bloqueada.
 */
function routeInGrid(
  source: Point,
  target: Point,
  blockedRects: Rect[],
  cell: number,
  margin: number,
): Point[] | null {
  // Rejilla local sobre el area de interes
  const xs = [
    source.x,
    target.x,
    ...blockedRects.map((o) => o.x),
    ...blockedRects.map((o) => o.x + o.width),
  ];
  const ys = [
    source.y,
    target.y,
    ...blockedRects.map((o) => o.y),
    ...blockedRects.map((o) => o.y + o.height),
  ];
  const minX = Math.floor(Math.min(...xs) / cell) * cell - margin;
  const maxX = Math.ceil(Math.max(...xs) / cell) * cell + margin;
  const minY = Math.floor(Math.min(...ys) / cell) * cell - margin;
  const maxY = Math.ceil(Math.max(...ys) / cell) * cell + margin;
  const cols = Math.max(1, Math.round((maxX - minX) / cell));
  const rows = Math.max(1, Math.round((maxY - minY) / cell));

  // Celdas bloqueadas = las que tocan alguna tabla (ya expandida)
  const blocked = new Uint8Array(cols * rows);
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const r: Rect = {
        x: minX + cx * cell,
        y: minY + cy * cell,
        width: cell,
        height: cell,
      };
      for (const o of blockedRects) {
        if (rectsOverlap(r, o)) {
          blocked[cy * cols + cx] = 1;
          break;
        }
      }
    }
  }

  const toCell = (p: Point): number => {
    const cx = Math.max(
      0,
      Math.min(cols - 1, Math.floor((p.x - minX) / cell)),
    );
    const cy = Math.max(
      0,
      Math.min(rows - 1, Math.floor((p.y - minY) / cell)),
    );
    return cy * cols + cx;
  };

  // Arranque y entrega: se ubican en la celda libre mas cercana para evitar
  // que un lead atrapado deje al A* sin salida (degradar a cruzar la tabla).
  const startIdx = nearestFreeCell(toCell(source), blocked, cols, rows);
  const goalIdx = nearestFreeCell(toCell(target), blocked, cols, rows);
  if (startIdx === -1 || goalIdx === -1) return null;
  if (startIdx === goalIdx) {
    return [
      source,
      {
        x: minX + (startIdx % cols) * cell + cell / 2,
        y: minY + ((startIdx / cols) | 0) * cell + cell / 2,
      },
      target,
    ];
  }

  const goalCx = goalIdx % cols;
  const goalCy = (goalIdx / cols) | 0;

  const g = new Float64Array(cols * rows).fill(Infinity);
  const parent = new Int32Array(cols * rows).fill(-1);
  const closed = new Uint8Array(cols * rows);
  const openF = new Float64Array(cols * rows).fill(Infinity);
  g[startIdx] = 0;
  openF[startIdx] =
    Math.abs((startIdx % cols) - goalCx) * cell +
    Math.abs(((startIdx / cols) | 0) - goalCy) * cell;
  const heap = new MiniHeap();
  heap.push(startIdx, openF[startIdx]);

  const dirs = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  while (heap.length > 0) {
    const cur = heap.pop();
    closed[cur] = 1;
    if (cur === goalIdx) break;
    const cx = cur % cols;
    const cy = (cur / cols) | 0;
    for (const d of dirs) {
      const nx = cx + d.dx;
      const ny = cy + d.dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      if (blocked[ni] || closed[ni]) continue;
      const ng = g[cur] + cell;
      if (ng < g[ni]) {
        g[ni] = ng;
        parent[ni] = cur;
        openF[ni] =
          ng + (Math.abs(nx - goalCx) + Math.abs(ny - goalCy)) * cell;
        heap.push(ni, openF[ni]);
      }
    }
  }

  if (parent[goalIdx] === -1) return null;

  // Reconstruccion del camino en centros de celda
  const pts: Point[] = [];
  let curIdx = goalIdx;
  while (curIdx !== -1) {
    pts.push({
      x: minX + (curIdx % cols) * cell + cell / 2,
      y: minY + ((curIdx / cols) | 0) * cell + cell / 2,
    });
    if (curIdx === startIdx) break;
    curIdx = parent[curIdx];
  }
  pts.reverse();
  pts[0] = source;
  pts[pts.length - 1] = target;

  return simplifyPath(pts, blockedRects);
}

/** Longitud total de una polilinea (suma de sus segmentos). */
function polylineLength(pts: Point[]): number {
  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }
  return len;
}

/** True si ningun tramo de la polilinea cruza un obstaculo. */
function pathClear(pts: Point[], obstacles: Rect[]): boolean {
  for (let i = 0; i < pts.length - 1; i++) {
    for (const o of obstacles) {
      if (segmentIntersectsRect(pts[i], pts[i + 1], o)) return false;
    }
  }
  return true;
}

/**
 * Ultimo recurso cuando el A* no encuentra camino: rodea el rectangulo que
 * envuelve a todos los obstaculos por el lado libre mas corto. Asi nunca se
 * degrada a la recta directa que cruza las tablas.
 */
function detourAroundObstacles(
  source: Point,
  target: Point,
  padded: Rect[],
  pad: number,
): Point[] | null {
  if (padded.length === 0) return [source, target];
  const m = pad + 20;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const o of padded) {
    minX = Math.min(minX, o.x);
    minY = Math.min(minY, o.y);
    maxX = Math.max(maxX, o.x + o.width);
    maxY = Math.max(maxY, o.y + o.height);
  }
  const top = minY - m;
  const bottom = maxY + m;
  const left = minX - m;
  const right = maxX + m;
  const candidates: Point[][] = [
    [source, { x: source.x, y: top }, { x: target.x, y: top }, target],
    [source, { x: source.x, y: bottom }, { x: target.x, y: bottom }, target],
    [source, { x: left, y: source.y }, { x: left, y: target.y }, target],
    [source, { x: right, y: source.y }, { x: right, y: target.y }, target],
  ];
  let best: Point[] | null = null;
  let bestLen = Infinity;
  for (const cand of candidates) {
    if (!pathClear(cand, padded)) continue;
    const len = polylineLength(cand);
    if (len < bestLen) {
      bestLen = len;
      best = cand;
    }
  }
  return best;
}

/**
 * Encuentra un camino ortogonal desde `source` hasta `target` evitando las
 * tablas (obstaculos). Retorna la lista de puntos (incluye los extremos) o
 * `null` solo si no existe ninguna ruta posible.
 *
 * Estrategia:
 *   1. Si la recta directa no cruza ninguna tabla, se conserva (original).
 *   2. A* ortogonal sobre una rejilla local; si no halla ruta a la primera,
 *      se reintenta con una rejilla mas amplia (margen x2).
 *   3. Como ultimo recurso se rodea el rectangulo envolvente de las tablas
 *      por su lado libre mas corto (nunca se atraviesa una tabla).
 */
export function findOrthogonalRoute(
  source: Point,
  target: Point,
  obstacles: Rect[],
  opts: RouteOptions = {},
): Point[] | null {
  const cell = opts.cellSize ?? 20;
  const pad = opts.pad ?? 18;
  const margin = opts.margin ?? 40;

  const padded = obstacles
    .filter((o) => o.width > 0 && o.height > 0)
    .map((o) => ({
      x: o.x - pad,
      y: o.y - pad,
      width: o.width + 2 * pad,
      height: o.height + 2 * pad,
    }));

  // Camino rapido: si la recta directa no cruza ninguna tabla, sin desvio.
  // Aqui solo se consideran las tablas intermedias; el origen/destino no
  // aplican porque la recta arranca/finaliza en sus bordes.
  let straightClear = true;
  for (const o of padded) {
    if (segmentIntersectsRect(source, target, o)) {
      straightClear = false;
      break;
    }
  }
  if (straightClear) return [source, target];

  // Para el A*, ademas de las tablas intermedias se bloquean el origen y el
  // destino (expandidos). Asi la ruta no re-entra al cuerpo de las tablas de
  // donde sale o hacia donde entra la relacion ("llegar por otro campo").
  const blocking: Rect[] = [
    ...padded,
    ...(opts.sourceRect
      ? [
          {
            x: opts.sourceRect.x - pad,
            y: opts.sourceRect.y - pad,
            width: opts.sourceRect.width + 2 * pad,
            height: opts.sourceRect.height + 2 * pad,
          },
        ]
      : []),
    ...(opts.targetRect
      ? [
          {
            x: opts.targetRect.x - pad,
            y: opts.targetRect.y - pad,
            width: opts.targetRect.width + 2 * pad,
            height: opts.targetRect.height + 2 * pad,
          },
        ]
      : []),
  ];

  // A* normal y, si falla, reintento con una rejilla mas amplia
  const attempt1 = routeInGrid(source, target, blocking, cell, margin);
  if (attempt1) return attempt1;
  const attempt2 = routeInGrid(source, target, blocking, cell, margin * 2);
  if (attempt2) return attempt2;

  return detourAroundObstacles(source, target, blocking, pad);
}

/**
 * Convierte la polilinea de puntos en el atributo `d` de un path SVG.
 * Redondea levemente las esquinas para un aspecto UML limpio.
 */
export function pointsToSVGPath(points: Point[], radius = 8): string {
  if (points.length < 2) {
    return `M ${points[0]?.x ?? 0} ${points[0]?.y ?? 0}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const next = points[i + 1];
    const dPrev = unit({ x: prev.x - cur.x, y: prev.y - cur.y });
    const dNext = unit({ x: next.x - cur.x, y: next.y - cur.y });
    const r = Math.min(
      radius,
      Math.hypot(prev.x - cur.x, prev.y - cur.y) / 2,
      Math.hypot(next.x - cur.x, next.y - cur.y) / 2,
    );
    const s = { x: cur.x + dPrev.x * r, y: cur.y + dPrev.y * r };
    const e = { x: cur.x + dNext.x * r, y: cur.y + dNext.y * r };
    d += ` L ${s.x} ${s.y} Q ${cur.x} ${cur.y} ${e.x} ${e.y}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

/**
 * Fuerza que los tramos de salida (desde `srcDir`) y entrada (hacia `tgtDir`)
 * de una ruta A* queden ortogonales puros. Sin este ajuste, el primer/ultimo
 * punto pueden ser centros de celda no alineados con el eje del nodo y generar
 * pequenas diagonales visibles justo en el borde de la tabla.
 */
export function orthogonalizeEnds(
  route: Point[],
  srcDir: Point,
  tgtDir: Point,
): Point[] {
  const pts = [...route];
  if (pts.length < 2) return pts;

  // Salida: el punto que sigue al lead debe quedar en el eje del nodo origen
  const s = pts[0];
  const s2 = pts[1];
  const a: Point =
    srcDir.x === 0 ? { x: s.x, y: s2.y } : { x: s2.x, y: s.y };
  if (
    (Math.abs(a.x - s.x) > 0.5 || Math.abs(a.y - s.y) > 0.5) &&
    !(Math.abs(a.x - s2.x) < 0.5 && Math.abs(a.y - s2.y) < 0.5)
  ) {
    pts.splice(1, 0, a);
  }

  if (pts.length < 3) return pts;

  // Entrada: el punto anterior al lead debe quedar en el eje del nodo destino
  const t = pts[pts.length - 1];
  const tp = pts[pts.length - 2];
  const b: Point =
    tgtDir.x === 0 ? { x: tp.x, y: t.y } : { x: t.x, y: tp.y };
  if (
    (Math.abs(b.x - t.x) > 0.5 || Math.abs(b.y - t.y) > 0.5) &&
    !(Math.abs(b.x - tp.x) < 0.5 && Math.abs(b.y - tp.y) < 0.5)
  ) {
    pts.splice(pts.length - 1, 0, b);
  }

  return pts;
}

/** Avanza una distancia `len` desde `p` en direccion `dir`. */
export function advance(p: Point, dir: Point, len: number): Point {
  const u = unit(dir);
  return { x: p.x + u.x * len, y: p.y + u.y * len };
}