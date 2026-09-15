import Link from "next/link";
import { requerirSesion } from "@/lib/auth";
import { salir } from "@/actions/auth";
import { NavLinks } from "@/components/NavLinks";
import { AGENCIA } from "@/lib/agencia";

function iniciales(nombre: string): string {
  return nombre
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const usuario = await requerirSesion();

  return (
    <div className="min-h-dvh px-3 pb-16 pt-3 sm:px-5 sm:pt-5">
      {/* Ancho fluido: en un monitor grande la pantalla se usa entera. */}
      <div className="mx-auto flex w-full max-w-[1760px] flex-col gap-4">
        <header className="tarjeta flex flex-wrap items-center gap-3 px-3.5 py-2.5 sm:gap-4">
          <Link href="/" className="mr-auto flex items-center gap-2.5">
            <span className="grid size-[34px] flex-none place-items-center rounded-[11px] bg-accent font-display text-[14px] font-extrabold tracking-tight text-white">
              MP
            </span>
            <span className="leading-[1.15]">
              <span className="block font-display text-[15px] font-bold tracking-tight">
                {AGENCIA.nombre}
              </span>
              <span className="block text-[11px] text-muted">
                {AGENCIA.rubro} · {AGENCIA.ciudad}
                <span className="hidden sm:inline"> · {AGENCIA.matricula}</span>
              </span>
            </span>
          </Link>

          <NavLinks esTitular={usuario.rol === "titular"} />

          <div className="flex items-center gap-2.5">
            <Link
              href="/cuenta"
              title={`${usuario.nombre} — mi cuenta`}
              className="grid size-[38px] flex-none place-items-center rounded-full bg-accent-soft text-[13px] font-bold text-accent hover:bg-accent-border"
            >
              {iniciales(usuario.nombre)}
            </Link>
            <form action={salir}>
              <button
                type="submit"
                className="text-[13px] font-semibold text-muted hover:text-accent"
              >
                Salir
              </button>
            </form>
          </div>
        </header>

        {/* Mientras todos compartan la contraseña inicial, no hay cuentas
            separadas de verdad: hay una sola llave repartida. */}
        {!usuario.passwordCambiado && (
          <Link
            href="/cuenta"
            className="flex items-center gap-2.5 rounded-[16px] border border-[var(--warn-border)] bg-warn-bg px-4 py-3 text-[13.5px] text-warn hover:border-[var(--warn-solid)]"
          >
            <span className="size-2 flex-none rounded-full bg-[var(--warn-solid)]" />
            Seguís con la contraseña inicial, la misma que los demás.
            <span className="ml-auto font-semibold whitespace-nowrap">
              Cambiarla →
            </span>
          </Link>
        )}

        <main>{children}</main>

        <footer className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11.5px] text-faint">
          <span>
            {AGENCIA.titular} · {AGENCIA.matricula}
          </span>
          <span>
            {AGENCIA.direccion}, {AGENCIA.ciudad}
          </span>
          <span>{AGENCIA.horario}</span>
        </footer>
      </div>
    </div>
  );
}
