/**
 * Importador de diagramas de clases UML desde formato XMI.
 *
 * Soporta los dos formatos que genera el exportador (lib/export-xmi.ts):
 *  - "umbrello": XMI 1.2 (UML 1.4) con elementos UML:Class/Interface/
 *    Enumeration, Generalization, Abstraction, Dependency y Association.
 *  - "enterprise": XMI 2.5.1 (UML 2.5) con packagedElement tipados
 *    (uml:Class/Interface/Enumeration/Generalization/Realization/
 *    Dependency/Association).
 *
 * Tambien lee archivos equivalentes de Umbrello y Enterprise Architect
 * mientras respeten esas estructuras. Si el archivo trae la extension
 * de diagrama de Umbrello (clasewidget/interfacewidget/enumwidget con
 * coordenadas x/y) o la de Enterprise Architect (elementos con geometry,
 * sujetos por xmi:id), se usan esas posiciones; si no, los nodos se ubican
 * en cuadricula. Las referencias irresolubles se omiten y se reportan en
 * `warnings`.
 */

import type {
  DiagramState,
  UMLEdgeType,
  UMLField,
  UMLMethod,
  UMLNodeType,
  UMLParameter,
  UMLVisibility,
} from "@/types/diagram";

/** Formato XMI detectado en el documento. */
export type XmiImportFormat = "umbrello" | "enterprise";

/** Resultado de parsear un XMI: estado listo para el lienzo + avisos. */
export interface XmiImportResult {
  format: XmiImportFormat;
  state: DiagramState;
  warnings: string[];
}

/** Genera un id local unico (mismo formato que el editor). */
function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Lee un atributo XML (soporta con y sin prefijo xmi:, y xmi.id de XMI 1.x). */
function attr(el: Element, name: string): string {
  return (
    el.getAttribute(name) ??
    el.getAttribute(`xmi:${name}`) ??
    el.getAttribute(`UML:${name}`) ??
    (name === "id" ? (el.getAttribute("xmi.id") ?? "") : "") ??
    ""
  );
}

/** Hijos directos con un tag dado. */
function children(el: Element, tag: string): Element[] {
  const out: Element[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child instanceof Element && child.tagName === tag) out.push(child);
  }
  return out;
}

/** Primer hijo directo con un tag dado. */
function child(el: Element, tag: string): Element | null {
  for (const c of children(el, tag)) return c;
  return null;
}

/** Hijos directos cuyo tag termina con el sufijo (ignora prefijos). */
function childrenSuffix(el: Element, suffix: string): Element[] {
  const out: Element[] = [];
  for (const child of Array.from(el.childNodes)) {
    if (child instanceof Element && child.tagName.endsWith(suffix)) {
      out.push(child);
    }
  }
  return out;
}

/** Normaliza una visibilidad UML a los valores del editor. */
function toVisibility(value: string): UMLVisibility {
  switch (value) {
    case "private":
      return "private";
    case "protected":
      return "protected";
    case "package":
      return "package";
    default:
      return "public";
  }
}

/** Fragmento #Tipo de un href de PrimitiveTypes -> tipo del editor. */
function primitiveFromHref(href: string): string {
  const frag = href.split("#").pop() ?? "";
  switch (frag.toLowerCase()) {
    case "string":
      return "string";
    case "integer":
      return "int";
    case "real":
      return "double";
    case "boolean":
      return "boolean";
    case "void":
      return "void";
    default:
      return "string";
  }
}

/** Id de tipo T_nombre del exportador -> nombre legible. */
function typeIdToName(typeId: string): string {
  const base = typeId.replace(/^T_/, "").replace(/_/g, " ").trim();
  return base === "" ? "string" : base;
}

/**
 * Lee las posiciones de los widgets del diagrama guardadas por Umbrello.
 *
 * Umbrello guarda la geometria en un bloque `<XMI.extension>` (XMI 1.2) o
 * `<xmi:Extension>` (XMI 2.1) con `extender="umbrello"`, dentro del modelo:
 *   <widgets>
 *     <classwidget xmi.id="cls_Cliente" x="80" y="120" width="150" height="60"/>
 *   </widgets>
 * El `xmi.id` del widget coincide con el `xmi.id` del clasificador que dibuja,
 * por lo que devuelve un mapa xmiId -> { x, y } para posicionar los nodos.
 * @returns Mapa (xmiId del clasificador) -> posicion {x, y}
 */
