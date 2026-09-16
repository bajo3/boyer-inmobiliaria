import { Suspense } from "react";
import { requerirSesion } from "@/lib/auth";
import { BandejaLista, cargarBandeja, leerFiltro } from "@/components/BandejaLista";
import { ResumenDia } from "@/components/ResumenDia";

export default async function Bandeja({
  searchParams,
}: {
  searchParams: Promise<{ f?: string; q?: string }>;
}) {
  const usuario = await requerirSesion();
  const { f, q } = await searchParams;
  const filtro = leerFiltro(f, usuario.rol);

  const datos = await cargarBandeja(usuario, filtro, q);

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
      <BandejaLista usuario={usuario} filtro={filtro} datos={datos} />

      {/* La columna de la derecha hace sus propias consultas. En Suspense, la
          bandeja se pinta sin esperarla y el resumen entra cuando está. */}
      <Suspense
        fallback={
          <div className="hidden animate-pulse flex-col gap-4 xl:flex">
            <div className="tarjeta h-[160px]" />
            <div className="tarjeta h-[190px]" />
          </div>
        }
      >
        <ResumenDia />
      </Suspense>
    </div>
  );
}
