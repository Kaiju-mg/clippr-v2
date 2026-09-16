import {
  getCashBalanceAction,
  getCurrentCashSessionAction,
} from "@/actions/cash.actions";
import { OpenCashView } from "./_components/OpenCashView";
import { CloseCashButton } from "./_components/CloseCashButton";
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

  if (!session) {
    return <OpenCashView />;
  }

  const balanceResult = await getCashBalanceAction(session.id);

  if (!balanceResult.success) {
    return (
      <p role="alert" className="p-4 text-sm text-danger">
        {balanceResult.error}
      </p>
    );
  }

  const balance = balanceResult.data;

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
            <dt className="text-muted">Cobros</dt>
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
    </div>
  );
}