function readUmbrelloWidgetPositions(doc: XMLDocument): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  // Recorre todos los widgets (classwidget/interfacewidget/enumwidget/...)
  // dentro de cualquier bloque <widgets> del diagrama de Umbrello.
  for (const widget of Array.from(doc.querySelectorAll("widgets > *"))) {
    const tag = widget.tagName.toLowerCase();
    if (!tag.endsWith("widget")) continue;
    const id = attr(widget, "id");
    const rawX = widget.getAttribute("x");
    const rawY = widget.getAttribute("y");
    if (!id || rawX === null || rawY === null) continue;
    const x = Number.parseFloat(rawX);
    const y = Number.parseFloat(rawY);
    if (Number.isNaN(x) || Number.isNaN(y)) continue;
    positions.set(id, { x, y });
  }
  return positions;
}

/**
 * Lee las posiciones de los elementos del diagrama guardadas por Enterprise
 * Architect.
 *
 * EA guarda la geometria en un bloque `<xmi:Extension extender="Enterprise
 * Architect">` (XMI 2.x), dentro de `<diagrams>/<diagram>/<elements>`:
 *   <element geometry="Left=120;Top=90;Right=270;Bottom=150;"
 *            subject="cls_Cliente" seqno="1" style="DUID=1;"/>
 * El atributo `subject` referencia el xmi:id del clasificador dibujado y
 * `geometry` codifica el rectangulo (Left/Top = esquina superior izquierda,
 * Right/Bottom = esquina inferior derecha). Se usa la esquina superior.
 * @returns Mapa (xmiId del clasificador) -> posicion {x, y}
 */
function readEnterpriseElementPositions(
  doc: XMLDocument,
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  for (const element of Array.from(
    doc.querySelectorAll("diagram elements > element"),
  )) {
    const subject = element.getAttribute("subject");
    const geometry = element.getAttribute("geometry");
    if (!subject || !geometry) continue;
    const rect: Record<string, number> = {};
    for (const part of geometry.split(";")) {
      const [key, raw] = part.split("=");
      const value = Number.parseFloat((raw ?? "").trim());
      if (key && !Number.isNaN(value)) rect[key.trim().toLowerCase()] = value;
    }
    const x = rect["left"];
    const y = rect["top"];
    if (typeof x !== "number" || typeof y !== "number") continue;
    positions.set(subject, { x, y });
  }
  return positions;
}

/** Detecta el formato XMI del documento. */
function detectFormat(doc: XMLDocument): XmiImportFormat | null {
  const root = doc.documentElement;
  if (!root || root.tagName !== "XMI" || root.namespaceURI === null) {
    // El tag raiz debe ser XMI (con o sin prefijo xmi:)
    if (!root || !root.tagName.endsWith("XMI")) return null;
  }
  const version =
    root.getAttribute("xmi.version") ?? root.getAttribute("xmi:version") ?? "";
  if (version.startsWith("2.")) return "enterprise";
  if (version.startsWith("1.")) return "umbrello";
  // Sin version: decide por el dialecto de los elementos
  if (doc.getElementsByTagName("UML:Model").length > 0) return "umbrello";
  if (doc.getElementsByTagName("uml:Model").length > 0) return "enterprise";
  return null;
}

interface ParsedNode {
  xmiId: string;
  type: UMLNodeType;
  isAbstract: boolean;
  name: string;
  fields: UMLField[];
  methods: UMLMethod[];
  literals: string[];
}

interface ParsedEdge {
  type: UMLEdgeType;
  sourceXmi: string;
  targetXmi: string;
  label?: string;
  sourceMult?: string;
  targetMult?: string;
}

