import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import type { Transaction } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { registerTransactionAction, sellProductAction } from "../cash.actions";

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

/** Igual al builder de cash.test.ts. */
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

/**
 * Un builder por cada `.from(...)`, en orden: `users` (perfil), después
 * `cash_sessions` (caja abierta) y lo que haga cada acción.
 */
function mockSupabase(fromResults: MockResult<unknown>[]) {
  const builders = fromResults.map((result) => createBuilder(result));
  let callIndex = 0;
  const tables: string[] = [];
  const from = vi.fn((table: string) => {
    tables.push(table);
    return builders[callIndex++];
  });

  vi.mocked(createClient).mockResolvedValue({
    from,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "auth-1" } } })),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  return { from, builders, tables };
}

const PROFILE = { data: { id: "user-1" }, error: null };
const OPEN_SESSION = { data: { id: "cs1" }, error: null };
const NO_SESSION = { data: null, error: null };

const TRANSACTION: Transaction = {
  id: "t1",
  cash_session_id: "cs1",
  type: "expense",
  amount: 8000,
  description: "Café",
  created_at: "2026-09-16T12:00:00.000Z",
};

const PRODUCT_ROW = {
  id: "p1",
  name: "Cera mate",
  price: 45000,
  stock: 5,
  is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerTransactionAction — validaciones", () => {
  it.each([
    [
      { type: "expense" as const, amount: 0, description: "Café" },
      "El monto debe ser un número entero mayor a cero.",
    ],
    [
      { type: "expense" as const, amount: 1000.5, description: "Café" },
      "El monto debe ser un número entero mayor a cero.",
    ],
    [
      { type: "income" as const, amount: 1000, description: "   " },
      "Contá brevemente de qué es el movimiento.",
    ],
    [
      { type: "robo" as never, amount: 1000, description: "x" },
      "El tipo de movimiento no es válido.",
    ],
  ])("rechaza %o", async (payload, error) => {
    const result = await registerTransactionAction(payload);

    expect(result).toEqual({ success: false, error });
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("registerTransactionAction", () => {
  it("inserta el egreso en la caja abierta resuelta en el servidor", async () => {
    const { builders, tables } = mockSupabase([
      PROFILE,
      OPEN_SESSION,
      { data: TRANSACTION, error: null },
    ]);

    const result = await registerTransactionAction({
      type: "expense",
      amount: 8000,
      description: "  Café ",
    });

    expect(tables).toEqual(["users", "cash_sessions", "transactions"]);
    expect(builders[1].eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(builders[1].eq).toHaveBeenCalledWith("status", "open");
    expect(builders[2].insert).toHaveBeenCalledWith({
      cash_session_id: "cs1",
      type: "expense",
      amount: 8000,
      description: "Café",
    });
    expect(result).toEqual({ success: true, data: TRANSACTION });
  });

  it("bloquea el movimiento si no hay caja abierta", async () => {
    const { from } = mockSupabase([PROFILE, NO_SESSION]);

    const result = await registerTransactionAction({
      type: "income",
      amount: 5000,
      description: "Propina",
    });

    expect(result).toEqual({
      success: false,
      error: "Tenés que abrir tu caja antes de registrar movimientos.",
    });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("devuelve un error genérico si falla el insert (ej. RLS)", async () => {
    mockSupabase([
      PROFILE,
      OPEN_SESSION,
      { data: null, error: { message: "new row violates row-level security" } },
    ]);

    const result = await registerTransactionAction({
      type: "income",
      amount: 5000,
      description: "Propina",
    });

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("sellProductAction", () => {
  it("rechaza una cantidad inválida sin tocar la base", async () => {
    const result = await sellProductAction({ productId: "p1", quantity: 0 });

    expect(result).toEqual({
      success: false,
      error: "La cantidad debe ser un número entero mayor a cero.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("descuenta stock condicionado al leído e ingresa precio × cantidad", async () => {
    const sale = {
      ...TRANSACTION,
      type: "income" as const,
      amount: 90000,
      description: "Venta: Cera mate x2",
    };
    const { builders, tables } = mockSupabase([
      PROFILE,
      OPEN_SESSION,
      { data: PRODUCT_ROW, error: null },
      { data: { id: "p1" }, error: null },
      { data: sale, error: null },
    ]);

    const result = await sellProductAction({ productId: "p1", quantity: 2 });

    expect(tables).toEqual([
      "users",
      "cash_sessions",
      "products",
      "products",
      "transactions",
    ]);
    expect(builders[3].update).toHaveBeenCalledWith({ stock: 3 });
    expect(builders[3].eq).toHaveBeenCalledWith("id", "p1");
    expect(builders[3].eq).toHaveBeenCalledWith("stock", 5);
    expect(builders[4].insert).toHaveBeenCalledWith({
      cash_session_id: "cs1",
      type: "income",
      amount: 90000,
      description: "Venta: Cera mate x2",
    });
    expect(result).toEqual({ success: true, data: sale });
  });

  it("usa una descripción sin cantidad al vender una sola unidad", async () => {
    const { builders } = mockSupabase([
      PROFILE,
      OPEN_SESSION,
      { data: PRODUCT_ROW, error: null },
      { data: { id: "p1" }, error: null },
      { data: TRANSACTION, error: null },
    ]);

    await sellProductAction({ productId: "p1", quantity: 1 });

    expect(builders[4].insert).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 45000,
        description: "Venta: Cera mate",
      }),
    );
  });

  it("aborta con un error legible si la cantidad supera el stock", async () => {
    const { from } = mockSupabase([
      PROFILE,
      OPEN_SESSION,
      { data: PRODUCT_ROW, error: null },
    ]);

    const result = await sellProductAction({ productId: "p1", quantity: 6 });

    expect(result).toEqual({
      success: false,
      error: "No hay stock suficiente de Cera mate (quedan 5).",
    });
    expect(from).toHaveBeenCalledTimes(3);
  });

  it("avisa si no queda stock", async () => {
    mockSupabase([
      PROFILE,
      OPEN_SESSION,
      { data: { ...PRODUCT_ROW, stock: 0 }, error: null },
    ]);

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error: "No queda stock de Cera mate.",
    });
  });

  it("bloquea la venta si no hay caja abierta, antes de tocar el stock", async () => {
    const { from } = mockSupabase([PROFILE, NO_SESSION]);

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error: "Tenés que abrir tu caja antes de registrar movimientos.",
    });
    expect(from).toHaveBeenCalledTimes(2);
  });

  it("rechaza productos inactivos o de otro tenant", async () => {
    mockSupabase([
      PROFILE,
      OPEN_SESSION,
      { data: { ...PRODUCT_ROW, is_active: false }, error: null },
    ]);

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error: "Producto no encontrado o inactivo.",
    });
  });

  it("pide reintentar si otro barbero vendió en el medio (update sin filas)", async () => {
    const { from } = mockSupabase([
      PROFILE,
      OPEN_SESSION,
      { data: PRODUCT_ROW, error: null },
      { data: null, error: null },
    ]);

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error: "El stock cambió mientras vendías. Intentá de nuevo.",
    });
    expect(from).toHaveBeenCalledTimes(4);
  });

  it("traduce la violación del check de stock a 'stock cambió'", async () => {
    mockSupabase([
      PROFILE,
      OPEN_SESSION,
      { data: PRODUCT_ROW, error: null },
      { data: null, error: { message: "check", code: "23514" } },
    ]);

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error: "El stock cambió mientras vendías. Intentá de nuevo.",
    });
  });

  it("avisa del desfase si se descontó stock pero falló el ingreso", async () => {
    mockSupabase([
      PROFILE,
      OPEN_SESSION,
      { data: PRODUCT_ROW, error: null },
      { data: { id: "p1" }, error: null },
      { data: null, error: { message: "boom" } },
    ]);

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error:
        "Se descontó el stock, pero la venta no se pudo reflejar en la caja. Avisá para revisar el desfase.",
    });
  });
});
