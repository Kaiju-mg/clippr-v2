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
import type { ReactNode } from "react";
import { BarberDashboard } from "./_components/BarberDashboard";
import { OwnerDashboard, type RangeKey } from "./_components/OwnerDashboard";
import { OwnerViewSwitch } from "./_components/OwnerViewSwitch";

interface EstadisticasPageProps {
  searchParams: Promise<{ rango?: string; vista?: string }>;
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

  const isOwner = roleResult.data.role === "owner";
  const firstName = roleResult.data.name.split(" ")[0];

  // El barbero siempre ve su rendimiento. El dueño elige con el selector
  // (`?vista=yo`): "Yo" es su propio tablero de barbero, sólo sus números,
  // porque el dueño también corta (2026-10-04).
  if (!isOwner) return personalView(today, firstName);
  if (params.vista === "yo") {
    return personalView(today, firstName, <OwnerViewSwitch active="yo" />);
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
      topSlot={<OwnerViewSwitch active="barberia" />}
    />
  );
}

/**
 * Rendimiento propio: lo que ve el barbero, y el dueño en "Yo". Todas las
 * acciones consultan lo del perfil autenticado (`user_id` a mano), así que
 * para el dueño son sus cortes, su racha y su nivel, nunca los del equipo.
 */
async function personalView(
  today: string,
  firstName: string,
  topSlot?: ReactNode,
) {
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
      firstName={firstName}
      // Las dos son extras de la pantalla: si fallan, no se muestran y el
      // resto del dashboard sigue.
      monthTicket={monthResult.success ? monthResult.data : null}
      stampCard={stampResult.success ? stampResult.data : null}
      topSlot={topSlot}
    />
  );
}
