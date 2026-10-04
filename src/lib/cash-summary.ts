/**
 * Resumen de una caja: lo que se imprime en el ticket del cierre (spec 10,
 * fase 2). Función pura y sin Supabase: la llama el servidor con las filas
 * de `transactions` ya leídas, nunca el cliente (regla 1 de CLAUDE.md).
 *
 * Es también la fuente del saldo (`computeSummary` en `cash.actions.ts`, que
 * reemplazó a `computeBalance`), así el TOTAL del ticket y el
 * `final_balance` guardado son el mismo número por construcción, no por
 * casualidad.
 */
import type { TransactionCategory, TransactionType } from "@/types";

export interface CashSummaryRow {
  type: TransactionType | string;
  amount: number | string;
  /** En la base nunca falta (default `'service'`); acá se tolera por las dudas. */
  category?: TransactionCategory | string | null;
}

export interface CountedTotal {
  count: number;
  total: number;
}

export interface CashSummary {
  initialBalance: number;
  /** Cobros de cortes (`category = 'service'`). */
  cuts: CountedTotal;
  /** Ventas de productos (`category = 'product'`). */
  sales: CountedTotal;
  /** Ingresos cargados a mano (propinas, etc.). */
  manualIncome: number;
  /** Todos los egresos, de cualquier categoría. */
  expenses: number;
  /** Todos los ingresos: cortes + ventas + manuales. */
  income: number;
  /** inicial + ingresos − egresos. */
  finalBalance: number;
}

export function summarizeCash(
  initialBalance: number,
  rows: readonly CashSummaryRow[],
): CashSummary {
  const cuts: CountedTotal = { count: 0, total: 0 };
  const sales: CountedTotal = { count: 0, total: 0 };
  let manualIncome = 0;
  let expenses = 0;

  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount)) continue;

    if (row.type === "expense") {
      expenses += amount;
    } else if (row.type === "income") {
      if (row.category === "service") {
        cuts.count += 1;
        cuts.total += amount;
      } else if (row.category === "product") {
        sales.count += 1;
        sales.total += amount;
      } else {
        manualIncome += amount;
      }
    }
  }

  const initial = Number(initialBalance);
  const income = cuts.total + sales.total + manualIncome;

  return {
    initialBalance: initial,
    cuts,
    sales,
    manualIncome,
    expenses,
    income,
    finalBalance: initial + income - expenses,
  };
}
