/**
 * Exportador del diagrama de clases UML a formato XMI.
 *
 * Soporta dos formatos:
 *  - "umbrello": XMI 1.2 (UML 1.4), replicando el formato nativo que escribe
 *    Umbrello 26.x (funcion `saveToXMI` de `umldoc.cpp` en su modo UML1).
 *  - "enterprise": XMI 2.5.1 (UML 2.5) estandar, orientado a Sparx Enterprise
 *    Architect y otras herramientas que usan XMI 2.x.
 *
 * Util para compartir el diagrama con otras herramientas UML o como documentacion.
 */

import type { DiagramState, UMLNodeType, UMLEdgeType } from "@/types/diagram";

/** Formatos de exportacion XMI soportados. */
export type XmiFormat = "umbrello" | "enterprise";

/** Mapea la visibilidad de un miembro a la notacion UML estandar. */
function toUmlVisibility(visibility: string | undefined): string {
  switch (visibility) {
    case "protected":
      return "protected";
    case "private":
      return "private";
    case "package":
      return "package";
    default:
      return "public";
  }
}

/** Escapa caracteres especiales XML para evitar romper el documento resultante. */
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** Devuelve un id XMI valido (sin caracteres problematicos). */
function xmiId(prefix: string, raw: string): string {
  return `${prefix}_${escapeXml(raw.replace(/[^a-zA-Z0-9]/g, "_"))}`;
}

/** URI de un tipo primitivo UML 2.5 (para el formato Enterprise/EA). */
const PRIMITIVE_HREF: Record<string, string> = {
  string: "http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#String",
  int: "http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Integer",
  integer: "http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Integer",
  double: "http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Real",
  float: "http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Real",
  real: "http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Real",
  boolean: "http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Boolean",
  void: "http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Void",
};

/** Convierte un nombre de tipo en un id de tipo estabilizado. */
function typeToId(name: string): string {
  const base = name
    .trim()
    .replace(/[^a-zA-Z0-9]/g, "_")
    .toLowerCase();
  return `T_${base || "string"}`;
}

/** Indica si un tipo es primitivo (usa href vs element). */
function isPrimitiveType(name: string): boolean {
  return name in PRIMITIVE_HREF;
}

/**
 * Construye la cadena XMI 1.2 (UML 1.4) para Umbrello.
 * @param state Estado serializado del diagrama (nodos + aristas).
 * @param modelName Nombre del modelo raiz.
 * @returns Contenido XML completo listo para guardarse como `.xmi`.
 */
