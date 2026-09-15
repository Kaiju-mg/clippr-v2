import { getCurrentCashSessionAction } from "@/actions/cash.actions";
import { OpenCashView } from "./_components/OpenCashView";
import { CloseCashButton } from "./_components/CloseCashButton";
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

  return (
    <div className="flex flex-col gap-6 p-4">
      <h1 className="font-display text-xl font-semibold">Caja abierta</h1>

      <div className="rounded-lg border border-line bg-surface-2 p-4">
        <p className="text-sm text-muted">Saldo inicial</p>
        <p className="font-display text-3xl font-semibold tabular-nums">
          {formatGuaranies(session.initial_balance)}
        </p>
        <p className="mt-2 text-sm text-muted">
          Abierta desde{" "}
          {new Date(session.start_time).toLocaleString("es-PY", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </p>
      </div>

      <CloseCashButton sessionId={session.id} />
    </div>
  );
}
