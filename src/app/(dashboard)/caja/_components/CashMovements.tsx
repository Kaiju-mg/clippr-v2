import { Tile } from "@/components/ui/Tile";
import { formatBusinessTime } from "@/lib/dates";
import { formatGuaranies } from "@/lib/utils";
import type { Transaction, TransactionCategory } from "@/types";

const CATEGORY_LABELS: Record<TransactionCategory, string> = {
  service: "Corte",
  product: "Producto",
  manual: "Manual",
};

interface CashMovementsProps {
  movements: Transaction[];
  /** La consulta falló: se avisa en vez de mostrar una lista vacía. */
  failed?: boolean;
}

/**
 * Los últimos movimientos de la caja abierta. Es sólo lectura y está
 * recortada en el servidor (`getCashMovementsAction`): el saldo de arriba
 * no se calcula sumando esta lista, se pide aparte a
 * `getCashBalanceAction`, que suma todo en la base.
 *
 * Filas con línea punteada: es plata (spec 10, regla 3).
 */
export function CashMovements({
  movements,
  failed = false,
}: CashMovementsProps) {
  return (
    <Tile className="gap-3">
      <h2 className="text-muted text-[0.625rem] font-medium tracking-[0.14em] uppercase">
        Movimientos de hoy
      </h2>

      {failed ? (
        <p role="alert" className="text-danger text-sm">
          No pudimos cargar los movimientos de la caja.
        </p>
      ) : movements.length === 0 ? (
        <p className="text-muted text-sm">
          Todavía no hay movimientos en esta caja.
        </p>
      ) : (
        <ul className="flex flex-col">
          {movements.map((movement) => (
            <li
              key={movement.id}
              className="border-muted/55 flex items-center justify-between gap-3 border-b border-dashed py-2.5 last:border-b-0 last:pb-0"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[15px]">
                  {movement.description}
                </span>
                <span className="text-muted text-[13px]">
                  <span className="font-mono tabular-nums">
                    {formatBusinessTime(movement.created_at)}
                  </span>{" "}
                  · {CATEGORY_LABELS[movement.category] ?? movement.category}
                </span>
              </span>
              <span
                className={`flex-none font-mono text-[14px] font-semibold tabular-nums ${
                  movement.type === "income" ? "text-success" : "text-danger"
                }`}
              >
                {movement.type === "income" ? "+" : "−"}{" "}
                {formatGuaranies(movement.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Tile>
  );
}
