import {
  getCashBalanceAction,
  getCurrentCashSessionAction,
} from "@/actions/cash.actions";
import { getProductsAction } from "@/actions/product.actions";
import { OpenCashView } from "./_components/OpenCashView";
import { CloseCashButton } from "./_components/CloseCashButton";
import { TransactionInlineForm } from "./_components/TransactionInlineForm";
import { SellProductForm } from "./_components/SellProductForm";
import { BUSINESS_TIMEZONE } from "@/lib/dates";
import { formatGuaranies } from "@/lib/utils";

export default async function CajaPage() {
  const result = await getCurrentCashSessionAction();

  if (!result.success) {
    return (
      <p role="alert" className="p-4 text-sm text-danger">
        {result.error}
      </p>
    );
  }

  const session = result.data;

  // Sin caja abierta no se renderizan movimientos ni ventas; igual el
  // servidor los rechaza por su cuenta (spec 07, sección 5.3).
  if (!session) {
    return <OpenCashView />;
  }

  const [balanceResult, productsResult] = await Promise.all([
    getCashBalanceAction(session.id),
    getProductsAction(),
  ]);

  if (!balanceResult.success) {
    return (
      <p role="alert" className="p-4 text-sm text-danger">
        {balanceResult.error}
      </p>
    );
  }

  const balance = balanceResult.data;
  // Si falla la lectura del catálogo, la caja sigue usable: solo no se
  // ofrece la venta de productos.
  const activeProducts = productsResult.success
    ? productsResult.data.filter((product) => product.is_active)
    : [];

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="font-display text-xl font-semibold">Caja abierta</h1>

      <div className="rounded-lg border border-line bg-surface-2 p-4">
        <p className="text-sm text-muted">Saldo actual</p>
        <p className="font-display text-3xl font-semibold tabular-nums">
          {formatGuaranies(balance.current)}
        </p>

        <dl className="mt-3 flex flex-col gap-1 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted">Saldo inicial</dt>
            <dd className="tabular-nums">
              {formatGuaranies(session.initial_balance)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted">Ingresos</dt>
            <dd className="tabular-nums">+ {formatGuaranies(balance.income)}</dd>
          </div>
          {balance.expense > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted">Egresos</dt>
              <dd className="tabular-nums">
                − {formatGuaranies(balance.expense)}
              </dd>
            </div>
          )}
        </dl>

        <p className="mt-3 text-sm text-muted">
          Abierta desde{" "}
          {new Date(session.start_time).toLocaleString("es-PY", {
            dateStyle: "short",
            timeStyle: "short",
            timeZone: BUSINESS_TIMEZONE,
          })}
        </p>
      </div>

      <CloseCashButton sessionId={session.id} />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted">Movimientos</h2>
        <TransactionInlineForm />
        {activeProducts.length > 0 && (
          <SellProductForm products={activeProducts} />
        )}
      </section>
    </div>
  );
}
