import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getBarberStatsAction, getOwnerStatsAction } from "../stats.actions";

interface MockResult {
  data?: unknown;
  count?: number | null;
  error: { message: string } | null;
}

interface QueryBuilderMock {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  or: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (onfulfilled: (value: MockResult) => unknown) => Promise<unknown>;
}

/**
 * Mismo patrón que el resto de los tests de actions. Las consultas de
 * estadísticas no encadenan single/maybeSingle (salvo el perfil), así que
 * casi todas resuelven por `then`. Se le puede pasar una cola de resultados
 * para las tablas que se consultan más de una vez (ej. appointments: día y
 * ventana de 30 días).
 */
function createBuilder(...results: MockResult[]): QueryBuilderMock {
  let index = 0;
  const next = () => results[Math.min(index++, results.length - 1)];
  const builder: QueryBuilderMock = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    or: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => next()),
    then: (onfulfilled) => Promise.resolve(next()).then(onfulfilled),
  };
  return builder;
}

function mockSupabase(builders: Record<string, QueryBuilderMock>) {
  const from = vi.fn((table: string) => builders[table]);
  vi.mocked(createClient).mockResolvedValue({
    from,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "auth-1" } } })),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from };
}

const PERFIL_BARBERO = {
  id: "user-1",
  name: "Ana López",
  role: "barber",
  level: "junior",
  streak_count: 4,
};

