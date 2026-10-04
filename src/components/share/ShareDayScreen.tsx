"use client";

import type { CashSummary } from "@/lib/cash-summary";
import { businessDateOf } from "@/lib/dates";
import type { ShareDay } from "@/lib/share-day";
import { ShareTicketScreen } from "./ShareTicketScreen";
import { shareTicketLines } from "./shareTicketLines";

interface ShareDayScreenProps {
  summary: CashSummary;
  share: ShareDay;
  closedAt: string;
  barberName: string | null;
  streakDays: number | null;
  onBack: () => void;
}

/**
 * "Compartir el día" (spec 10, fase 3): se abre desde "Compartir" en el
 * ticket del cierre. La pantalla en sí es `ShareTicketScreen`; acá sólo se
 * arman los renglones de la versión cliente del ticket y el nombre del PNG.
 */
export function ShareDayScreen({
  summary,
  share,
  closedAt,
  barberName,
  streakDays,
  onBack,
}: ShareDayScreenProps) {
  return (
    <ShareTicketScreen
      title="Compartir el día"
      ticketLabel="Ticket del día"
      linesFor={(showAmounts) =>
        shareTicketLines(summary, share, { closedAt, barberName, showAmounts })
      }
      streakDays={streakDays}
      phone={share.phone}
      fileName={`clippr-${businessDateOf(new Date(closedAt))}.png`}
      amountsOnHint="Prendido: suma el TOTAL de la caja"
      amountsOffHint="Apagado: sólo cortes y racha"
      onBack={onBack}
    />
  );
}
