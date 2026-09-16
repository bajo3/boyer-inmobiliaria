import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { BotonImprimir } from "@/components/BotonImprimir";

/**
 * Los documentos van fuera del layout de la app: sin menú ni encabezado, para
 * que lo que se ve en pantalla sea exactamente lo que sale impreso.
 */
export default async function ImprimirLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requerirSesion();

  return (
    <div className="min-h-dvh px-3 py-5 sm:px-5">
      <div className="sin-imprimir mx-auto mb-4 flex w-full max-w-[820px] items-center gap-3">
        <Link
          href="/documentos"
          className="text-[13px] font-semibold text-muted hover:text-accent"
        >
          ← Volver a documentos
        </Link>
        <span className="ml-auto">
          <BotonImprimir />
        </span>
      </div>

      {children}
    </div>
  );
}
