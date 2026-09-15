"use client";

import { useActionState, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import {
  editarConsulta,
  eliminarConsulta,
  asignarConsulta,
  type Estado,
} from "@/actions/consultas";

type PropiedadItem = {
  id: number;
  codigo: string;
  direccion: string;
  barrio: string | null;
};

const CANALES = [
  ["whatsapp", "WhatsApp"],
  ["instagram", "Instagram"],
  ["facebook", "Facebook"],
  ["zonaprop", "Zonaprop"],
  ["llamada", "Llamada"],
  ["mostrador", "Mostrador"],
  ["web", "Web"],
] as const;

function Guardar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario w-full" disabled={pending}>
      {pending ? "Guardando…" : "Guardar correcciones"}
    </button>
  );
}

export function PanelCorreccion({
  consultaId,
  canal,
  propiedadId,
  mensaje,
  asignadaA,
  propiedades,
  vendedores,
}: {
  consultaId: number;
  canal: string;
  propiedadId: number | null;
  mensaje: string | null;
  asignadaA: number | null;
  propiedades: PropiedadItem[];
  vendedores: { id: number; nombre: string }[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [estado, accion] = useActionState<Estado, FormData>(editarConsulta, {});
  const [reasignando, iniciarReasignar] = useTransition();
  const [borrando, iniciarBorrar] = useTransition();

  return (
    <section className="tarjeta-i p-4">
      {/* Reasignar: es lo que más se usa, así que va suelto y siempre visible. */}
      <label className="block">
        <span className="etiqueta">Pasársela a</span>
        <select
          className="campo"
          defaultValue={asignadaA ?? ""}
          disabled={reasignando}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (v) iniciarReasignar(() => void asignarConsulta(consultaId, v));
          }}
        >
          <option value="">— Sin asignar —</option>
          {vendedores.map((v) => (
            <option key={v.id} value={v.id}>
              {v.nombre}
            </option>
          ))}
        </select>
      </label>

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setAbierto((a) => !a)}
          className="btn btn-neutro btn-chico flex-1"
        >
          {abierto ? "Cerrar" : "Corregir datos"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(true)}
          className="btn btn-chico flex-none border-[var(--crit-border)] bg-crit-bg text-crit hover:bg-[#f6d5d5]"
        >
          Borrar
        </button>
      </div>

      {confirmando && (
        <div className="mt-3 rounded-[12px] border border-[var(--crit-border)] bg-crit-bg p-3.5">
          <p className="text-[13.5px] text-crit">
            Se borra la consulta y todo su historial, para siempre. El contacto
            queda. Si la persona simplemente no sirvió, es mejor{" "}
            <strong>rechazarla con motivo</strong>: así queda en el panel.
          </p>
          <div className="mt-2.5 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(false)}
              className="btn btn-neutro btn-chico flex-1"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={borrando}
              onClick={() => iniciarBorrar(() => void eliminarConsulta(consultaId))}
              className="btn btn-chico flex-1 bg-[var(--crit-solid)] text-white"
            >
              {borrando ? "Borrando…" : "Sí, borrar"}
            </button>
          </div>
        </div>
      )}

      {abierto && (
        <form action={accion} className="mt-3 flex flex-col gap-3">
          <input type="hidden" name="consultaId" value={consultaId} />

          <label className="block">
            <span className="etiqueta">Canal</span>
            <select name="canal" defaultValue={canal} className="campo">
              {CANALES.map(([v, t]) => (
                <option key={v} value={v}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="etiqueta">Propiedad</span>
            <select
              name="propiedadId"
              defaultValue={propiedadId ?? ""}
              className="campo"
            >
              <option value="">— Consulta general —</option>
              {propiedades.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.codigo} · {p.direccion}
                  {p.barrio ? ` (${p.barrio})` : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="etiqueta">Qué preguntó</span>
            <textarea
              name="mensaje"
              rows={2}
              defaultValue={mensaje ?? ""}
              className="campo resize-y"
            />
          </label>

          {estado.error && (
            <p
              role="alert"
              className="rounded-[12px] border border-[var(--crit-border)] bg-crit-bg px-3.5 py-2.5 text-[13.5px] text-crit"
            >
              {estado.error}
            </p>
          )}
          {estado.ok && (
            <p className="rounded-[12px] border border-[var(--ok-border)] bg-ok-bg px-3.5 py-2.5 text-[13.5px] text-ok">
              Corregido.
            </p>
          )}

          <Guardar />

          <p className="text-[12px] text-muted">
            El nombre y el teléfono se cambian en la ficha del contacto.
          </p>
        </form>
      )}
    </section>
  );
}
