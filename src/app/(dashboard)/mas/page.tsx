import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { logoutAction } from "@/actions/auth.actions";

// Estadísticas entra acá y no en la BottomNav: la barra se mantiene en 4
// íconos de uso diario (decisión del 2026-09-15, ver docs/decisiones.md) y
// las estadísticas tienen cadencia semanal/mensual.
const LINKS = [
  { href: "/estadisticas", label: "Estadísticas" },
  { href: "/servicios", label: "Servicios" },
  { href: "/productos", label: "Productos" },
  { href: "/equipo", label: "Equipo" },
  { href: "/mas/cambiar-password", label: "Cambiar contraseña" },
];

export default function MasPage() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-xl font-semibold">Más</h1>

      <ul className="flex flex-col">
        {LINKS.map(({ href, label }) => (
          <li key={href} className="border-line border-b last:border-b-0">
            <Link
              href={href}
              className="text-foreground flex items-center justify-between py-3.5 text-[15px]"
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
          className="border-line text-danger w-full rounded border px-4 py-3 text-left text-[15px] transition-transform duration-100 active:scale-95"
        >
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
