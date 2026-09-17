import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import type { CashSession } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { closeCashSessionAction } from "../cash.actions";

/**
 * Racha y nivel al cerrar la caja (spec 08, sección 3). Va en su propio
 * archivo porque necesita un mock más fino que el de cash.test.ts: la tabla
 * `transactions` se consulta dos veces con formas distintas (el saldo de la
 * caja que se cierra, y qué cajas anteriores tuvieron ingresos).
 */

type Result = {
  data?: unknown;
  count?: number | null;
  error: { message: string } | null;
};

interface BuilderMock {
  select: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  neq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (onfulfilled: (value: Result) => unknown) => Promise<unknown>;
}

/** Cada llamada consume el siguiente resultado de la cola (el último se repite). */
function createBuilder(...results: Result[]): BuilderMock {
  let index = 0;
  const next = () => results[Math.min(index++, results.length - 1)];
  const builder: BuilderMock = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    neq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(async () => next()),
    maybeSingle: vi.fn(async () => next()),
    then: (onfulfilled) => Promise.resolve(next()).then(onfulfilled),
  };
  return builder;
}

// La caja que se cierra: jueves 17/09/2026, hora de Paraguay.
const SESION: CashSession = {
  id: "cs-hoy",
  barbershop_id: "b1",
  user_id: "user-1",
  start_time: "2026-09-17T12:00:00.000Z",
  end_time: null,
  initial_balance: 50000,
  final_balance: null,
  status: "open",
};

const CERRADA = { ...SESION, status: "closed" as const, final_balance: 80000 };

interface Escenario {
  /** Racha guardada hoy. */
  streak?: number;
  /** Ingresos de la caja que se cierra. */
  income?: number;
  /** Cajas cerradas anteriores del barbero. */
  previous?: { id: string; start_time: string }[];
  /** Ids de esas cajas que tuvieron al menos un ingreso. */
  previousWithIncome?: string[];
  /** Cortes completados en la ventana de 30 días. */
  windowCuts?: number;
}

function mockCierre(escenario: Escenario = {}) {
  const income = escenario.income ?? 30000;
  const previous = escenario.previous ?? [];

  // cash_sessions: (1) fetch de la caja a cerrar, (2) update, (3) lista de
  // cajas cerradas anteriores (resuelve por `then`).
  const cashSessions = createBuilder(
    {
      data: { initial_balance: SESION.initial_balance, status: "open" },
      error: null,
    },
    { data: CERRADA, error: null },
  );
  cashSessions.then = (onfulfilled) =>
    Promise.resolve({ data: previous, error: null } as Result).then(
      onfulfilled,
    );

  // transactions: (1) computeBalance de la caja que se cierra, (2) ingresos
  // de las cajas anteriores.
  let transactionsCall = 0;
  const transactions = createBuilder();
  transactions.then = (onfulfilled) => {
    transactionsCall += 1;
    const result: Result =
      transactionsCall === 1
        ? {
            data: income > 0 ? [{ type: "income", amount: income }] : [],
            error: null,
          }
        : {
            data: (
              escenario.previousWithIncome ?? previous.map((s) => s.id)
            ).map((id) => ({ cash_session_id: id })),
            error: null,
          };
    return Promise.resolve(result).then(onfulfilled);
  };

  const users = createBuilder({
    data: {
      id: "user-1",
      streak_count: escenario.streak ?? 0,
      level: "junior",
    },
    error: null,
  });

  const appointments = createBuilder();
  appointments.then = (onfulfilled) =>
    Promise.resolve({
      data: null,
      count: escenario.windowCuts ?? 0,
      error: null,
    } as Result).then(onfulfilled);

  const from = vi.fn((table: string) => {
    if (table === "users") return users;
    if (table === "transactions") return transactions;
    if (table === "appointments") return appointments;
    return cashSessions;
  });

  vi.mocked(createClient).mockResolvedValue({
    from,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "auth-1" } } })),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  return { users, appointments, cashSessions };
}

