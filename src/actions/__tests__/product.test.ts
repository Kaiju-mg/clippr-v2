import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import type { Product } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  getProductsAction,
  createProductAction,
  updateProductAction,
  toggleProductStatusAction,
} from "../product.actions";

interface MockResult<T> {
  data: T | null;
  error: { message: string } | null;
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

/** Igual al builder de service.test.ts. */
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
 * Un builder por cada `.from(...)` esperado, en el orden en que la acción
 * los hace (primero el rol en `users`, después `products`), igual que
 * team.test.ts.
 */
function mockSupabase(fromResults: MockResult<unknown>[]) {
  const builders = fromResults.map((result) => createBuilder(result));
  let callIndex = 0;
  const from = vi.fn(() => builders[callIndex++]);

  vi.mocked(createClient).mockResolvedValue({
    from,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "auth-1" } } })) },
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  return { from, builders };
}

const OWNER = { data: { role: "owner" }, error: null };
const BARBER = { data: { role: "barber" }, error: null };

const PRODUCT: Product = {
  id: "p1",
  barbershop_id: "b1",
  name: "Cera mate",
  price: 45000,
  stock: 10,
  low_stock_threshold: 3,
  is_active: true,
};

const PAYLOAD = {
  name: "Cera mate",
  price: 45000,
  stock: 10,
  low_stock_threshold: 3,
};

const ACCESO_DENEGADO = {
  success: false,
  error: "Acceso denegado: solo el dueño puede gestionar los productos.",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProductsAction", () => {
  it("devuelve el catálogo con activos primero, sin filtrar por tenant a mano", async () => {
    const { from, builders } = mockSupabase([{ data: [PRODUCT], error: null }]);

    const result = await getProductsAction();

    expect(from).toHaveBeenCalledWith("products");
    expect(builders[0].order).toHaveBeenCalledWith("is_active", {
      ascending: false,
    });
    expect(builders[0].eq).not.toHaveBeenCalled();
    expect(result).toEqual({ success: true, data: [PRODUCT] });
  });

  it("devuelve un error genérico si supabase falla", async () => {
    mockSupabase([{ data: null, error: { message: "boom" } }]);

    const result = await getProductsAction();

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("createProductAction — validaciones", () => {
  it.each([
    [{ ...PAYLOAD, name: "  " }, "El nombre del producto es obligatorio."],
    [{ ...PAYLOAD, price: 0 }, "El precio debe ser un número entero mayor a cero."],
    [
      { ...PAYLOAD, price: 1500.5 },
      "El precio debe ser un número entero mayor a cero.",
    ],
    [
      { ...PAYLOAD, stock: -1 },
      "El stock debe ser un número entero mayor o igual a cero.",
    ],
    [
      { ...PAYLOAD, low_stock_threshold: -2 },
      "El aviso de stock bajo debe ser un número entero mayor o igual a cero.",
    ],
  ])("rechaza %o", async (payload, error) => {
    const result = await createProductAction(payload);

    expect(result).toEqual({ success: false, error });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("acepta un producto sin aviso de stock bajo", async () => {
    mockSupabase([
      OWNER,
      { data: { ...PRODUCT, low_stock_threshold: null }, error: null },
    ]);

    const result = await createProductAction({
      ...PAYLOAD,
      low_stock_threshold: null,
    });

    expect(result.success).toBe(true);
  });
});

describe("createProductAction", () => {
  it("el dueño crea un producto sin mandar barbershop_id", async () => {
    const { builders } = mockSupabase([
      OWNER,
      { data: PRODUCT, error: null },
    ]);

    const result = await createProductAction({ ...PAYLOAD, name: " Cera mate " });

    expect(builders[1].insert).toHaveBeenCalledWith(PAYLOAD);
    expect(builders[1].insert.mock.calls[0][0]).not.toHaveProperty(
      "barbershop_id",
    );
    expect(result).toEqual({ success: true, data: PRODUCT });
  });

  it("un barbero no puede crear productos", async () => {
    const { from } = mockSupabase([BARBER]);

    const result = await createProductAction(PAYLOAD);

    expect(result).toEqual(ACCESO_DENEGADO);
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("updateProductAction", () => {
  it("el dueño actualiza solo los campos enviados", async () => {
    const { builders } = mockSupabase([
      OWNER,
      { data: { ...PRODUCT, stock: 25 }, error: null },
    ]);

    const result = await updateProductAction("p1", { stock: 25 });

    expect(builders[1].update).toHaveBeenCalledWith({ stock: 25 });
    expect(builders[1].eq).toHaveBeenCalledWith("id", "p1");
    expect(result).toEqual({ success: true, data: { ...PRODUCT, stock: 25 } });
  });

  it("permite quitar el aviso de stock bajo con null", async () => {
    const { builders } = mockSupabase([
      OWNER,
      { data: { ...PRODUCT, low_stock_threshold: null }, error: null },
    ]);

    await updateProductAction("p1", { low_stock_threshold: null });

    expect(builders[1].update).toHaveBeenCalledWith({
      low_stock_threshold: null,
    });
  });

  it("devuelve 'no encontrado' si RLS no deja matchear la fila", async () => {
    mockSupabase([OWNER, { data: null, error: null }]);

    const result = await updateProductAction("p-otro-tenant", { price: 1000 });

    expect(result).toEqual({ success: false, error: "Producto no encontrado." });
  });

  it("un barbero no puede editar productos", async () => {
    const { from } = mockSupabase([BARBER]);

    const result = await updateProductAction("p1", { price: 1 });

    expect(result).toEqual(ACCESO_DENEGADO);
    expect(from).toHaveBeenCalledTimes(1);
  });
});

describe("toggleProductStatusAction", () => {
  it("el dueño desactiva un producto con el estado destino explícito", async () => {
    const { builders } = mockSupabase([
      OWNER,
      { data: { ...PRODUCT, is_active: false }, error: null },
    ]);

    const result = await toggleProductStatusAction("p1", false);

    expect(builders[1].update).toHaveBeenCalledWith({ is_active: false });
    expect(result.success).toBe(true);
  });

  it("un barbero no puede activar/desactivar productos", async () => {
    mockSupabase([BARBER]);

    const result = await toggleProductStatusAction("p1", false);

    expect(result).toEqual(ACCESO_DENEGADO);
  });

  it("sin perfil (no autenticado) también se deniega", async () => {
    mockSupabase([{ data: null, error: null }]);

    const result = await toggleProductStatusAction("p1", true);

    expect(result).toEqual(ACCESO_DENEGADO);
  });
});
