import type { Nivel } from "@/lib/sla";

/**
 * El chip del semáforo.
 *
 * El rojo va macizo (fondo lleno, texto blanco) y los otros dos en versión
 * suave: en una lista de veinte filas, el ojo tiene que ir al rojo solo.
 */
const CHIP: Record<Nivel, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  crit: "bg-[var(--crit-solid)] text-white",
  neutral: "bg-sunken text-muted",
};

export function Semaforo({
  nivel,
  children,
  className = "",
}: {
  nivel: Nivel;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex flex-none items-center rounded-full px-2.5 py-[3px] text-[11.5px] font-bold whitespace-nowrap ${CHIP[nivel]} ${className}`}
    >
      {children}
    </span>
  );
}

/** El riel de 4 px al borde de la fila. Mismo significado, sin texto. */
export function Riel({ nivel }: { nivel: Nivel }) {
  return <span aria-hidden className={`riel riel-${nivel}`} />;
}

export function Pastilla({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full bg-sunken px-2 py-[2px] text-[11px] text-muted whitespace-nowrap ${className}`}
    >
      {children}
    </span>
  );
}

/** Punto de color para "vencida / hoy / al día". */
export function Punto({ nivel }: { nivel: Nivel }) {
  const color =
    nivel === "crit"
      ? "bg-[var(--crit-solid)]"
      : nivel === "warn"
        ? "bg-[var(--warn-solid)]"
        : nivel === "ok"
          ? "bg-[var(--ok-solid)]"
          : "bg-[#c6c4dc]";

  return <span aria-hidden className={`size-1.5 flex-none rounded-full ${color}`} />;
}