function buildUmbrelloXmi(state: DiagramState, modelName: string): string {
  const nodes = state.nodes ?? [];
  const edges = state.edges ?? [];

  // Recopila todos los tipos referenciados por campos/metodos para emitir DataTypes.
  const types = new Set<string>(["string", "int", "double", "void", "boolean"]);
  for (const node of nodes) {
    for (const field of node.data.fields ?? []) {
      if (field.type) types.add(field.type);
    }
    for (const method of node.data.methods ?? []) {
      if (method.returnType && method.returnType !== "void") {
        types.add(method.returnType);
      }
      for (const param of method.params ?? []) {
        if (param.type) types.add(param.type);
      }
    }
  }

  const modelId = xmiId("m", modelName);

  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(
    `<XMI xmi.version="1.2" timestamp="2026-09-03T00:00:00" verified="false" xmlns:UML="http://schema.omg.org/spec/UML/1.4">`,
  );
  parts.push(`  <XMI.header>`);
  parts.push(`    <XMI.documentation>`);
  parts.push(`      <XMI.exporter>UML Class Diagram Exporter</XMI.exporter>`);
  parts.push(`      <XMI.exporterVersion>1.0</XMI.exporterVersion>`);
  parts.push(`      <XMI.exporterEncoding>UnicodeUTF8</XMI.exporterEncoding>`);
  parts.push(`    </XMI.documentation>`);
  parts.push(
    `    <XMI.metamodel xmi.name="UML" xmi.version="1.4" href="UML.xml"/>`,
  );
  parts.push(`  </XMI.header>`);
  parts.push(``);
  parts.push(`  <XMI.content>`);
  parts.push(
    `    <UML:Model xmi.id="${modelId}" name="${escapeXml(modelName)}" isSpecification="false" isAbstract="false" isRoot="false" isLeaf="false">`,
  );
  parts.push(`      <UML:Namespace.ownedElement>`);

  // -------- Querido diagramada: Clases / interfaces / abstractas / enumeraciones --------
  for (const node of nodes) {
    const nodeId = xmiId("cls", node.id);
    const nodeType = (node.type as UMLNodeType | undefined) ?? "class";
    const isAbstract = nodeType === "abstract" || node.data.isAbstract === true;
    const nodeIsEnum = nodeType === "enumeration";

    if (nodeIsEnum) {
      parts.push(
        `        <UML:Enumeration xmi.id="${nodeId}" name="${escapeXml(node.data.name || "Enumeracion")}" isSpecification="false" isLeaf="false" isRoot="false" isAbstract="false" visibility="public">`,
      );
      parts.push(`          <UML:Enumeration.literal>`);
      for (const literal of node.data.literals ?? []) {
        parts.push(
          `            <UML:EnumerationLiteral xmi.id="${nodeId}_lit_${escapeXml(literal.replace(/[^a-zA-Z0-9]/g, "_") || "VALOR")}" name="${escapeXml(literal)}"/>`,
        );
      }
      parts.push(`          </UML:Enumeration.literal>`);
      parts.push(`        </UML:Enumeration>`);
      continue;
    }

    const isInterface = nodeType === "interface";
    const classifierEl = isInterface
      ? `        <UML:Interface xmi.id="${nodeId}" name="${escapeXml(node.data.name || "Interfaz")}" isSpecification="false" isLeaf="false" isRoot="false" isAbstract="false" visibility="public">`
      : `        <UML:Class xmi.id="${nodeId}" name="${escapeXml(node.data.name || "Clase")}" isSpecification="false" isLeaf="false" isRoot="false" isAbstract="${isAbstract ? "true" : "false"}" visibility="public">`;
    parts.push(classifierEl);
    parts.push(`          <UML:Classifier.feature>`);

    for (const field of node.data.fields ?? []) {
      const fieldId = xmiId("attr", field.id || `${node.id}_${field.name}`);
      const typeId = xmiId("dt", field.type || "string");
      const attrs = [
        `xmi.id="${fieldId}"`,
        `name="${escapeXml(field.name)}"`,
        `type="${typeId}"`,
        `visibility="${toUmlVisibility(field.visibility)}"`,
      ];
      if (field.isStatic) attrs.push(`ownerScope="classifier"`);
      if (field.defaultValue) {
        attrs.push(`initialValue="${escapeXml(field.defaultValue)}"`);
      }
      parts.push(`            <UML:Attribute ${attrs.join(" ")}/>`);
    }

    for (const method of node.data.methods ?? []) {
      const methodId = xmiId("op", method.id || `${node.id}_${method.name}`);
      const methodAttrs = [
        `xmi.id="${methodId}"`,
        `name="${escapeXml(method.name)}"`,
        `visibility="${toUmlVisibility(method.visibility)}"`,
      ];
      if (method.isStatic) methodAttrs.push(`ownerScope="classifier"`);
      if (method.isAbstract) methodAttrs.push(`isAbstract="true"`);
      parts.push(`            <UML:Operation ${methodAttrs.join(" ")}>`);
      parts.push(`              <UML:BehavioralFeature.parameter>`);

      if (method.returnType && method.returnType !== "void") {
        parts.push(
          `                <UML:Parameter xmi.id="${methodId}_ret" type="${xmiId("dt", method.returnType)}" kind="return"/>`,
        );
      }

      for (const param of method.params ?? []) {
        parts.push(
          `                <UML:Parameter xmi.id="${methodId}_p_${escapeXml(param.id || param.name)}" name="${escapeXml(param.name)}" type="${xmiId("dt", param.type || "string")}" kind="in"/>`,
        );
      }

      parts.push(`              </UML:BehavioralFeature.parameter>`);
      parts.push(`            </UML:Operation>`);
    }

    parts.push(`          </UML:Classifier.feature>`);
    parts.push(
      isInterface
        ? `        </UML:Interface>`
        : `        </UML:Class>`,
    );
  }

  // -------- Tipos de datos ---------
  for (const type of Array.from(types).sort()) {
    parts.push(
      `        <UML:DataType xmi.id="${xmiId("dt", type)}" name="${escapeXml(type)}" isSpecification="false"/>`,
    );
  }

  // -------- Relaciones --------
  for (const edge of edges) {
    const edgeType = (edge.type as UMLEdgeType) || "association";

    if (edgeType === "inheritance") {
      parts.push(
        `        <UML:Generalization xmi.id="${xmiId("gen", edge.id)}" isSpecification="false" child="${xmiId("cls", edge.source)}" parent="${xmiId("cls", edge.target)}"/>`,
      );
      continue;
    }
    if (edgeType === "implementation") {
      parts.push(
        `        <UML:Abstraction xmi.id="${xmiId("impl", edge.id)}" isSpecification="false" client="${xmiId("cls", edge.source)}" supplier="${xmiId("cls", edge.target)}"/>`,
      );
      continue;
    }
    if (edgeType === "dependency") {
      parts.push(
        `        <UML:Dependency xmi.id="${xmiId("dep", edge.id)}" isSpecification="false" client="${xmiId("cls", edge.source)}" supplier="${xmiId("cls", edge.target)}"/>`,
      );
      continue;
    }

    // Asociacion / agregacion / composicion
    const assocId = xmiId("assoc", edge.id);
    const nameAttr = edge.label ? escapeXml(edge.label) : "";
    parts.push(
      `        <UML:Association xmi.id="${assocId}" name="${nameAttr}" isSpecification="false" visibility="public">`,
    );
    parts.push(`          <UML:Association.connection>`);

    const edgeData = edge as typeof edge & {
      sourceMultiplicity?: string;
      targetMultiplicity?: string;
    };
    const srcMult = edgeData.sourceMultiplicity || "1";
    const tgtMult = edgeData.targetMultiplicity || "1";
    const diamondEnd = edgeType === "composition" || edgeType === "aggregation";

    const agg = (isDiamondEnd: boolean): string => {
      if (edgeType === "composition") return isDiamondEnd ? "composite" : "none";
      if (edgeType === "aggregation") return isDiamondEnd ? "aggregate" : "none";
      return "none";
    };

    parts.push(
      `            <UML:AssociationEnd xmi.id="${xmiId("end", `${edge.id}_a`)}" name="${escapeXml(edge.label || "")}" type="${xmiId("cls", edge.source)}" multiplicity="${escapeXml(srcMult)}" aggregation="${agg(false)}" isNavigable="true" visibility="public" changeability="changeable"/>`,
    );
    parts.push(
      `            <UML:AssociationEnd xmi.id="${xmiId("end", `${edge.id}_b`)}" name="" type="${xmiId("cls", edge.target)}" multiplicity="${escapeXml(tgtMult)}" aggregation="${agg(diamondEnd)}" isNavigable="false" visibility="public" changeability="changeable"/>`,
    );

    parts.push(`          </UML:Association.connection>`);
    parts.push(`        </UML:Association>`);
  }

  parts.push(`      </UML:Namespace.ownedElement>`);
  parts.push(`    </UML:Model>`);
  parts.push(`  </XMI.content>`);
  parts.push(``);
  parts.push(`  <XMI.extensions xmi.extender="umbrello">`);
  parts.push(`  </XMI.extensions>`);
  parts.push(`</XMI>`);

  return parts.join("\n");
}

