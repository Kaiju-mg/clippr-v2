"use client";

import { useEffect, useState } from "react";
import { Share } from "lucide-react";
import type { MonthTicket } from "@/actions/stats.actions";
import { monthTicketLines } from "@/components/share/monthTicketLines";
import { ShareTicketScreen } from "@/components/share/ShareTicketScreen";
import { TicketReceipt } from "@/components/ticket/TicketReceipt";
import { formatMonthLabel } from "@/lib/dates";

interface MonthTicketCardProps {
  ticket: MonthTicket;
}

/**
 * El ticket del mes anterior en `/estadisticas` del barbero (spec 10, fase
 * 4), durante los primeros días del mes. En pantalla va sin montos, igual que
 * la imagen por defecto; "Compartir" abre el mismo flujo de compartir el día
 * con "Mostrar montos" apagado.
 */
export function MonthTicketCard({ ticket }: MonthTicketCardProps) {
  const [sharing, setSharing] = useState(false);
  const { month, barberName, barbershopName, phone } = ticket;
  const mes = formatMonthLabel(month.monthStartISO);

  useEffect(() => {
    if (!sharing) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setSharing(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sharing]);

  const linesFor = (showAmounts: boolean) =>
    monthTicketLines(month, { barbershopName, barberName, showAmounts });

  return (
    <section aria-labelledby="ticket-del-mes" className="flex flex-col gap-3">
      <h2
        id="ticket-del-mes"
        className="text-muted text-[0.625rem] font-medium tracking-[0.14em] uppercase"
      >
        Tu {mes.split(" ")[0].toLocaleLowerCase("es")}
      </h2>

      <div className="flex flex-col items-center gap-3">
        {/* Sombra por lo mismo que en "Cierres de hoy": en claro el papel
            y el fondo son del mismo color. */}
        <div className="flex w-full justify-center drop-shadow-[0_2px_6px_rgba(38,35,29,0.18)]">
          <TicketReceipt label="Ticket del mes" lines={linesFor(false)} />
        </div>
        <button
          type="button"
          onClick={() => setSharing(true)}
          className="border-line text-foreground flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-transform active:scale-95"
        >
          <Share size={15} strokeWidth={2} />
          Compartir el mes
        </button>
      </div>

      {sharing && (
        <ShareTicketScreen
          title="Compartir el mes"
          ticketLabel="Ticket del mes"
          linesFor={linesFor}
          streakDays={null}
          phone={phone}
          fileName={`clippr-${month.monthStartISO.slice(0, 7)}.png`}
          amountsOnHint="Prendido: suma lo cobrado en el mes"
          amountsOffHint="Apagado: sólo cortes y racha"
          onBack={() => setSharing(false)}
        />
      )}
    </section>
  );
}
