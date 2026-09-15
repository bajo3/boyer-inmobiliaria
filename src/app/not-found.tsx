import Link from "next/link";

export default function NoEncontrado() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="text-center">
        <p className="rotulo">
          Error 404
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight">
          Esa página no existe
        </h1>
        <p className="mt-2 text-sm text-ink-2">
          Puede que el registro se haya borrado o que el link esté mal.
        </p>
        <Link href="/" className="btn btn-primario mt-5">
          Volver a consultas
        </Link>
      </div>
    </main>
  );
}
