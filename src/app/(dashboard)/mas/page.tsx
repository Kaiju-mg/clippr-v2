import Link from "next/link";
import { cookies } from "next/headers";
import { ChevronRight } from "lucide-react";
import { logoutAction } from "@/actions/auth.actions";
import { ThemeSwitch } from "@/components/ui/ThemeSwitch";
import { VibrationSwitch } from "@/components/ui/VibrationSwitch";
import { createClient } from "@/lib/supabase/server";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import type { SubscriptionPlan, UserRole } from "@/types";
import { BarbershopCard } from "./_components/BarbershopCard";

// Estadísticas entra acá y no en la BottomNav: la barra se mantiene en 4
// íconos de uso diario (decisión del 2026-09-15, ver docs/decisiones.md) y
// las estadísticas tienen cadencia semanal/mensual. El nivel del barbero
// también se mira desde acá, dentro de Estadísticas.
const LINKS = [
  { href: "/estadisticas", label: "Estadísticas" },
  { href: "/servicios", label: "Servicios" },
  { href: "/productos", label: "Productos" },
  { href: "/equipo", label: "Equipo" },
  { href: "/mas/cambiar-password", label: "Cambiar contraseña" },
  { href: "/ayuda", label: "Ayuda" },
  { href: "/terminos", label: "Términos" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/mas/eliminar-cuenta", label: "Eliminar mi cuenta" },
];

interface PerfilConBarberia {
  name: string;
  role: UserRole;
  barbershops: {
    name: string;
    subscription_plan: SubscriptionPlan;
    phone: string | null;
  } | null;
}

/**
 * Perfil propio con su barbería, para la tarjeta de arriba. RLS acota las dos
 * tablas a lo propio (`users_select_same_barbershop`,
 * `barbershops_select_own`); si algo falla, `/mas` se muestra sin tarjeta.
 */
async function perfilConBarberia(): Promise<PerfilConBarberia | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("users")
    .select("name, role, barbershops(name, subscription_plan, phone)")
    .eq("auth_id", user.id)
    .maybeSingle<PerfilConBarberia>();

  if (error) {
    console.error("MasPage (perfil):", error.message);
    return null;
  }
  return data;
}

export default async function MasPage() {
  const store = await cookies();
  const theme = parseTheme(store.get(THEME_COOKIE)?.value);
  const perfil = await perfilConBarberia();

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="font-display text-xl font-semibold">Más</h1>

      {perfil?.barbershops && (
        <BarbershopCard
          barbershopName={perfil.barbershops.name}
          userName={perfil.name}
          role={perfil.role}
          plan={perfil.barbershops.subscription_plan ?? null}
          phone={perfil.barbershops.phone ?? null}
        />
      )}

      <div className="divide-line border-line flex flex-col divide-y border-b">
        <ThemeSwitch initialTheme={theme} />
        <VibrationSwitch />
      </div>

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
