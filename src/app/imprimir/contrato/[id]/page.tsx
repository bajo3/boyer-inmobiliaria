import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contratos } from "@/db/schema";
import { AGENCIA } from "@/lib/agencia";
import { precio as fmtPrecio, fecha as fmtFecha } from "@/lib/formato";
import { importeEnLetras } from "@/lib/letras";
import { mostrarTelefono } from "@/lib/telefono";
import { Membrete } from "@/components/Membrete";

const AJUSTES: Record<string, string> = {
  trimestral: "trimestralmente",
  cuatrimestral: "cuatrimestralmente",
  semestral: "semestralmente",
  anual: "anualmente",
  sin_ajuste: "sin actualización",
};

function mesesDe(inicio: string, fin: string): number {
  const a = new Date(inicio);
  const b = new Date(fin);
  return Math.round(
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()),
  );
}

export default async function ContratoLocacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contratoId = Number(id);
  if (!Number.isInteger(contratoId)) notFound();

  const c = await db.query.contratos.findFirst({
    where: eq(contratos.id, contratoId),
    with: { inquilino: true, propiedad: true, propietario: true },
  });

  if (!c) notFound();

  const meses = mesesDe(c.inicio, c.fin);

  return (
    <article className="hoja">
      <Membrete numero={`LOC-${String(c.id).padStart(4, "0")}`} />

      <p className="sin-imprimir !mb-5 rounded-[10px] border border-[var(--warn-border)] bg-warn-bg px-3.5 py-2.5 !text-left text-[12.5px] text-warn">
        Borrador armado con los datos del sistema. Hay que revisarlo con el
        profesional que corresponda antes de firmarlo — no reemplaza el
        asesoramiento legal.
      </p>

      <h1>Contrato de locación</h1>
      <p className="tnum !mb-5 !text-right !text-[12.5px] text-[#4a4870]">
        {AGENCIA.ciudad}, {fmtFecha(c.inicio)}
      </p>

      <p>
        Entre{" "}
        <strong>{c.propietario?.nombre ?? "________________________"}</strong>, en
        adelante <strong>EL LOCADOR</strong>, y{" "}
        <strong>{c.inquilino.nombre}</strong>
        {c.inquilino.telefono ? ` (tel. ${mostrarTelefono(c.inquilino.telefono)})` : ""},
        en adelante <strong>EL LOCATARIO</strong>, con la intervención de{" "}
        {AGENCIA.nombre} ({AGENCIA.matricula}), se conviene el presente contrato
        de locación sujeto a las siguientes cláusulas:
      </p>

      <h2>Primera — Objeto</h2>
      <p>
        EL LOCADOR da en locación a EL LOCATARIO el inmueble ubicado en{" "}
        <strong>{c.propiedad.direccion}</strong>
        {c.propiedad.barrio ? `, barrio ${c.propiedad.barrio}` : ""}, de la ciudad
        de {AGENCIA.ciudad}, provincia de {AGENCIA.provincia}
        {c.propiedad.ambientes ? `, compuesto de ${c.propiedad.ambientes} ambientes` : ""}
        {c.propiedad.dormitorios ? ` y ${c.propiedad.dormitorios} dormitorios` : ""}.
      </p>

      <h2>Segunda — Plazo</h2>
      <p>
        La locación se conviene por el plazo de <strong>{meses} meses</strong>,
        con inicio el {fmtFecha(c.inicio)} y vencimiento el {fmtFecha(c.fin)},
        fecha en la que EL LOCATARIO deberá restituir el inmueble sin necesidad
        de interpelación previa.
      </p>

      <h2>Tercera — Precio</h2>
      <p>
        El precio se fija en <strong>{fmtPrecio(c.monto, c.moneda)}</strong>{" "}
        mensuales ({importeEnLetras(Number(c.monto), c.moneda).toLowerCase()}),
        pagaderos por adelantado del día 1 al{" "}
        <strong>{c.diaVencimiento}</strong> de cada mes
        {c.expensas
          ? `, con más las expensas ordinarias, estimadas a la fecha en ${fmtPrecio(c.expensas, c.moneda)}`
          : ""}
        .
      </p>

      <h2>Cuarta — Actualización</h2>
      <p>
        El precio se actualizará <strong>{AJUSTES[c.ajuste] ?? c.ajuste}</strong>
        {c.ajuste === "sin_ajuste"
          ? "."
          : ", conforme al índice que las partes acuerden por escrito y comuniquen fehacientemente antes de cada período."}
      </p>

      <h2>Quinta — Destino</h2>
      <p>
        El inmueble se destinará exclusivamente a vivienda familiar. EL LOCATARIO
        no podrá cambiar el destino, ceder ni sublocar total o parcialmente sin
        conformidad previa y por escrito de EL LOCADOR.
      </p>

      <h2>Sexta — Estado y conservación</h2>
      <p>
        EL LOCATARIO recibe el inmueble en el estado que declara conocer y
        aceptar, obligándose a conservarlo y restituirlo en las mismas
        condiciones, salvo el deterioro propio del uso regular.
      </p>

      <h2>Séptima — Servicios e impuestos</h2>
      <p>
        Estarán a cargo de EL LOCATARIO los servicios de luz, gas, agua y demás
        consumos, así como las tasas que graven el uso del inmueble. Los
        impuestos que graven la propiedad quedan a cargo de EL LOCADOR.
      </p>

      <h2>Octava — Garantía</h2>
      <p>
        EL LOCATARIO constituye garantía suficiente a satisfacción de EL LOCADOR,
        que subsistirá hasta la efectiva restitución del inmueble y la
        cancelación total de las obligaciones emergentes de este contrato.
      </p>

      <h2>Novena — Jurisdicción</h2>
      <p>
        Para todos los efectos las partes se someten a la jurisdicción de los
        tribunales ordinarios de {AGENCIA.ciudad}, constituyendo domicilios en
        los indicados precedentemente.
      </p>

      <p className="!mt-6">
        En prueba de conformidad se firman tres ejemplares de un mismo tenor y a
        un solo efecto, en {AGENCIA.ciudad}, a los {new Date(c.inicio).getUTCDate()}{" "}
        días del mes de{" "}
        {new Intl.DateTimeFormat("es-AR", { month: "long", timeZone: "UTC" }).format(
          new Date(c.inicio),
        )}{" "}
        de {new Date(c.inicio).getUTCFullYear()}.
      </p>

      <div className="firma">
        <div>{c.propietario?.nombre ?? "El locador"} — Locador</div>
        <div>{c.inquilino.nombre} — Locatario</div>
        <div>{AGENCIA.titular} — {AGENCIA.matricula}</div>
      </div>
    </article>
  );
}
