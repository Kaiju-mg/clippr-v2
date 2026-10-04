import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import type { CashSession } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      update: () => ({ eq: async () => ({ error: null }) }),
    }),
  }),
}));

import { closeCashSessionAction } from "../cash.actions";

type Result = { data: unknown; error: { message: string } | null; count?: number };

/** Builder encadenable: cualquier filtro devuelve el mismo builder. */
function builder(resolve: () => Result, single?: () => Result) {
  const b: Record<string, unknown> = {};
  for (const method of ["select", "update", "eq", "neq", "in", "gte", "lt", "lte", "order", "limit"]) {
    b[method] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(async () => (single ?? resolve)());
  b.single = vi.fn(async () => (single ?? resolve)());
  b.then = (ok: (value: Result) => unknown) => Promise.resolve(resolve()).then(ok);
  return b as Record<string, ReturnType<typeof vi.fn>> & { then: unknown };
}

const OPEN = { initial_balance: 50000, status: "open" };
const CLOSED: CashSession = {
  id: "cs1",
  barbershop_id: "b1",
  user_id: "user-1",
  start_time: "2026-10-04T11:00:00.000Z",
  end_time: "2026-10-04T23:00:00.000Z",
  initial_balance: 50000,
  final_balance: 210000,
  status: "closed",
};

interface Opciones {
  cortes?: Result;
  barberia?: Result;
}

/**
 * `appointments` se consulta dos veces al cerrar: el conteo de la ventana de
 * niveles (`select("id", { count })`) y los cortes de la imagen
 * (`select("services(name)")`). El builder responde según qué se pidió.
 */
function mockCierre({ cortes, barberia }: Opciones = {}) {
  let cashCalls = 0;
  const cash = builder(
    () => ({ data: [], error: null }),
    () => (cashCalls++ === 0 ? { data: OPEN, error: null } : { data: CLOSED, error: null }),
  );
  const transactions = builder(() => ({
    data: [
      { type: "income", category: "service", amount: 50000 },
      { type: "income", category: "service", amount: 50000 },
      { type: "income", category: "service", amount: 70000 },
      { type: "income", category: "product", amount: 20000 },
      { type: "expense", category: "manual", amount: 30000 },
    ],
    error: null,
  }));
  const users = builder(() => ({
    data: { id: "user-1", name: "Eduardo", streak_count: 0, level: "junior" },
    error: null,
  }));

  // Un builder nuevo por consulta: las dos corren en paralelo.
  const shareQueries: ReturnType<typeof builder>[] = [];
  function appointmentsQuery() {
    let columns = "";
    const query = builder(() =>
      columns === "services(name)"
        ? (cortes ?? {
            data: [
              { services: { name: "Corte clásico" } },
              { services: { name: "Corte + barba" } },
              { services: { name: "Corte clásico" } },
            ],
            error: null,
          })
        : { data: null, error: null, count: 3 },
    );
    query.select = vi.fn((cols: string) => {
      columns = cols;
      if (cols === "services(name)") shareQueries.push(query);
      return query;
    });
    return query;
  }

  const barbershops = builder(
    () => barberia ?? { data: { name: "El Poste", phone: "0981 123 456" }, error: null },
  );

  const from = vi.fn((table: string) => {
    switch (table) {
      case "transactions":
        return transactions;
      case "users":
        return users;
      case "appointments":
        return appointmentsQuery();
      case "barbershops":
        return barbershops;
      default:
        return cash;
    }
  });

  vi.mocked(createClient).mockResolvedValue({
    from,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "auth-1" } } })) },
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  return { shareQueries, barbershops };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("closeCashSessionAction — datos de 'Compartir el día'", () => {
  it("devuelve la barbería, su teléfono y los cortes por servicio", async () => {
    mockCierre();

    const result = await closeCashSessionAction("cs1");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.share).toEqual({
      barbershopName: "El Poste",
      phone: "0981 123 456",
      cutsByService: [
        { name: "Corte clásico", count: 2 },
        { name: "Corte + barba", count: 1 },
      ],
    });
    // Coincide con los cobros de corte del resumen.
    expect(result.data.summary.cuts.count).toBe(3);
  });

  it("los cortes son los del barbero de la caja y dentro de su ventana (la RLS ya no acota al dueño)", async () => {
    const { shareQueries, barbershops } = mockCierre();

    await closeCashSessionAction("cs1");

    expect(shareQueries).toHaveLength(1);
    const [appointments] = shareQueries;
    expect(appointments.eq).toHaveBeenCalledWith("user_id", CLOSED.user_id);
    expect(appointments.eq).toHaveBeenCalledWith("status", "completed");
    expect(appointments.gte).toHaveBeenCalledWith("end_time", CLOSED.start_time);
    expect(appointments.lte).toHaveBeenCalledWith("end_time", CLOSED.end_time);
    expect(barbershops.eq).toHaveBeenCalledWith("id", CLOSED.barbershop_id);
  });

  it("si no se pueden leer los cortes, el cierre sale igual con share null", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCierre({ cortes: { data: null, error: { message: "timeout" } } });

    const result = await closeCashSessionAction("cs1");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.share).toBeNull();
    expect(result.data.session.status).toBe("closed");
  });

  it("si no se puede leer la barbería, share null (sin 'Compartir')", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockCierre({ barberia: { data: null, error: null } });

    const result = await closeCashSessionAction("cs1");

    expect(result.success && result.data.share).toBeNull();
  });

  it("una barbería sin teléfono llega con phone null", async () => {
    mockCierre({ barberia: { data: { name: "El Poste", phone: null }, error: null } });

    const result = await closeCashSessionAction("cs1");

    expect(result.success && result.data.share?.phone).toBeNull();
  });
});
