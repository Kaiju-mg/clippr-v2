import type { TicketLine } from "@/components/ticket/TicketReceipt";
import { formatMonthLabel, formatShortDay } from "@/lib/dates";
import type { MonthSummary } from "@/lib/month-summary";
import { formatGuaranies } from "@/lib/utils";

interface MonthTicketOptions {
  barbershopName: string;
  barberName: string | null;
  /**
   * "Mostrar montos" (como en compartir el día): apagado, el ticket no lleva
   * ningún monto; prendido suma lo cobrado en el mes.
   */
  showAmounts: boolean;
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Renglones del ticket del mes (spec 10, fase 4): cortes, servicio más
 * pedido, mejor día y racha más larga. No calcula nada: todo viene del
 * resumen que armó el servidor (`summarizeMonth`).
 */
export function monthTicketLines(
  month: MonthSummary,
  { barbershopName, barberName, showAmounts }: MonthTicketOptions,
): TicketLine[] {
  const lines: TicketLine[] = [
    {
      kind: "center",
      text: barbershopName.toLocaleUpperCase("es"),
      strong: true,
    },
    { kind: "center", text: formatMonthLabel(month.monthStartISO) },
  ];

  if (barberName) {
    lines.push({ kind: "center", text: `Barbero: ${firstName(barberName)}` });
  }

  lines.push(
    { kind: "rule" },
    { kind: "row", label: "Cortes", value: String(month.cuts), strong: true },
  );

  if (month.topService) {
    lines.push({
      kind: "row",
      label: `Más pedido: ${month.topService.name}`,
      value: `x${month.topService.count}`,
    });
  }

  if (month.bestDay) {
    lines.push({
      kind: "row",
      label: `Mejor día: ${formatShortDay(month.bestDay.dateISO)}`,
      value: `x${month.bestDay.cuts}`,
    });
  }

  lines.push({
    kind: "row",
    label: "Racha más larga",
    value: `${month.longestStreak} ${month.longestStreak === 1 ? "día" : "días"}`,
  });

  if (showAmounts) {
    lines.push(
      { kind: "rule" },
      {
        kind: "row",
        label: "COBRADO",
        value: formatGuaranies(month.income),
        strong: true,
      },
    );
  }

  return lines;
}
