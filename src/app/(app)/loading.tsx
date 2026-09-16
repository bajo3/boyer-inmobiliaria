/**
 * Lo que se ve mientras el servidor arma la pantalla.
 *
 * Sin esto el navegador se queda en la pantalla anterior, sin ninguna señal,
 * hasta que llega el HTML: son los mismos milisegundos, pero se sienten como
 * que la app no respondió al clic.
 */

function Fila() {
  return (
    <li className="flex gap-3 px-4 py-3.5 sm:px-5">
      <span className="h-[52px] w-1 flex-none rounded-full bg-sunken" />
      <span className="flex min-w-0 flex-1 flex-col gap-2 pt-0.5">
        <span className="flex items-center gap-2">
          <span className="h-3.5 w-[38%] rounded-full bg-sunken" />
          <span className="ml-auto h-4 w-[84px] rounded-full bg-sunken" />
        </span>
        <span className="h-3 w-[62%] rounded-full bg-sunken" />
        <span className="h-3 w-[45%] rounded-full bg-sunken" />
      </span>
    </li>
  );
}

export default function Cargando() {
  return (
    <div
      aria-busy="true"
      aria-label="Cargando"
      className="grid animate-pulse items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]"
    >
      <div className="tarjeta overflow-hidden">
        <div className="px-4 pb-3 pt-4 sm:px-5">
          <span className="block h-3 w-[120px] rounded-full bg-sunken" />
          <span className="mt-2.5 block h-6 w-[220px] rounded-full bg-sunken" />
          <span className="mt-3.5 block h-[46px] rounded-[16px] bg-sunken" />
        </div>
        <ul className="border-t border-line-soft">
          {[0, 1, 2, 3, 4].map((i) => (
            <Fila key={i} />
          ))}
        </ul>
      </div>

      <div className="hidden flex-col gap-4 xl:flex">
        <div className="tarjeta h-[160px]" />
        <div className="tarjeta h-[190px]" />
      </div>
    </div>
  );
}
