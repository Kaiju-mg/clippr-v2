"use client";

import { useEffect, useRef, useState } from "react";
import { ShareDayScreen } from "@/components/share/ShareDayScreen";
import { PATRON_IMPRESORA, vibrate } from "@/lib/haptics";
import { useCloseCelebration } from "@/store/closeCelebrationStore";
import { closeTicketLines } from "./closeTicketLines";
import { StreakStamp } from "./StreakStamp";
import { TicketReceipt } from "./TicketReceipt";

/** Cuándo cae el sello y cuándo aparecen los botones (después de imprimir). */
export const SELLO_DELAY_MS = 2050;
const BOTONES_DELAY_MS = 2500;

/**
 * El cierre de caja (spec 10, fase 2): el fondo se oscurece, aparece la boca
 * de la impresora y el ticket baja renglón por renglón; al terminar cae el
 * sello de la racha y aparecen los botones. Reemplaza a la hoja del poste
 * (`StreakCelebration`). Montado en el layout del dashboard; lo dispara
 * `CloseCashButton` con `useCloseCelebration`.
 *
 * Todos los números vienen del servidor (`closeCashSessionAction` →
 * `summary`). Con "reducir movimiento", el ticket aparece entero y el sello
 * aparece sin caer.
 *
 * "Compartir" (fase 3) abre "Compartir el día" **encima** del ticket, que
 * queda montado abajo: al volver no se reimprime. Sólo aparece si el
 * servidor pudo armar los datos de la imagen (`share`).
 */
export function CloseTicket() {
  const celebration = useCloseCelebration((state) => state.celebration);
  const dismiss = useCloseCelebration((state) => state.dismiss);
  const doneRef = useRef<HTMLButtonElement>(null);
  const [sharing, setSharing] = useState(false);
  // Cada cierre arranca en el ticket, no en la pantalla de compartir del
  // cierre anterior (ajuste de estado al cambiar la prop, sin efecto).
  const [shownFor, setShownFor] = useState(celebration);
  if (shownFor !== celebration) {
    setShownFor(celebration);
    setSharing(false);
  }

  // La impresora vibra mientras salen los renglones (fase 3). Una vez por
  // cierre: volver de "Compartir" no reimprime, así que tampoco vibra.
  useEffect(() => {
    if (celebration) vibrate(PATRON_IMPRESORA);
  }, [celebration]);

  useEffect(() => {
    if (!celebration || sharing) return;
    doneRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [celebration, sharing, dismiss]);

  useEffect(() => {
    if (!sharing) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSharing(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sharing]);

  if (!celebration) return null;

  const { summary, closedAt, barberName, streak, share } = celebration;
  const lines = closeTicketLines(summary, { closedAt, barberName });

  const footer = streak && streak.current > 0 && (
    <>
      <hr className="border-paper-rule my-[5px] border-0 border-t border-dashed" />
      <div className="flex justify-center pt-1.5 pb-1">
        <StreakStamp
          days={streak.current}
          animate
          delayMs={SELLO_DELAY_MS}
        />
      </div>
      <p className="m-0 text-center">Mañana va el {streak.current + 1}.</p>
    </>
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cierre de caja"
      onClick={(event) => {
        if (event.target === event.currentTarget) dismiss();
      }}
      className="animate-ticket-scrim fixed inset-0 z-50 flex flex-col items-center justify-center gap-[18px] overflow-y-auto bg-[rgba(18,16,13,0.76)] px-4 pt-3 pb-5 motion-reduce:animate-none"
    >
      <div className="flex w-full max-w-[252px] flex-col items-center">
        <span
          aria-hidden="true"
          className="animate-ticket-mouth relative z-[2] h-[18px] w-full rounded-[9px] bg-[linear-gradient(180deg,#2b2f36,#121418)] shadow-[inset_0_-5px_0_#07080a,0_0_0_1px_rgba(255,255,255,0.08)] motion-reduce:animate-none"
        />
        <div className="-mt-[7px] w-[calc(100%-22px)] overflow-hidden pb-3">
          <TicketReceipt
            label="Ticket del cierre"
            lines={lines}
            footer={footer || undefined}
            className="animate-ticket-print shadow-[0_6px_16px_rgba(0,0,0,0.3)] motion-reduce:animate-none"
          />
        </div>
      </div>

      <div
        className="animate-ticket-rise flex w-full max-w-[252px] gap-2 motion-reduce:animate-none"
        style={{ animationDelay: `${BOTONES_DELAY_MS}ms` }}
      >
        {share && (
          <button
            type="button"
            onClick={() => setSharing(true)}
            className="text-paper flex-1 rounded-[14px] border border-[rgba(255,253,246,0.35)] bg-transparent p-3 text-sm font-semibold transition-transform active:scale-95"
          >
            Compartir
          </button>
        )}
        <button
          ref={doneRef}
          type="button"
          onClick={dismiss}
          className="bg-paper text-paper-ink flex-1 rounded-[14px] p-3 text-sm font-semibold transition-transform active:scale-95"
        >
          Listo
        </button>
      </div>

      {sharing && share && (
        <ShareDayScreen
          summary={summary}
          share={share}
          closedAt={closedAt}
          barberName={barberName}
          streakDays={streak?.current ?? null}
          onBack={() => setSharing(false)}
        />
      )}
    </div>
  );
}
