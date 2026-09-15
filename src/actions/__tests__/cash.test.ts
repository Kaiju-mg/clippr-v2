import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import type { CashSession } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  getCurrentCashSessionAction,
  openCashSessionAction,
  closeCashSessionAction,
} from "../cash.actions";

interface MockResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

interface QueryBuilderMock<T> {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (onfulfilled: (value: MockResult<T>) => unknown) => Promise<unknown>;
}

/**
 * Simula el query builder encadenable de supabase-js, igual que
 * service.test.ts: cada método intermedio devuelve el mismo builder, y
 * single/maybeSingle (o el propio builder vía `then`) resuelven al
 * resultado configurado.
 */
function createBuilder<T>(result: MockResult<T>): QueryBuilderMock<T> {
  const builder: QueryBuilderMock<T> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onfulfilled) => Promise.resolve(result).then(onfulfilled),
  };
  return builder;
}

const AUTH_USER = { id: "auth-1" };
const PROFILE = { id: "user-1" };

/**
 * Simula createClient() devolviendo: auth.getUser() con el usuario logueado,
 * y from("users") resolviendo siempre al perfil de arriba. from("cash_sessions")
 * (u otra tabla) usa el builder que se le pase para cada test.
 */
function mockSupabase(cashSessionsBuilder: QueryBuilderMock<unknown>) {
  const usersBuilder = createBuilder<typeof PROFILE>({
    data: PROFILE,
    error: null,
  });

  const from = vi.fn((table: string) =>
    table === "users" ? usersBuilder : cashSessionsBuilder,
  );

  vi.mocked(createClient).mockResolvedValue({
    from,
    auth: { getUser: vi.fn(async () => ({ data: { user: AUTH_USER } })) },
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  return { from, usersBuilder };
}

const CASH_SESSION: CashSession = {
  id: "cs1",
  barbershop_id: "b1",
  user_id: "user-1",
  start_time: "2026-09-15T10:00:00.000Z",
  end_time: null,
  initial_balance: 50000,
  final_balance: null,
  status: "open",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getCurrentCashSessionAction", () => {
  it("devuelve la caja abierta del usuario autenticado", async () => {
    const builder = createBuilder<CashSession>({
      data: CASH_SESSION,
      error: null,
    });
    const { from } = mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await getCurrentCashSessionAction();

    expect(from).toHaveBeenCalledWith("cash_sessions");
    expect(builder.eq).toHaveBeenCalledWith("user_id", PROFILE.id);
    expect(builder.eq).toHaveBeenCalledWith("status", "open");
    expect(result).toEqual({ success: true, data: CASH_SESSION });
  });

  it("devuelve null si no tiene ninguna caja abierta", async () => {
    const builder = createBuilder<CashSession>({ data: null, error: null });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await getCurrentCashSessionAction();

    expect(result).toEqual({ success: true, data: null });
  });

  it("devuelve un error legible si supabase falla", async () => {
    const builder = createBuilder<CashSession>({
      data: null,
      error: { message: "boom" },
    });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await getCurrentCashSessionAction();

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("openCashSessionAction — validaciones", () => {
  it("rechaza un saldo inicial negativo", async () => {
    const result = await openCashSessionAction(-500);

    expect(result).toEqual({
      success: false,
      error: "El saldo inicial debe ser un número mayor o igual a cero.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza un saldo inicial que no es un número finito", async () => {
    const result = await openCashSessionAction(Number.NaN);

    expect(result).toEqual({
      success: false,
      error: "El saldo inicial debe ser un número mayor o igual a cero.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("acepta un saldo inicial de cero", async () => {
    const builder = createBuilder<CashSession>({
      data: { ...CASH_SESSION, initial_balance: 0 },
      error: null,
    });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await openCashSessionAction(0);

    expect(result.success).toBe(true);
  });
});

describe("openCashSessionAction — happy path y errores", () => {
  it("abre la caja sin mandar user_id ni barbershop_id", async () => {
    const builder = createBuilder<CashSession>({
      data: CASH_SESSION,
      error: null,
    });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await openCashSessionAction(50000);

    expect(builder.insert).toHaveBeenCalledWith({ initial_balance: 50000 });
    const insertPayload = builder.insert.mock.calls[0][0];
    expect(insertPayload).not.toHaveProperty("user_id");
    expect(insertPayload).not.toHaveProperty("barbershop_id");
    expect(result).toEqual({ success: true, data: CASH_SESSION });
  });

  it("traduce la violación del índice único a un mensaje amigable", async () => {
    const builder = createBuilder<CashSession>({
      data: null,
      error: { message: "duplicate key value", code: "23505" },
    });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await openCashSessionAction(50000);

    expect(result).toEqual({
      success: false,
      error: "Ya tenés una caja abierta.",
    });
  });

  it("devuelve un error genérico ante otros errores de supabase", async () => {
    const builder = createBuilder<CashSession>({
      data: null,
      error: { message: "boom" },
    });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await openCashSessionAction(50000);

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("closeCashSessionAction", () => {
  it("cierra la caja igualando final_balance a initial_balance", async () => {
    const closed = {
      ...CASH_SESSION,
      status: "closed" as const,
      end_time: "2026-09-15T18:00:00.000Z",
      final_balance: CASH_SESSION.initial_balance,
    };

    // El action hace dos llamadas a .from("cash_sessions"): un fetch
    // (para leer initial_balance/status) y después el update. El mismo
    // builder atiende ambas, pero maybeSingle devuelve un resultado
    // distinto cada vez: primero la caja abierta, después la ya cerrada.
    const builder = createBuilder<unknown>({ data: CASH_SESSION, error: null });
    builder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: { initial_balance: CASH_SESSION.initial_balance, status: "open" },
        error: null,
      })
      .mockResolvedValueOnce({ data: closed, error: null });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await closeCashSessionAction("cs1");

    expect(builder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "closed",
        final_balance: closed.initial_balance,
      }),
    );
    expect(builder.eq).toHaveBeenCalledWith("id", "cs1");
    expect(result).toEqual({ success: true, data: closed });
  });

  it("devuelve 'no encontrada' si la sesión ya está cerrada", async () => {
    const builder = createBuilder<unknown>({
      data: { initial_balance: 50000, status: "closed" },
      error: null,
    });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await closeCashSessionAction("cs1");

    expect(result).toEqual({
      success: false,
      error: "Caja no encontrada o ya cerrada.",
    });
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("devuelve 'no encontrada' si la sesión no existe", async () => {
    const builder = createBuilder<unknown>({ data: null, error: null });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await closeCashSessionAction("no-existe");

    expect(result).toEqual({
      success: false,
      error: "Caja no encontrada o ya cerrada.",
    });
    expect(builder.update).not.toHaveBeenCalled();
  });

  it("devuelve 'no encontrada' si RLS bloquea el update (caja de otro barbero)", async () => {
    // El select (tenant-wide) sí ve la fila -- el dueño puede ver la caja
    // de sus barberos -- pero el update (cash_sessions_update_own) la
    // bloquea porque quien ejecuta la acción no es el dueño de esa caja.
    const builder = createBuilder<unknown>({ data: null, error: null });
    builder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: { initial_balance: 50000, status: "open" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await closeCashSessionAction("cs-de-otro-barbero");

    expect(result).toEqual({
      success: false,
      error: "Caja no encontrada o ya cerrada.",
    });
  });

  it("devuelve un error legible si supabase falla", async () => {
    const builder = createBuilder<unknown>({
      data: null,
      error: { message: "boom" },
    });
    mockSupabase(builder as QueryBuilderMock<unknown>);

    const result = await closeCashSessionAction("cs1");

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});
