"use client";

import { useMemo, useState, useTransition } from "react";
import {
  mesesDelAjuste,
  calcularAjuste,
  calcularPorPorcentaje,
  mesCorto,
} from "@/lib/ipc";
import { aplicarAjuste } from "@/actions/indices";
import { precio as fmtPrecio } from "@/lib/formato";

export type ContratoItem = {
  id: number;
  inquilino: string;
  direccion: string;
  monto: string;
  moneda: "ARS" | "USD";
  ajuste: string;
  ultimoAjuste: string | null;
};

const NF = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 });

/**
 * Dos caminos al mismo número.
 *
 * Con el índice cargado el cálculo sale solo, pero el INDEC publica a mediados
 * de mes y nadie va a cargar doce meses antes de poder usar la calculadora.
 * Por eso el modo manual existe y es el que abre: se escribe el acumulado que
 * ya viene en la nota del diario y listo.
 */
export function CalculadoraIPC({
  contratos,
  indices,
  puedeAplicar,
}: {
  contratos: ContratoItem[];
  indices: { mes: string; valor: string }[];
  puedeAplicar: boolean;
}) {
  const [modo, setModo] = useState<"manual" | "indice">("manual");
  const [contratoId, setContratoId] = useState<string>(
    contratos[0] ? String(contratos[0].id) : "",
  );
  const [montoLibre, setMontoLibre] = useState("");
  const [porcentaje, setPorcentaje] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [aplicando, iniciarAplicar] = useTransition();
  const [aplicado, setAplicado] = useState(false);

  const valores = useMemo(
    () => new Map(indices.map((i) => [i.mes, Number(i.valor)])),
    [indices],
  );

  const contrato = contratos.find((c) => String(c.id) === contratoId);

  // El monto sale del contrato elegido; si no hay ninguno, se escribe a mano.
  const monto = contrato ? Number(contrato.monto) : Number(montoLibre) || 0;
  const moneda = contrato?.moneda ?? "ARS";

  const calculo = useMemo(() => {
    if (monto <= 0) return null;

    if (modo === "manual") {
      const p = Number(porcentaje);
      if (!Number.isFinite(p) || porcentaje === "") return null;
      return calcularPorPorcentaje(monto, p);
    }

    if (!/^\d{4}-\d{2}$/.test(desde) || !/^\d{4}-\d{2}$/.test(hasta)) return null;

    const meses = mesesDelAjuste(desde, hasta);
    if (meses.length === 0) return null;

    return calcularAjuste(monto, meses, valores);
  }, [modo, monto, porcentaje, desde, hasta, valores]);

  function aplicar() {
    if (!contrato || !calculo) return;

    const detalle =
      modo === "manual"
        ? `${NF.format(calculo.porcentaje)} % acumulado, cargado a mano`
        : `IPC ${mesCorto(desde)} a ${mesCorto(hasta)}, ${NF.format(calculo.porcentaje)} %`;

    iniciarAplicar(async () => {
      await aplicarAjuste(contrato.id, calculo.montoNuevo, detalle);
      setAplicado(true);
    });
  }

  return (
    <section className="tarjeta p-4">
      <h2 className="rotulo">Calculadora de ajuste</h2>

      <div className="mt-2.5 flex gap-1.5">
        {(
          [
            ["manual", "Con el % acumulado"],
            ["indice", "Con el IPC cargado"],
          ] as const
        ).map(([v, t]) => (
          <button
            key={v}
            type="button"
            onClick={() => {
              setModo(v);
              setAplicado(false);
            }}
            data-activa={modo === v}
            className="solapa"
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-3.5 flex flex-col gap-3">
        <label className="block">
          <span className="etiqueta">Contrato</span>
          <select
            className="campo"
            value={contratoId}
            onChange={(e) => {
              setContratoId(e.target.value);
              setAplicado(false);
            }}
          >
            <option value="">— Monto suelto, sin contrato —</option>
            {contratos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.inquilino} · {c.direccion}
              </option>
            ))}
          </select>
        </label>

        {!contrato && (
          <label className="block">
            <span className="etiqueta">Monto actual</span>
            <input
              inputMode="numeric"
              className="campo tnum"
              placeholder="450000"
              value={montoLibre}
              onChange={(e) => setMontoLibre(e.target.value)}
            />
          </label>
        )}

        {modo === "manual" ? (
          <label className="block">
            <span className="etiqueta">Porcentaje acumulado del período</span>
            <input
              inputMode="decimal"
              className="campo tnum"
              placeholder="8.24"
              value={porcentaje}
              onChange={(e) => {
                setPorcentaje(e.target.value);
                setAplicado(false);
              }}
            />
          </label>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="etiqueta">Último ajuste</span>
              <input
                className="campo tnum"
                placeholder="2026-05"
                value={desde}
                onChange={(e) => {
                  setDesde(e.target.value);
                  setAplicado(false);
                }}
              />
            </label>
            <label className="block">
              <span className="etiqueta">Hasta el mes</span>
              <input
                className="campo tnum"
                placeholder="2026-08"
                value={hasta}
                onChange={(e) => {
                  setHasta(e.target.value);
                  setAplicado(false);
                }}
              />
            </label>
          </div>
        )}
      </div>

      {calculo && (
        <div className="mt-3.5 rounded-[14px] bg-sunken p-3.5">
          <p className="text-[12.5px] text-muted">
            {fmtPrecio(monto, moneda)} + {NF.format(calculo.porcentaje)} %
          </p>
          <p className="tnum mt-0.5 font-display text-[28px] font-extrabold leading-none text-accent">
            {fmtPrecio(calculo.montoNuevo, moneda)}
          </p>
          <p className="mt-1.5 text-[13px] text-ink-2">
            Sube {fmtPrecio(calculo.diferencia, moneda)} por mes.
          </p>

          {modo === "indice" && calculo.meses.length > 0 && (
            <p className="mt-2 text-[12px] text-muted">
              {calculo.meses.length} meses: {calculo.meses.map(mesCorto).join(", ")}
            </p>
          )}

          {calculo.faltantes.length > 0 && (
            <p className="mt-2 rounded-[10px] border border-[var(--warn-border)] bg-warn-bg px-3 py-2 text-[12.5px] text-warn">
              Faltan cargar {calculo.faltantes.map(mesCorto).join(", ")}. Sin esos
              meses el resultado queda por debajo del real.
            </p>
          )}

          {contrato && puedeAplicar && (
            <button
              type="button"
              onClick={aplicar}
              disabled={aplicando || aplicado}
              className="btn btn-primario btn-chico mt-3 w-full"
            >
              {aplicado
                ? "Aplicado al contrato"
                : aplicando
                  ? "Aplicando…"
                  : "Aplicar al contrato"}
            </button>
          )}
        </div>
      )}

      <p className="mt-3 text-[12px] text-muted">
        Los porcentajes mensuales se multiplican, no se suman: cuatro meses al
        2 % dan 8,24 %, no 8 %.
      </p>
    </section>
  );
}
