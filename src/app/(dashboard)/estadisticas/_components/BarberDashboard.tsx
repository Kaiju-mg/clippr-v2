import { Flame } from "lucide-react";
import { LEVEL_LABELS, LEVEL_WINDOW_DAYS } from "@/lib/levels";
import { formatGuaranies } from "@/lib/utils";
import type { BarberStats } from "@/actions/stats.actions";
import { StatCard } from "./StatCard";

interface BarberDashboardProps {
  stats: BarberStats;
  firstName: string;
}

/**
 * Dashboard del barbero: su día, su racha y cuánto le falta para la
 * siguiente liga. Server Component puro — los dashboards son de sólo
 * lectura, no necesitan estado optimista (caso borde 5 de la spec).
 *
 * La barra de progreso es un `div` con `width` en porcentaje: la spec pide
 * evitar librerías de gráficos en esta iteración.
 */
export function BarberDashboard({ stats, firstName }: BarberDashboardProps) {
  const { progress } = stats;
  const sinActividad = stats.completedCuts === 0 && stats.income === 0;
  const ventana = `${progress.cuts} ${progress.cuts === 1 ? "corte" : "cortes"} en los últimos ${LEVEL_WINDOW_DAYS} días`;

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Tu rendimiento
        </h1>
        <p className="text-muted text-sm">
          {firstName}, así viene tu día de hoy.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard label="Cortes de hoy" value={String(stats.completedCuts)} />
        <StatCard label="Cobrado hoy" value={formatGuaranies(stats.income)} />
      </div>

      {sinActividad && (
        <p className="text-muted text-sm">
          Todavía no hay actividad hoy. Cuando cobres tu primer corte, los
          números aparecen acá.
        </p>
      )}

      <section className="bg-surface-2 flex flex-col gap-3 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <p className="text-muted text-xs font-medium">Tu nivel</p>
            <p className="font-display text-2xl font-semibold">
              {LEVEL_LABELS[progress.level]}
            </p>
          </div>
          <span className="bg-background flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium tabular-nums">
            <Flame size={14} strokeWidth={1.5} />
            {stats.streakCount} {stats.streakCount === 1 ? "día" : "días"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div
            className="bg-background h-2 overflow-hidden rounded-full"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress.ratio * 100)}
            aria-label={
              progress.nextLevel
                ? `Progreso hacia ${LEVEL_LABELS[progress.nextLevel]}`
                : "Nivel máximo alcanzado"
            }
          >
            <div
              className="bg-accent h-full rounded-full"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
          <p className="text-muted text-xs">
            {ventana}
            {progress.nextLevel
              ? ` · te ${progress.cutsToNext === 1 ? "falta" : "faltan"} ${progress.cutsToNext} para ${LEVEL_LABELS[progress.nextLevel]}`
              : " · estás en el nivel más alto"}
          </p>
        </div>

        <p className="text-muted text-xs">
          Tu nivel se calcula sobre los últimos {LEVEL_WINDOW_DAYS} días: si
          bajás el ritmo, baja con vos.
        </p>
      </section>
    </div>
  );
}
