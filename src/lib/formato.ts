/** Formateo para pantalla. Argentina: punto de miles, coma decimal. */

const NF = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 0 });

export function precio(
  valor: string | number | null | undefined,
  moneda: "USD" | "ARS" = "USD",
): string {
  if (valor === null || valor === undefined || valor === "") return "Consultar";

  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "Consultar";

  return `${moneda === "USD" ? "USD" : "$"} ${NF.format(n)}`;
}

export function numero(valor: string | number | null | undefined): string {
  if (valor === null || valor === undefined || valor === "") return "—";
  const n = typeof valor === "string" ? Number(valor) : valor;
  return Number.isFinite(n) ? NF.format(n) : "—";
}

const DF = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Argentina/Buenos_Aires",
});

const DTF = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

export function fecha(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const v = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(v.getTime()) ? "—" : DF.format(v);
}

export function fechaHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const v = typeof d === "string" ? new Date(d) : d;
  return Number.isNaN(v.getTime()) ? "—" : DTF.format(v);
}

/** "hace 3 h", "en 2 días" */
export function relativo(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const v = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(v.getTime())) return "—";

  const min = Math.round((v.getTime() - Date.now()) / 60_000);
  const abs = Math.abs(min);

  const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });

  if (abs < 60) return rtf.format(min, "minute");
  if (abs < 60 * 24) return rtf.format(Math.round(min / 60), "hour");
  return rtf.format(Math.round(min / 1440), "day");
}

export const ETIQUETAS = {
  rol: {
    titular: "Titular",
    administrativa: "Administrativa",
    vendedor: "Vendedor",
  } as Record<string, string>,

  canal: {
    whatsapp: "WhatsApp",
    instagram: "Instagram",
    facebook: "Facebook",
    zonaprop: "Zonaprop",
    llamada: "Llamada",
    mostrador: "Mostrador",
    web: "Web",
  } as Record<string, string>,

  estadoConsulta: {
    no_atendido: "No atendido",
    contactado: "Contactado",
    recontactar: "Re-contactar",
    ganado: "Ganado",
    rechazado: "Rechazado",
  } as Record<string, string>,

  motivoRechazo: {
    compro_en_otra: "Compró en otra inmobiliaria",
    no_calificaba: "No calificaba",
    nunca_respondio: "Nunca respondió",
    fuera_de_zona: "Fuera de zona",
    precio: "Precio",
  } as Record<string, string>,

  tipoPropiedad: {
    casa: "Casa",
    departamento: "Departamento",
    ph: "PH",
    lote: "Lote",
    campo: "Campo",
    local: "Local",
    galpon: "Galpón",
    cochera: "Cochera",
    quinta: "Quinta",
  } as Record<string, string>,

  estadoPropiedad: {
    borrador: "Borrador",
    publicada: "Publicada",
    reservada: "Reservada",
    vendida: "Vendida",
    suspendida: "Suspendida",
  } as Record<string, string>,

  tipoActividad: {
    nota: "Nota",
    llamada: "Llamada",
    whatsapp: "WhatsApp",
    email: "Email",
    visita: "Visita",
    oferta: "Oferta",
    cambio_estado: "Cambio de estado",
  } as Record<string, string>,
};
