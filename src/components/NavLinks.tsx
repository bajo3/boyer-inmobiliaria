"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Bandeja", exacto: true },
  { href: "/propiedades", label: "Propiedades" },
  { href: "/contactos", label: "Contactos" },
  { href: "/agenda", label: "Agenda" },
];

export function NavLinks({ esTitular }: { esTitular: boolean }) {
  const path = usePathname();

  const items = esTitular ? [...ITEMS, { href: "/panel", label: "Panel" }] : ITEMS;

  return (
    <nav
      aria-label="Secciones"
      className="-mx-1 flex w-full flex-nowrap gap-1.5 overflow-x-auto px-1 pb-1 sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0"
    >
      {items.map((it) => {
        const activa = it.exacto
          ? path === it.href || path.startsWith("/consultas")
          : path.startsWith(it.href);

        return (
          <Link
            key={it.href}
            href={it.href}
            data-activa={activa}
            aria-current={activa ? "page" : undefined}
            className="pastilla-nav"
          >
            {it.label}
          </Link>
        );
      })}
    </nav>
  );
}
