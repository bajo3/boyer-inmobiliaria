"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { agendarVisita, type Estado } from "@/actions/consultas";

function proximoDiaHabil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  d.setHours(17, 0, 0, 0);

  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primario w-full" disabled={pending}>
      {pending ? "Agendando…" : "Agendar"}
    </button>
  );
}

export function FormVisita({ consultaId }: { consultaId: number }) {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion] = useActionState<Estado, FormData>(agendarVisita, {});

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="btn btn-neutro w-full"
      >
        Agendar visita
      </button>
    );
  }

  return (
    <section className="tarjeta-i border-accent! p-4">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="text-[12.5px] font-semibold text-muted">Agendar visita</p>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="text-[12.5px] font-semibold text-muted hover:text-ink"
        >
          Cancelar
        </button>
      </div>

      <form action={accion} className="flex flex-col gap-2.5">
        <input type="hidden" name="consultaId" value={consultaId} />

        <input
          type="datetime-local"
          name="fechaHora"
          required
          defaultValue={proximoDiaHabil()}
          className="campo tnum"
          aria-label="Cuándo"
        />

        {estado.error && (
          <p
            role="alert"
            className="rounded-[12px] border border-[var(--crit-border)] bg-crit-bg px-3.5 py-2.5 text-[13.5px] text-crit"
          >
            {estado.error}
          </p>
        )}

        <Boton />
      </form>
    </section>
  );
}
