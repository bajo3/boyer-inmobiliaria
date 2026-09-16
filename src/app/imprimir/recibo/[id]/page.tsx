import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pagos } from "@/db/schema";
import { AGENCIA } from "@/lib/agencia";
import { precio as fmtPrecio, fecha as fmtFecha } from "@/lib/formato";
import { nombrePeriodo, vencimientoDe } from "@/lib/alquileres";
import { importeEnLetras } from "@/lib/letras";
import { Membrete } from "@/components/Membrete";

export default async function Recibo({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pagoId = Number(id);
  if (!Number.isInteger(pagoId)) notFound();

  const pago = await db.query.pagos.findFirst({
    where: eq(pagos.id, pagoId),
    with: { contrato: { with: { inquilino: true, propiedad: true, propietario: true } } },
  });

  if (!pago) notFound();

  const { contrato } = pago;
  const monto = Number(pago.monto);
  const expensas = Number(contrato.expensas) || 0;
  const total = monto + expensas;

  return (
    <article className="hoja">
      <Membrete numero={`${pago.periodo.replace("-", "")}-${String(pago.id).padStart(4, "0")}`} />

      <h1>Recibo de alquiler</h1>
      <p className="tnum !mb-5 !text-right !text-[12.5px] text-[#4a4870]">
        {AGENCIA.ciudad}, {fmtFecha(pago.pagadoAt)}
      </p>

      <p>
        Recibí de <strong>{contrato.inquilino.nombre}</strong> la suma de{" "}
        <strong>{fmtPrecio(total, contrato.moneda)}</strong>, en concepto de
        alquiler del inmueble sito en{" "}
        <strong>{contrato.propiedad.direccion}</strong>
        {contrato.propiedad.barrio ? `, ${contrato.propiedad.barrio}` : ""}, de la
        ciudad de {AGENCIA.ciudad}, correspondiente al período de{" "}
        <strong className="capitalize">{nombrePeriodo(pago.periodo)}</strong>, con
        vencimiento el {fmtFecha(vencimientoDe(contrato, pago.periodo))}.
      </p>

      <p className="!font-semibold">
        {importeEnLetras(total, contrato.moneda)}.
      </p>

      <h2>Detalle</h2>
      <table className="w-full border-collapse text-[13px]">
        <tbody>
          <tr className="border-b border-[#e6e4f2]">
            <td className="py-1.5">Alquiler {nombrePeriodo(pago.periodo)}</td>
            <td className="tnum py-1.5 text-right">
              {fmtPrecio(monto, contrato.moneda)}
            </td>
          </tr>
          {expensas > 0 && (
            <tr className="border-b border-[#e6e4f2]">
              <td className="py-1.5">Expensas</td>
              <td className="tnum py-1.5 text-right">
                {fmtPrecio(expensas, contrato.moneda)}
              </td>
            </tr>
          )}
          <tr>
            <td className="py-2 font-bold">Total</td>
            <td className="tnum py-2 text-right font-bold">
              {fmtPrecio(total, contrato.moneda)}
            </td>
          </tr>
        </tbody>
      </table>

      {contrato.propietario && (
        <>
          <h2>Propietario</h2>
          <p className="!mb-0 !text-left">{contrato.propietario.nombre}</p>
        </>
      )}

      {pago.notas && (
        <>
          <h2>Observaciones</h2>
          <p className="!text-left">{pago.notas}</p>
        </>
      )}

      <div className="firma">
        <div>{contrato.inquilino.nombre} — Inquilino</div>
        <div>
          {AGENCIA.titular} — {AGENCIA.matricula}
        </div>
      </div>
    </article>
  );
}