/**
 * Construye la cadena XMI 2.5.1 (UML 2.5) para Enterprise Architect.
 * @param state Estado serializado del diagrama (nodos + aristas).
 * @param modelName Nombre del modelo raiz.
 * @returns Contenido XML completo listo para guardarse como `.xmi`.
 */
function buildEnterpriseXmi(state: DiagramState, modelName: string): string {
  const nodes = state.nodes ?? [];
  const edges = state.edges ?? [];

  const modelId = xmiId("m", modelName);

  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push(
    `<xmi:XMI xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20110701" xmi:version="2.5.1">`,
  );
  parts.push(`  <xmi:Documentation>`);
  parts.push(`    <xmi:exporter>UML Class Diagram Exporter</xmi:exporter>`);
  parts.push(`    <xmi:exporterVersion>1.0</xmi:exporterVersion>`);
  parts.push(`  </xmi:Documentation>`);
  parts.push(``);
  parts.push(
    `  <uml:Model xmi:id="${modelId}" name="${escapeXml(modelName)}">`,
  );

  // -------- Clases / interfaces / abstractas / enumeraciones --------
  for (const node of nodes) {
    const nodeId = xmiId("cls", node.id);
    const nodeType = (node.type as UMLNodeType | undefined) ?? "class";
    const isAbstract = nodeType === "abstract" || node.data.isAbstract === true;
    const umlType =
      nodeType === "interface"
        ? "uml:Interface"
        : nodeType === "enumeration"
          ? "uml:Enumeration"
          : "uml:Class";

    if (nodeType === "enumeration") {
      parts.push(
        `    <packagedElement xmi:type="uml:Enumeration" xmi:id="${nodeId}" name="${escapeXml(node.data.name || "Enumeracion")}" visibility="public">`,
      );
      for (const literal of node.data.literals ?? []) {
        const litId = `${nodeId}_lit_${escapeXml(literal.replace(/[^a-zA-Z0-9]/g, "_") || "VALOR")}`;
        parts.push(
          `      <ownedLiteral xmi:type="uml:EnumerationLiteral" xmi:id="${litId}" name="${escapeXml(literal)}"/>`,
        );
      }
      parts.push(`    </packagedElement>`);
      continue;
    }

    const openTag = [
      `    <packagedElement xmi:type="${umlType}"`,
      `                xmi:id="${nodeId}"`,
      `                name="${escapeXml(node.data.name || "Clase")}"`,
      ...(isAbstract ? [`                isAbstract="true"`] : []),
      `                visibility="public">`,
    ].join("\n");
    parts.push(openTag);

    for (const field of node.data.fields ?? []) {
      const fieldId = xmiId("attr", field.id || `${node.id}_${field.name}`);
      const typeName = field.type || "string";
      const typeId = typeToId(typeName);
      parts.push(
        `      <ownedAttribute xmi:type="uml:Property" xmi:id="${fieldId}" name="${escapeXml(field.name)}" visibility="${toUmlVisibility(field.visibility)}"${field.isStatic ? ` isStatic="true"` : ""}>`,
      );
      // Tipo del atributo
      if (isPrimitiveType(typeName.toLowerCase())) {
        parts.push(
          `        <type xmi:type="uml:PrimitiveType" href="${PRIMITIVE_HREF[typeName.toLowerCase()]}"/>`,
        );
      } else {
        parts.push(`        <type xmi:idref="${typeId}"/>`);
      }
      if (field.defaultValue) {
        parts.push(
          `        <defaultValue xmi:type="uml:LiteralString" xmi:id="${fieldId}_def" value="${escapeXml(field.defaultValue)}"/>`,
        );
      }
      parts.push(`      </ownedAttribute>`);
    }

    for (const method of node.data.methods ?? []) {
      const methodId = xmiId("op", method.id || `${node.id}_${method.name}`);
      parts.push(
        `      <ownedOperation xmi:type="uml:Operation" xmi:id="${methodId}" name="${escapeXml(method.name)}" visibility="${toUmlVisibility(method.visibility)}"${method.isAbstract ? ` isAbstract="true"` : ""}${method.isStatic ? ` isStatic="true"` : ""}>`,
      );
      if (method.returnType && method.returnType !== "void") {
        const retType = method.returnType.toLowerCase();
        parts.push(
          `        <ownedParameter xmi:type="uml:Parameter" xmi:id="${methodId}_ret" name="return" direction="return">`,
        );
        if (isPrimitiveType(retType)) {
          parts.push(
            `          <type xmi:type="uml:PrimitiveType" href="${PRIMITIVE_HREF[retType]}"/>`,
          );
        } else {
          parts.push(`          <type xmi:idref="${typeToId(method.returnType)}"/>`);
        }
        parts.push(`        </ownedParameter>`);
      }
      for (const idx in method.params ?? []) {
        const param = method.params[idx];
        const paramId = xmiId("p", `${method.id}_${param.id || param.name}`);
        parts.push(
          `        <ownedParameter xmi:type="uml:Parameter" xmi:id="${paramId}" name="${escapeXml(param.name)}" direction="in">`,
        );
        if (isPrimitiveType((param.type || "string").toLowerCase())) {
          parts.push(
            `          <type xmi:type="uml:PrimitiveType" href="${PRIMITIVE_HREF[(param.type || "string").toLowerCase()]}"/>`,
          );
        } else {
          parts.push(
            `          <type xmi:idref="${typeToId(param.type || "string")}"/>`,
          );
        }
        parts.push(`        </ownedParameter>`);
      }
      parts.push(`      </ownedOperation>`);
    }

    parts.push(`    </packagedElement>`);
  }

  // -------- Relaciones --------
  for (const edge of edges) {
    const edgeType = (edge.type as UMLEdgeType) || "association";
    const srcId = xmiId("cls", edge.source);
    const tgtId = xmiId("cls", edge.target);

    if (edgeType === "inheritance") {
      parts.push(
        `    <packagedElement xmi:type="uml:Generalization" xmi:id="${xmiId("gen", edge.id)}" general="${tgtId}">`,
      );
      parts.push(`      <general xmi:idref="${tgtId}"/>`);
      parts.push(`    </packagedElement>`);
      continue;
    }
    if (edgeType === "implementation") {
      parts.push(
        `    <packagedElement xmi:type="uml:Realization" xmi:id="${xmiId("impl", edge.id)}" client="${srcId}" supplier="${tgtId}"/>`,
      );
      continue;
    }
    if (edgeType === "dependency") {
      parts.push(
        `    <packagedElement xmi:type="uml:Dependency" xmi:id="${xmiId("dep", edge.id)}" client="${srcId}" supplier="${tgtId}"/>`,
      );
      continue;
    }

    // Asociacion / agregacion / composicion
    const assocId = xmiId("assoc", edge.id);
    const endA = `${assocId}_a`;
    const endB = `${assocId}_b`;
    const edgeData = edge as typeof edge & {
      sourceMultiplicity?: string;
      targetMultiplicity?: string;
    };
    const srcMult = edgeData.sourceMultiplicity || "1";
    const tgtMult = edgeData.targetMultiplicity || "1";
    const diamondEnd = edgeType === "composition" || edgeType === "aggregation";
    const agg = (isDiamondEnd: boolean): string => {
      if (edgeType === "composition") return isDiamondEnd ? "composite" : "none";
      if (edgeType === "aggregation") return isDiamondEnd ? "aggregate" : "none";
      return "none";
    };

    parts.push(
      `    <packagedElement xmi:type="uml:Association" xmi:id="${assocId}" name="${escapeXml(edge.label || "")}" visibility="public">`,
    );
    parts.push(`      <memberEnd xmi:idref="${endA}"/>`);
    parts.push(`      <memberEnd xmi:idref="${endB}"/>`);
    // Extremo A (origen)
    parts.push(
      `      <ownedEnd xmi:type="uml:Property" xmi:id="${endA}" name="${escapeXml(edge.label || "")}" type="${srcId}" aggregation="${agg(false)}" association="${assocId}">`,
    );
    parts.push(
      `        <lowerValue xmi:type="uml:LiteralInteger" xmi:id="${endA}_lo" value="${escapeXml(srcMult.split("..")[0] || "1")}"/>`,
    );
    parts.push(
      `        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="${endA}_up" value="${escapeXml(srcMult.split("..")[1] || "1")}"/>`,
    );
    parts.push(`      </ownedEnd>`);
    // Extremo B (destino)
    parts.push(
      `      <ownedEnd xmi:type="uml:Property" xmi:id="${endB}" name="" type="${tgtId}" aggregation="${agg(diamondEnd)}" association="${assocId}">`,
    );
    parts.push(
      `        <lowerValue xmi:type="uml:LiteralInteger" xmi:id="${endB}_lo" value="${escapeXml(tgtMult.split("..")[0] || "1")}"/>`,
    );
    parts.push(
      `        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="${endB}_up" value="${escapeXml(tgtMult.split("..")[1] || "1")}"/>`,
    );
    parts.push(`      </ownedEnd>`);
    parts.push(`    </packagedElement>`);
  }

  parts.push(`  </uml:Model>`);
  parts.push(`</xmi:XMI>`);

  return parts.join("\n");
}