/** Resuelve el tipo de un atributo/parametro enterprise a nombre simple. */
function enterpriseTypeName(
  container: Element,
  classNames: Map<string, string>,
): string {
  const typeEl =
    child(container, "type") ?? childrenSuffix(container, "type")[0];
  if (!typeEl) return "string";
  const href = typeEl.getAttribute("href") ?? "";
  if (href !== "") return primitiveFromHref(href);
  const idref =
    typeEl.getAttribute("xmi:idref") ?? typeEl.getAttribute("idref") ?? "";
  if (idref !== "") {
    // Referencia a otra clase (cls_...) o a tipo T_....
    const className = classNames.get(idref);
    if (className) return className;
    if (idref.startsWith("T_")) return typeIdToName(idref);
    return "string";
  }
  return "string";
}

/** Parsea un documento Umbrello (XMI 1.2 / UML 1.4). */
function parseUmbrello(doc: XMLDocument, warnings: string[]): {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
} {
  const nodes: ParsedNode[] = [];
  const edges: ParsedEdge[] = [];
  const dataTypes = new Map<string, string>();
  for (const dt of Array.from(doc.getElementsByTagName("UML:DataType"))) {
    const id = attr(dt, "id");
    if (id) dataTypes.set(id, dt.getAttribute("name") || "string");
  }

  const classifiers = [
    ...Array.from(doc.getElementsByTagName("UML:Class")),
    ...Array.from(doc.getElementsByTagName("UML:Interface")),
    ...Array.from(doc.getElementsByTagName("UML:Enumeration")),
  ];
  for (const el of classifiers) {
    const xmiId = attr(el, "id");
    const name = el.getAttribute("name") || "Clase";
    if (el.tagName === "UML:Enumeration") {
      // Literales: directos o dentro de <UML:Enumeration.literal>
      const literals = Array.from(
        el.getElementsByTagName("UML:EnumerationLiteral"),
      ).map((l) => l.getAttribute("name") || "VALOR");
      nodes.push({
        xmiId,
        type: "enumeration",
        isAbstract: false,
        name,
        fields: [],
        methods: [],
        literals,
      });
      continue;
    }
    const type: UMLNodeType =
      el.tagName === "UML:Interface"
        ? "interface"
        : el.getAttribute("isAbstract") === "true"
          ? "abstract"
          : "class";
    nodes.push({
      xmiId,
      type,
      isAbstract: type === "abstract",
      name,
      fields: fieldsFor(el, dataTypes),
      methods: methodsFor(el, dataTypes),
      literals: [],
    });
  }

  for (const g of Array.from(doc.getElementsByTagName("UML:Generalization"))) {
    const ch = g.getAttribute("child") || "";
    const pa = g.getAttribute("parent") || "";
    if (ch !== "" && pa !== "") {
      edges.push({ type: "inheritance", sourceXmi: ch, targetXmi: pa });
    } else {
      warnings.push("Generalizacion sin child/parent: omitida.");
    }
  }
  for (const a of Array.from(doc.getElementsByTagName("UML:Abstraction"))) {
    const cl = a.getAttribute("client") || "";
    const su = a.getAttribute("supplier") || "";
    if (cl !== "" && su !== "") {
      edges.push({ type: "implementation", sourceXmi: cl, targetXmi: su });
    }
  }
  for (const d of Array.from(doc.getElementsByTagName("UML:Dependency"))) {
    const cl = d.getAttribute("client") || "";
    const su = d.getAttribute("supplier") || "";
    if (cl !== "" && su !== "") {
      edges.push({ type: "dependency", sourceXmi: cl, targetXmi: su });
    }
  }
  for (const a of Array.from(doc.getElementsByTagName("UML:Association"))) {
    const conn = child(a, "UML:Association.connection");
    const ends = conn ? children(conn, "UML:AssociationEnd") : [];
    if (ends.length < 2 || !ends[0] || !ends[1]) {
      warnings.push("Asociacion sin dos extremos: omitida.");
      continue;
    }
    const src = ends[0].getAttribute("type") || "";
    const tgt = ends[1].getAttribute("type") || "";
    if (src === "" || tgt === "") {
      warnings.push("Asociacion con extremos sin tipo: omitida.");
      continue;
    }
    const diamond = ends[1].getAttribute("aggregation") || "none";
    const type: UMLEdgeType =
      diamond === "composite"
        ? "composition"
        : diamond === "aggregate"
          ? "aggregation"
          : "association";
    edges.push({
      type,
      sourceXmi: src,
      targetXmi: tgt,
      ...(a.getAttribute("name") ? { label: a.getAttribute("name") ?? "" } : {}),
      ...(ends[0].getAttribute("multiplicity")
        ? { sourceMult: ends[0].getAttribute("multiplicity") ?? "" }
        : {}),
      ...(ends[1].getAttribute("multiplicity")
        ? { targetMult: ends[1].getAttribute("multiplicity") ?? "" }
        : {}),
    });
  }

  return { nodes, edges };
}

