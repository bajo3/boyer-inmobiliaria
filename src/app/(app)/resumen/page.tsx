import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { armarResumen, pendientes } from "@/lib/resumen";
import { precio as fmtPrecio, fecha as fmtFecha } from "@/lib/formato";
import { Semaforo, Riel } from "@/components/Semaforo";
import { EnviarResumen } from "@/components/EnviarResumen";
import { describirBusqueda } from "@/lib/matching";

const HORA = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

function Bloque({
  titulo,
  cuantos,
  children,
}: {
  titulo: string;
  cuantos: number;
  children: React.ReactNode;
}) {
  if (cuantos === 0) return null;

  return (
    <section className="tarjeta overflow-hidden">
      <div className="flex items-baseline gap-2 px-4 pb-2 pt-3.5 sm:px-5">
        <h2 className="rotulo">{titulo}</h2>
        <span className="tnum text-[12px] font-bold text-muted">{cuantos}</span>
      </div>
      <ul className="border-t border-line-soft">{children}</ul>
    </section>
  );
}

export default async function Resumen() {
  await requerirSesion();

  const r = await armarResumen();
  const total = pendientes(r);

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="flex flex-col gap-4">
        <div className="tarjeta px-4 pb-4 pt-4 sm:px-5">
          <p className="text-[12px] text-muted">{r.titulo}</p>
          <h1 className="mt-0.5 font-display text-[26px] font-extrabold">
            El aviso de la mañana
          </h1>
          <p className="mt-1.5 text-[13.5px] text-ink-2">
            {total === 0
              ? "Nada pendiente. Hoy no hace falta abrir el sistema."
              : `${total} ${total === 1 ? "cosa" : "cosas"} para resolver hoy.`}
          </p>
        </div>

        <Bloque titulo="Esperando respuesta" cuantos={r.sinResponder.length}>
          {r.sinResponder.map(({ c, s }) => (
            <li key={c.id}>
              <Link href={`/consultas/${c.id}`} className="fila">
                <Riel nivel={s.nivel} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="recorte text-[15px] font-bold">
                      {c.contacto.nombre}
                    </span>
                    <Semaforo nivel={s.nivel} className="ml-auto">
                      {s.etiqueta}
                    </Semaforo>
                  </span>
                  <span className="recorte text-[12.5px] text-muted">
                    {c.propiedad
                      ? `${c.propiedad.codigo} · ${c.propiedad.direccion}`
                      : "Consulta general"}
                    {" — "}
                    {c.vendedor ? c.vendedor.nombre : "sin asignar"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Bloque>

        <Bloque titulo="Sin próximo paso o vencidas" cuantos={r.vencidas.length}>
          {r.vencidas.map(({ c, s }) => (
            <li key={c.id}>
              <Link href={`/consultas/${c.id}`} className="fila">
                <Riel nivel={s.nivel} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="recorte text-[15px] font-bold">
                      {c.contacto.nombre}
                    </span>
                    <Semaforo nivel={s.nivel} className="ml-auto">
                      {s.etiqueta}
                    </Semaforo>
                  </span>
                  <span className="recorte text-[12.5px] text-muted">
                    {c.proximaAccion ?? "No quedó nada agendado"}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Bloque>

        <Bloque titulo="Visitas de hoy" cuantos={r.visitasHoy.length}>
          {r.visitasHoy.map((v) => (
            <li key={v.id}>
              <Link href={`/propiedades/${v.propiedad.id}`} className="fila">
                <Riel nivel="warn" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="tnum flex-none font-bold text-accent">
                      {HORA.format(v.fechaHora)}
                    </span>
                    <span className="recorte text-[15px] font-bold">
                      {v.contacto.nombre}
                    </span>
                  </span>
                  <span className="recorte text-[12.5px] text-muted">
                    {v.propiedad.direccion}
                    {v.vendedor ? ` — ${v.vendedor.nombre}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Bloque>

        <Bloque titulo="Alquileres que hay que cobrar" cuantos={r.alquileres.length}>
          {r.alquileres.map(({ c, e }) => (
            <li key={c.id}>
              <Link href="/alquileres" className="fila">
                <Riel nivel={e.nivel} />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="recorte text-[15px] font-bold">
                      {c.inquilino.nombre}
                    </span>
                    <Semaforo nivel={e.nivel} className="ml-auto">
                      {e.etiqueta}
                    </Semaforo>
                  </span>
                  <span className="flex items-baseline gap-2 text-[12.5px] text-muted">
                    <span className="recorte min-w-0 flex-1">
                      {c.propiedad.direccion}
                    </span>
                    <span className="tnum flex-none font-semibold">
                      {fmtPrecio(c.monto, c.moneda)}
                    </span>
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Bloque>

        <Bloque titulo="Gente esperando algo que ya tenemos" cuantos={r.matches.length}>
          {r.matches.map((m) => (
            <li key={m.propiedad.id}>
              <Link href={`/propiedades/${m.propiedad.id}`} className="fila">
                <Riel nivel="ok" />
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="flex items-center gap-2">
                    <span className="tnum flex-none font-semibold text-accent">
                      {m.propiedad.codigo}
                    </span>
                    <span className="recorte text-[15px] font-bold">
                      {m.propiedad.direccion}
                    </span>
                    <Semaforo nivel="ok" className="ml-auto">
                      {m.gente.length}{" "}
                      {m.gente.length === 1 ? "comprador" : "compradores"}
                    </Semaforo>
                  </span>
                  <span className="recorte text-[12.5px] text-muted">
                    {m.gente
                      .slice(0, 3)
                      .map((g) => g.busqueda.contacto.nombre)
                      .join(" · ")}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Bloque>

        <Bloque titulo="Autorizaciones por vencer" cuantos={r.autorizaciones.length}>
          {r.autorizaciones.map((a) => (
            <li key={a.id}>
              <Link href={`/propiedades/${a.propiedad.id}`} className="fila">
                <Riel nivel="warn" />
                <span className="flex min-w-0 flex-1 items-baseline gap-2">
                  <span className="recorte min-w-0 flex-1 text-[15px] font-bold">
                    {a.propiedad.direccion}
                  </span>
                  <span className="tnum flex-none text-[12.5px] font-semibold text-warn">
                    vence {fmtFecha(a.hasta)}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </Bloque>
      </div>

      <div className="flex flex-col gap-4">
        <section className="tarjeta p-4">
          <p className="rotulo">El mensaje</p>
          <pre className="mt-2.5 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-[14px] bg-sunken px-3.5 py-3 text-[13px] leading-[1.5] font-sans">
            {r.texto}
          </pre>
          <div className="mt-3">
            <EnviarResumen texto={r.texto} />
          </div>
          <p className="mt-2.5 text-[12px] text-muted">
            Va con nombres y montos, no con cantidades: la idea es no tener que
            abrir el sistema para saber de quién se trata.
          </p>
        </section>
      </div>
    </div>
  );
}
