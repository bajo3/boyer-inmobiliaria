import { requerirSesion } from "@/lib/auth";
import { ETIQUETAS } from "@/lib/formato";
import { FormPassword } from "@/components/FormPassword";

export default async function Cuenta() {
  const usuario = await requerirSesion();

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-4">
      <div>
        <h1 className="font-display text-[30px] font-extrabold">Mi cuenta</h1>
        <p className="mt-0.5 text-[13.5px] text-muted">
          {usuario.nombre} · {ETIQUETAS.rol[usuario.rol] ?? usuario.rol} ·{" "}
          {usuario.email}
        </p>
      </div>

      {!usuario.passwordCambiado && (
        <p className="rounded-[16px] border border-[var(--warn-border)] bg-warn-bg px-4 py-3 text-[13.5px] text-warn">
          Seguís usando la contraseña que te asignaron al crear el usuario.
          Cambiala por una tuya: es la misma para todos hasta que cada uno la
          cambie.
        </p>
      )}

      <FormPassword />
    </div>
  );
}
