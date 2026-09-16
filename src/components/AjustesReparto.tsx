"use client";

import { useOptimistic, useTransition } from "react";
import {
  cambiarAsignacionAutomatica,
  cambiarRecibeLeads,
} from "@/actions/configuracion";

type Vendedor = {
  id: number;
  nombre: string;
  recibeLeads: boolean;
  abiertas: number;
};

/** Interruptor accesible: un checkbox con aspecto de switch. */
function Interruptor({
  activo,
  onCambio,
  etiqueta,
  disabled,
}: {
  activo: boolean;
  onCambio: (v: boolean) => void;
  etiqueta: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={activo}
      aria-label={etiqueta}
      disabled={disabled}
      onClick={() => onCambio(!activo)}
      className={`relative h-[28px] w-[48px] flex-none rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50 ${
        activo ? "bg-accent" : "bg-line"
      }`}
    >
      <span
        className={`absolute top-[3px] size-[22px] rounded-full bg-white shadow transition-[left] ${
          activo ? "left-[23px]" : "left-[3px]"
        }`}
      />
    </button>
  );
}

export function AjustesReparto({
  automatica,
  vendedores,
  leToca,
}: {
  automatica: boolean;
  vendedores: Vendedor[];
  leToca: string | null;
}) {
  const [, iniciar] = useTransition();
  const [auto, setAuto] = useOptimistic(automatica);
  const [lista, setLista] = useOptimistic(
    vendedores,
    (actual, cambio: { id: number; recibe: boolean }) =>
      actual.map((v) => (v.id === cambio.id ? { ...v, recibeLeads: cambio.recibe } : v)),
  );

  const maxAbiertas = Math.max(1, ...lista.map((v) => v.abiertas));

  return (
    <div className="flex flex-col gap-4">
      <section className="tarjeta p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-[16px] font-bold">Repartir las consultas automáticamente</h2>
            <p className="mt-1 text-[13.5px] text-ink-2">
              Cuando se carga una consulta sin elegir vendedor, va a quien{" "}
              <strong>menos consultas abiertas</strong> tiene. Si empatan, a quien
              hace más tiempo que no recibe una.
            </p>
            <p className="mt-1.5 text-[12.5px] text-muted">
              Se puede seguir eligiendo a mano: el reparto solo actúa cuando el
              campo queda en "Automático".
            </p>
          </div>
          <Interruptor
            activo={auto}
            etiqueta="Repartir automáticamente"
            onCambio={(v) =>
              iniciar(async () => {
                setAuto(v);
                await cambiarAsignacionAutomatica(v);
              })
            }
          />
        </div>

        {auto && (
          <p className="mt-3.5 rounded-[12px] border border-[var(--ok-border)] bg-ok-bg px-3.5 py-2.5 text-[13.5px] text-ok">
            {leToca
              ? `La próxima consulta le toca a ${leToca}.`
              : "Nadie está recibiendo consultas: activá al menos un vendedor abajo."}
          </p>
        )}
      </section>

      <section className="tarjeta overflow-hidden">
        <div className="px-4 pb-2 pt-3.5 sm:px-5">
          <h2 className="rotulo">Quién recibe consultas</h2>
          <p className="mt-1 text-[12.5px] text-muted">
            Sacá a alguien del reparto cuando está de vacaciones o con la agenda
            llena. Sigue viendo y trabajando las suyas.
          </p>
        </div>

        {lista.length === 0 ? (
          <p className="border-t border-line-soft px-5 py-6 text-center text-[13px] text-muted">
            No hay vendedores activos.
          </p>
        ) : (
          <ul className="border-t border-line-soft">
            {lista.map((v) => (
              <li
                key={v.id}
                className="flex items-center gap-4 border-b border-line-soft px-4 py-3 last:border-0 sm:px-5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-semibold">
                    {v.nombre}
                  </span>
                  <span className="mt-1.5 flex items-center gap-2.5">
                    <span className="h-2 max-w-[220px] flex-1 overflow-hidden rounded-full bg-sunken">
                      <span
                        className="block h-full rounded-full bg-accent"
                        style={{ width: `${(v.abiertas / maxAbiertas) * 100}%` }}
                      />
                    </span>
                    <span className="tnum text-[12.5px] text-muted">
                      {v.abiertas} {v.abiertas === 1 ? "abierta" : "abiertas"}
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="hidden text-[12.5px] text-muted sm:inline">
                    {v.recibeLeads ? "Recibe" : "Pausado"}
                  </span>
                  <Interruptor
                    activo={v.recibeLeads}
                    etiqueta={`${v.nombre} recibe consultas`}
                    onCambio={(recibe) =>
                      iniciar(async () => {
                        setLista({ id: v.id, recibe });
                        await cambiarRecibeLeads(v.id, recibe);
                      })
                    }
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
