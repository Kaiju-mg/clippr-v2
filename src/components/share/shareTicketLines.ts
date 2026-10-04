import type { CashSummary } from "@/lib/cash-summary";
import { formatShareDate } from "@/lib/dates";
import type { ShareDay } from "@/lib/share-day";
import { formatGuaranies } from "@/lib/utils";
import type { TicketLine } from "@/components/ticket/TicketReceipt";

interface ShareTicketOptions {
  closedAt: string;
  barberName: string | null;
  /**
   * El switch "Mostrar montos". Apagado (lo normal) la imagen no lleva
   * **ningún** monto: ni el TOTAL, ni el saldo, ni lo cobrado por servicio.
   */
  showAmounts: boolean;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Renglones de la versión cliente del ticket (spec 10, fase 3): lo que se
 * publica en el estado de WhatsApp. Cortes por servicio (`Corte clásico
 * x5`) y el total de cortes, sin plata salvo que el barbero lo pida.
 *
 * No calcula nada: los cortes vienen de `share.cutsByService` y el total de
 * `summary.cuts.count`, los dos armados por el servidor al cerrar. El TOTAL
 * con el switch prendido es `summary.finalBalance`, el mismo renglón que el
 * ticket del cierre (así está en el muestrario).
 */
export function shareTicketLines(
  summary: CashSummary,
  share: ShareDay,
  { closedAt, barberName, showAmounts }: ShareTicketOptions,
): TicketLine[] {
  const lines: TicketLine[] = [
    {
      kind: "center",
      text: share.barbershopName.toLocaleUpperCase("es"),
      strong: true,
    },
    { kind: "center", text: formatShareDate(closedAt) },
  ];

  if (barberName) {
    lines.push({ kind: "center", text: `Barbero: ${firstName(barberName)}` });
  }

  lines.push({ kind: "rule" });

  if (share.cutsByService.length === 0) {
    lines.push({ kind: "center", text: "Hoy no hubo cortes" });
  } else {
    for (const { name, count } of share.cutsByService) {
      lines.push({ kind: "row", label: name, value: `x${count}` });
    }
  }

  lines.push(
    { kind: "rule" },
    {
      kind: "row",
      label: "CORTES",
      value: String(summary.cuts.count),
      strong: true,
    },
  );

  if (showAmounts) {
    lines.push({
      kind: "row",
      label: "TOTAL",
      value: formatGuaranies(summary.finalBalance),
      strong: true,
    });
  }

  return lines;
}