/** Atributos de un clasificador Umbrello (helper para prolijidad). */
function fieldsFor(
  el: Element,
  dataTypes: Map<string, string>,
): UMLField[] {
  const out: UMLField[] = [];
  const feature = child(el, "UML:Classifier.feature");
  const scope = feature ? [feature] : [el];
  for (const container of scope) {
    for (const a of children(container, "UML:Attribute")) {
      const typeRef = a.getAttribute("type") || "";
      out.push({
        id: makeId("f"),
        visibility: toVisibility(a.getAttribute("visibility") || ""),
        name: a.getAttribute("name") || "campo",
        type: dataTypes.get(typeRef) ?? "string",
        isStatic: a.getAttribute("ownerScope") === "classifier",
        isReadonly: false,
        ...(a.getAttribute("initialValue")
          ? { defaultValue: a.getAttribute("initialValue") ?? "" }
          : {}),
      });
    }
  }
  return out;
}

/** Operaciones de un clasificador Umbrello (helper para prolijidad). */
function methodsFor(
  el: Element,
  dataTypes: Map<string, string>,
): UMLMethod[] {
  const out: UMLMethod[] = [];
  const feature = child(el, "UML:Classifier.feature");
  const scope = feature ? [feature] : [el];
  for (const container of scope) {
    for (const op of children(container, "UML:Operation")) {
      const params: UMLParameter[] = [];
      let ret = "void";
      const paramBox = child(op, "UML:BehavioralFeature.parameter");
      if (paramBox) {
        for (const p of children(paramBox, "UML:Parameter")) {
          if (p.getAttribute("kind") === "return") {
            const t = p.getAttribute("type") || "";
            ret = dataTypes.get(t) ?? "string";
          } else {
            const t = p.getAttribute("type") || "";
            params.push({
              id: makeId("p"),
              name: p.getAttribute("name") || "param",
              type: dataTypes.get(t) ?? "string",
            });
          }
        }
      }
      out.push({
        id: makeId("m"),
        visibility: toVisibility(op.getAttribute("visibility") || ""),
        name: op.getAttribute("name") || "metodo",
        params,
        returnType: ret,
        isStatic: op.getAttribute("ownerScope") === "classifier",
        isAbstract: op.getAttribute("isAbstract") === "true",
      });
    }
  }
  return out;
}

/** Une lower/upper en notacion de multiplicidad ("1", "0..*", "*"). */
function joinMultiplicity(lower: string, upper: string): string {
  const lo = lower === "" ? "1" : lower;
  const up = upper === "" ? "1" : upper;
  if (up === "*") return lo === "0" || lo === "1" ? `${lo}..*` : "*";
  if (lo === up) return lo;
  return `${lo}..${up}`;
}