/**
 * Construye la cadena XMI en el formato indicado.
 * @param state Estado serializado del diagrama (nodos + aristas).
 * @param modelName Nombre del modelo raiz.
 * @param format Formato de salida ("umbrello" por defecto).
 * @returns Contenido XML completo listo para guardarse como `.xmi`.
 */
export function buildXmi(
  state: DiagramState,
  modelName = "Model",
  format: XmiFormat = "umbrello",
): string {
  if (format === "enterprise") {
    return buildEnterpriseXmi(state, modelName);
  }
  return buildUmbrelloXmi(state, modelName);
}

/** Descarga el contenido XML como archivo en el navegador. */
function triggerDownload(xml: string, baseName: string, extension: string): void {
  const safeName = baseName.replace(/[^a-zA-Z0-9_-]/g, "_") || "diagrama";
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeName}.${extension}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Genera y descarga el archivo `.xmi` en el navegador.
 * @param state Estado del diagrama a exportar.
 * @param diagramName Nombre usado para el archivo y el modelo raiz.
 * @param format Formato de exportacion (por defecto "umbrello").
 */
export function downloadXmi(
  state: DiagramState,
  diagramName: string,
  format: XmiFormat = "umbrello",
): void {
  const xml = buildXmi(state, diagramName, format);
  const suffix = format === "enterprise" ? "_ea" : "_umbrello";
  triggerDownload(xml, `${diagramName}${suffix}`, "xmi");
}
