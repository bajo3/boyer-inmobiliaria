import { AGENCIA } from "@/lib/agencia";

/** El encabezado que llevan todos los documentos. */
export function Membrete({ numero }: { numero?: string }) {
  return (
    <header className="mb-6 flex items-start justify-between gap-6 border-b border-[#14132b] pb-4">
      <div className="flex items-center gap-3">
        <span className="grid size-[44px] flex-none place-items-center rounded-[14px] bg-accent font-display text-[17px] font-extrabold tracking-tight text-white">
          MP
        </span>
        <span className="leading-[1.3]">
          <span className="block font-display text-[16px] font-extrabold">
            {AGENCIA.nombre}
          </span>
          <span className="block text-[11.5px] text-[#4a4870]">
            {AGENCIA.rubro} · {AGENCIA.matricula}
          </span>
          <span className="block text-[11.5px] text-[#4a4870]">
            {AGENCIA.direccion}, {AGENCIA.ciudad} · CUIT {AGENCIA.cuit}
          </span>
        </span>
      </div>

      {numero && (
        <span className="tnum flex-none text-right text-[11.5px] text-[#4a4870]">
          <span className="block font-bold text-[#14132b]">N.º {numero}</span>
        </span>
      )}
    </header>
  );
}
