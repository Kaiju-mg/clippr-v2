import { formatBusinessTime } from "@/lib/dates";
import { formatAmount, formatGuaranies } from "@/lib/utils";
import type { Transaction, TransactionCategory } from "@/types";

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  service: "Corte",
  product: "Venta",
  manual: "Manual",
};

interface CashMovementsProps {
  /** Del más nuevo al más viejo, recortados en el servidor. */
  movements: Transaction[];
  /** Hay movimientos más viejos que no entraron en la lista. */
  hasMore?: boolean;
  /** Saldo inicial y hora de apertura: el primer renglón del ticket. */
  initialBalance: number;
  openedAt: string;
  /**
   * El saldo actual que calculó el servidor (`getCashBalanceAction`). El
   * TOTAL del ticket es este número, **nunca** la suma de los renglones de
   * arriba (regla 1 de CLAUDE.md): la lista está recortada.
   */
  total: number;
  /** La consulta falló: se avisa en vez de mostrar una lista vacía. */
  failed?: boolean;
}

/** Una fila del ticket: hora, concepto y monto, con línea punteada abajo. */
function Row({
  time,
  concept,
  detail,
  amount,
  tone = "plain",
}: {
  time: string;
  concept: string;
  detail?: string;
  amount: string;
  /** Ingresos en tinta azul; el resto en tinta normal, como el muestrario.
   *  Un egreso no es un error: no va en `--danger`. */
  tone?: "plain" | "income";
}) {
  return (
    <li className="border-muted/55 flex items-center gap-3 border-b border-dashed py-2">
      <span className="text-muted w-10 flex-none font-mono text-xs tabular-nums">
        {time}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{concept}</span>
        {detail && <span className="text-muted text-xs">{detail}</span>}
      </span>
      <span
        className={`flex-none font-mono text-[13.5px] font-semibold whitespace-nowrap tabular-nums ${
          tone === "income" ? "text-accent-ink" : ""
        }`}
      >
        {amount}
      </span>
    </li>
  );
}

/**
 * Los movimientos de la caja abierta como un ticket (spec 10, fase 2):
 * tarjeta `--surface-2` con el borde de abajo en zigzag, en orden de llegada
 * como se imprime un recibo, y un renglón TOTAL al pie igual al saldo actual.
 *
 * Es sólo lectura. Si la lista está recortada (`hasMore`), arriba va "Más
 * movimientos" en vez de "Saldo inicial", para que el ticket no parezca
 * completo cuando no lo es.
 */
export function CashMovements({
  movements,
  hasMore = false,
  initialBalance,
  openedAt,
  total,
  failed = false,
}: CashMovementsProps) {
  // Llegan del más nuevo al más viejo; el ticket se lee en orden.
  const chronological = [...movements].reverse();

  return (
    <section aria-labelledby="cash-movements-title" className="flex flex-col">
      <h2
        id="cash-movements-title"
        className="text-muted mb-1 text-[0.625rem] font-medium tracking-[0.14em] uppercase"
      >
        Movimientos de hoy
      </h2>

      {failed ? (
        <p role="alert" className="text-danger text-sm">
          No pudimos cargar los movimientos de la caja.
        </p>
      ) : (
        <div className="ticket-edge bg-surface-2 mb-2 rounded-t-[14px] px-3.5 pt-1 pb-2.5 [--edge-color:var(--surface-2)]">
          <ul className="flex flex-col">
            {hasMore ? (
              <li className="border-muted/55 text-muted border-b border-dashed py-2 text-center text-xs">
                · · · Más movimientos antes · · ·
              </li>
            ) : (
              <Row
                time={formatBusinessTime(openedAt)}
                concept="Saldo inicial"
                amount={formatAmount(initialBalance)}
              />
            )}
            {chronological.map((movement) => (
              <Row
                key={movement.id}
                time={formatBusinessTime(movement.created_at)}
                concept={movement.description}
                detail={
                  movement.type === "expense"
                    ? "Egreso"
                    : (CATEGORY_LABELS[movement.category] ?? movement.category)
                }
                amount={`${movement.type === "income" ? "+" : "−"} ${formatAmount(movement.amount)}`}
                tone={movement.type === "income" ? "income" : "plain"}
              />
            ))}
          </ul>

          <p className="m-0 flex items-baseline justify-between pt-2.5 pb-0.5 font-bold">
            <span className="text-xs tracking-[0.14em] uppercase">Total</span>
            <span className="font-mono text-[17px] tabular-nums">
              {formatGuaranies(total)}
            </span>
          </p>
        </div>
      )}
    </section>
  );
}
