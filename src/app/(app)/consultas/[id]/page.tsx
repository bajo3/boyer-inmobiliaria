import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { consultas, actividades } from "@/db/schema";
import { requerirSesion } from "@/lib/auth";
import { evaluarConsulta } from "@/lib/sla";
import { mostrarTelefono } from "@/lib/telefono";
import { plantillasDisponibles, linkWhatsApp } from "@/lib/whatsapp";
import { precio as fmtPrecio, fechaHora, ETIQUETAS } from "@/lib/formato";
import { Semaforo, Pastilla } from "@/components/Semaforo";
import { BandejaLista, cargarBandeja, leerFiltro } from "@/components/BandejaLista";
import { FormActividad } from "@/components/FormActividad";
import { FormCierre } from "@/components/FormCierre";
import { FormVisita } from "@/components/FormVisita";
import { BotonTomar, BotonReabrir } from "@/components/BotonesConsulta";
import { ControlesConsulta } from "@/components/ControlesConsulta";

const ABIERTAS = ["no_atendido", "contactado", "recontactar"];

const PUNTO: Record<string, string> = {
  crit: "bg-[var(--crit-solid)]",
  warn: "bg-[var(--warn-solid)]",
  ok: "bg-[var(--ok-solid)]",
  neutral: "bg-[#c6c4dc]",
};

