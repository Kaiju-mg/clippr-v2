"use client";

import { useEffect, useRef } from "react";
import { Stamp } from "@/components/ui/Stamp";
import { useCloseCelebration } from "@/store/closeCelebrationStore";
import { closeTicketLines } from "./closeTicketLines";
import { TicketReceipt } from "./TicketReceipt";

/** Cuándo cae el sello y cuándo aparecen los botones (después de imprimir). */
export const SELLO_DELAY_MS = 2050;
const BOTONES_DELAY_MS = 2500;

/** Poste chico de un solo color, dibujado con rayas en la tinta del sello. */
function InkPole() {
  return (
    <span
      aria-hidden="true"
      className="h-[30px] w-[9px] flex-none rounded-[2px] border-[1.5px] border-current bg-[repeating-linear-gradient(-45deg,currentColor_0_3px,transparent_3px_6px)]"
    />
  );
}

/**
 * El cierre de caja (spec 10, fase 2): el fondo se oscurece, aparece la boca
 * de la impresora y el ticket baja renglón por renglón; al terminar cae el
 * sello de la racha y aparecen los botones. Reemplaza a la hoja del poste
 * (`StreakCelebration`). Montado en el layout del dashboard; lo dispara
 * `CloseCashButton` con `useCloseCelebration`.
 *
 * Todos los números vienen del servidor (`closeCashSessionAction` →
 * `summary`). Con "reducir movimiento", el ticket aparece entero y el sello
 * aparece sin caer. "Compartir" llega con la fase 3.
 */
export function CloseTicket() {
  const celebration = useCloseCelebration((state) => state.celebration);
  const dismiss = useCloseCelebration((state) => state.dismiss);
  const doneRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!celebration) return;
    doneRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") dismiss();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [celebration, dismiss]);

  if (!celebration) return null;

  const { summary, closedAt, barberName, streak } = celebration;
  const lines = closeTicketLines(summary, { closedAt, barberName });

  const footer = streak && streak.current > 0 && (
    <>
      <hr className="border-paper-rule my-[5px] border-0 border-t border-dashed" />
      <div className="flex justify-center pt-1.5 pb-1">
        <Stamp
          size="md"
          double
          animate
          delayMs={SELLO_DELAY_MS}
          className="font-sans opacity-95 mix-blend-multiply"
        >
          <InkPole />
          <span className="text-[11px] leading-[1.05] tracking-[0.12em]">
            {/* Los espacios explícitos son para el lector de pantalla: sin
                ellos lee "13DÍASDE RACHA". */}
            <b className="mr-1 align-[-3px] text-[22px] tracking-[-0.02em]">
              {streak.current}
            </b>{" "}
            {streak.current === 1 ? "DÍA" : "DÍAS"}{" "}
            <small className="block text-[9px] tracking-[0.18em]">
              DE RACHA
            </small>
          </span>
        </Stamp>
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
        <button
          ref={doneRef}
          type="button"
          onClick={dismiss}
          className="bg-paper text-paper-ink flex-1 rounded-[14px] p-3 text-sm font-semibold transition-transform active:scale-95"
        >
          Listo
        </button>
      </div>
    </div>
  );
}
