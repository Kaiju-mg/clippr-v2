import type { ReactNode } from "react";
import { Scissors, Wallet } from "lucide-react";
import { PerforatedBar } from "@/components/ui/PerforatedBar";
import { StatTile, Tile } from "@/components/ui/Tile";
import { LEVEL_LABELS, LEVEL_WINDOW_DAYS } from "@/lib/levels";
import { formatGuaranies } from "@/lib/utils";
import type {
  BarberStats,
  MonthTicket,
  StampCard as StampCardData,
} from "@/actions/stats.actions";
import { MonthTicketCard } from "./MonthTicketCard";
import { StampCard } from "./StampCard";
import { StreakPanel } from "./StreakPanel";

interface BarberDashboardProps {
  stats: BarberStats;
  firstName: string;
  /** Ticket del mes anterior (fase 4): null fuera de los días 1 a 7. */
  monthTicket?: MonthTicket | null;
  /** Tarjeta de sellos del mes (fase 4): null si la consulta falló. */
  stampCard?: StampCardData | null;
  /**
   * Debajo del encabezado: el selector "Mi barbería / Yo" cuando el que
   * mira es el dueño (su propio rendimiento como barbero).
   */
  topSlot?: ReactNode;
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
 * La barra de progreso es `PerforatedBar` (spec 10): un `div` con `width` en
 * porcentaje, sin librerías de gráficos.
 */
export function BarberDashboard({
  stats,
  firstName,
  monthTicket = null,
  stampCard = null,
  topSlot,
}: BarberDashboardProps) {
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

      {topSlot}

      {/* La racha va primero: es lo que motiva a volver a entrar acá, y el
          poste necesita el ancho completo. */}
      <StreakPanel count={stats.streakCount} status={stats.streakStatus} />

      {/* Justo debajo del poste: los sellos son la racha día por día. */}
      {stampCard && <StampCard card={stampCard} />}

      {/* Sólo los primeros días del mes: el resumen del mes que terminó. */}
      {monthTicket && <MonthTicketCard ticket={monthTicket} />}

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
          mono
          className="aspect-square"
        />
      </div>

      {sinActividad && (
        <p className="text-muted text-sm">
          Todavía no hay actividad hoy. Cuando cobres tu primer corte, los
          números aparecen acá.
        </p>
      )}

      {/* El cubo relleno de la pantalla: el nivel. La racha tiene su propio
          cubo arriba (StreakPanel), desde el 2026-10-03. */}
      <Tile variant="filled" className="gap-4 p-5">
        <div className="flex flex-col gap-0.5">
          <p className="text-[0.625rem] font-medium tracking-[0.14em] uppercase opacity-80">
            Tu nivel
          </p>
          <p className="font-display text-2xl font-semibold tracking-tight">
            {LEVEL_LABELS[progress.level]}
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <PerforatedBar
            tone="on-accent"
            className="h-2"
            value={progress.ratio}
            label={
              progress.nextLevel
                ? `Progreso hacia ${LEVEL_LABELS[progress.nextLevel]}`
                : "Nivel máximo alcanzado"
            }
          />
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
