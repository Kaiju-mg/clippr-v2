import { BarberPole } from "@/components/ui/BarberPole";
import { Stamp } from "@/components/ui/Stamp";
import { Tile } from "@/components/ui/Tile";
import type { StampCard as StampCardData } from "@/actions/stats.actions";
import { formatMonthLabel } from "@/lib/dates";
import { mondayOffset, type StampDay } from "@/lib/stamp-card";
import { STREAK_TIER_FROM, STREAK_TIER_LABELS } from "@/lib/streaks";
import { cn } from "@/lib/utils";

const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"];

interface StampCardProps {
  card: StampCardData;
}

function nombreDelDia(day: StampDay, mes: string): string {
  const base = `${day.day} de ${mes}`;
  if (!day.worked) return day.isFuture ? base : `${base}, sin sello`;
  const hito = day.milestone
    ? `, poste ${day.milestone === "oro" ? "de oro" : "encendido"}`
    : "";
  return `${base}, sellado, ${day.streak} ${day.streak === 1 ? "día" : "días"} de racha${hito}`;
}

/**
 * Tarjeta de sellos de la racha (spec 10, fase 4): la grilla del mes en
 * curso, como una tarjeta de cliente frecuente. Cada día con caja cerrada y
 * al menos un cobro lleva su número estampado (`<Stamp />`, quieto: no es
 * algo que acaba de pasar). Los días en que la racha llegó a 7 y a 30 llevan
 * además el poste de oro o el encendido, los niveles que ya existen.
 *
 * Server Component: los días y la racha de cada uno vienen calculados del
 * servidor (`getStampCardAction`).
 */
export function StampCard({ card }: StampCardProps) {
  const mes = formatMonthLabel(card.monthStartISO).split(" ")[0];
  const mesMinuscula = mes.toLocaleLowerCase("es");
  const sellos = card.days.filter((day) => day.worked).length;
  const huecos = mondayOffset(card.monthStartISO);

  return (
    <Tile className="gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-muted text-[0.625rem] font-medium tracking-[0.14em] uppercase">
          Tarjeta de sellos · {mes}
        </h2>
        <span className="text-muted font-mono text-xs tabular-nums">
          {sellos} {sellos === 1 ? "sello" : "sellos"}
        </span>
      </div>

      <div
        role="grid"
        aria-label={`Tarjeta de sellos de ${mesMinuscula}`}
        className="grid grid-cols-7 gap-1.5"
      >
        {DIAS_SEMANA.map((inicial, index) => (
          <span
            key={index}
            aria-hidden="true"
            className="text-muted text-center text-[10px] font-medium"
          >
            {inicial}
          </span>
        ))}

        {Array.from({ length: huecos }, (_, index) => (
          <span key={`hueco-${index}`} aria-hidden="true" />
        ))}

        {card.days.map((day) => (
          <div
            key={day.dateISO}
            role="gridcell"
            aria-label={nombreDelDia(day, mesMinuscula)}
            data-worked={day.worked || undefined}
            data-milestone={day.milestone ?? undefined}
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-md border border-dashed",
              day.isToday ? "border-accent-ink" : "border-muted/40",
              day.isFuture && "opacity-40",
            )}
          >
            {day.worked ? (
              <Stamp
                double={day.milestone !== null}
                className="font-mono text-[11px] tracking-normal"
              >
                {day.day}
              </Stamp>
            ) : (
              <span className="text-muted font-mono text-[11px] tabular-nums">
                {day.day}
              </span>
            )}
            {day.milestone && (
              <span className="absolute -top-1.5 -right-0.5 flex h-6 w-3 items-center justify-center">
                <BarberPole
                  size="sm"
                  tier={day.milestone}
                  status="activa"
                  className="scale-50"
                />
              </span>
            )}
          </div>
        ))}
      </div>

      <p className="text-muted text-xs">
        Un sello por día con caja cerrada y al menos un cobro. El poste marca el
        día {STREAK_TIER_FROM.oro} (
        {STREAK_TIER_LABELS.oro.toLocaleLowerCase("es")}) y el{" "}
        {STREAK_TIER_FROM.encendido} (
        {STREAK_TIER_LABELS.encendido.toLocaleLowerCase("es")}) de la racha.
      </p>
    </Tile>
  );
}
