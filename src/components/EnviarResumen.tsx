"use client";

import { useState } from "react";

/**
 * Mandar el resumen o copiarlo.
 *
 * El link de wa.me sin número abre WhatsApp con el texto cargado y deja elegir
 * a quién: en la práctica va siempre al grupo de la oficina, y así no hay que
 * tener ningún número configurado en el sistema.
 */
export function EnviarResumen({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      <a
        href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
        target="_blank"
        rel="noreferrer"
        className="btn btn-wa flex-[1.4]"
      >
        Enviar por WhatsApp
      </a>
      <button type="button" onClick={copiar} className="btn btn-neutro flex-1">
        {copiado ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
