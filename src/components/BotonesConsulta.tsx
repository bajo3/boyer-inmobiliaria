"use client";

import { useTransition } from "react";
import { tomarConsulta, reabrirConsulta } from "@/actions/consultas";

export function BotonTomar({ consultaId }: { consultaId: number }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => iniciar(() => void tomarConsulta(consultaId))}
      className="btn btn-primario btn-chico"
    >
      {pendiente ? "Tomando…" : "Tomarla"}
    </button>
  );
}

export function BotonReabrir({ consultaId }: { consultaId: number }) {
  const [pendiente, iniciar] = useTransition();

  return (
    <button
      type="button"
      disabled={pendiente}
      onClick={() => iniciar(() => void reabrirConsulta(consultaId))}
      className="btn btn-neutro btn-chico"
    >
      {pendiente ? "Reabriendo…" : "Reabrir"}
    </button>
  );
}