/** Lo que se guardó en `users` (racha y nivel), o null si no se guardó nada. */
function guardado(users: BuilderMock) {
  const call = users.update.mock.calls.at(-1);
  return call ? (call[0] as { streak_count: number; level: string }) : null;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("closeCashSessionAction — racha", () => {
  it("la primera caja con ingresos arranca la racha en 1", async () => {
    const { users } = mockCierre({ streak: 0, previous: [] });

    const result = await closeCashSessionAction("cs-hoy");

    expect(result.success).toBe(true);
    expect(guardado(users)?.streak_count).toBe(1);
  });

  it("haber trabajado ayer suma un día", async () => {
    const { users } = mockCierre({
      streak: 5,
      previous: [{ id: "cs-ayer", start_time: "2026-09-16T12:00:00.000Z" }],
    });

    await closeCashSessionAction("cs-hoy");

    expect(guardado(users)?.streak_count).toBe(6);
  });

  it("un día salteado no rompe la racha: es el día de gracia", async () => {
    const { users } = mockCierre({
      streak: 5,
      previous: [{ id: "cs-anteayer", start_time: "2026-09-15T12:00:00.000Z" }],
    });

    await closeCashSessionAction("cs-hoy");

    expect(guardado(users)?.streak_count).toBe(6);
  });

  it("tres días sin caja rompen la racha y vuelve a 1", async () => {
    const { users } = mockCierre({
      streak: 40,
      previous: [{ id: "cs-viejo", start_time: "2026-09-14T12:00:00.000Z" }],
    });

    await closeCashSessionAction("cs-hoy");

    expect(guardado(users)?.streak_count).toBe(1);
  });

  it("una caja anterior sin ingresos no cuenta como jornada trabajada", async () => {
    const { users } = mockCierre({
      streak: 5,
      previous: [
        { id: "cs-ayer-vacia", start_time: "2026-09-16T12:00:00.000Z" },
        { id: "cs-viejo", start_time: "2026-09-10T12:00:00.000Z" },
      ],
      // La de ayer se abrió y cerró sin cobrar nada.
      previousWithIncome: ["cs-viejo"],
    });

    await closeCashSessionAction("cs-hoy");

    expect(guardado(users)?.streak_count).toBe(1);
  });

  it("una segunda caja el mismo día no suma dos veces", async () => {
    const { users } = mockCierre({
      streak: 6,
      previous: [
        { id: "cs-manana", start_time: "2026-09-17T11:00:00.000Z" },
        { id: "cs-ayer", start_time: "2026-09-16T12:00:00.000Z" },
      ],
    });

    await closeCashSessionAction("cs-hoy");

    expect(guardado(users)?.streak_count).toBe(6);
  });

  it("cerrar a las 2 AM sigue contando como la jornada anterior", async () => {
    // La caja se abrió el 17 a las 09:00 de Paraguay y se cierra pasada la
    // medianoche: lo que manda es start_time, no el reloj del cierre.
    const { users, appointments } = mockCierre({
      streak: 2,
      previous: [{ id: "cs-ayer", start_time: "2026-09-16T12:00:00.000Z" }],
    });

    await closeCashSessionAction("cs-hoy");

    expect(guardado(users)?.streak_count).toBe(3);
    // La ventana de niveles termina el 17, el día de apertura.
    expect(appointments.lt).toHaveBeenCalledWith(
      "start_time",
      "2026-09-18T03:00:00.000Z",
    );
  });

  it("una caja cerrada sin un solo ingreso no toca la racha", async () => {
    const { users } = mockCierre({
      streak: 7,
      income: 0,
      previous: [{ id: "cs-viejo", start_time: "2026-09-01T12:00:00.000Z" }],
    });

    await closeCashSessionAction("cs-hoy");

    expect(guardado(users)?.streak_count).toBe(7);
  });
});

describe("closeCashSessionAction — nivel (ligas de 30 días)", () => {
  it("sube de liga al superar el umbral de cortes de la ventana", async () => {
    const { users, appointments } = mockCierre({ windowCuts: 45 });

    await closeCashSessionAction("cs-hoy");

    expect(guardado(users)?.level).toBe("pro");
    // Ventana de 30 días terminando el día de la caja (17/09 → 19/08).
    expect(appointments.gte).toHaveBeenCalledWith(
      "start_time",
      "2026-08-19T03:00:00.000Z",
    );
  });

  it("baja de liga si el rendimiento de los últimos 30 días bajó", async () => {
    const { users } = mockCierre({ windowCuts: 12 });

    await closeCashSessionAction("cs-hoy");

    expect(guardado(users)?.level).toBe("junior");
  });

  it("llega a élite con más de 150 cortes en la ventana", async () => {
    const { users } = mockCierre({ windowCuts: 151 });

    await closeCashSessionAction("cs-hoy");

    expect(guardado(users)?.level).toBe("elite");
  });
});

describe("closeCashSessionAction — la gamificación no puede tumbar el cierre", () => {
  it("la caja se cierra igual aunque falle la consulta de cortes", async () => {
    const { users, appointments } = mockCierre();
    appointments.then = (onfulfilled) =>
      Promise.resolve({
        data: null,
        count: null,
        error: { message: "boom" },
      } as Result).then(onfulfilled);

    const result = await closeCashSessionAction("cs-hoy");

    expect(result).toEqual({ success: true, data: CERRADA });
    expect(users.update).not.toHaveBeenCalled();
  });

  it("la caja se cierra igual aunque no se encuentre el perfil", async () => {
    const { users } = mockCierre();
    users.maybeSingle = vi.fn(async () => ({ data: null, error: null }));

    const result = await closeCashSessionAction("cs-hoy");

    expect(result).toEqual({ success: true, data: CERRADA });
    expect(users.update).not.toHaveBeenCalled();
  });
});
