import { Flame, Scissors, Wallet } from "lucide-react";
import { StatTile, Tile } from "@/components/ui/Tile";
import { LEVEL_LABELS, LEVEL_WINDOW_DAYS } from "@/lib/levels";
import { formatGuaranies } from "@/lib/utils";
import type { BarberStats } from "@/actions/stats.actions";

interface BarberDashboardProps {
  stats: BarberStats;
  firstName: string;
}

/**
 * Dashboard del barbero: su día, su racha y cuánto le falta para la
 * siguiente liga, como grilla bento. Server Component puro — los dashboards
 * son de sólo lectura, no necesitan estado optimista (caso borde 5 de la
 * spec 08).
 *
 * Acá vive el nivel, y no en /inicio (decisión del 2026-09-20): es el único
 * lugar con espacio para explicar que la liga se mide sobre una ventana
 * móvil de 30 días, sin lo cual el número no se entiende.
 *
 * La barra de progreso es un `div` con `width` en porcentaje: la spec pide
 * evitar librerías de gráficos en esta iteración.
 */
export function BarberDashboard({ stats, firstName }: BarberDashboardProps) {
  const { progress } = stats;
  const sinActividad = stats.completedCuts === 0 && stats.income === 0;
  const ventana = `${progress.cuts} ${progress.cuts === 1 ? "corte" : "cortes"} en los últimos ${LEVEL_WINDOW_DAYS} días`;

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-col gap-0.5">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Tu rendimiento
        </h1>
        <p className="text-muted text-sm">
          {firstName}, así viene tu día de hoy.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatTile
          icon={<Scissors size={18} strokeWidth={1.5} />}
          value={String(stats.completedCuts)}
          label={stats.completedCuts === 1 ? "Corte de hoy" : "Cortes de hoy"}
          className="aspect-square"
        />
        <StatTile
          icon={<Wallet size={18} strokeWidth={1.5} />}
          value={formatGuaranies(stats.income)}
          label="Cobrado hoy"
          size="md"
          className="aspect-square"
        />
      </div>

      {sinActividad && (
        <p className="text-muted text-sm">
          Todavía no hay actividad hoy. Cuando cobres tu primer corte, los
          números aparecen acá.
        </p>
      )}

      {/* El cubo relleno de la pantalla: el nivel y la racha son la parte
          que motiva, y la que justifica volver a entrar acá. */}
      <Tile variant="filled" className="gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-[0.625rem] font-medium tracking-[0.14em] uppercase opacity-80">
              Tu nivel
            </p>
            <p className="font-display text-2xl font-semibold tracking-tight">
              {LEVEL_LABELS[progress.level]}
            </p>
          </div>
          <span className="bg-accent-contrast/15 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium tabular-nums">
            <Flame size={14} strokeWidth={1.5} />
            {stats.streakCount} {stats.streakCount === 1 ? "día" : "días"}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div
            className="bg-accent-contrast/20 h-2 overflow-hidden rounded-full"
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
              className="bg-accent-contrast h-full rounded-full"
              style={{ width: `${Math.round(progress.ratio * 100)}%` }}
            />
          </div>
          <p className="text-xs opacity-80">
            {ventana}
            {progress.nextLevel
              ? ` · te ${progress.cutsToNext === 1 ? "falta" : "faltan"} ${progress.cutsToNext} para ${LEVEL_LABELS[progress.nextLevel]}`
              : " · estás en el nivel más alto"}
          </p>
        </div>
      </Tile>

      <p className="text-muted text-xs">
        Tu nivel se calcula sobre los últimos {LEVEL_WINDOW_DAYS} días: si bajás
        el ritmo, baja con vos.
      </p>
    </div>
  );
}
