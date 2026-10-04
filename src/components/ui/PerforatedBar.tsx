import { cn } from "@/lib/utils";

export type PerforatedBarTone = "accent" | "on-accent";

/**
 * Riel y relleno de cada tono. `on-accent` es para una barra adentro del cubo
 * relleno (`bg-accent`), donde el riel normal no se vería.
 */
const TONE_CLASSES: Record<PerforatedBarTone, { track: string; fill: string }> =
  {
    accent: { track: "text-line", fill: "text-accent" },
    "on-accent": {
      track: "text-accent-contrast/30",
      fill: "text-accent-contrast",
    },
  };

interface PerforatedBarProps {
  /** Progreso de 0 a 1. Lo que caiga afuera se recorta. */
  value: number;
  label: string;
  tone?: PerforatedBarTone;
  /** Alto de la barra (`h-*`). */
  className?: string;
}

/**
 * Barra de progreso "perforada" (spec 10, regla 3: punteado donde se cuenta
 * algo). Segmentos de 5px con 3px de aire y sin redondeo, vía la utilidad
 * `perforated` de `globals.css`: el riel y el relleno son el mismo picado en
 * dos colores. Un `div` con `width` en porcentaje, sin librería de gráficos
 * (spec 08).
 */
export function PerforatedBar({
  value,
  label,
  tone = "accent",
  className = "h-1.5",
}: PerforatedBarProps) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const classes = TONE_CLASSES[tone];

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={label}
      className={cn("perforated overflow-hidden", classes.track, className)}
    >
      <div
        className={cn("perforated h-full", classes.fill)}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
