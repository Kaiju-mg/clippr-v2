import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { getMonthTicketAction, getStampCardAction } from "../stats.actions";

type Result = { data: unknown; error: { message: string } | null };
type Responder = (table: string, columns: string) => Result;

/**
 * Un builder nuevo por `.from()`, que responde según la tabla y las columnas
 * pedidas: `cash_sessions` se consulta para los días trabajados
 * (`id, start_time`) y para lo cobrado (`id, user_id`).
 */
function mock(responder: Responder) {
  const calls: { table: string; columns: string; filters: unknown[][] }[] = [];
  const from = vi.fn((table: string) => {
    const call = { table, columns: "", filters: [] as unknown[][] };
    calls.push(call);
    const b: Record<string, unknown> = {};
    for (const m of ["eq", "gte", "lt", "in", "or", "order"]) {
      b[m] = vi.fn((...args: unknown[]) => {
        call.filters.push([m, ...args]);
        return b;
      });
    }
    b.select = vi.fn((columns: string) => {
      call.columns = columns;
      return b;
    });
    b.maybeSingle = vi.fn(async () => responder(table, call.columns));
    b.then = (ok: (v: Result) => unknown) =>
      Promise.resolve(responder(table, call.columns)).then(ok);
    return b;
  });
  vi.mocked(createClient).mockResolvedValue({
    from,
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "auth" } } })) },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return calls;
}

const PERFIL = {
  id: "u1",
  name: "Caillu Pérez",
  role: "barber",
  level: "junior",
  streak_count: 3,
};

/** Septiembre: cortes el 12 (x2) y el 13, cajas con cobro el 12 y el 13. */
function septiembre(
  overrides: Partial<Record<string, Result>> = {},
): Responder {
  return (table, columns) => {
    const key = `${table}:${columns}`;
    const override = overrides[key];
    if (override) return override;
    switch (key) {
      case "users:id, name, role, level, streak_count":
        return { data: PERFIL, error: null };
      case "appointments:start_time, services(name)":
        return {
          data: [
            {
              start_time: "2026-09-12T14:00:00.000Z",
              services: { name: "Corte clásico" },
            },
            {
              start_time: "2026-09-12T16:00:00.000Z",
              services: { name: "Corte clásico" },
            },
            {
              start_time: "2026-09-13T14:00:00.000Z",
              services: { name: "Barba" },
            },
          ],
          error: null,
        };
      case "cash_sessions:id, start_time":
        return {
          data: [
            { id: "cs12", start_time: "2026-09-12T11:00:00.000Z" },
            { id: "cs13", start_time: "2026-09-13T11:00:00.000Z" },
          ],
          error: null,
        };
      case "transactions:cash_session_id":
        return {
          data: [{ cash_session_id: "cs12" }, { cash_session_id: "cs13" }],
          error: null,
        };
      case "cash_sessions:id, user_id":
        return {
          data: [
            { id: "cs12", user_id: "u1" },
            { id: "cs13", user_id: "u1" },
          ],
          error: null,
        };
      case "transactions:cash_session_id, amount, category":
        return {
          data: [
            { cash_session_id: "cs12", amount: 100000, category: "service" },
            { cash_session_id: "cs13", amount: 30000, category: "product" },
          ],
          error: null,
        };
      case "barbershops:name, phone":
        return {
          data: { name: "El Poste", phone: "0981 123 456" },
          error: null,
        };
      default:
        throw new Error(`consulta inesperada: ${key}`);
    }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getMonthTicketAction — el ticket del mes anterior", () => {
  it("del 1 al 7, arma el resumen del mes anterior en el servidor", async () => {
    const calls = mock(septiembre());

    const result = await getMonthTicketAction("2026-10-03");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      month: {
        monthStartISO: "2026-09-01",
        cuts: 3,
        topService: { name: "Corte clásico", count: 2 },
        bestDay: { dateISO: "2026-09-12", cuts: 2 },
        longestStreak: 2,
        income: 130000,
      },
      barberName: "Caillu Pérez",
      barbershopName: "El Poste",
      phone: "0981 123 456",
    });

    // Septiembre entero, en la zona del negocio, y sólo lo del barbero.
    const cortes = calls.find((c) => c.table === "appointments")!;
    expect(cortes.filters).toContainEqual(["eq", "user_id", "u1"]);
    expect(cortes.filters).toContainEqual([
      "gte",
      "start_time",
      "2026-09-01T03:00:00.000Z",
    ]);
    expect(cortes.filters).toContainEqual([
      "lt",
      "start_time",
      "2026-10-01T03:00:00.000Z",
    ]);
  });

  it("después del día 7 no muestra nada (ni consulta la base)", async () => {
    const calls = mock(septiembre());
    const result = await getMonthTicketAction("2026-10-08");
    expect(result).toEqual({ success: true, data: null });
    expect(calls).toHaveLength(0);
  });

  it("un mes sin cortes ni días trabajados no tiene ticket", async () => {
    mock(
      septiembre({
        "appointments:start_time, services(name)": { data: [], error: null },
        "cash_sessions:id, start_time": { data: [], error: null },
        "cash_sessions:id, user_id": { data: [], error: null },
      }),
    );
    const result = await getMonthTicketAction("2026-10-01");
    expect(result).toEqual({ success: true, data: null });
  });

  it("si falla una consulta, error (no un ticket con números a medias)", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock(
      septiembre({
        "appointments:start_time, services(name)": {
          data: null,
          error: { message: "timeout" },
        },
      }),
    );
    const result = await getMonthTicketAction("2026-10-01");
    expect(result.success).toBe(false);
  });
});

