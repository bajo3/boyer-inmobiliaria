import { redirect } from "next/navigation";
import { requerirSesion, puedeAdministrar } from "@/lib/auth";
import { leerConfiguracion, cargaDelEquipo, aQuienLeToca } from "@/lib/reparto";
import { AjustesReparto } from "@/components/AjustesReparto";

export default async function Configuracion() {
  const usuario = await requerirSesion();
  if (!puedeAdministrar(usuario)) redirect("/");

  const [config, carga] = await Promise.all([leerConfiguracion(), cargaDelEquipo()]);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4">
      <div className="tarjeta px-4 pb-4 pt-4 sm:px-5">
        <h1 className="font-display text-[26px] font-extrabold">Configuración</h1>
        <p className="mt-1 text-[13.5px] text-ink-2">
          Cómo se reparten las consultas entre los vendedores.
        </p>
      </div>

      <AjustesReparto
        automatica={config.asignacionAutomatica}
        vendedores={carga.map(({ id, nombre, recibeLeads, abiertas }) => ({
          id,
          nombre,
          recibeLeads,
          abiertas,
        }))}
        leToca={aQuienLeToca(carga)?.nombre ?? null}
      />
    </div>
  );
}
