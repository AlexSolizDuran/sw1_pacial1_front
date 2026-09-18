/**
 * Test de round-trip de importacion/exportacion XMI Enterprise (EA, 2.5.1).
 *
 * Corre con tsx + linkedom (polyfill de DOMParser para Node):
 *   npx tsx scripts/xmi-roundtrip.test.ts
 *
 * Casos:
 *  1. Export enterprise -> XML valido con raiz xmi:XMI xmi:version="2.5.1".
 *  2. Export enterprise -> import (round-trip) preserva clases, interfaces,
 *     abstractas, enumeraciones, atributos, metodos, literales y relaciones.
 *  3. Import de un XMI enterprise "extranjero" (EA clasico: Generalization
 *     standalone con specific/general) es tolerante.
 *  4. Round-trip multiplicidades (1, 0..*, 1..*, *).
 *  5. Round-trip del formato Umbrello (regresion, barato de cubrir).
 *  6. Import de posiciones de un XMI enterprise extranjero (Sparx EA clasico).
 */
import { DOMParser, Element } from "linkedom";

globalThis.DOMParser = DOMParser as unknown as typeof globalThis.DOMParser;
globalThis.Element = Element as unknown as typeof globalThis.Element;

import { buildXmi } from "../src/lib/export-xmi";
import { parseXmi } from "../src/lib/import-xmi";
import type { DiagramState } from "../src/types/diagram";

let fallos = 0;
let pasados = 0;

function ok(condicion: boolean, etiqueta: string): void {
  if (condicion) {
    pasados += 1;
  } else {
    fallos += 1;
    console.error(`  ✗ ${etiqueta}`);
  }
}

function igual(a: unknown, b: unknown, etiqueta: string): void {
  const sa = JSON.stringify(a);
  const sb = JSON.stringify(b);
  ok(sa === sb, `${etiqueta} (esperaba ${sa}, obtuvo ${sb})`);
}

