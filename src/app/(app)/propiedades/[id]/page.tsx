import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  propiedades,
  consultas,
  autorizaciones,
  visitas,
  busquedas,
} from "@/db/schema";
import { requerirSesion } from "@/lib/auth";
import { editarPropiedad } from "@/actions/propiedades";
import { FormPropiedad } from "@/components/FormPropiedad";
import { Semaforo, Pastilla } from "@/components/Semaforo";
import { evaluarConsulta } from "@/lib/sla";
import { compradoresPara, describirBusqueda } from "@/lib/matching";
import { linkWhatsApp, mensajeOportunidad } from "@/lib/whatsapp";
import { mostrarTelefono } from "@/lib/telefono";
import {
  precio as fmtPrecio,
  numero,
  fecha as fmtFecha,
  fechaHora,
  ETIQUETAS,
} from "@/lib/formato";

export default async function FichaPropiedad({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const usuario = await requerirSesion();
  const { id } = await params;
  const propiedadId = Number(id);
  if (!Number.isInteger(propiedadId)) notFound();

  const propiedad = await db.query.propiedades.findFirst({
    where: eq(propiedades.id, propiedadId),
    with: { propietario: true },
  });

  if (!propiedad) notFound();

  const [autorizacion] = await db
    .select()
    .from(autorizaciones)
    .where(eq(autorizaciones.propiedadId, propiedadId))
    .orderBy(desc(autorizaciones.hasta))
    .limit(1);

  const consultasProp = await db.query.consultas.findMany({
    where: eq(consultas.propiedadId, propiedadId),
    with: { contacto: true },
    orderBy: [desc(consultas.creadaAt)],
    limit: 50,
  });

  const visitasProp = await db.query.visitas.findMany({
    where: eq(visitas.propiedadId, propiedadId),
    with: { contacto: true },
    orderBy: [desc(visitas.fechaHora)],
    limit: 20,
  });

  // Quién de la cartera está buscando exactamente esto. Es la parte que
  // convierte el sistema en ventas y no solo en registro.
  const activas = await db.query.busquedas.findMany({
    where: eq(busquedas.activa, true),
    with: { contacto: true },
    limit: 300,
  });

  const interesados = compradoresPara(propiedad, activas);

  const diasAutorizacion = autorizacion
    ? Math.ceil(
        (new Date(autorizacion.hasta).getTime() - Date.now()) / 86_400_000,
      )
    : null;

  const editar = editarPropiedad.bind(null, propiedadId);

  const especificaciones: [string, string][] = [
    ["Tipo", ETIQUETAS.tipoPropiedad[propiedad.tipo] ?? propiedad.tipo],
    ["Operación", propiedad.operacion === "venta" ? "Venta" : "Alquiler"],
    ["Barrio", propiedad.barrio ?? "—"],
    ["m² totales", numero(propiedad.m2Totales)],
    ["m² cubiertos", numero(propiedad.m2Cubiertos)],
    ["Ambientes", numero(propiedad.ambientes)],
    ["Dormitorios", numero(propiedad.dormitorios)],
    ["Baños", numero(propiedad.banos)],
    ["Cocheras", numero(propiedad.cocheras)],
  ];

  return (
    <div className="space-y-5">
      <Link
        href="/propiedades"
        className="text-[13px] font-semibold text-muted hover:text-accent"
      >
        ← Volver a propiedades
      </Link>

      <header className="tarjeta p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="tnum text-[12px] font-semibold text-accent">{propiedad.codigo}</p>
            <h1 className="mt-0.5 text-xl font-bold tracking-tight">
              {propiedad.direccion}
            </h1>
            <p className="text-sm text-muted">
              {ETIQUETAS.tipoPropiedad[propiedad.tipo]}
              {propiedad.barrio ? ` · ${propiedad.barrio}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-accent">
              {fmtPrecio(propiedad.precio, propiedad.moneda)}
            </p>
            <Pastilla className="mt-1">
              {ETIQUETAS.estadoPropiedad[propiedad.estado]}
            </Pastilla>
          </div>
        </div>
      </header>

      {/* Alerta de autorización: el aviso que evita trabajar gratis. */}
      {diasAutorizacion !== null && diasAutorizacion <= 30 && (
        <p
          className={`rounded-lg border px-4 py-2.5 text-sm ${
            diasAutorizacion < 0
              ? "border-crit bg-crit-bg text-crit"
              : "border-warn bg-warn-bg text-warn"
          }`}
        >
          {diasAutorizacion < 0
            ? `La autorización venció hace ${Math.abs(diasAutorizacion)} días (${fmtFecha(autorizacion.hasta)}).`
            : `La autorización vence en ${diasAutorizacion} días (${fmtFecha(autorizacion.hasta)}).`}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <section className="tarjeta p-4">
            <h2 className="mb-3 rotulo">
              Ficha
            </h2>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {especificaciones.map(([k, v]) => (
                <div key={k}>
                  <dt className="rotulo">
                    {k}
                  </dt>
                  <dd className="text-sm font-medium">{v}</dd>
                </div>
              ))}
            </dl>
            {propiedad.descripcion && (
              <p className="mt-3 border-t border-line pt-3 text-sm text-ink-2">
                {propiedad.descripcion}
              </p>
            )}
          </section>

          {interesados.length > 0 && (
            <section className="tarjeta border-[var(--ok-border)] bg-ok-bg p-4">
              <h2 className="mb-1 rotulo text-ok">
                {interesados.length}{" "}
                {interesados.length === 1
                  ? "persona de la cartera busca esto"
                  : "personas de la cartera buscan esto"}
              </h2>
              <p className="mb-3 text-[12.5px] text-[#1c5f43]">
                Ya te dejaron dicho qué querían. Nadie más se los va a avisar.
              </p>

              <ul className="space-y-1.5">
                {interesados.map(({ busqueda, motivos }) => {
                  const link = linkWhatsApp(
                    busqueda.contacto.telefono,
                    mensajeOportunidad(busqueda.contacto, propiedad),
                  );

                  return (
                    <li
                      key={busqueda.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-surface px-3.5 py-2.5"
                    >
                      <span className="min-w-0">
                        <Link
                          href={`/contactos/${busqueda.contacto.id}`}
                          className="block truncate text-sm font-semibold hover:text-accent"
                        >
                          {busqueda.contacto.nombre}
                        </Link>
                        <span className="block truncate text-[12px] text-muted">
                          {describirBusqueda(busqueda)}
                        </span>
                      </span>

                      <span className="flex items-center gap-2">
                        {motivos.length > 0 && (
                          <Pastilla>coincide en {motivos.join(", ")}</Pastilla>
                        )}
                        {link && (
                          <a
                            href={link}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-wa btn-chico"
                          >
                            Avisarle
                          </a>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}

          <section className="tarjeta p-4">
            <h2 className="mb-3 rotulo">
              Consultas · {consultasProp.length}
            </h2>

            {consultasProp.length === 0 ? (
              <p className="text-sm text-muted">
                Nadie consultó por esta propiedad todavía.
              </p>
            ) : (
              <ul className="space-y-1">
                {consultasProp.map((c) => {
                  const s = evaluarConsulta(c);
                  return (
                    <li key={c.id}>
                      <Link
                        href={`/consultas/${c.id}`}
                        className="flex items-center justify-between gap-3 tarjeta-i px-3.5 py-2.5 hover:border-accent-border"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">
                            {c.contacto.nombre}
                          </span>
                          <span className="block tnum text-[12px] text-faint">
                            {ETIQUETAS.canal[c.canal]} · {fechaHora(c.creadaAt)}
                          </span>
                        </span>
                        <Semaforo nivel={s.nivel}>{s.etiqueta}</Semaforo>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {visitasProp.length > 0 && (
            <section className="tarjeta p-4">
              <h2 className="mb-3 rotulo">
                Visitas · {visitasProp.length}
              </h2>
              <ul className="space-y-2">
                {visitasProp.map((v) => (
                  <li key={v.id} className="border-b border-line pb-2 last:border-0">
                    <p className="text-sm font-medium">
                      {v.contacto.nombre}{" "}
                      <span className="tnum text-[12px] font-normal text-faint">
                        {fechaHora(v.fechaHora)} · {v.estado}
                      </span>
                    </p>
                    {v.feedback && (
                      <p className="mt-0.5 text-sm text-ink-2">{v.feedback}</p>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <details className="tarjeta">
            <summary className="cursor-pointer px-5 py-3.5 rotulo">
              Editar datos
            </summary>
            <div className="border-t border-line p-4">
              <FormPropiedad
                accion={editar}
                propiedad={propiedad}
                textoBoton="Guardar cambios"
              />
            </div>
          </details>
        </div>

        <aside className="space-y-4">
          <section className="tarjeta p-4">
            <h2 className="mb-2 rotulo">
              Propietario
            </h2>
            {propiedad.propietario ? (
              <Link
                href={`/contactos/${propiedad.propietario.id}`}
                className="block hover:text-accent"
              >
                <p className="font-semibold">{propiedad.propietario.nombre}</p>
                <p className="tnum text-[12.5px] text-muted">
                  {mostrarTelefono(propiedad.propietario.telefono)}
                </p>
              </Link>
            ) : (
              <p className="text-sm text-warn">Sin propietario cargado.</p>
            )}
          </section>

          <section className="tarjeta p-4">
            <h2 className="mb-2 rotulo">
              Autorización
            </h2>
            {autorizacion ? (
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Vence</dt>
                  <dd className="font-medium">{fmtFecha(autorizacion.hasta)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Exclusiva</dt>
                  <dd className="font-medium">
                    {autorizacion.exclusiva ? "Sí" : "No"}
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted">Comisión</dt>
                  <dd className="font-medium">
                    {autorizacion.comisionPct ? `${autorizacion.comisionPct} %` : "—"}
                  </dd>
                </div>
                {/* El precio piso y las notas internas son solo para la titular. */}
                {usuario.rol === "titular" && (
                  <>
                    <div className="flex justify-between gap-2 border-t border-line pt-1.5">
                      <dt className="text-muted">Precio piso</dt>
                      <dd className="font-medium">
                        {fmtPrecio(autorizacion.precioPiso, propiedad.moneda)}
                      </dd>
                    </div>
                    {autorizacion.notasInternas && (
                      <p className="rounded bg-sunken px-2 py-1.5 text-xs text-ink-2">
                        {autorizacion.notasInternas}
                      </p>
                    )}
                  </>
                )}
              </dl>
            ) : (
              <p className="text-sm text-warn">
                Sin autorización cargada. Sin fecha de vencimiento no hay aviso.
              </p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
