import Link from "next/link";
import { BarberPole } from "@/components/ui/BarberPole";
import { tileClasses } from "@/components/ui/Tile";
import { streakTier, type StreakStatus } from "@/lib/streaks";
import { cn } from "@/lib/utils";

interface StreakTileProps {
  /** Sin dato (falló la consulta de estadísticas) el cubo va sin número. */
  streak?: { count: number; status: StreakStatus };
}

const LABEL: Record<StreakStatus, (count: number) => string> = {
  activa: (count) => (count === 1 ? "Día de racha" : "Días de racha"),
  en_peligro: () => "Cerrá hoy",
  apagada: () => "Empezá hoy",
};

/**
 * Cubo compacto de la racha en /inicio, con el poste de barbería chico (ver
 * docs/decisiones.md 2026-10-03). El poste gira mientras la racha está viva,
 * se frena en el día de gracia — y el cubo late en naranja para que se note
 * sin leer nada — y queda gris si la racha se apagó.
 *
 * Mismo tamaño y padding que el `StatTile compact` de cortes que tiene al
 * lado, para que la fila se lea pareja.
 */
export function StreakTile({ streak }: StreakTileProps) {
  const enPeligro = streak?.status === "en_peligro";

  return (
    <Link
      href="/estadisticas"
      className={tileClasses(
        "default",
        cn(
          "flex-row items-center gap-3 px-3.5 py-3 transition-transform duration-100 active:scale-95",
          enPeligro &&
            "border-warning animate-streak-beat motion-reduce:animate-none",
        ),
      )}
    >
      <BarberPole
        size="sm"
        tier={streakTier(streak?.count ?? 0)}
        // Sin dato, el poste quieto: ni festeja ni alarma.
        status={streak?.status ?? "en_peligro"}
      />
      <div className="flex min-w-0 flex-col gap-1">
        {streak && (
          <span className="font-display text-2xl leading-none font-normal tracking-tight tabular-nums">
            {streak.count}
          </span>
        )}
        <span
          className={cn(
            "text-[0.625rem] font-medium tracking-[0.14em] uppercase",
            enPeligro ? "text-warning font-semibold" : "text-muted",
          )}
        >
          {streak ? LABEL[streak.status](streak.count) : "Días de racha"}
        </span>
      </div>
    </Link>
  );
}

/**
 * Aviso del día de gracia, debajo de los cubos. Dice qué hacer y qué se
 * pierde, sin retar: el objetivo es que vuelva a abrir la caja.
 */
export function StreakWarning({ count }: { count: number }) {
  return (
    <p
      role="status"
      className="border-warning/45 bg-warning/10 text-foreground rounded-2xl border px-3.5 py-2.5 text-[13px]"
    >
      Ayer no cerraste la caja.{" "}
      <b className="text-warning font-semibold">Cerrala hoy</b>, con al menos un
      cobro, para no perder {count === 1 ? "tu día" : `tus ${count} días`} de
      racha.
    </p>
  );
}