/** Diagrama de ejemplo con todos los tipos de nodo, miembros y relaciones. */
function diagramaDePrueba(): DiagramState {
  return {
    nodes: [
      {
        id: "n1",
        type: "class",
        position: { x: 120, y: 90 },
        data: {
          name: "Cliente",
          fields: [
            {
              id: "f1",
              visibility: "private",
              name: "id",
              type: "string",
              isStatic: false,
              isReadonly: true,
            },
            {
              id: "f2",
              visibility: "public",
              name: "nombre",
              type: "string",
              isStatic: false,
              isReadonly: false,
              defaultValue: "anonimo",
            },
            {
              id: "f3",
              visibility: "protected",
              name: "activo",
              type: "boolean",
              isStatic: true,
              isReadonly: false,
            },
          ],
          methods: [
            {
              id: "m1",
              visibility: "public",
              name: "getNombre",
              params: [],
              returnType: "string",
              isStatic: false,
              isAbstract: false,
            },
            {
              id: "m2",
              visibility: "private",
              name: "setActivo",
              params: [
                { id: "p1", name: "valor", type: "boolean" },
                { id: "p2", name: "desde", type: "int" },
              ],
              returnType: "void",
              isStatic: false,
              isAbstract: false,
            },
          ],
        },
      },
      {
        id: "n2",
        type: "class",
        position: { x: 480, y: 90 },
        data: {
          name: "Cuenta",
          fields: [
            {
              id: "f1",
              visibility: "public",
              name: "cliente",
              type: "Cliente",
              isStatic: false,
              isReadonly: false,
            },
            {
              id: "f2",
              visibility: "public",
              name: "saldo",
              type: "double",
              isStatic: false,
              isReadonly: false,
            },
          ],
          methods: [
            {
              id: "m1",
              visibility: "public",
              name: "transferir",
              params: [{ id: "p1", name: "monto", type: "double" }],
              returnType: "Cuenta",
              isStatic: false,
              isAbstract: false,
            },
          ],
        },
      },
      {
        id: "n3",
        type: "interface",
        position: { x: 120, y: 330 },
        data: {
          name: "Repositorio",
          fields: [],
          methods: [
            {
              id: "m1",
              visibility: "public",
              name: "buscar",
              params: [{ id: "p1", name: "id", type: "int" }],
              returnType: "Cliente",
              isStatic: false,
              isAbstract: true,
            },
          ],
        },
      },
      {
        id: "n4",
        type: "abstract",
        position: { x: 480, y: 330 },
        data: {
          name: "Entidad",
          fields: [
            {
              id: "f1",
              visibility: "package",
              name: "creadoPor",
              type: "string",
              isStatic: false,
              isReadonly: false,
            },
          ],
          methods: [
            {
              id: "m1",
              visibility: "protected",
              name: "persistir",
              params: [],
              returnType: "void",
              isStatic: false,
              isAbstract: true,
            },
          ],
        },
      },
      {
        id: "n5",
        type: "enumeration",
        position: { x: 300, y: 560 },
        data: {
          name: "Estado",
          fields: [],
          methods: [],
          literals: ["ACTIVO", "INACTIVO", "SUSPENDIDO"],
        },
      },
    ],
    edges: [
      // Herencia: Cuenta -> Cliente
      { id: "e1", source: "n2", target: "n1", type: "inheritance" },
      // Realizacion: Cuenta -> Repositorio
      { id: "e2", source: "n2", target: "n3", type: "implementation" },
      // Dependencia: Cliente -> Repositorio
      { id: "e3", source: "n1", target: "n3", type: "dependency" },
      // Asociacion con etiqueta y multiplicidades
      {
        id: "e4",
        source: "n1",
        target: "n2",
        type: "association",
        label: "posee",
        sourceMultiplicity: "0..*",
        targetMultiplicity: "1",
      },
      // Agregacion: Entidad -> Cuenta
      {
        id: "e5",
        source: "n4",
        target: "n2",
        type: "aggregation",
        sourceMultiplicity: "1",
        targetMultiplicity: "1..*",
      },
      // Composicion: Cuenta -> Cliente
      {
        id: "e6",
        source: "n2",
        target: "n1",
        type: "composition",
      },
      // Multiplicidad "*" (caso que históricamente se rompía)
      {
        id: "e7",
        source: "n3",
        target: "n2",
        type: "association",
        sourceMultiplicity: "*",
      },
    ],
  };
}

// ─────────────────────────────── Suites ───────────────────────────────

function suiteEstructuraXML(): void {
  console.log("1) Export enterprise genera XML valido");
  const xml = buildXmi(diagramaDePrueba(), "ModeloPrueba", "enterprise");
  const doc = new DOMParser().parseFromString(
    xml,
    "application/xml" as unknown as "text/xml",
  );
  ok(doc.getElementsByTagName("parsererror").length === 0, "XML valido");
  const root = doc.documentElement;
  ok(root.tagName.endsWith("XMI"), `raiz <${root.tagName}>`);
  ok(
    root.getAttribute("xmi:version") === "2.5.1",
    `xmi:version=${root.getAttribute("xmi:version")}`,
  );
  const clases = doc.getElementsByTagName("packagedElement");
  ok(clases.length >= 5, `${clases.length} packagedElement`);
}

