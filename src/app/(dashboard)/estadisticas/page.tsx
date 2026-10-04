import {
  getBarberStatsAction,
  getCurrentRoleAction,
  getMonthTicketAction,
  getOwnerStatsAction,
  getStampCardAction,
  getTeamClosuresAction,
} from "@/actions/stats.actions";
import {
  businessMonthStart,
  businessToday,
  businessWeekStart,
} from "@/lib/dates";
import { BarberDashboard } from "./_components/BarberDashboard";
import { OwnerDashboard, type RangeKey } from "./_components/OwnerDashboard";

interface EstadisticasPageProps {
  searchParams: Promise<{ rango?: string }>;
}

const RANGOS: RangeKey[] = ["hoy", "semana", "mes"];

/**
 * Rango [desde, hasta] en días del negocio. "Esta semana" arranca el lunes y
 * "este mes" el día 1 — los dos terminan hoy, no al final del periodo: el
 * dueño quiere saber cómo viene, no proyectar el futuro.
 */
function resolveRange(range: RangeKey, today: string) {
  if (range === "semana") return { from: businessWeekStart(today), to: today };
  if (range === "mes") return { from: businessMonthStart(today), to: today };
  return { from: today, to: today };
}

export default async function EstadisticasPage({
  searchParams,
}: EstadisticasPageProps) {
  const params = await searchParams;
  const roleResult = await getCurrentRoleAction();

  if (!roleResult.success) {
    return (
      <p role="alert" className="text-danger p-4 text-sm">
        {roleResult.error}
      </p>
    );
  }

  const today = businessToday();

  if (roleResult.data.role !== "owner") {
    const [statsResult, monthResult, stampResult] = await Promise.all([
      getBarberStatsAction(today),
      getMonthTicketAction(today),
      getStampCardAction(today),
    ]);

    if (!statsResult.success) {
      return (
        <p role="alert" className="text-danger p-4 text-sm">
          {statsResult.error}
        </p>
      );
    }

    return (
      <BarberDashboard
        stats={statsResult.data}
        firstName={roleResult.data.name.split(" ")[0]}
        // Las dos son extras de la pantalla: si fallan, no se muestran y el
        // resto del dashboard sigue.
        monthTicket={monthResult.success ? monthResult.data : null}
        stampCard={stampResult.success ? stampResult.data : null}
      />
    );
  }

  const range: RangeKey = RANGOS.includes(params.rango as RangeKey)
    ? (params.rango as RangeKey)
    : "hoy";
  const { from, to } = resolveRange(range, today);

  const [statsResult, closuresResult] = await Promise.all([
    getOwnerStatsAction(from, to),
    getTeamClosuresAction(today),
  ]);

  if (!statsResult.success) {
    return (
      <p role="alert" className="text-danger p-4 text-sm">
        {statsResult.error}
      </p>
    );
  }

  return (
    <OwnerDashboard
      stats={statsResult.data}
      range={range}
      closures={closuresResult.success ? closuresResult.data : null}
    />
  );
}
