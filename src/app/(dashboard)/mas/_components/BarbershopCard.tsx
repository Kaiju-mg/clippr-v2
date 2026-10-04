import { BarberPole } from "@/components/ui/BarberPole";
import type { SubscriptionPlan, UserRole } from "@/types";

/**
 * Nombre visible de cada plan. Son etiquetas, no precios: los precios no se
 * escriben en el código (regla 6 de CLAUDE.md).
 */
const PLAN_LABELS: Record<SubscriptionPlan, string> = {
  trial: "Plan de prueba",
  pro: "Plan Pro",
  team: "Plan Equipo",
};

const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Dueño",
  barber: "Barbero",
  independent: "Independiente",
};

interface BarbershopCardProps {
  barbershopName: string;
  userName: string;
  role: UserRole;
  plan: SubscriptionPlan | null;
}

/**
 * La barbería como tarjeta, arriba de `/mas` (spec 10): poste, nombre,
 * "Nombre · Rol" y el plan, con borde punteado como un cupón. Sólo lectura:
 * editar el nombre y el teléfono llega con la fase 3.
 */
export function BarbershopCard({
  barbershopName,
  userName,
  role,
  plan,
}: BarbershopCardProps) {
  return (
    <section
      aria-label="Tu barbería"
      className="bg-surface-2 border-muted/55 flex items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed px-4 py-3.5"
    >
      <BarberPole size="sm" tier="acero" status="activa" />
      <div className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-base font-bold">{barbershopName}</span>
        <span className="text-muted truncate text-[12.5px]">
          {userName} · {ROLE_LABELS[role]}
        </span>
        {plan && (
          <span className="border-accent-ink text-accent-ink mt-1 self-start rounded-full border px-2 text-[10.5px] font-semibold">
            {PLAN_LABELS[plan]}
          </span>
        )}
      </div>
    </section>
  );
}