function suiteRoundTripEnterprise(): void {
  console.log("2) Round-trip enterprise: export -> import");
  const xml = buildXmi(diagramaDePrueba(), "ModeloPrueba", "enterprise");
  const res = parseXmi(xml);
  ok(res.format === "enterprise", `formato detectado: ${res.format}`);
  ok(res.warnings.length === 0, `sin warnings (obtuvo ${res.warnings.join("; ") || "ninguno"})`);
  ok(res.state.nodes.length === 5, `${res.state.nodes.length} nodos`);
  ok(res.state.edges.length === 7, `${res.state.edges.length} relaciones`);

  const porNombre = new Map(
    res.state.nodes.map((n) => [n.data.name, n] as const),
  );

  // Clase Cliente: atributos y metodos
  const cliente = porNombre.get("Cliente");
  ok(!!cliente && cliente.type === "class", "Cliente es class");
  if (cliente) {
    igual(
      cliente.data.fields.map((f) => [f.name, f.type, f.visibility, f.isStatic, f.defaultValue ?? null]),
      [["id", "string", "private", false, null], ["nombre", "string", "public", false, "anonimo"], ["activo", "boolean", "protected", true, null]],
      "atributos de Cliente",
    );
    igual(
      cliente.data.methods.map((m) => [m.name, m.returnType, m.visibility, m.params.map((p) => [p.name, p.type])]),
      [["getNombre", "string", "public", []], ["setActivo", "void", "private", [["valor", "boolean"], ["desde", "int"]]]],
      "metodos de Cliente",
    );
  }

  // Referencia de tipo a otra clase (Cuenta.cliente : Cliente)
  const cuenta = porNombre.get("Cuenta");
  if (cuenta) {
    const campoCliente = cuenta.data.fields.find((f) => f.name === "cliente");
    ok(campoCliente?.type === "Cliente", `tipo de campo cliente: ${campoCliente?.type ?? "null"}`);
    const retTransferir = cuenta.data.methods.find((m) => m.name === "transferir");
    ok(retTransferir?.returnType === "Cuenta", `returnType de transferir: ${retTransferir?.returnType ?? "null"}`);
  }

  // Interfaz con metodo abstracto
  const repo = porNombre.get("Repositorio");
  ok(!!repo && repo.type === "interface", "Repositorio es interface");
  ok((repo?.data.methods[0]?.isAbstract ?? false) === true, "buscar() es abstracto");

  // Clase abstracta
  const entidad = porNombre.get("Entidad");
  ok(!!entidad && entidad.type === "abstract", "Entidad es abstract");
  ok((entidad?.data.methods[0]?.isAbstract ?? false) === true, "persistir() es abstracto");
  const campoPackage = entidad?.data.fields.find((f) => f.name === "creadoPor");
  ok(campoPackage?.visibility === "package", "visibilidad package preservada");

  // Enumeracion con literales
  const estado = porNombre.get("Estado");
  ok(!!estado && estado.type === "enumeration", "Estado es enumeration");
  igual(estado?.data.literals ?? [], ["ACTIVO", "INACTIVO", "SUSPENDIDO"], "literales de Estado");

  // Las posiciones del diagrama original deben sobrevivir al round-trip
  // (la extension de geometria de EA se escribe y se relee al importar).
  const originales = diagramaDePrueba().nodes;
  for (const original of originales) {
    const importado = res.state.nodes.find((n) => n.data.name === original.data.name);
    ok(
      !!importado &&
        importado.position.x === original.position.x &&
        importado.position.y === original.position.y,
      `posicion EA de ${original.data.name} (${original.position.x},${original.position.y})`,
    );
  }

  // Relaciones: mapear por (origen -> tipo -> destino) ya que los ids cambian
  const deNombre = (n: { data: { name: string } }) => n.data.name;
  const rels: Array<{
    type: string;
    src: string;
    tgt: string;
    label: string | undefined;
    sourceMultiplicity: string | undefined;
    targetMultiplicity: string | undefined;
  }> = res.state.edges.map((e) => {
    const src = res.state.nodes.find((n) => n.id === e.source);
    const tgt = res.state.nodes.find((n) => n.id === e.target);
    return {
      type: e.type,
      src: src ? deNombre(src) : e.source,
      tgt: tgt ? deNombre(tgt) : e.target,
      label: e.label,
      sourceMultiplicity: e.sourceMultiplicity,
      targetMultiplicity: e.targetMultiplicity,
    };
  });
  const clave = (r: (typeof rels)[number]) => `${r.src}|${r.type}|${r.tgt}`;
  const tiene = (k: string, extra?: Partial<(typeof rels)[number]>) =>
    rels.some(
      (r): boolean =>
        clave(r) === k &&
        Object.entries(extra ?? {}).every(
          ([campo, val]) =>
            (r as unknown as Record<string, unknown>)[campo] === val,
        ),
    );

  ok(
    tiene("Cuenta|inheritance|Cliente"),
    "herencia Cuenta->Cliente",
  );
  ok(
    tiene("Cuenta|implementation|Repositorio"),
    "realizacion Cuenta->Repositorio",
  );
  ok(
    tiene("Cliente|dependency|Repositorio"),
    "dependencia Cliente->Repositorio",
  );
  ok(
    tiene("Cliente|association|Cuenta", { label: "posee", sourceMultiplicity: "0..*", targetMultiplicity: "1" }),
    "asociacion posee con 0..* / 1",
  );
  ok(
    tiene("Entidad|aggregation|Cuenta", { sourceMultiplicity: "1", targetMultiplicity: "1..*" }),
    "agregacion 1 / 1..*",
  );
  ok(
    tiene("Cuenta|composition|Cliente", { sourceMultiplicity: "1", targetMultiplicity: "1" }),
    "composicion con multiplicidades por defecto",
  );
  // El caso "*": export normaliza a 0..* (equivalente UML)
  ok(
    tiene("Repositorio|association|Cuenta") &&
      rels.some(
        (r) => r.src === "Repositorio" && r.tgt === "Cuenta" && (r.sourceMultiplicity === "*" || r.sourceMultiplicity === "0..*"),
      ),
    `multiplicidad "*" preservada (${rels.find((r) => r.src === "Repositorio" && r.tgt === "Cuenta")?.sourceMultiplicity})`,
  );
}

