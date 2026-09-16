import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { autorizaciones } from "@/db/schema";
import { AGENCIA } from "@/lib/agencia";
import { precio as fmtPrecio, fecha as fmtFecha, ETIQUETAS } from "@/lib/formato";
import { importeEnLetras } from "@/lib/letras";
import { mostrarTelefono } from "@/lib/telefono";
import { Membrete } from "@/components/Membrete";

function mesesDe(desde: string, hasta: string): number {
  const a = new Date(desde);
  const b = new Date(hasta);
  return Math.round(
    (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth()),
  );
}

export default async function Autorizacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const autorizacionId = Number(id);
  if (!Number.isInteger(autorizacionId)) notFound();

  const a = await db.query.autorizaciones.findFirst({
    where: eq(autorizaciones.id, autorizacionId),
    with: { propiedad: true, propietario: true },
  });

  if (!a) notFound();

  const precio = a.precioAutorizado ?? a.propiedad.precio;
  const meses = mesesDe(a.desde, a.hasta);

  return (
    <article className="hoja">
      <Membrete numero={`AUT-${String(a.id).padStart(4, "0")}`} />

      <h1>Autorización de venta</h1>
      <p className="tnum !mb-5 !text-right !text-[12.5px] text-[#4a4870]">
        {AGENCIA.ciudad}, {fmtFecha(a.desde)}
      </p>

      <p>
        Por la presente,{" "}
        <strong>{a.propietario?.nombre ?? "________________________"}</strong>
        {a.propietario?.telefono
          ? ` (tel. ${mostrarTelefono(a.propietario.telefono)})`
          : ""}
        , en su carácter de titular, autoriza a{" "}
        <strong>{AGENCIA.nombre}</strong>, {AGENCIA.matricula}, a intervenir en la{" "}
        <strong>venta</strong> del inmueble que se detalla, en los términos y
        condiciones que siguen.
      </p>

      <h2>El inmueble</h2>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          <tr className="border-b border-[#e6e4f2]">
            <td className="py-1.5 text-[#4a4870]">Ubicación</td>
            <td className="py-1.5 text-right font-semibold">
              {a.propiedad.direccion}
              {a.propiedad.barrio ? `, ${a.propiedad.barrio}` : ""}
            </td>
          </tr>
          <tr className="border-b border-[#e6e4f2]">
            <td className="py-1.5 text-[#4a4870]">Tipo</td>
            <td className="py-1.5 text-right font-semibold">
              {ETIQUETAS.tipoPropiedad[a.propiedad.tipo] ?? a.propiedad.tipo}
            </td>
          </tr>
          {a.propiedad.m2Totales && (
            <tr className="border-b border-[#e6e4f2]">
              <td className="py-1.5 text-[#4a4870]">Superficie</td>
              <td className="tnum py-1.5 text-right font-semibold">
                {a.propiedad.m2Totales} m²
              </td>
            </tr>
          )}
          <tr>
            <td className="py-1.5 text-[#4a4870]">Referencia interna</td>
            <td className="tnum py-1.5 text-right font-semibold">
              {a.propiedad.codigo}
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Primera — Precio</h2>
      <p>
        El precio de venta autorizado se fija en{" "}
        <strong>{fmtPrecio(precio, a.propiedad.moneda)}</strong>
        {precio ? ` (${importeEnLetras(Number(precio), a.propiedad.moneda).toLowerCase()})` : ""}
        . Toda modificación deberá ser comunicada por escrito.
      </p>

      <h2>Segunda — Plazo</h2>
      <p>
        La presente autorización se otorga por el término de{" "}
        <strong>{meses} meses</strong>, desde el {fmtFecha(a.desde)} hasta el{" "}
        {fmtFecha(a.hasta)}, y se renovará por igual período salvo comunicación en
        contrario de cualquiera de las partes con quince días de anticipación.
      </p>

      <h2>Tercera — Carácter</h2>
      <p>
        La autorización se otorga con carácter{" "}
        <strong>{a.exclusiva ? "exclusivo" : "no exclusivo"}</strong>.
        {a.exclusiva
          ? " Durante su vigencia el titular se abstendrá de encomendar la operación a terceros."
          : " El titular podrá encomendar la operación a otros intermediarios."}
      </p>

      <h2>Cuarta — Honorarios</h2>
      <p>
        Los honorarios por la intermediación se fijan en{" "}
        <strong>{a.comisionPct ? `${a.comisionPct} %` : "____ %"}</strong> sobre el
        precio efectivo de la operación, conforme a los aranceles vigentes,
        pagaderos al momento de la firma del boleto de compraventa o instrumento
        equivalente.
      </p>

      <h2>Quinta — Facultades</h2>
      <p>
        Se autoriza a la intermediaria a publicar el inmueble en los medios que
        estime convenientes, exhibirlo a interesados, colocar cartelería y
        recibir reservas ad referéndum de la aceptación del titular.
      </p>

      <div className="firma">
        <div>{a.propietario?.nombre ?? "El titular"} — Titular</div>
        <div>
          {AGENCIA.titular} — {AGENCIA.matricula}
        </div>
      </div>
    </article>
  );
}
