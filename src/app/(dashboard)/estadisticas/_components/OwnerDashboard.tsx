import Link from "next/link";
import { Scissors, Wallet } from "lucide-react";
import { StatTile, Tile, tileClasses } from "@/components/ui/Tile";
import { cn, formatGuaranies } from "@/lib/utils";
import type { OwnerStats } from "@/actions/stats.actions";

export type RangeKey = "hoy" | "semana" | "mes";

export const RANGE_LABELS: Record<RangeKey, string> = {
  hoy: "Hoy",
  semana: "Esta semana",
  mes: "Este mes",
};

const INGRESOS_LABELS: Record<RangeKey, string> = {
  hoy: "Ingresos de hoy",
  semana: "Ingresos de la semana",
  mes: "Ingresos del mes",
};

interface OwnerDashboardProps {
  stats: OwnerStats;
  range: RangeKey;
}

/**
 * Dashboard del dueño: KPIs de la barbería y rendimiento por barbero, como
 * grilla bento. Los filtros de rango son links (`?rango=`), no estado de
 * cliente: cada cambio es un fetch real al servidor, mismo criterio que
 * `?date=` en la agenda.
 *
 * El "gráfico" del equipo son barras de Tailwind proporcionales al mejor del
 * rango — sin librerías de gráficos, como pide la spec.
 */
export function OwnerDashboard({ stats, range }: OwnerDashboardProps) {
  const conActividad = stats.leaderboard.filter(
    (member) => member.cuts > 0 || member.income > 0,
  );
  const maxIncome = Math.max(1, ...conActividad.map((member) => member.income));

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-0.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Estadísticas
        </h1>
        <p className="text-muted text-sm">Tu barbería, de un vistazo.</p>
      </header>

      <nav className="flex gap-2" aria-label="Rango de fechas">
        {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
          <Link
            key={key}
            href={`/estadisticas?rango=${key}`}
            aria-current={key === range ? "page" : undefined}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-xs font-medium transition-transform duration-100 active:scale-95",
              key === range
                ? "bg-accent text-accent-contrast"
                : "bg-surface-2 text-muted",
            )}
          >
            {RANGE_LABELS[key]}
          </Link>
        ))}
      </nav>

      {/* El cubo relleno de la pantalla: los ingresos del rango son el
          número por el que el dueño entra acá. */}
      <Tile variant="filled" className="gap-2 p-5">
        <span className="text-[0.625rem] font-medium tracking-[0.14em] uppercase opacity-80">
          {INGRESOS_LABELS[range]}
        </span>
        <span className="font-display text-[2.25rem] leading-none font-semibold tracking-tight tabular-nums">
          {formatGuaranies(stats.totalIncome)}
        </span>
      </Tile>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={<Scissors size={18} strokeWidth={1.5} />}
          value={String(stats.totalCuts)}
          label={stats.totalCuts === 1 ? "Corte" : "Cortes"}
          className="aspect-square"
        />
        <StatTile
          icon={<Wallet size={18} strokeWidth={1.5} />}
          value={formatGuaranies(stats.averageTicket)}
          label="Ticket prom."
          hint="Sólo cortes, sin productos"
          size="md"
          className="aspect-square"
        />
      </div>

      {/* Fila fina, no cubo: `tileClasses` en vez de `<Tile>` porque este
          caso necesita dirección horizontal y `Tile` fija `flex-col`. */}
      <div
        className={tileClasses(
          "plain",
          "flex-row items-center justify-between py-3",
        )}
      >
        <span className="text-muted text-[13px]">Promedio diario</span>
        <span className="font-display text-base font-semibold tracking-tight tabular-nums">
          {formatGuaranies(stats.dailyAverageIncome)}
        </span>
      </div>

      <Tile className="gap-3">
        <h2 className="text-muted text-[0.625rem] font-medium tracking-[0.14em] uppercase">
          Equipo
        </h2>

        {conActividad.length === 0 ? (
          <p className="text-muted py-4 text-center text-sm">
            No hay actividad en este periodo.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {conActividad.map((member) => (
              <li key={member.userId} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[15px]">{member.name}</span>
                  <span className="font-display text-sm font-semibold tabular-nums">
                    {formatGuaranies(member.income)}
                  </span>
                </div>
                <div className="bg-line h-1.5 overflow-hidden rounded-full">
                  <div
                    className="bg-accent h-full rounded-full"
                    style={{
                      width: `${Math.round((member.income / maxIncome) * 100)}%`,
                    }}
                  />
                </div>
                <span className="text-muted text-xs tabular-nums">
                  {member.cuts} {member.cuts === 1 ? "corte" : "cortes"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Tile>

      <p className="text-muted text-xs">
        {stats.days} {stats.days === 1 ? "día" : "días"} en el rango.
      </p>
    </div>
  );
}