function suiteXmiExtranjeroEA(): void {
  console.log("3) Import tolerante a XMI enterprise extranjero (clasico EA)");
  const golden = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmlns:xmi="http://www.omg.org/spec/XMI/20131001" xmlns:uml="http://www.omg.org/spec/UML/20110701" xmi:version="2.5.1">
  <uml:Model xmi:id="m_modelo" name="Modelo">
    <packagedElement xmi:type="uml:Class" xmi:id="cls_1" name="Vehiculo" visibility="public">
      <ownedAttribute xmi:type="uml:Property" xmi:id="attr_1" name="patente" visibility="private">
        <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#String"/>
      </ownedAttribute>
      <ownedOperation xmi:type="uml:Operation" xmi:id="op_1" name="acelerar" visibility="public">
        <ownedParameter xmi:type="uml:Parameter" xmi:id="p_ret" name="return" direction="return">
          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#Boolean"/>
        </ownedParameter>
      </ownedOperation>
    </packagedElement>
    <packagedElement xmi:type="uml:Class" xmi:id="cls_2" name="Auto" visibility="public">
      <generalization xmi:type="uml:Generalization" xmi:id="gen_x" general="cls_1"/>
    </packagedElement>
    <packagedElement xmi:type="uml:Generalization" xmi:id="gen_y" general="cls_1" specific="cls_2"/>
    <packagedElement xmi:type="uml:Realization" xmi:id="impl_x" client="cls_2" supplier="cls_1"/>
    <packagedElement xmi:type="uml:Dependency" xmi:id="dep_x" client="cls_1" supplier="cls_2"/>
    <packagedElement xmi:type="uml:Association" xmi:id="assoc_1" name="asocia" visibility="public">
      <memberEnd xmi:idref="end_a"/>
      <memberEnd xmi:idref="end_b"/>
      <ownedEnd xmi:type="uml:Property" xmi:id="end_a" name="origen" type="cls_1" aggregation="none">
        <lowerValue xmi:type="uml:LiteralInteger" xmi:id="la" value="0"/>
        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="ua" value="*"/>
      </ownedEnd>
      <ownedEnd xmi:type="uml:Property" xmi:id="end_b" name="destino" type="cls_2" aggregation="composite">
        <lowerValue xmi:type="uml:LiteralInteger" xmi:id="lb" value="1"/>
        <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="ub" value="1"/>
      </ownedEnd>
    </packagedElement>
  </uml:Model>
</xmi:XMI>`;
  const res = parseXmi(golden);
  ok(res.format === "enterprise", `formato: ${res.format}`);
  ok(res.state.nodes.length === 2, `${res.state.nodes.length} nodos`);
  ok(res.state.edges.length >= 4, `${res.state.edges.length} relaciones`);
  const porNombre = new Map(res.state.nodes.map((n) => [n.data.name, n] as const));
  const vehiculo = porNombre.get("Vehiculo");
  ok(
    (vehiculo?.data.fields.some((f) => f.name === "patente" && f.type === "string" && f.visibility === "private") ?? false),
    "atributo patente (private string)",
  );
  ok(
    (vehiculo?.data.methods.some((m) => m.name === "acelerar" && m.returnType === "boolean") ?? false),
    "metodo acelerar(): boolean",
  );
  const tipos = res.state.edges.map((e) => e.type).sort();
  ok(tipos.includes("inheritance"), "heredada (incluye la anidada)");
  ok(tipos.filter((t) => t === "inheritance").length >= 2, `herencias detectadas: ${tipos.filter((t) => t === "inheritance").length}`);
  ok(tipos.includes("implementation") && tipos.includes("dependency"), "realizacion + dependencia");
  ok(tipos.includes("composition"), "composicion extranjera");
  const asoc = res.state.edges.find((e) => e.type === "composition");
  ok(asoc?.sourceMultiplicity === "0..*" && asoc?.targetMultiplicity === "1", `multiplicidad extranjera: ${asoc?.sourceMultiplicity}/${asoc?.targetMultiplicity}`);
}

function suiteMultiplicidades(): void {
  console.log("4) Multiplicidades: round-trip individual");
  for (const mult of ["1", "0..*", "1..*", "2..5", "*"]) {
    const state: DiagramState = {
      nodes: [
        { id: "a", type: "class", position: { x: 0, y: 0 }, data: { name: "A", fields: [], methods: [] } },
        { id: "b", type: "class", position: { x: 0, y: 0 }, data: { name: "B", fields: [], methods: [] } },
      ],
      edges: [
        { id: "e", source: "a", target: "b", type: "association", sourceMultiplicity: mult, targetMultiplicity: "1" },
      ],
    };
    const res = parseXmi(buildXmi(state, "M", "enterprise"));
    const edge = res.state.edges[0];
    const esperado = mult === "*" ? "0..*" : mult;
    ok(edge?.sourceMultiplicity === esperado, `"${mult}" -> "${edge?.sourceMultiplicity}"`);
  }
}

function suiteRoundTripUmbrello(): void {
  console.log("5) Round-trip umbrello (regresion)");
  const state = diagramaDePrueba();
  const res = parseXmi(buildXmi(state, "Modelo", "umbrello"));
  ok(res.format === "umbrello", `formato: ${res.format}`);
  ok(res.state.nodes.length === 5, `${res.state.nodes.length} nodos`);
  ok(res.state.edges.length === 7, `${res.state.edges.length} relaciones`);
  const porNombre = new Map(res.state.nodes.map((n) => [n.data.name, n] as const));
  ok(porNombre.get("Estado")?.data.literals?.join(",") === "ACTIVO,INACTIVO,SUSPENDIDO", "literales umbrello");
  const campoCliente = porNombre.get("Cuenta")?.data.fields.find((f) => f.name === "cliente");
  ok(campoCliente?.type === "Cliente", "tipo-clase en umbrello");
  const rels = res.state.edges.map((e) => {
    const s = res.state.nodes.find((n) => n.id === e.source);
    const t = res.state.nodes.find((n) => n.id === e.target);
    return `${s ? s.data.name : "?"}|${e.type}|${t ? t.data.name : "?"}`;
  });
  ok(rels.includes("Cuenta|inheritance|Cliente"), "herencia umbrello");
  const asoc = res.state.edges.find((e) => e.type === "association");
  ok(asoc?.sourceMultiplicity === "0..*" && asoc?.targetMultiplicity === "1", "multiplicidades umbrello");

  // Las posiciones del diagrama original deben sobrevivir al round-trip
  // (los widgets escritos por el exportador se releen al importar).
  for (const original of state.nodes) {
    const importado = res.state.nodes.find((n) => n.data.name === original.data.name);
    ok(
      !!importado &&
        importado.position.x === original.position.x &&
        importado.position.y === original.position.y,
      `posicion de ${original.data.name} (${original.position.x},${original.position.y})`,
    );
  }
}

function suiteImportarPosicionesEA(): void {
  console.log("6) Import posiciones de XMI enterprise extranjero (Sparx EA)");
  // Formato real de Enterprise Architect (XMI 2.1): el modelo en uml:Model y
  // la geometria en <xmi:Extension extender="Enterprise Architect"> con
  // <diagrams>/<diagram>/<elements>. El `subject` referencia el xmi:id del
  // clasificador y `geometry` codifica Left/Top/Right/Bottom.
  const golden = `<?xml version="1.0" encoding="UTF-8"?>
<xmi:XMI xmi:version="2.1" xmlns:uml="http://schema.omg.org/spec/UML/2.1" xmlns:xmi="http://schema.omg.org/spec/XMI/2.1">
  <xmi:Documentation exporter="Enterprise Architect" exporterVersion="6.5"/>
  <uml:Model xmi:type="uml:Model" name="EA_Model" visibility="public">
    <packagedElement xmi:type="uml:Package" xmi:id="EAPK_1" name="Modelo" visibility="public">
      <packagedElement xmi:type="uml:Class" xmi:id="EAID_11" name="Usuario" visibility="public">
        <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_111" name="login" visibility="private">
          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#String"/>
        </ownedAttribute>
      </packagedElement>
      <packagedElement xmi:type="uml:Class" xmi:id="EAID_22" name="Perfil" visibility="public">
        <ownedAttribute xmi:type="uml:Property" xmi:id="EAID_221" name="rol" visibility="public">
          <type xmi:type="uml:PrimitiveType" href="http://www.omg.org/spec/UML/20110701/PrimitiveTypes.xmi#String"/>
        </ownedAttribute>
      </packagedElement>
    </packagedElement>
  </uml:Model>
  <xmi:Extension extender="Enterprise Architect" extenderID="6.5">
    <elements>
      <element xmi:idref="EAID_11" xmi:type="uml:Class" name="Usuario"/>
      <element xmi:idref="EAID_22" xmi:type="uml:Class" name="Perfil"/>
    </elements>
    <connectors/>
    <primitivetypes/>
    <profiles/>
    <diagrams>
      <diagram xmi:id="EAID_D"> 
        <model package="EAPK_1" localID="1" owner="EAPK_1"/>
        <properties name="Class Model" type="Logical"/>
        <extendedProperties/>
        <elements>
          <element geometry="Left=290;Top=50;Right=380;Bottom=200;" subject="EAID_11" seqno="1" style="DUID=1;"/>
          <element geometry="Left=70;Top=50;Right=180;Bottom=220;" subject="EAID_22" seqno="2" style="DUID=2;"/>
        </elements>
      </diagram>
    </diagrams>
  </xmi:Extension>
</xmi:XMI>`;
  const res = parseXmi(golden);
  ok(res.format === "enterprise", `formato detectado: ${res.format}`);
  ok(res.state.nodes.length === 2, `${res.state.nodes.length} nodos`);
  const porNombre = new Map(res.state.nodes.map((n) => [n.data.name, n] as const));
  const usuario = porNombre.get("Usuario");
  ok(!!usuario && usuario.position.x === 290 && usuario.position.y === 50, `posicion Usuario (${usuario?.position.x},${usuario?.position.y})`);
  const perfil = porNombre.get("Perfil");
  ok(!!perfil && perfil.position.x === 70 && perfil.position.y === 50, `posicion Perfil (${perfil?.position.x},${perfil?.position.y})`);
  ok(
    (usuario?.data.fields.some((f) => f.name === "login" && f.type === "string" && f.visibility === "private") ?? false),
    "atributo login (private string)",
  );
}

// ───────────────────────────── Main ─────────────────────────────

suiteEstructuraXML();
suiteRoundTripEnterprise();
suiteXmiExtranjeroEA();
suiteMultiplicidades();
suiteRoundTripUmbrello();
suiteImportarPosicionesEA();

console.log(`\n${pasados} checks ok, ${fallos} fallaron`);
if (fallos > 0) process.exit(1);