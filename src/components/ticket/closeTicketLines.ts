import type { CashSummary } from "@/lib/cash-summary";
import { formatTicketDateTime } from "@/lib/dates";
import { formatAmount, formatGuaranies } from "@/lib/utils";
import type { TicketLine } from "./TicketReceipt";

interface CloseTicketMeta {
  /** `end_time` de la caja, tal como lo guardó el servidor. */
  closedAt: string;
  barberName: string | null;
}

/** "Eduardo Villalba" → "Eduardo": en el ticket alcanza con el de pila. */
function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

/**
 * Renglones del ticket del cierre (spec 10, fase 2). No calcula nada: todos
 * los números vienen del `summary` que armó el servidor, y el TOTAL es
 * `summary.finalBalance` tal cual, el mismo que quedó en `final_balance`.
 *
 * "Otros ingresos" sólo aparece si hubo (propinas y demás manuales): sin
 * ellos, cortes + ventas − egresos ya cierra contra el TOTAL.
 */
export function closeTicketLines(
  summary: CashSummary,
  { closedAt, barberName }: CloseTicketMeta,
): TicketLine[] {
  const lines: TicketLine[] = [
    { kind: "center", text: "CLIPPR · CIERRE", strong: true },
    { kind: "center", text: formatTicketDateTime(closedAt) },
  ];

  if (barberName) {
    lines.push({ kind: "center", text: `Barbero: ${firstName(barberName)}` });
  }

  lines.push(
    { kind: "rule" },
    {
      kind: "row",
      label: "Saldo inicial",
      value: formatAmount(summary.initialBalance),
    },
    {
      kind: "row",
      label: `Cortes (${summary.cuts.count})`,
      value: `+ ${formatAmount(summary.cuts.total)}`,
    },
    {
      kind: "row",
      label: `Ventas (${summary.sales.count})`,
      value: `+ ${formatAmount(summary.sales.total)}`,
    },
  );

  if (summary.manualIncome > 0) {
    lines.push({
      kind: "row",
      label: "Otros ingresos",
      value: `+ ${formatAmount(summary.manualIncome)}`,
    });
  }

  lines.push(
    {
      kind: "row",
      label: "Egresos",
      value: `− ${formatAmount(summary.expenses)}`,
    },
    { kind: "rule" },
    {
      kind: "row",
      label: "TOTAL",
      value: formatGuaranies(summary.finalBalance),
      strong: true,
    },
  );

  return lines;
}
