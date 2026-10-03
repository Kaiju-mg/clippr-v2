import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import type { Transaction } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  getCashMovementsAction,
  registerTransactionAction,
  sellProductAction,
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
  limit: ReturnType<typeof vi.fn>;
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
    limit: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onfulfilled) => Promise.resolve(result).then(onfulfilled),
  };
  return builder;
}

/**
 * Un builder por cada `.from(...)`, en orden: `users` (perfil), después
 * `cash_sessions` (caja abierta) y lo que haga cada acción.
 *
 * `rpcResult` es para `sellProductAction`, que desde la spec 09 resuelve la
 * caja con `.from(...)` pero hace la venta con un solo
 * `.rpc("sell_product_and_charge", ...).single()`.
 */
function mockSupabase(
  fromResults: MockResult<unknown>[],
  rpcResult?: {
    data: unknown;
    error: { message: string; code?: string; details?: string } | null;
  },
) {
  const builders = fromResults.map((result) => createBuilder(result));
  let callIndex = 0;
  const tables: string[] = [];
  const from = vi.fn((table: string) => {
    tables.push(table);
    return builders[callIndex++];
  });

  const single = vi.fn(async () => rpcResult);
  const rpc = vi.fn(() => ({ single }));

  vi.mocked(createClient).mockResolvedValue({
    from,
    rpc,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "auth-1" } } })),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  return { from, builders, tables, rpc };
}

const PROFILE = { data: { id: "user-1" }, error: null };
const OPEN_SESSION = { data: { id: "cs1" }, error: null };
const NO_SESSION = { data: null, error: null };

const TRANSACTION: Transaction = {
  id: "t1",
  cash_session_id: "cs1",
  type: "expense",
  category: "manual",
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
      // Un movimiento cargado a mano nunca es un corte: no entra en el
      // ticket promedio del dueño (spec 09, paso 3).
      category: "manual",
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

  it("bloquea la venta si no hay caja abierta, sin llamar al RPC", async () => {
    const { from, rpc } = mockSupabase([PROFILE, NO_SESSION]);

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error: "Tenés que abrir tu caja antes de registrar movimientos.",
    });
    expect(from).toHaveBeenCalledTimes(2);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("delega la venta entera al RPC, con la caja resuelta en el servidor", async () => {
    const sale = {
      ...TRANSACTION,
      type: "income" as const,
      amount: 90000,
      description: "Venta: Cera mate x2",
    };
    const { tables, rpc } = mockSupabase([PROFILE, OPEN_SESSION], {
      data: sale,
      error: null,
    });

    const result = await sellProductAction({ productId: "p1", quantity: 2 });

    // Ya no hay dos `.from("products")`: el descuento de stock y el ingreso
    // viven dentro de la transacción del RPC.
    expect(tables).toEqual(["users", "cash_sessions"]);
    expect(rpc).toHaveBeenCalledWith("sell_product_and_charge", {
      p_product_id: "p1",
      p_cash_session_id: "cs1",
      p_quantity: 2,
    });
    expect(result).toEqual({ success: true, data: sale });
  });

  it("nunca manda el monto: el precio lo lee la base", async () => {
    const { rpc } = mockSupabase([PROFILE, OPEN_SESSION], {
      data: TRANSACTION,
      error: null,
    });

    await sellProductAction({ productId: "p1", quantity: 1 });

    const params = (
      rpc.mock.calls[0] as unknown as [string, Record<string, unknown>]
    )[1];
    expect(params).not.toHaveProperty("p_amount");
    expect(params).not.toHaveProperty("p_price");
  });

  it("traduce CL005 (producto inactivo o de otro tenant)", async () => {
    mockSupabase([PROFILE, OPEN_SESSION], {
      data: null,
      error: { message: "Producto no encontrado o inactivo", code: "CL005" },
    });

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error: "Producto no encontrado o inactivo.",
    });
  });

  it("arma el mensaje de stock insuficiente con el nombre y el stock del RPC", async () => {
    // El RPC manda el nombre en `message` y el stock restante en `details`;
    // la copia que ve el barbero se arma en el Server Action.
    mockSupabase([PROFILE, OPEN_SESSION], {
      data: null,
      error: { message: PRODUCT_ROW.name, code: "CL006", details: "5" },
    });

    const result = await sellProductAction({ productId: "p1", quantity: 6 });

    expect(result).toEqual({
      success: false,
      error: "No hay stock suficiente de Cera mate (quedan 5).",
    });
  });

  it("avisa si no queda stock", async () => {
    mockSupabase([PROFILE, OPEN_SESSION], {
      data: null,
      error: { message: PRODUCT_ROW.name, code: "CL006", details: "0" },
    });

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error: "No queda stock de Cera mate.",
    });
  });

  it("traduce CL001 (caja cerrada entre la lectura y el RPC)", async () => {
    mockSupabase([PROFILE, OPEN_SESSION], {
      data: null,
      error: { message: "Caja inexistente, ajena o cerrada", code: "CL001" },
    });

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error: "Tenés que abrir tu caja antes de registrar movimientos.",
    });
  });

  it("ya no existe el caso 'stock descontado sin venta': el RPC revierte todo", async () => {
    // Antes de la spec 09, un fallo al insertar la transacción dejaba el
    // stock descontado y devolvía "Se descontó el stock, pero...".
    mockSupabase([PROFILE, OPEN_SESSION], {
      data: null,
      error: { message: "boom", code: "XX000" },
    });

    const result = await sellProductAction({ productId: "p1", quantity: 1 });

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("getCashMovementsAction", () => {
  it("devuelve los movimientos de la caja, del más nuevo al más viejo", async () => {
    const { builders, tables } = mockSupabase([
      { data: [TRANSACTION], error: null },
    ]);

    const result = await getCashMovementsAction("cs1");

    expect(result).toEqual({ success: true, data: [TRANSACTION] });
    expect(tables).toEqual(["transactions"]);
    expect(builders[0].eq).toHaveBeenCalledWith("cash_session_id", "cs1");
    expect(builders[0].order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
  });

  it("recorta la lista en el servidor, no en el cliente", async () => {
    const { builders } = mockSupabase([{ data: [], error: null }]);

    await getCashMovementsAction("cs1");

    expect(builders[0].limit).toHaveBeenCalledWith(8);
  });

  it("devuelve una lista vacía cuando la caja no tiene movimientos", async () => {
    mockSupabase([{ data: null, error: null }]);

    const result = await getCashMovementsAction("cs1");

    expect(result).toEqual({ success: true, data: [] });
  });

  it("devuelve un error legible si supabase falla", async () => {
    mockSupabase([{ data: null, error: { message: "boom" } }]);

    const result = await getCashMovementsAction("cs1");

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});
