import { BarberPole } from "@/components/ui/BarberPole";
import { Tile } from "@/components/ui/Tile";
import {
  nextStreakTier,
  STREAK_TIER_LABELS,
  streakTier,
  type StreakStatus,
  type StreakTier,
} from "@/lib/streaks";
import { cn } from "@/lib/utils";

interface StreakPanelProps {
  count: number;
  status: StreakStatus;
}

const TIERS: StreakTier[] = ["acero", "oro", "encendido"];

/** "Poste de oro", pero "Poste encendido" (no "de encendido"). */
const POLE_NAME: Record<StreakTier, string> = {
  acero: "Poste de acero",
  oro: "Poste de oro",
  encendido: "Poste encendido",
};

function hint(count: number, status: StreakStatus): string {
  if (status === "en_peligro") {
    return "Ayer no cerraste la caja: cerrala hoy para no perderla.";
  }
  if (status === "apagada") {
    return "Cerrá una caja con al menos un cobro para arrancar.";
  }
  const next = nextStreakTier(count);
  if (!next) return "Tu poste ya está encendido.";
  const dias = next.daysLeft === 1 ? "día" : "días";
  return `A ${next.daysLeft} ${dias} del ${POLE_NAME[next.tier].toLowerCase()}.`;
}

/**
 * La racha en grande, arriba de todo en el dashboard del barbero, con el
 * poste de barbería y los tres niveles del poste (ver docs/decisiones.md
 * 2026-10-03). Antes era un chip con una llama dentro del cubo del nivel;
 * ahora nivel y racha tienen cada uno su cubo, porque miden cosas distintas
 * (volumen de 30 días contra constancia).
 */
export function StreakPanel({ count, status }: StreakPanelProps) {
  const tier = streakTier(count);

  return (
    <Tile className="flex-row items-center gap-5 px-5 py-[18px]">
      <BarberPole size="md" tier={tier} status={status} />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-accent-ink text-[0.625rem] font-bold tracking-[0.14em] uppercase">
          {POLE_NAME[tier]}
        </span>
        {/* La racha es algo que ya pasó: va en tinta de sello (spec 10). */}
        <span className="font-display text-stamp text-[3.5rem] leading-[0.9] font-semibold tracking-tight tabular-nums">
          {count}
        </span>
        <span className="text-muted text-[0.625rem] font-medium tracking-[0.14em] uppercase">
          {count === 1 ? "Día de racha" : "Días de racha"}
        </span>
        <span
          className={cn(
            "text-xs",
            status === "en_peligro" ? "text-warning font-medium" : "text-muted",
          )}
        >
          {hint(count, status)}
        </span>
        <ul
          className="mt-1 flex flex-wrap gap-1.5"
          aria-label="Niveles del poste"
        >
          {TIERS.map((item) => (
            <li
              key={item}
              aria-current={item === tier ? "true" : undefined}
              className={cn(
                "bg-background rounded-full border px-2 py-0.5 text-[0.625rem] font-semibold",
                item === tier
                  ? "border-accent-ink text-accent-ink"
                  : "border-line text-muted",
              )}
            >
              {STREAK_TIER_LABELS[item]}
            </li>
          ))}
        </ul>
      </div>
    </Tile>
  );
}
