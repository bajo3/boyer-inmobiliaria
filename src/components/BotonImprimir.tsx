"use client";

export function BotonImprimir() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="btn btn-primario btn-chico"
    >
      Imprimir o guardar PDF
    </button>
  );
}
