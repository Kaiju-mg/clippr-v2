"use client";

import { useEffect, useRef, useState } from "react";
import { BarberPole } from "@/components/ui/BarberPole";
import { Button } from "@/components/ui/Button";
import { streakTier } from "@/lib/streaks";
import { formatGuaranies } from "@/lib/utils";
import { useStreakCelebration } from "@/store/streakCelebrationStore";

/** Cuándo empieza a girar rápido, cuándo cae el número nuevo y cuándo frena. */
const GIRO_RAPIDO_MS = 450;
const SELLO_MS = 1300;
const FRENO_MS = 2300;

/**
 * Hoja que sube desde abajo al cerrar la caja con la racha arriba: el poste
 * gira rápido, brilla y el número nuevo cae como un sello (ver
 * docs/decisiones.md 2026-10-03). Montada en el layout del dashboard; la
 * dispara `CloseCashButton` a través de `useStreakCelebration`.
 *
 * Se cierra con "Listo", tocando afuera o con Escape. Con "reducir
 * movimiento" el poste y el sello quedan quietos, pero la hoja y los números
 * se muestran igual.
 */
export function StreakCelebration() {
  const celebration = useStreakCelebration((state) => state.celebration);
  const dismiss = useStreakCelebration((state) => state.dismiss);
  const [shown, setShown] = useState<number | null>(null);
  const [fast, setFast] = useState(false);
  const [open, setOpen] = useState(false);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!celebration) {
      setOpen(false);
      return;
    }

    setShown(celebration.previous);
    setFast(false);
    // Un frame después, para que la hoja entre con su transición.
    const frame = requestAnimationFrame(() => setOpen(true));
    const timers = [
      setTimeout(() => setFast(true), GIRO_RAPIDO_MS),
      setTimeout(() => setShown(celebration.current), SELLO_MS),
      setTimeout(() => setFast(false), FRENO_MS),
    ];
    doneRef.current?.focus();

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach(clearTimeout);
    };
  }, [celebration]);

  useEffect(() => {
    if (!celebration) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [celebration, dismiss]);

  if (!celebration) return null;

  const value = shown ?? celebration.previous;
  const arranca = celebration.previous === 0;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Cerrar"
        tabIndex={-1}
        onClick={dismiss}
        className={`absolute inset-0 bg-black/45 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="streak-celebration-title"
        className={`bg-background absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col items-center gap-3 rounded-t-[28px] px-6 pt-3.5 pb-[max(1.75rem,env(safe-area-inset-bottom))] text-center transition-transform duration-[450ms] ease-[cubic-bezier(0.2,1.1,0.3,1)] ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <span aria-hidden="true" className="bg-line h-1.5 w-10 rounded-full" />

        <div className="flex items-center gap-6 py-2">
          <BarberPole
            size="lg"
            tier={streakTier(value)}
            status="activa"
            fast={fast}
          />
          <div className="flex flex-col items-start gap-1.5">
            <span
              id="streak-celebration-title"
              className="text-muted text-[13px] font-semibold"
            >
              {arranca ? "Racha nueva" : "Racha"}
            </span>
            <span
              key={value}
              aria-live="polite"
              className={`font-display text-[4.75rem] leading-[0.9] font-extrabold tracking-tight tabular-nums ${value === celebration.current ? "animate-streak-stamp motion-reduce:animate-none" : ""}`}
            >
              {value}
            </span>
            <span className="text-muted text-[13px] font-semibold">
              {/* "de racha" y no "seguidos": con el día de gracia, una racha de 10
                puede no ser 10 días corridos (ver docs/deuda-tecnica.md). */}
              {value === 1 ? "día de racha" : "días de racha"}
            </span>
          </div>
        </div>

        <p className="text-muted m-0 text-[13px]">
          {celebration.finalBalance !== null && (
            <>
              Caja cerrada con{" "}
              <b className="text-foreground font-mono tabular-nums">
                {formatGuaranies(celebration.finalBalance)}
              </b>
              .
              <br />
            </>
          )}
          Mañana sumás el día {celebration.current + 1}.
        </p>

        <Button
          ref={doneRef}
          type="button"
          onClick={dismiss}
          className="rounded-tile w-full py-3.5 text-base"
        >
          Listo
        </Button>
      </div>
    </div>
  );
}