/** Parsea un documento Enterprise (XMI 2.5.1). */
function parseEnterprise(doc: XMLDocument, warnings: string[]): {
  nodes: ParsedNode[];
  edges: ParsedEdge[];
} {
  const nodes: ParsedNode[] = [];
  const edges: ParsedEdge[] = [];
  const classNames = new Map<string, string>();

  const packaged = Array.from(doc.getElementsByTagName("packagedElement"));
  // Primera pasada: nombres de clases para resolver type="cls_...".
  for (const el of packaged) {
    const t = el.getAttribute("xmi:type") || "";
    if (
      t === "uml:Class" ||
      t === "uml:Interface" ||
      t === "uml:Enumeration"
    ) {
      const id = el.getAttribute("xmi:id") || "";
      if (id) classNames.set(id, el.getAttribute("name") || "Clase");
    }
  }

  for (const el of packaged) {
    const t = el.getAttribute("xmi:type") || "";
    const xmiId = el.getAttribute("xmi:id") || "";
    const name = el.getAttribute("name") || "Clase";

    if (t === "uml:Enumeration") {
      const literals = children(el, "ownedLiteral").map(
        (l) => l.getAttribute("name") || "VALOR",
      );
      nodes.push({
        xmiId,
        type: "enumeration",
        isAbstract: false,
        name,
        fields: [],
        methods: [],
        literals,
      });
      continue;
    }

    if (t === "uml:Class" || t === "uml:Interface") {
      const type: UMLNodeType =
        t === "uml:Interface"
          ? "interface"
          : el.getAttribute("isAbstract") === "true"
            ? "abstract"
            : "class";
      const fields: UMLField[] = [];
      for (const a of children(el, "ownedAttribute")) {
        fields.push({
          id: makeId("f"),
          visibility: toVisibility(a.getAttribute("visibility") || ""),
          name: a.getAttribute("name") || "campo",
          type: enterpriseTypeName(a, classNames),
          isStatic: a.getAttribute("isStatic") === "true",
          isReadonly: false,
          ...(child(a, "defaultValue")
            ? {
                defaultValue:
                  child(a, "defaultValue")?.getAttribute("value") ?? "",
              }
            : {}),
        });
      }
      const methods: UMLMethod[] = [];
      for (const op of children(el, "ownedOperation")) {
        const params: UMLParameter[] = [];
        let ret = "void";
        for (const p of children(op, "ownedParameter")) {
          const dir = p.getAttribute("direction") || "in";
          if (dir === "return") {
            ret = enterpriseTypeName(p, classNames);
          } else {
            params.push({
              id: makeId("p"),
              name: p.getAttribute("name") || "param",
              type: enterpriseTypeName(p, classNames),
            });
          }
        }
        methods.push({
          id: makeId("m"),
          visibility: toVisibility(op.getAttribute("visibility") || ""),
          name: op.getAttribute("name") || "metodo",
          params,
          returnType: ret,
          isStatic: op.getAttribute("isStatic") === "true",
          isAbstract: op.getAttribute("isAbstract") === "true",
        });
      }
      nodes.push({
        xmiId,
        type,
        isAbstract: type === "abstract",
        name,
        fields,
        methods,
        literals: [],
      });

      // Herencias anidadas (las que genera este exportador): la clase actual
      // es la hija (specific) y `general` es el padre.
      for (const g of children(el, "generalization")) {
        const gen = g.getAttribute("general") || "";
        if (gen !== "" && xmiId !== "") {
          edges.push({ type: "inheritance", sourceXmi: xmiId, targetXmi: gen });
        }
      }
      continue;
    }

    if (t === "uml:Generalization") {
      // De otras herramientas: busca specific/general como atributos.
      const gen = el.getAttribute("general") || "";
      const spec =
        el.getAttribute("specific") ||
        el.getAttribute("client") ||
        el.getAttribute("specificClassifier") ||
        "";
      if (gen !== "" && spec !== "") {
        edges.push({ type: "inheritance", sourceXmi: spec, targetXmi: gen });
      } else {
        warnings.push("Generalizacion sin extremos claros: omitida.");
      }
      continue;
    }

    if (t === "uml:Realization") {
      const cl = el.getAttribute("client") || "";
      const su = el.getAttribute("supplier") || "";
      if (cl !== "" && su !== "") {
        edges.push({ type: "implementation", sourceXmi: cl, targetXmi: su });
      }
      continue;
    }

    if (t === "uml:Dependency") {
      const cl = el.getAttribute("client") || "";
      const su = el.getAttribute("supplier") || "";
      if (cl !== "" && su !== "") {
        edges.push({ type: "dependency", sourceXmi: cl, targetXmi: su });
      }
      continue;
    }

    if (t === "uml:Association") {
      const ends = children(el, "ownedEnd");
      if (ends.length < 2 || !ends[0] || !ends[1]) {
        warnings.push("Asociacion sin dos extremos: omitida.");
        continue;
      }
      const src = ends[0].getAttribute("type") || "";
      const tgt = ends[1].getAttribute("type") || "";
      if (src === "" || tgt === "") {
        warnings.push("Asociacion con extremos sin tipo: omitida.");
        continue;
      }
      const diamond = ends[1].getAttribute("aggregation") || "none";
      const relType: UMLEdgeType =
        diamond === "composite"
          ? "composition"
          : diamond === "aggregate"
            ? "aggregation"
            : "association";
      const multOf = (end: Element): string => {
        const lo =
          child(end, "lowerValue")?.getAttribute("value") ?? "";
        const up =
          child(end, "upperValue")?.getAttribute("value") ?? "";
        return joinMultiplicity(lo, up);
      };
      edges.push({
        type: relType,
        sourceXmi: src,
        targetXmi: tgt,
        ...(el.getAttribute("name")
          ? { label: el.getAttribute("name") ?? "" }
          : {}),
        sourceMult: multOf(ends[0]),
        targetMult: multOf(ends[1]),
      });
    }
  }

  return { nodes, edges };
}

