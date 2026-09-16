import Link from "next/link";
import { desc, eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { contratos, pagos, indices, autorizaciones } from "@/db/schema";
import { requerirSesion, puedeAdministrar } from "@/lib/auth";
import { precio as fmtPrecio, fecha as fmtFecha } from "@/lib/formato";
import { nombrePeriodo } from "@/lib/alquileres";
import { CalculadoraIPC } from "@/components/CalculadoraIPC";
import { TablaIndices } from "@/components/TablaIndices";

export default async function Documentos() {
  const usuario = await requerirSesion();
  const administra = puedeAdministrar(usuario);

  const [recibos, vivos, autos, tabla] = await Promise.all([
    db.query.pagos.findMany({
      with: { contrato: { with: { inquilino: true, propiedad: true } } },
      orderBy: [desc(pagos.pagadoAt)],
      limit: 30,
    }),
    db.query.contratos.findMany({
      where: eq(contratos.estado, "activo"),
      with: { inquilino: true, propiedad: true },
      orderBy: [desc(contratos.creadoAt)],
    }),
    db.query.autorizaciones.findMany({
      with: { propiedad: true, propietario: true },
      orderBy: [desc(autorizaciones.hasta)],
      limit: 30,
    }),
    db.select().from(indices).orderBy(asc(indices.mes)),
  ]);

  const paraCalculadora = vivos.map((c) => ({
    id: c.id,
    inquilino: c.inquilino.nombre,
    direccion: c.propiedad.direccion,
    monto: c.monto,
    moneda: c.moneda,
    ajuste: c.ajuste,
    ultimoAjuste: c.proximoAjuste,
  }));

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex flex-col gap-4">
        <div className="tarjeta px-4 pb-4 pt-4 sm:px-5">
          <h1 className="font-display text-[26px] font-extrabold">Documentos</h1>
          <p className="mt-1 text-[13.5px] text-ink-2">
            Se arman con los datos que ya están cargados y se imprimen o se
            guardan como PDF desde el navegador.
          </p>
        </div>

        <Seccion
          titulo="Recibos de alquiler"
          vacio="Cuando registres un pago, el recibo se arma solo."
          cuantos={recibos.length}
        >
          {recibos.map((p) => (
            <li key={p.id}>
              <Link href={`/imprimir/recibo/${p.id}`} className="fila">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="recorte text-[14.5px] font-bold">
                      {p.contrato.inquilino.nombre}
                    </span>
                    <span className="recorte text-[12.5px] text-muted">
                      {p.contrato.propiedad.direccion} ·{" "}
                      <span className="capitalize">{nombrePeriodo(p.periodo)}</span>
                    </span>
                  </span>
                  <span className="tnum flex-none text-[13px] font-semibold">
                    {fmtPrecio(p.monto, p.contrato.moneda)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Seccion>

        <Seccion
          titulo="Contratos de locación"
          vacio="No hay contratos activos."
          cuantos={vivos.length}
        >
          {vivos.map((c) => (
            <li key={c.id}>
              <Link href={`/imprimir/contrato/${c.id}`} className="fila">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="recorte text-[14.5px] font-bold">
                      {c.inquilino.nombre}
                    </span>
                    <span className="recorte text-[12.5px] text-muted">
                      {c.propiedad.direccion} · hasta {fmtFecha(c.fin)}
                    </span>
                  </span>
                  <span className="tnum flex-none text-[13px] font-semibold">
                    {fmtPrecio(c.monto, c.moneda)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Seccion>

        <Seccion
          titulo="Autorizaciones de venta"
          vacio="Ninguna propiedad tiene autorización cargada todavía."
          cuantos={autos.length}
        >
          {autos.map((a) => (
            <li key={a.id}>
              <Link href={`/imprimir/autorizacion/${a.id}`} className="fila">
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="recorte text-[14.5px] font-bold">
                      {a.propiedad.direccion}
                    </span>
                    <span className="recorte text-[12.5px] text-muted">
                      {a.propietario?.nombre ?? "Sin propietario"} · vence{" "}
                      {fmtFecha(a.hasta)}
                    </span>
                  </span>
                  <span className="tnum flex-none text-[13px] font-semibold">
                    {a.comisionPct ? `${a.comisionPct} %` : "—"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Seccion>
      </div>

      <div className="flex flex-col gap-4">
        <CalculadoraIPC
          contratos={paraCalculadora}
          indices={tabla.map((i) => ({ mes: i.mes, valor: i.valor }))}
          puedeAplicar={administra}
        />
        <TablaIndices
          indices={tabla.map((i) => ({ mes: i.mes, valor: i.valor }))}
          puedeEditar={administra}
        />
      </div>
    </div>
  );
}

function Seccion({
  titulo,
  cuantos,
  vacio,
  children,
}: {
  titulo: string;
  cuantos: number;
  vacio: string;
  children: React.ReactNode;
}) {
  return (
    <section className="tarjeta overflow-hidden">
      <div className="flex items-baseline gap-2 px-4 pb-2 pt-3.5 sm:px-5">
        <h2 className="rotulo">{titulo}</h2>
        <span className="tnum text-[12px] font-bold text-muted">{cuantos}</span>
      </div>
      {cuantos === 0 ? (
        <p className="border-t border-line-soft px-5 py-6 text-center text-[13px] text-muted">
          {vacio}
        </p>
      ) : (
        <ul className="border-t border-line-soft">{children}</ul>
      )}
    </section>
  );
}