const PERFIL_DUENO = { ...PERFIL_BARBERO, id: "owner-1", role: "owner" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getBarberStatsAction", () => {
  it("devuelve cortes del día, cobrado, racha, nivel y progreso", async () => {
    const usersBuilder = createBuilder({ data: PERFIL_BARBERO, error: null });
    // Dos consultas a appointments: el día (3) y la ventana de 30 días (45).
    const appointmentsBuilder = createBuilder(
      { count: 3, error: null },
      { count: 45, error: null },
    );
    const cashSessionsBuilder = createBuilder({
      data: [{ id: "cs1", user_id: "user-1" }],
      error: null,
    });
    const transactionsBuilder = createBuilder({
      data: [
        { cash_session_id: "cs1", amount: 30000, category: "service" },
        { cash_session_id: "cs1", amount: 25000, category: "product" },
      ],
      error: null,
    });

    mockSupabase({
      users: usersBuilder,
      appointments: appointmentsBuilder,
      cash_sessions: cashSessionsBuilder,
      transactions: transactionsBuilder,
    });

    const result = await getBarberStatsAction("2026-09-17");

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.completedCuts).toBe(3);
    expect(result.data.income).toBe(55000);
    expect(result.data.streakCount).toBe(4);
    // 45 cortes en la ventana → Pro (40), rumbo a Senior (91).
    expect(result.data.progress.level).toBe("pro");
    expect(result.data.progress.cutsToNext).toBe(46);
  });

  it("corta el día en la zona del negocio, no en UTC", async () => {
    const appointmentsBuilder = createBuilder(
      { count: 0, error: null },
      { count: 0, error: null },
    );
    mockSupabase({
      users: createBuilder({ data: PERFIL_BARBERO, error: null }),
      appointments: appointmentsBuilder,
      cash_sessions: createBuilder({ data: [], error: null }),
      transactions: createBuilder({ data: [], error: null }),
    });

    await getBarberStatsAction("2026-09-17");

    // 00:00 del 17/09 en Paraguay (UTC-3) es 03:00 UTC.
    expect(appointmentsBuilder.gte).toHaveBeenCalledWith(
      "start_time",
      "2026-09-17T03:00:00.000Z",
    );
    expect(appointmentsBuilder.lt).toHaveBeenCalledWith(
      "start_time",
      "2026-09-18T03:00:00.000Z",
    );
  });

  it("cuenta lo cobrado hoy aunque la caja se haya abierto ayer y siga abierta", async () => {
    // Caso real encontrado en el navegador (2026-09-17): una caja abierta el
    // 16 a las 21:27 y todavía sin cerrar mostraba "1 corte hoy" junto a
    // "Gs. 0 cobrado hoy". El recorte por fecha va sobre la transacción, no
    // sobre el día de apertura de la caja.
    const cashSessionsBuilder = createBuilder({
      data: [{ id: "cs-de-ayer", user_id: "user-1" }],
      error: null,
    });
    const transactionsBuilder = createBuilder({
      data: [
        { cash_session_id: "cs-de-ayer", amount: 35000, category: "service" },
      ],
      error: null,
    });

    mockSupabase({
      users: createBuilder({ data: PERFIL_BARBERO, error: null }),
      appointments: createBuilder(
        { count: 1, error: null },
        { count: 1, error: null },
      ),
      cash_sessions: cashSessionsBuilder,
      transactions: transactionsBuilder,
    });

    const result = await getBarberStatsAction("2026-09-17");

    expect(result).toMatchObject({
      success: true,
      data: { completedCuts: 1, income: 35000 },
    });
    // La caja se busca por intersección con el día, no por día de apertura.
    expect(cashSessionsBuilder.gte).not.toHaveBeenCalledWith(
      "start_time",
      expect.anything(),
    );
    expect(cashSessionsBuilder.or).toHaveBeenCalledWith(
      "end_time.gte.2026-09-17T03:00:00.000Z,end_time.is.null",
    );
    // El movimiento sí se filtra por cuándo se cobró.
    expect(transactionsBuilder.gte).toHaveBeenCalledWith(
      "created_at",
      "2026-09-17T03:00:00.000Z",
    );
    expect(transactionsBuilder.lt).toHaveBeenCalledWith(
      "created_at",
      "2026-09-18T03:00:00.000Z",
    );
  });

  it("un día sin actividad devuelve ceros, no un error", async () => {
    mockSupabase({
      users: createBuilder({ data: PERFIL_BARBERO, error: null }),
      appointments: createBuilder({ count: 0, error: null }),
      cash_sessions: createBuilder({ data: [], error: null }),
      transactions: createBuilder({ data: [], error: null }),
    });

    const result = await getBarberStatsAction("2026-09-17");

    expect(result).toMatchObject({
      success: true,
      data: {
        completedCuts: 0,
        income: 0,
        progress: { level: "junior", ratio: 0 },
      },
    });
  });

  it("rechaza una fecha inválida antes de consultar", async () => {
    const result = await getBarberStatsAction("17-09-2026");

    expect(result).toEqual({ success: false, error: "La fecha no es válida." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("devuelve un error legible si falla la consulta de cortes", async () => {
    mockSupabase({
      users: createBuilder({ data: PERFIL_BARBERO, error: null }),
      appointments: createBuilder({ count: null, error: { message: "boom" } }),
      cash_sessions: createBuilder({ data: [], error: null }),
      transactions: createBuilder({ data: [], error: null }),
    });

    const result = await getBarberStatsAction("2026-09-17");

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("getOwnerStatsAction — permisos", () => {
  it("rechaza a un barbero aunque llame a la acción directamente", async () => {
    const appointmentsBuilder = createBuilder({ data: [], error: null });
    mockSupabase({
      users: createBuilder({ data: PERFIL_BARBERO, error: null }),
      appointments: appointmentsBuilder,
      cash_sessions: createBuilder({ data: [], error: null }),
      transactions: createBuilder({ data: [], error: null }),
    });

    const result = await getOwnerStatsAction("2026-09-01", "2026-09-17");

    expect(result).toEqual({
      success: false,
      error:
        "Acceso denegado: solo el dueño puede ver las estadísticas de la barbería.",
    });
    // Nunca llega a leer los datos de los compañeros.
    expect(appointmentsBuilder.select).not.toHaveBeenCalled();
  });

  it("rechaza un rango con fechas inválidas antes de consultar", async () => {
    const result = await getOwnerStatsAction("2026-09-01", "no-es-fecha");

    expect(result).toEqual({ success: false, error: "La fecha no es válida." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza un rango al revés", async () => {
    const result = await getOwnerStatsAction("2026-09-17", "2026-09-01");

    expect(result).toEqual({
      success: false,
      error: "El rango de fechas no es válido.",
    });
  });
});

describe("getOwnerStatsAction — métricas", () => {
  const EQUIPO = [
    { id: "owner-1", name: "Carlos" },
    { id: "user-1", name: "Ana" },
    { id: "user-2", name: "Beto" },
  ];

  function mockBarberia() {
    // users se consulta dos veces: el perfil propio y el equipo.
    const usersBuilder = createBuilder(
      { data: PERFIL_DUENO, error: null },
      { data: EQUIPO, error: null },
    );
    const appointmentsBuilder = createBuilder({
      data: [
        { user_id: "user-1" },
        { user_id: "user-1" },
        { user_id: "user-2" },
        { user_id: "owner-1" },
      ],
      error: null,
    });
    const cashSessionsBuilder = createBuilder({
      data: [
        { id: "cs1", user_id: "user-1" },
        { id: "cs2", user_id: "user-2" },
        { id: "cs3", user_id: "owner-1" },
      ],
      error: null,
    });
    // Ana cobró 50.000 en cortes y vendió 10.000 de producto; Beto sólo
    // cortes; Carlos (el dueño) cargó una propina a mano. La mezcla es a
    // propósito: es lo que antes inflaba el ticket promedio.
    const transactionsBuilder = createBuilder({
      data: [
        { cash_session_id: "cs1", amount: 50000, category: "service" },
        { cash_session_id: "cs1", amount: 10000, category: "product" },
        { cash_session_id: "cs2", amount: 30000, category: "service" },
        { cash_session_id: "cs3", amount: 10000, category: "manual" },
      ],
      error: null,
    });

    mockSupabase({
      users: usersBuilder,
      appointments: appointmentsBuilder,
      cash_sessions: cashSessionsBuilder,
      transactions: transactionsBuilder,
    });

    return { appointmentsBuilder };
  }

  it("suma ingresos y cortes de toda la barbería y arma el leaderboard", async () => {
    mockBarberia();

    const result = await getOwnerStatsAction("2026-09-16", "2026-09-17");

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.totalIncome).toBe(100000);
    expect(result.data.totalCuts).toBe(4);
    expect(result.data.days).toBe(2);
    expect(result.data.dailyAverageIncome).toBe(50000);
    expect(result.data.leaderboard).toEqual([
      {
        userId: "user-1",
        name: "Ana",
        cuts: 2,
        income: 60000,
        serviceIncome: 50000,
      },
      {
        userId: "user-2",
        name: "Beto",
        cuts: 1,
        income: 30000,
        serviceIncome: 30000,
      },
      {
        userId: "owner-1",
        name: "Carlos",
        cuts: 1,
        income: 10000,
        serviceIncome: 0,
      },
    ]);
  });

  it("el ticket promedio usa sólo los cortes, no las ventas ni los movimientos manuales", async () => {
    mockBarberia();

    const result = await getOwnerStatsAction("2026-09-16", "2026-09-17");

    expect(result.success).toBe(true);
    if (!result.success) return;

    // 80.000 cobrados en cortes / 4 cortes = 20.000. Con el total mezclado
    // (100.000 / 4) daba 25.000: un ticket que ningún cliente pagó.
    expect(result.data.totalServiceIncome).toBe(80000);
    expect(result.data.averageTicket).toBe(20000);
  });

  it("el ingreso total sigue incluyendo ventas y movimientos manuales", async () => {
    mockBarberia();

    const result = await getOwnerStatsAction("2026-09-16", "2026-09-17");

    expect(result.success).toBe(true);
    if (!result.success) return;

    // "Ingresos" es lo que entró a la caja, igual que antes: la separación
    // por categoría es sólo para el ticket promedio.
    expect(result.data.totalIncome).toBe(100000);
    expect(result.data.totalIncome).toBeGreaterThan(
      result.data.totalServiceIncome,
    );
  });

  it("el rango cubre todos los días, del primero al último inclusive", async () => {
    const { appointmentsBuilder } = mockBarberia();

    await getOwnerStatsAction("2026-09-16", "2026-09-17");

    expect(appointmentsBuilder.gte).toHaveBeenCalledWith(
      "start_time",
      "2026-09-16T03:00:00.000Z",
    );
    expect(appointmentsBuilder.lt).toHaveBeenCalledWith(
      "start_time",
      "2026-09-18T03:00:00.000Z",
    );
  });

  it("un periodo sin actividad devuelve ceros y un leaderboard en cero, sin dividir por cero", async () => {
    mockSupabase({
      users: createBuilder(
        { data: PERFIL_DUENO, error: null },
        { data: EQUIPO, error: null },
      ),
      appointments: createBuilder({ data: [], error: null }),
      cash_sessions: createBuilder({ data: [], error: null }),
      transactions: createBuilder({ data: [], error: null }),
    });

    const result = await getOwnerStatsAction("2026-09-17", "2026-09-17");

    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(result.data.totalIncome).toBe(0);
    expect(result.data.totalServiceIncome).toBe(0);
    expect(result.data.totalCuts).toBe(0);
    expect(result.data.dailyAverageIncome).toBe(0);
    expect(result.data.averageTicket).toBe(0);
    expect(Number.isFinite(result.data.dailyAverageIncome)).toBe(true);
    expect(Number.isFinite(result.data.averageTicket)).toBe(true);
    expect(result.data.leaderboard.every((m) => m.cuts === 0)).toBe(true);
  });

  it("no consulta transacciones si no hubo ninguna caja en el rango", async () => {
    const transactionsBuilder = createBuilder({ data: [], error: null });
    mockSupabase({
      users: createBuilder(
        { data: PERFIL_DUENO, error: null },
        { data: EQUIPO, error: null },
      ),
      appointments: createBuilder({ data: [], error: null }),
      cash_sessions: createBuilder({ data: [], error: null }),
      transactions: transactionsBuilder,
    });

    await getOwnerStatsAction("2026-09-17", "2026-09-17");

    expect(transactionsBuilder.select).not.toHaveBeenCalled();
  });
});
