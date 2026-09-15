import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { logoutAction } from "@/actions/auth.actions";

const LINKS = [
  { href: "/servicios", label: "Servicios" },
  { href: "/equipo", label: "Equipo" },
];

export default function MasPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-xl font-semibold">Más</h1>

      <ul className="flex flex-col">
        {LINKS.map(({ href, label }) => (
          <li key={href} className="border-b border-line last:border-b-0">
            <Link
              href={href}
              className="flex items-center justify-between py-3.5 text-[15px] text-foreground"
            >
              {label}
              <ChevronRight size={18} className="text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      <form action={logoutAction}>
        <button
          type="submit"
          className="w-full rounded border border-line px-4 py-3 text-left text-[15px] text-danger transition-transform duration-100 active:scale-95"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
