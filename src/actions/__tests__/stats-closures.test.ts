import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getTeamClosuresAction } from "../stats.actions";

type Result = { data: unknown; error: { message: string } | null };

function builder(result: Result) {
  const b: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "lt", "in", "order"]) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(async () => result);
  b.then = (ok: (v: Result) => unknown) => Promise.resolve(result).then(ok);
  return b as Record<string, ReturnType<typeof vi.fn>>;
}

const OWNER = {
  id: "u-owner",
  name: "Edu",
  role: "owner",
  level: "junior",
  streak_count: 0,
};
const BARBER = { ...OWNER, id: "u-barber", role: "barber" };

const SESIONES = [
  {
    id: "cs1",
    user_id: "u-barber",
    end_time: "2026-10-04T20:00:00.000Z",
    initial_balance: 50000,
  },
  {
    id: "cs2",
    user_id: "u-owner",
    end_time: "2026-10-04T22:00:00.000Z",
    initial_balance: 10000,
  },
];

const MOVIMIENTOS = [
  {
    cash_session_id: "cs1",
    type: "income",
    category: "service",
    amount: 45000,
  },
  {
    cash_session_id: "cs1",
    type: "income",
    category: "product",
    amount: 20000,
  },
  { cash_session_id: "cs1", type: "expense", category: "manual", amount: 5000 },
  { cash_session_id: "cs2", type: "income", category: "manual", amount: 7000 },
];

function mock({
  profile = OWNER,
  sesiones = { data: SESIONES, error: null } as Result,
  movimientos = { data: MOVIMIENTOS, error: null } as Result,
} = {}) {
  let usersCall = 0;
  const cash = builder(sesiones);
  const tx = builder(movimientos);
  const from = vi.fn((table: string) => {
    if (table === "users") {
      // Primero el perfil propio (maybeSingle), después los nombres.
      return usersCall++ === 0
        ? builder({ data: profile, error: null })
        : builder({
            data: [
              { id: "u-barber", name: "Caillu Pérez" },
              { id: "u-owner", name: "Edu" },
            ],
            error: null,
          });
    }
    if (table === "transactions") return tx;
    return cash;
  });
  vi.mocked(createClient).mockResolvedValue({
    from,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "auth" } } })) },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from, cash, tx };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTeamClosuresAction — cierres de hoy del equipo", () => {
  it("un ticket por caja cerrada, con el mismo resumen que el cierre", async () => {
    mock();

    const result = await getTeamClosuresAction("2026-10-04");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((c) => c.barberName)).toEqual([
      "Caillu Pérez",
      "Edu",
    ]);
    const [caillu, edu] = result.data;
    expect(caillu.summary).toMatchObject({
      initialBalance: 50000,
      cuts: { count: 1, total: 45000 },
      sales: { count: 1, total: 20000 },
      expenses: 5000,
      finalBalance: 110000,
    });
    expect(edu.summary).toMatchObject({
      manualIncome: 7000,
      finalBalance: 17000,
    });
    expect(caillu.closedAt).toBe("2026-10-04T20:00:00.000Z");
  });

  it("toma las cajas cerradas cuya jornada (start_time) es del día pedido", async () => {
    const { cash, tx } = mock();

    await getTeamClosuresAction("2026-10-04");

    expect(cash.eq).toHaveBeenCalledWith("status", "closed");
    // 00:00 de Paraguay (UTC-3) del 4 y del 5 de octubre.
    expect(cash.gte).toHaveBeenCalledWith(
      "start_time",
      "2026-10-04T03:00:00.000Z",
    );
    expect(cash.lt).toHaveBeenCalledWith(
      "start_time",
      "2026-10-05T03:00:00.000Z",
    );
    expect(cash.order).toHaveBeenCalledWith("end_time", { ascending: true });
    expect(tx.in).toHaveBeenCalledWith("cash_session_id", ["cs1", "cs2"]);
  });

  it("un barbero no puede ver los cierres del equipo", async () => {
    const { cash } = mock({ profile: BARBER });

    const result = await getTeamClosuresAction("2026-10-04");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/solo el dueño/i);
    expect(cash.select).not.toHaveBeenCalled();
  });

  it("sin cierres, lista vacía (sin consultar movimientos)", async () => {
    const { tx } = mock({ sesiones: { data: [], error: null } });

    const result = await getTeamClosuresAction("2026-10-04");

    expect(result).toEqual({ success: true, data: [] });
    expect(tx.select).not.toHaveBeenCalled();
  });

  it("si fallan los movimientos, error (no tickets con números a medias)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock({ movimientos: { data: null, error: { message: "timeout" } } });

    const result = await getTeamClosuresAction("2026-10-04");

    expect(result.success).toBe(false);
  });

  it("una fecha inválida se rechaza sin tocar la base", async () => {
    const { from } = mock();
    const result = await getTeamClosuresAction("4/10/2026");
    expect(result.success).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
