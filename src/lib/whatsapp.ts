import { paraWhatsApp } from "./telefono";
import { precio as fmtPrecio } from "./formato";
import type { Contacto, Propiedad, Usuario } from "@/db/schema";

/**
 * Links wa.me con el mensaje ya escrito.
 *
 * Decisión del plan: NO se usa la API oficial de Meta. Cobra por conversación,
 * exige aprobación de plantillas y con el volumen de esta inmobiliaria no se
 * justifica. El link abre WhatsApp con el texto cargado y funciona desde el día uno.
 */

export const NOMBRE_AGENCIA = "María Paz Boyer Negocios Inmobiliarios";

function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

function describir(p: Propiedad): string {
  const partes: string[] = [];
  if (p.ambientes) partes.push(`${p.ambientes} amb`);
  if (p.dormitorios) partes.push(`${p.dormitorios} dorm`);

  const detalle = partes.length ? ` de ${partes.join(", ")}` : "";
  const barrio = p.barrio ? ` en ${p.barrio}` : "";

  return `${p.tipo}${detalle}${barrio}, ${p.direccion}`;
}

export type Plantilla = {
  id: string;
  etiqueta: string;
  /** Si es true, no se ofrece cuando la consulta no tiene propiedad asociada. */
  requierePropiedad?: boolean;
  texto: (ctx: {
    contacto: Contacto;
    propiedad: Propiedad | null;
    vendedor: Usuario;
  }) => string;
};

export const PLANTILLAS: Plantilla[] = [
  {
    id: "primer_contacto",
    etiqueta: "Primer contacto",
    requierePropiedad: true,
    texto: ({ contacto, propiedad, vendedor }) =>
      `Hola ${primerNombre(contacto.nombre)}, ¿cómo estás? Soy ${primerNombre(vendedor.nombre)} de ${NOMBRE_AGENCIA}.\n\n` +
      `Te escribo por tu consulta sobre ${describir(propiedad!)} — ${fmtPrecio(propiedad!.precio, propiedad!.moneda)}.\n\n` +
      `¿Querés que coordinemos una visita para conocerla?`,
  },
  {
    id: "primer_contacto_sin_prop",
    etiqueta: "Primer contacto (general)",
    texto: ({ contacto, vendedor }) =>
      `Hola ${primerNombre(contacto.nombre)}, ¿cómo estás? Soy ${primerNombre(vendedor.nombre)} de ${NOMBRE_AGENCIA}.\n\n` +
      `Recibí tu consulta. Para poder ayudarte mejor, ¿me contás qué estás buscando? ` +
      `Tipo de propiedad, zona y presupuesto aproximado.`,
  },
  {
    id: "confirmar_visita",
    etiqueta: "Confirmar visita",
    requierePropiedad: true,
    texto: ({ contacto, propiedad, vendedor }) =>
      `Hola ${primerNombre(contacto.nombre)}, te confirmo la visita a ${propiedad!.direccion}.\n\n` +
      `Nos encontramos en la puerta. Cualquier cosa escribime por acá.\n\n` +
      `${primerNombre(vendedor.nombre)} — ${NOMBRE_AGENCIA}`,
  },
  {
    id: "seguimiento",
    etiqueta: "Seguimiento post-visita",
    requierePropiedad: true,
    texto: ({ contacto, propiedad }) =>
      `Hola ${primerNombre(contacto.nombre)}, ¿qué te pareció ${propiedad!.direccion}?\n\n` +
      `Si no te cerró, contame qué le faltó y te busco algo más parecido a lo que necesitás.`,
  },
  {
    id: "nuevas_opciones",
    etiqueta: "Mandar opciones",
    texto: ({ contacto, vendedor }) =>
      `Hola ${primerNombre(contacto.nombre)}, ¿cómo estás? Entraron propiedades nuevas que coinciden con lo que buscabas.\n\n` +
      `Te paso las opciones:\n\n` +
      `¿Alguna te interesa para ir a verla?\n\n` +
      `${primerNombre(vendedor.nombre)} — ${NOMBRE_AGENCIA}`,
  },
  {
    id: "reactivar",
    etiqueta: "Reactivar contacto frío",
    texto: ({ contacto, vendedor }) =>
      `Hola ${primerNombre(contacto.nombre)}, ¿seguís buscando? Te escribo de ${NOMBRE_AGENCIA}.\n\n` +
      `Si ya resolviste avisame y no te molesto más. Si seguís en la búsqueda, tengo cosas nuevas para mostrarte.\n\n` +
      `${primerNombre(vendedor.nombre)}`,
  },
];

export function plantillasDisponibles(tienePropiedad: boolean): Plantilla[] {
  return PLANTILLAS.filter((p) => tienePropiedad || !p.requierePropiedad);
}

/** Construye el link wa.me listo para abrir. */
export function linkWhatsApp(
  telefono: string | null,
  mensaje: string,
): string | null {
  const numero = paraWhatsApp(telefono);
  if (!numero) return null;

  return `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`;
}
