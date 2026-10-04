import {
  getCashBalanceAction,
  getCashMovementsAction,
  getCurrentCashSessionAction,
} from "@/actions/cash.actions";
import { getProductsAction } from "@/actions/product.actions";
import { Tile } from "@/components/ui/Tile";
import {
  businessDateOf,
  businessToday,
  formatBusinessDateTime,
  formatBusinessTime,
} from "@/lib/dates";
import { formatGuaranies } from "@/lib/utils";
import { OpenCashView } from "./_components/OpenCashView";
import { CloseCashButton } from "./_components/CloseCashButton";
import { CashActionsBento } from "./_components/CashActionsBento";
import { CashMovements } from "./_components/CashMovements";

export default async function CajaPage() {
  const result = await getCurrentCashSessionAction();

  if (!result.success) {
    return (
      <p role="alert" className="text-danger p-4 text-sm">
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

  const [balanceResult, productsResult, movementsResult] = await Promise.all([
    getCashBalanceAction(session.id),
    getProductsAction(),
    getCashMovementsAction(session.id),
  ]);

  if (!balanceResult.success) {
    return (
      <p role="alert" className="text-danger p-4 text-sm">
        {balanceResult.error}
      </p>
    );
  }

  const balance = balanceResult.data;
  // Si falla la lectura del catálogo, la caja sigue usable: solo no se
  // ofrece la venta de productos. Con la lista de movimientos, igual: el
  // saldo y las acciones son lo que no puede faltar.
  const activeProducts = productsResult.success
    ? productsResult.data.filter((product) => product.is_active)
    : [];
  const movements = movementsResult.success ? movementsResult.data : [];

  // Una caja que quedó abierta de un día anterior (el barbero se olvidó de
  // cerrarla) tiene que decir de qué día es: con sólo la hora, "abierta
  // desde 08:30" se lee como si fuera de hoy.
  const abiertaHoy =
    businessDateOf(new Date(session.start_time)) === businessToday();
  const desde = abiertaHoy
    ? formatBusinessTime(session.start_time)
    : formatBusinessDateTime(session.start_time);

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Caja
        </h1>
        <span className="text-muted flex items-center gap-2 text-xs font-medium">
          <span
            aria-hidden="true"
            className="bg-success h-1.5 w-1.5 rounded-full"
          />
          Abierta desde <span className="font-mono tabular-nums">{desde}</span>
        </span>
      </header>

      {/* El cubo relleno de esta pantalla: el saldo es el número por el que
          el barbero entra acá. El desglose va adentro y no en una lista
          aparte, para que se lea como una sola cosa. */}
      <Tile variant="filled" className="gap-3 p-5">
        <span className="text-[0.625rem] font-medium tracking-[0.14em] uppercase opacity-80">
          Saldo actual
        </span>
        {/* 2rem y no más: en mono cada cifra ocupa ~0,6em y "Gs. 1.234.567"
            tiene que entrar en un celular de 360px. */}
        <span className="font-mono text-[2rem] leading-none font-semibold tracking-tight tabular-nums">
          {formatGuaranies(balance.current)}
        </span>

        <dl className="grid grid-cols-3 gap-2">
          <div className="bg-accent-contrast/10 flex flex-col gap-0.5 rounded-xl px-3 py-2">
            <dt className="text-[0.5625rem] font-medium tracking-[0.1em] uppercase opacity-80">
              Inicial
            </dt>
            <dd className="font-mono text-[12px] font-medium tabular-nums">
              {formatGuaranies(session.initial_balance)}
            </dd>
          </div>
          <div className="bg-accent-contrast/10 flex flex-col gap-0.5 rounded-xl px-3 py-2">
            <dt className="text-[0.5625rem] font-medium tracking-[0.1em] uppercase opacity-80">
              Ingresos
            </dt>
            <dd className="font-mono text-[12px] font-medium tabular-nums">
              + {formatGuaranies(balance.income)}
            </dd>
          </div>
          <div className="bg-accent-contrast/10 flex flex-col gap-0.5 rounded-xl px-3 py-2">
            <dt className="text-[0.5625rem] font-medium tracking-[0.1em] uppercase opacity-80">
              Egresos
            </dt>
            <dd className="font-mono text-[12px] font-medium tabular-nums">
              − {formatGuaranies(balance.expense)}
            </dd>
          </div>
        </dl>
      </Tile>

      <CashActionsBento products={activeProducts} />

      <CashMovements movements={movements} failed={!movementsResult.success} />

      <CloseCashButton sessionId={session.id} />
    </div>
  );
}