/**
 * Parsea un archivo XMI (Umbrello 1.2 o Enterprise 2.5.1) al estado del
 * lienzo. Las posiciones se generan en cuadricula (el XMI no las trae).
 * @param xml - Contenido del archivo .xmi
 * @returns Formato detectado, estado y avisos de elementos omitidos
 * @throws Error si el XML es invalido o el formato no se reconoce
 */
export function parseXmi(xml: string): XmiImportResult {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("El archivo no es un XML valido.");
  }
  const format = detectFormat(doc);
  if (!format) {
    throw new Error(
      "Formato XMI no reconocido (se espera XMI 1.2 de Umbrello o 2.5.1).",
    );
  }

  const warnings: string[] = [];
  const { nodes, edges } =
    format === "umbrello"
      ? parseUmbrello(doc, warnings)
      : parseEnterprise(doc, warnings);

  if (nodes.length === 0) {
    throw new Error("No se encontraron clases en el archivo XMI.");
  }

  // Posiciones del diagrama: widgets de Umbrello o elementos de EA, por xmiId.
  const widgetPositions = readUmbrelloWidgetPositions(doc);
  const eaElementPositions = readEnterpriseElementPositions(doc);

  // Ids locales + mapa xmiId -> id real para resolver relaciones.
  const idMap = new Map<string, string>();
  const stateNodes: DiagramState["nodes"] = nodes.map((n, i) => {
    const id = makeId(n.type);
    if (n.xmiId) idMap.set(n.xmiId, id);
    // Prioriza la posicion del widget de Umbrello; si no, la de EA; si no, cuadricula.
    const widget = n.xmiId ? widgetPositions.get(n.xmiId) : undefined;
    const eaPos = n.xmiId ? eaElementPositions.get(n.xmiId) : undefined;
    const widgetPos = widget ?? eaPos;
    return {
      id,
      type: n.type,
      position: widgetPos
        ? { x: widgetPos.x, y: widgetPos.y }
        : { x: 80 + (i % 4) * 280, y: 80 + Math.floor(i / 4) * 220 },
      data: {
        name: n.name,
        fields: n.fields,
        methods: n.methods,
        ...(n.type === "enumeration" ? { literals: n.literals } : {}),
      },
    };
  });

  const stateEdges: DiagramState["edges"] = [];
  for (const e of edges) {
    const source = idMap.get(e.sourceXmi);
    const target = idMap.get(e.targetXmi);
    if (!source || !target) {
      warnings.push(
        `Relacion ${e.type} con extremos desconocidos: omitida.`,
      );
      continue;
    }
    stateEdges.push({
      id: makeId("edge"),
      source,
      target,
      type: e.type,
      ...(e.label ? { label: e.label } : {}),
      ...(e.sourceMult ? { sourceMultiplicity: e.sourceMult } : {}),
      ...(e.targetMult ? { targetMultiplicity: e.targetMult } : {}),
    });
  }

  return { format, state: { nodes: stateNodes, edges: stateEdges }, warnings };
}
