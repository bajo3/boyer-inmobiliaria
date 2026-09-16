import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { contratos, pagos, propiedades } from "@/db/schema";
import { requerirSesion, puedeAdministrar } from "@/lib/auth";
import {
  periodoDe,
  nombrePeriodo,
  estadoPago,
  totalesDelMes,
  plantillaSugerida,
  yaRecordado,
} from "@/lib/alquileres";
import { linkWhatsApp } from "@/lib/whatsapp";
import { precio as fmtPrecio, fecha as fmtFecha, relativo } from "@/lib/formato";
import { mostrarTelefono } from "@/lib/telefono";
import { Semaforo, Riel, Pastilla } from "@/components/Semaforo";
import { AccionesAlquiler } from "@/components/AccionesAlquiler";
import { NuevoContrato } from "@/components/NuevoContrato";

export default async function Alquileres() {
  const usuario = await requerirSesion();
  const administra = puedeAdministrar(usuario);
  const periodo = periodoDe();

  // Las propiedades libres no dependen de los contratos: van en el mismo viaje.
  // Cada ida y vuelta a la base cuesta lo mismo esté cerca o lejos, así que lo
  // que no depende de nada nunca tiene que esperar su turno.
  const [vivos, disponibles] = await Promise.all([
    db.query.contratos.findMany({
      where: eq(contratos.estado, "activo"),
      with: { propiedad: true, inquilino: true },
      orderBy: [asc(contratos.diaVencimiento)],
    }),
    administra
      ? db
          .select({
            id: propiedades.id,
            codigo: propiedades.codigo,
            direccion: propiedades.direccion,
            barrio: propiedades.barrio,
          })
          .from(propiedades)
          .where(inArray(propiedades.estado, ["publicada", "borrador", "suspendida"]))
          .orderBy(asc(propiedades.codigo))
          .limit(500)
      : Promise.resolve([]),
  ]);

  // Los pagos del mes se traen en una sola consulta y se cruzan en memoria:
  // drizzle no califica las columnas dentro de una subconsulta correlacionada
  // en el select, y termina comparando una columna contra sí misma.
  const ids = vivos.map((c) => c.id);
  const delMes = ids.length
    ? await db
        .select()
        .from(pagos)
        .where(inArray(pagos.contratoId, ids))
    : [];

  const pagoDe = new Map(
    delMes.filter((p) => p.periodo === periodo).map((p) => [p.contratoId, p]),
  );

  const filas = vivos
    .map((c) => {
      const pago = pagoDe.get(c.id);
      const estado = estadoPago(c, pago, periodo);
      const plantilla = plantillaSugerida(estado);

      const texto = plantilla.texto({
        contrato: c,
        inquilino: c.inquilino,
        propiedad: c.propiedad,
        periodo,
      });

      return {
        contrato: c,
        pago,
        estado,
        linkWa: linkWhatsApp(c.inquilino.telefono, texto),
        etiquetaWa: plantilla.etiqueta,
        avisado: yaRecordado(c, periodo),
      };
    })
    .sort((a, b) => b.estado.orden - a.estado.orden);

  const totales = totalesDelMes(filas);
  const atrasados = filas.filter((f) => f.estado.dias < 0 && !f.estado.pagado);
  const cobrados = filas.filter((f) => f.estado.pagado).length;

  // Ajustes que caen dentro de los próximos 45 días: llegar tarde a un ajuste
  // es cobrar un mes entero al valor viejo.
  const limite = Date.now() + 45 * 86_400_000;
  const ajustes = vivos.filter(
    (c) => c.proximoAjuste && new Date(c.proximoAjuste).getTime() <= limite,
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="tarjeta flex flex-col overflow-hidden">
        <div className="px-4 pb-3 pt-4 sm:px-5">
          <p className="text-[12px] text-muted capitalize">{nombrePeriodo(periodo)}</p>
          <h1 className="mt-0.5 font-display text-[26px] font-extrabold">Alquileres</h1>

          {atrasados.length > 0 ? (
            <div className="mt-3.5 flex items-center gap-3 rounded-[16px] border border-[var(--crit-border)] bg-crit-bg px-3.5 py-3">
              <span className="latido size-[9px] flex-none rounded-full bg-[var(--crit-solid)]" />
              <p className="text-[13.5px] leading-[1.35]">
                <strong className="text-crit">
                  {atrasados.length}{" "}
                  {atrasados.length === 1 ? "alquiler atrasado" : "alquileres atrasados"}.
                </strong>{" "}
                <span className="text-[#7a2020]">
                  {atrasados
                    .slice(0, 2)
                    .map(
                      (f) =>
                        `${f.contrato.inquilino.nombre.split(" ")[0]} ${f.estado.etiqueta.toLowerCase()}`,
                    )
                    .join(" · ")}
                  {atrasados.length > 2 ? ` y ${atrasados.length - 2} más.` : "."}
                </span>
              </p>
            </div>
          ) : filas.length > 0 ? (
            <div className="mt-3.5 flex items-center gap-3 rounded-[16px] border border-[var(--ok-border)] bg-ok-bg px-3.5 py-3">
              <span className="size-[9px] flex-none rounded-full bg-[var(--ok-solid)]" />
              <p className="text-[13.5px] text-ok">
                Ningún alquiler atrasado. {cobrados} de {filas.length} cobrados este mes.
              </p>
            </div>
          ) : null}
        </div>

        <ul className="border-t border-line-soft">
          {filas.length === 0 ? (
            <li className="px-5 py-10 text-center text-[13.5px] text-muted">
              No hay contratos de alquiler cargados todavía.
            </li>
          ) : (
            filas.map(({ contrato: c, estado, linkWa, etiquetaWa, avisado, pago }) => (
              <li key={c.id} className="border-b border-line-soft last:border-0">
                <div className="fila cursor-default">
                  <Riel nivel={estado.nivel} />

                  <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="flex items-center gap-2">
                      <Link
                        href={`/contactos/${c.inquilino.id}`}
                        className="recorte text-[15.5px] font-bold tracking-[-.01em] hover:text-accent"
                      >
                        {c.inquilino.nombre}
                      </Link>
                      {avisado && !estado.pagado && (
                        <Pastilla>avisado {relativo(c.recordatorioAt)}</Pastilla>
                      )}
                      <Semaforo nivel={estado.nivel} className="ml-auto">
                        {estado.etiqueta}
                      </Semaforo>
                    </span>

                    <span className="flex min-w-0 items-baseline gap-2 text-[13px] text-ink-2">
                      <Link
                        href={`/propiedades/${c.propiedad.id}`}
                        className="tnum flex-none font-semibold text-accent hover:underline"
                      >
                        {c.propiedad.codigo}
                      </Link>
                      <span className="recorte min-w-0 flex-1">
                        {c.propiedad.direccion}
                      </span>
                      <span className="tnum flex-none font-semibold">
                        {fmtPrecio(pago?.monto ?? c.monto, c.moneda)}
                      </span>
                    </span>

                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[12.5px] text-muted">
                      <span className="tnum">
                        {mostrarTelefono(c.inquilino.telefono)}
                      </span>
                      {c.expensas && (
                        <span className="tnum">
                          + {fmtPrecio(c.expensas, c.moneda)} expensas
                        </span>
                      )}
                      <span>contrato hasta {fmtFecha(c.fin)}</span>
                    </span>

                    <span className="pt-0.5">
                      <AccionesAlquiler
                        contratoId={c.id}
                        periodo={periodo}
                        linkWa={linkWa}
                        etiquetaWa={etiquetaWa}
                        pagado={estado.pagado}
                        puedeAnular={administra}
                      />
                    </span>
                  </span>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      <div className="flex flex-col gap-4">
        <section className="tarjeta p-4">
          <p className="rotulo">La cobranza del mes</p>

          {Object.keys(totales).length === 0 ? (
            <p className="mt-2 text-[13px] text-muted">
              Cuando cargues un contrato, acá vas a ver cuánto entra este mes y
              cuánto falta cobrar.
            </p>
          ) : (
            Object.entries(totales).map(([moneda, t]) => (
              <div key={moneda} className="mt-2.5">
                <p className="tnum font-display text-[28px] font-extrabold leading-none">
                  {fmtPrecio(t.aCobrar, moneda as "ARS" | "USD")}
                </p>
                <p className="mt-1.5 text-[13px] text-ink-2">
                  Cobrado{" "}
                  <strong className="tnum text-ok">
                    {fmtPrecio(t.cobrado, moneda as "ARS" | "USD")}
                  </strong>
                  {t.pendiente > 0 && (
                    <>
                      {" · "}falta{" "}
                      <strong className="tnum text-crit">
                        {fmtPrecio(t.pendiente, moneda as "ARS" | "USD")}
                      </strong>
                    </>
                  )}
                </p>
              </div>
            ))
          )}
        </section>

        {ajustes.length > 0 && (
          <section className="tarjeta p-4">
            <p className="rotulo">Ajustes que se vienen</p>
            <ul className="mt-2 flex flex-col gap-2">
              {ajustes.map((c) => (
                <li key={c.id} className="flex items-baseline gap-2 text-[13px]">
                  <span className="recorte min-w-0 flex-1">
                    {c.inquilino.nombre} · {c.propiedad.direccion}
                  </span>
                  <span className="tnum flex-none font-semibold text-warn">
                    {fmtFecha(c.proximoAjuste)}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[12px] text-muted">
              Ajuste {ajustes[0].ajuste.replace("_", " ")}. Llegar tarde a un ajuste
              es cobrar un mes entero al valor viejo.
            </p>
          </section>
        )}

        {administra && <NuevoContrato propiedades={disponibles} />}
      </div>
    </div>
  );
}