export default async function FichaConsulta({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const usuario = await requerirSesion();
  const [{ id }, { f, q }] = await Promise.all([params, searchParams]);

  const consultaId = Number(id);
  if (!Number.isInteger(consultaId)) notFound();

  const filtro = leerFiltro(f, usuario.rol);

  const [consulta, timeline, datos] = await Promise.all([
    db.query.consultas.findFirst({
      where: eq(consultas.id, consultaId),
      with: { contacto: true, propiedad: true, vendedor: true },
    }),
    db.query.actividades.findMany({
      where: eq(actividades.consultaId, consultaId),
      with: { usuario: true },
      orderBy: [asc(actividades.fecha)],
    }),
    cargarBandeja(usuario, filtro, q),
  ]);

  if (!consulta) notFound();

  const s = evaluarConsulta(consulta);
  const abierta = ABIERTAS.includes(consulta.estado);

  // Los links de WhatsApp se arman en el servidor: el cliente solo abre un href.
  const plantillas = plantillasDisponibles(Boolean(consulta.propiedad))
    .map((p) => ({
      id: p.id,
      etiqueta: p.etiqueta,
      href: linkWhatsApp(
        consulta.contacto.telefono,
        p.texto({
          contacto: consulta.contacto,
          propiedad: consulta.propiedad,
          vendedor: usuario,
        }),
      ),
    }))
    .filter((p): p is { id: string; etiqueta: string; href: string } => !!p.href);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[430px_minmax(0,1fr)]">
      {/* Master: la misma bandeja, con la fila activa marcada. */}
      <div className="sticky top-4 hidden xl:block">
        <BandejaLista
          usuario={usuario}
          filtro={filtro}
          datos={datos}
          activaId={consulta.id}
          compacta
        />
      </div>

      {/* Detalle */}
      <div className="tarjeta overflow-hidden">
        <header className="border-b border-[#eae7f8] bg-surface-2 px-4 py-4 sm:px-6 sm:py-5">
          <Link
            href={`/?f=${filtro}`}
            className="text-[13.5px] font-semibold text-accent xl:hidden"
          >
            ← Bandeja
          </Link>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3 xl:mt-0">
            <div className="min-w-0">
              <h1 className="font-display text-[25px] font-extrabold leading-[1.1]">
                {consulta.contacto.nombre}
              </h1>
              <p className="tnum mt-1.5 text-[14px] text-ink-2">
                {mostrarTelefono(consulta.contacto.telefono)}
              </p>
            </div>

            <div className="flex flex-none items-center gap-2">
              <Semaforo nivel={s.nivel}>{s.etiqueta}</Semaforo>
              <Pastilla>
                {ETIQUETAS.estadoConsulta[consulta.estado] ?? consulta.estado}
              </Pastilla>
            </div>
          </div>

          <div
            className={`mt-3 flex flex-wrap items-center gap-2 rounded-[12px] border px-3 py-2.5 text-[13px] ${
              s.nivel === "crit"
                ? "border-[var(--crit-border)] bg-crit-bg text-crit"
                : s.nivel === "warn"
                  ? "border-[var(--warn-border)] bg-warn-bg text-warn"
                  : "border-[var(--ok-border)] bg-ok-bg text-ok"
            }`}
          >
            <span
              className={`size-2 flex-none rounded-full ${PUNTO[s.nivel] ?? PUNTO.neutral}`}
            />
            <span>
              <strong>{s.etiqueta}</strong> · entró por{" "}
              {ETIQUETAS.canal[consulta.canal] ?? consulta.canal} el{" "}
              <span className="tnum">{fechaHora(consulta.creadaAt)}</span>
            </span>
            <span className="ml-auto flex items-center gap-2">
              {consulta.vendedor
                ? `Atiende ${consulta.vendedor.nombre.split(" ")[0]}`
                : "Sin asignar"}
              {abierta && !consulta.asignadaA && (
                <BotonTomar consultaId={consulta.id} />
              )}
              {!abierta && <BotonReabrir consultaId={consulta.id} />}
            </span>
          </div>

          {consulta.mensajeOriginal && (
            <blockquote className="mt-3 rounded-[12px] border-l-[3px] border-accent bg-surface px-3.5 py-2.5 text-[13.5px] text-ink-2">
              {consulta.mensajeOriginal}
            </blockquote>
          )}
        </header>

        {/* En escritorio el cuerpo se parte en dos: trabajo a la izquierda,
            contexto a la derecha. */}
        <div className="grid items-start lg:grid-cols-[1.35fr_1fr]">
          <div className="lg:border-r lg:border-line-soft">
            {abierta && plantillas.length > 0 && (
              <section className="border-b border-line-soft px-4 py-4 sm:px-6">
                <p className="rotulo mb-2.5">Mandar WhatsApp</p>
                <div className="flex flex-wrap gap-2">
                  {plantillas.map((p) => (
                    <a
                      key={p.id}
                      href={p.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-wa"
                    >
                      {p.etiqueta}
                    </a>
                  ))}
                </div>
                <p className="mt-2.5 text-[12.5px] text-muted">
                  Abre WhatsApp con el mensaje escrito. Después registrá acá abajo
                  qué pasó.
                </p>
              </section>
            )}

            {abierta && (
              <FormActividad
                consultaId={consulta.id}
                tieneProximaAccion={Boolean(consulta.proximaAccionAt)}
              />
            )}

            <section className="px-4 py-5 sm:px-6">
              <h2 className="mb-3.5 font-display text-[18px] font-bold">
                Historial{timeline.length > 0 && ` · ${timeline.length}`}
              </h2>

              {timeline.length === 0 ? (
                <p className="text-[13.5px] text-muted">
                  Todavía no se registró ninguna actividad.
                </p>
              ) : (
                <ol className="flex flex-col">
                  {[...timeline].reverse().map((a, i, arr) => (
                    <li key={a.id} className="flex gap-3">
                      <span className="flex w-3.5 flex-none flex-col items-center">
                        <span className="mt-1.5 size-2.5 flex-none rounded-full bg-accent" />
                        {i < arr.length - 1 && (
                          <span className="w-px flex-1 bg-line" />
                        )}
                      </span>
                      <span className="min-w-0 pb-4">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="text-[13.5px] font-bold">
                            {ETIQUETAS.tipoActividad[a.tipo] ?? a.tipo}
                          </span>
                          <span className="tnum text-[12px] text-faint">
                            {fechaHora(a.fecha)}
                            {a.usuario ? ` · ${a.usuario.nombre.split(" ")[0]}` : ""}
                          </span>
                        </span>
                        <span className="mt-1 block text-[13.5px] leading-[1.45] text-ink-2">
                          {a.contenido}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>

          <aside className="flex flex-col gap-3 bg-ground px-4 py-5 sm:px-6">
            {consulta.propiedad ? (
              <Link
                href={`/propiedades/${consulta.propiedad.id}`}
                className="tarjeta-i flex items-center gap-3 p-3.5 hover:border-accent-border"
              >
                <span
                  aria-hidden
                  className="size-[52px] flex-none rounded-[13px]"
                  style={{
                    background:
                      "repeating-linear-gradient(135deg,#EDEAFF,#EDEAFF 6px,#F7F5FF 6px,#F7F5FF 12px)",
                  }}
                />
                <span className="min-w-0">
                  <span className="tnum block text-[12px] font-semibold text-accent">
                    {consulta.propiedad.codigo}
                  </span>
                  <span className="recorte block text-[14.5px] font-semibold">
                    {consulta.propiedad.direccion}
                  </span>
                  <span className="tnum block text-[12.5px] text-muted">
                    {consulta.propiedad.barrio ? `${consulta.propiedad.barrio} · ` : ""}
                    {ETIQUETAS.tipoPropiedad[consulta.propiedad.tipo]} ·{" "}
                    {fmtPrecio(consulta.propiedad.precio, consulta.propiedad.moneda)}
                  </span>
                </span>
              </Link>
            ) : (
              <p className="rounded-[16px] border border-dashed border-line p-4 text-[13.5px] text-muted">
                Consulta general, sin propiedad asociada.
              </p>
            )}

            {abierta && consulta.propiedad && <FormVisita consultaId={consulta.id} />}
            {abierta && <FormCierre consultaId={consulta.id} />}

            {!abierta && (
              <p
                className={`rounded-[16px] px-4 py-3 text-[13.5px] ${
                  consulta.estado === "ganado"
                    ? "bg-ok-bg text-ok"
                    : "bg-sunken text-ink-2"
                }`}
              >
                {consulta.estado === "ganado" ? (
                  <strong>Ganado — cerró la operación</strong>
                ) : (
                  <>
                    Rechazado:{" "}
                    <strong>
                      {consulta.motivoRechazo
                        ? ETIQUETAS.motivoRechazo[consulta.motivoRechazo]
                        : "sin motivo"}
                    </strong>
                  </>
                )}
              </p>
            )}

            <Link
              href={`/contactos/${consulta.contacto.id}`}
              className="text-[13.5px] font-semibold text-accent hover:underline"
            >
              Ver ficha del contacto →
            </Link>

            <ControlesConsulta consulta={consulta} usuario={usuario} />
          </aside>
        </div>
      </div>
    </div>
  );
}
