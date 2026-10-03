import { cn } from "@/lib/utils";
import type { StreakStatus, StreakTier } from "@/lib/streaks";
import styles from "./BarberPole.module.css";

interface BarberPoleProps {
  tier: StreakTier;
  /** Viva gira, en el día de gracia se frena, apagada queda gris. */
  status: StreakStatus;
  /** Giro rápido con brillo: el momento de sumar un día. */
  fast?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const STATUS_CLASS: Record<StreakStatus, string | undefined> = {
  activa: undefined,
  en_peligro: styles.paused,
  apagada: styles.off,
};

/**
 * El poste de barbería de la racha. Es decorativo (`aria-hidden`): el número
 * de días siempre va escrito al lado, el poste sólo lo hace sentir. Con
 * "reducir movimiento" activado en el teléfono queda quieto.
 */
export function BarberPole({
  tier,
  status,
  fast = false,
  size = "md",
  className,
}: BarberPoleProps) {
  return (
    <span
      aria-hidden="true"
      data-tier={tier}
      data-status={status}
      className={cn(
        styles.pole,
        styles[size],
        tier !== "acero" && styles[tier],
        STATUS_CLASS[status],
        fast && status !== "apagada" && styles.fast,
        className,
      )}
    >
      <span className={styles.ball} />
      <span className={styles.cap} />
      <span className={styles.glass}>
        <span className={styles.stripes} />
        <span className={styles.shine} />
      </span>
      <span className={styles.cap} />
    </span>
  );
}
