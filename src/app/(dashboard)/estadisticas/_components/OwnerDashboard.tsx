import Link from "next/link";
import { formatGuaranies } from "@/lib/utils";
import { cn } from "@/lib/utils";
import type { OwnerStats } from "@/actions/stats.actions";
import { StatCard } from "./StatCard";

export type RangeKey = "hoy" | "semana" | "mes";

export const RANGE_LABELS: Record<RangeKey, string> = {
  hoy: "Hoy",
  semana: "Esta semana",
  mes: "Este mes",
};

interface OwnerDashboardProps {
  stats: OwnerStats;
  range: RangeKey;
}

/**
 * Dashboard del dueño: KPIs de la barbería y rendimiento por barbero. Los
 * filtros de rango son links (`?rango=`), no estado de cliente: cada cambio
 * es un fetch real al servidor, mismo criterio que `?date=` en la agenda.
 *
 * El "gráfico" del equipo son barras de Tailwind proporcionales al mejor del
 * rango — sin librerías de gráficos, como pide la spec.
 */
export function OwnerDashboard({ stats, range }: OwnerDashboardProps) {
  const conActividad = stats.leaderboard.filter(
    (member) => member.cuts > 0 || member.income > 0,
  );
  const maxIncome = Math.max(
    1,
    ...conActividad.map((member) => member.income),
  );

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Estadísticas
        </h1>
        <p className="text-sm text-muted">Tu barbería, de un vistazo.</p>
      </header>

      <nav className="flex gap-2" aria-label="Rango de fechas">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <Link
            key={key}
            href={`/estadisticas?rango=${key}`}
            aria-current={key === range ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-transform duration-100 active:scale-95",
              key === range
                ? "bg-accent text-white"
                : "bg-surface-2 text-muted",
            )}
          >
            {RANGE_LABELS[key]}
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Ingresos"
          value={formatGuaranies(stats.totalIncome)}
        />
        <StatCard label="Cortes" value={String(stats.totalCuts)} />
        <StatCard
          label="Promedio diario"
          value={formatGuaranies(stats.dailyAverageIncome)}
          hint={`${stats.days} ${stats.days === 1 ? "día" : "días"} en el rango`}
        />
        <StatCard
          label="Ticket promedio"
          value={formatGuaranies(
            stats.totalCuts > 0
              ? Math.round(stats.totalIncome / stats.totalCuts)
              : 0,
          )}
          hint="Por corte cobrado"
        />
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Equipo</h2>

        {conActividad.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">
            No hay actividad en este periodo.
          </p>
        ) : (
          <ul className="flex flex-col">
            {conActividad.map((member) => (
              <li
                key={member.userId}
                className="flex flex-col gap-1.5 border-b border-line py-3 last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px]">{member.name}</span>
                  <span className="font-display text-sm font-semibold tabular-nums">
                    {formatGuaranies(member.income)}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className="h-full rounded-full bg-accent"
                    style={{
                      width: `${Math.round((member.income / maxIncome) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-xs text-muted tabular-nums">
                  {member.cuts} {member.cuts === 1 ? "corte" : "cortes"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
