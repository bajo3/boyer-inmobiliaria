import { redirect } from "next/navigation";
import { sesionActual } from "@/lib/auth";
import { AGENCIA } from "@/lib/agencia";
import { FormLogin } from "./FormLogin";

export default async function LoginPage() {
  if (await sesionActual()) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center p-5">
      <div className="w-full max-w-[400px]">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid size-[46px] flex-none place-items-center rounded-[15px] bg-accent font-display text-[18px] font-extrabold tracking-tight text-white">
            MP
          </span>
          <span>
            <h1 className="font-display text-[22px] font-extrabold leading-tight">
              {AGENCIA.nombre}
            </h1>
            <p className="text-[13px] text-muted">
              {AGENCIA.rubro} · {AGENCIA.ciudad}
            </p>
          </span>
        </div>

        <FormLogin />

        <p className="mt-5 text-center text-[12px] text-faint">
          {AGENCIA.titular} · {AGENCIA.matricula}
        </p>
      </div>
    </main>
  );
}
