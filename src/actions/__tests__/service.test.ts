import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  getServicesAction,
  createServiceAction,
  updateServiceAction,
  toggleServiceStatusAction,
} from "../service.actions";

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

/**
 * Simula el query builder encadenable de supabase-js: cada método
 * intermedio (select/insert/update/eq/order) devuelve el mismo builder, y
 * tanto `single`/`maybeSingle` como el propio builder (vía `then`, igual
 * que el PostgrestFilterBuilder real) resuelven al resultado configurado.
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

function mockSupabaseFrom<T>(builder: QueryBuilderMock<T>) {
  const from = vi.fn(() => builder);
  vi.mocked(createClient).mockResolvedValue({
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return from;
}

const SERVICE: Service = {
  id: "s1",
  barbershop_id: "b1",
  name: "Corte Clásico",
  price: 5000,
  duration_minutes: 30,
  is_active: true,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getServicesAction", () => {
  it("devuelve todos los servicios (activos e inactivos) ordenados", async () => {
    const inactive = { ...SERVICE, id: "s2", name: "Barba", is_active: false };
    const builder = createBuilder<Service[]>({
      data: [SERVICE, inactive],
      error: null,
    });
    const from = mockSupabaseFrom(builder);

    const result = await getServicesAction();

    expect(from).toHaveBeenCalledWith("services");
    expect(builder.order).toHaveBeenCalledWith("is_active", {
      ascending: false,
    });
    expect(builder.order).toHaveBeenCalledWith("name");
    expect(result).toEqual({ success: true, data: [SERVICE, inactive] });
  });

  it("devuelve un error legible si supabase falla", async () => {
    const builder = createBuilder<Service[]>({
      data: null,
      error: { message: "boom" },
    });
    mockSupabaseFrom(builder);

    const result = await getServicesAction();

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("createServiceAction — validaciones", () => {
  it("rechaza un nombre vacío", async () => {
    const result = await createServiceAction({
      name: "   ",
      price: 100,
      duration_minutes: 30,
    });

    expect(result).toEqual({
      success: false,
      error: "El nombre del servicio es obligatorio.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza un precio negativo o cero", async () => {
    const result = await createServiceAction({
      name: "Corte",
      price: -500,
      duration_minutes: 30,
    });

    expect(result).toEqual({
      success: false,
      error: "El precio debe ser un número entero mayor a cero.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza un precio con decimales (el guaraní no tiene centavos)", async () => {
    const result = await createServiceAction({
      name: "Corte",
      price: 5000.5,
      duration_minutes: 30,
    });

    expect(result).toEqual({
      success: false,
      error: "El precio debe ser un número entero mayor a cero.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza una duración negativa", async () => {
    const result = await createServiceAction({
      name: "Corte",
      price: 100,
      duration_minutes: -10,
    });

    expect(result).toEqual({
      success: false,
      error: "La duración debe ser un número entero de minutos mayor a cero.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("createServiceAction — happy path y errores de servidor", () => {
  it("crea el servicio con el payload recortado, sin mandar barbershop_id", async () => {
    const builder = createBuilder<Service>({ data: SERVICE, error: null });
    mockSupabaseFrom(builder);

    const result = await createServiceAction({
      name: "  Corte Clásico  ",
      price: 5000,
      duration_minutes: 30,
    });

    expect(builder.insert).toHaveBeenCalledWith({
      name: "Corte Clásico",
      price: 5000,
      duration_minutes: 30,
    });
    expect(result).toEqual({ success: true, data: SERVICE });
  });

  it("devuelve un error legible si el insert falla", async () => {
    const builder = createBuilder<Service>({
      data: null,
      error: { message: "boom" },
    });
    mockSupabaseFrom(builder);

    const result = await createServiceAction({
      name: "Corte",
      price: 100,
      duration_minutes: 30,
    });

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("updateServiceAction", () => {
  it("valida solo los campos presentes en el payload parcial", async () => {
    const result = await updateServiceAction("s1", { price: -1 });

    expect(result).toEqual({
      success: false,
      error: "El precio debe ser un número entero mayor a cero.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("actualiza el servicio con el payload parcial", async () => {
    const updated = { ...SERVICE, price: 6000 };
    const builder = createBuilder<Service>({ data: updated, error: null });
    mockSupabaseFrom(builder);

    const result = await updateServiceAction("s1", { price: 6000 });

    expect(builder.update).toHaveBeenCalledWith({ price: 6000 });
    expect(builder.eq).toHaveBeenCalledWith("id", "s1");
    expect(result).toEqual({ success: true, data: updated });
  });

  it("devuelve 'no encontrado' si RLS bloquea la fila (otro tenant)", async () => {
    const builder = createBuilder<Service>({ data: null, error: null });
    mockSupabaseFrom(builder);

    const result = await updateServiceAction("otro-tenant", { price: 100 });

    expect(result).toEqual({
      success: false,
      error: "Servicio no encontrado.",
    });
  });
});

describe("toggleServiceStatusAction", () => {
  it("desactiva un servicio (is_active = false)", async () => {
    const builder = createBuilder<Service>({
      data: { ...SERVICE, is_active: false },
      error: null,
    });
    mockSupabaseFrom(builder);

    const result = await toggleServiceStatusAction("s1", false);

    expect(builder.update).toHaveBeenCalledWith({ is_active: false });
    expect(builder.eq).toHaveBeenCalledWith("id", "s1");
    expect(result).toEqual({
      success: true,
      data: { ...SERVICE, is_active: false },
    });
  });

  it("reactiva un servicio (is_active = true)", async () => {
    const builder = createBuilder<Service>({
      data: { ...SERVICE, is_active: true },
      error: null,
    });
    mockSupabaseFrom(builder);

    const result = await toggleServiceStatusAction("s1", true);

    expect(builder.update).toHaveBeenCalledWith({ is_active: true });
    expect(result).toEqual({
      success: true,
      data: { ...SERVICE, is_active: true },
    });
  });

  it("devuelve 'no encontrado' si RLS bloquea la fila (otro tenant)", async () => {
    const builder = createBuilder<Service>({ data: null, error: null });
    mockSupabaseFrom(builder);

    const result = await toggleServiceStatusAction("otro-tenant", false);

    expect(result).toEqual({
      success: false,
      error: "Servicio no encontrado.",
    });
  });

  it("devuelve un error legible si supabase falla", async () => {
    const builder = createBuilder<Service>({
      data: null,
      error: { message: "boom" },
    });
    mockSupabaseFrom(builder);

    const result = await toggleServiceStatusAction("s1", false);

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("aislamiento de tenant", () => {
  // Nota: esto verifica que las Server Actions nunca arman un filtro manual
  // de barbershop_id (que es justamente la regla no-negociable #2 de
  // CLAUDE.md). No reemplaza una prueba de integración contra Postgres
  // real: la barrera real es la política RLS de la migración
  // (`services_select_same_barbershop`, etc.), que un test con mocks no
  // puede ejercitar. Esa verificación end-to-end requiere aplicar
  // `supabase/migrations/20260914000000_create_services_table.sql` contra
  // el proyecto Supabase linkeado y probar con dos barberías reales.
  it("createServiceAction no manda barbershop_id en el insert", async () => {
    const builder = createBuilder<Service>({ data: SERVICE, error: null });
    mockSupabaseFrom(builder);

    await createServiceAction({
      name: "Corte",
      price: 100,
      duration_minutes: 30,
    });

    const insertPayload = builder.insert.mock.calls[0][0];
    expect(insertPayload).not.toHaveProperty("barbershop_id");
  });

  it("getServicesAction no filtra por barbershop_id a mano (delega en RLS)", async () => {
    const builder = createBuilder<Service[]>({ data: [SERVICE], error: null });
    mockSupabaseFrom(builder);

    await getServicesAction();

    expect(builder.eq).not.toHaveBeenCalled();
    const orderCalls = builder.order.mock.calls;
    expect(orderCalls.some(([column]) => column === "barbershop_id")).toBe(
      false,
    );
  });
});