describe("getStampCardAction — tarjeta de sellos del mes", () => {
  it("marca los días trabajados del mes en curso, con la racha de cada uno", async () => {
    const calls = mock((table, columns) => {
      if (table === "users") return { data: PERFIL, error: null };
      if (table === "cash_sessions")
        return {
          data: [
            { id: "a", start_time: "2026-09-30T11:00:00.000Z" },
            { id: "b", start_time: "2026-10-01T11:00:00.000Z" },
            { id: "c", start_time: "2026-10-02T11:00:00.000Z" },
          ],
          error: null,
        };
      if (table === "transactions" && columns === "cash_session_id")
        return {
          data: [
            { cash_session_id: "a" },
            { cash_session_id: "b" },
            { cash_session_id: "c" },
          ],
          error: null,
        };
      throw new Error(`consulta inesperada: ${table}:${columns}`);
    });

    const result = await getStampCardAction("2026-10-04");

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.monthStartISO).toBe("2026-10-01");
    expect(result.data.days).toHaveLength(31);
    // El 30/9 suma a la racha: el 1/10 ya es el día 2.
    expect(result.data.days[0]).toMatchObject({
      day: 1,
      worked: true,
      streak: 2,
    });
    expect(result.data.days[1]).toMatchObject({
      day: 2,
      worked: true,
      streak: 3,
    });
    expect(result.data.days[2]).toMatchObject({ day: 3, worked: false });

    // Mira 90 días antes del 1° (para la racha) y sólo las cajas propias.
    const cajas = calls.find((c) => c.table === "cash_sessions")!;
    expect(cajas.filters).toContainEqual(["eq", "user_id", "u1"]);
    expect(cajas.filters).toContainEqual(["eq", "status", "closed"]);
    expect(cajas.filters).toContainEqual([
      "gte",
      "start_time",
      "2026-07-03T03:00:00.000Z",
    ]);
  });

  it("si falla la consulta, error y la pantalla no la muestra", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mock((table) =>
      table === "users"
        ? { data: PERFIL, error: null }
        : { data: null, error: { message: "timeout" } },
    );
    const result = await getStampCardAction("2026-10-04");
    expect(result.success).toBe(false);
  });
});
