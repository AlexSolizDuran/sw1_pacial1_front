/**
 * Encabezado de un elemento UML: muestra el estereotipo (opcional) y el
 * nombre en el header de la tarjeta.
 * Los estereotipos se muestran como <<interface>>, <<abstract>>, <<enumeration>>.
 * El header usa los tokens del sistema (Proton) con acento del primario.
 */
export function NodeHeader({
  name,
  stereotype,
  italic = false,
}: {
  name: string;
  stereotype?: string;
  /** Nombre en cursiva (convencion UML para clases abstractas). */
  italic?: boolean;
}) {
  return (
    <div className="rounded-t-md bg-primary-container px-3 py-2 text-center">
      {stereotype && (
        <div className="font-mono text-[10px] italic text-on-primary-container">
          &lt;&lt;{stereotype}&gt;&gt;
        </div>
      )}
      <span
        className={`font-headline text-sm font-semibold text-on-primary-container ${
          italic ? "italic" : ""
        }`}
      >
        {name}
      </span>
    </div>
  );
}