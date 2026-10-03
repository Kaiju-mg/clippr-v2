import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import type { Appointment } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  getAgendaAction,
  scheduleAppointmentAction,
  completeScheduledAppointmentAction,
  cancelAppointmentAction,
} from "../agenda.actions";

interface MockResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface QueryBuilderMock<T> {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  in: ReturnType<typeof vi.fn>;
  gte: ReturnType<typeof vi.fn>;
  lt: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (onfulfilled: (value: MockResult<T>) => unknown) => Promise<unknown>;
}

/**
 * Mismo patrón que walkin.test.ts: cada método intermedio devuelve el
 * mismo builder, y single/maybeSingle (o `then`, para getAgendaAction que
 * no encadena ninguno de los dos) resuelven al resultado configurado.
 */
function createBuilder<T>(result: MockResult<T>): QueryBuilderMock<T> {
  const builder: QueryBuilderMock<T> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    gte: vi.fn(() => builder),
    lt: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onfulfilled) => Promise.resolve(result).then(onfulfilled),
  };
  return builder;
}

const PERFIL = { id: "user-1" };

/**
 * `users` se resuelve siempre al perfil propio: desde la spec 08,
 * getAgendaAction filtra la agenda por `user_id` a mano (RLS pasó a dejar
 * que el dueño lea los turnos de todo el equipo).
 */
function mockSupabase(builders: Record<string, QueryBuilderMock<unknown>>) {
  const usersBuilder = createBuilder<typeof PERFIL>({
    data: PERFIL,
    error: null,
  });
  const from = vi.fn(
    (table: string) =>
      builders[table] ??
      (table === "users"
        ? (usersBuilder as QueryBuilderMock<unknown>)
        : undefined),
  );
  vi.mocked(createClient).mockResolvedValue({
    from,
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "auth-1" } } })),
    },
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from };
}

// "Ahora" fijo para los tests de cobro: miércoles 16/09/2026 10:12 en
// Paraguay (UTC-3).
const AHORA = new Date("2026-09-16T13:12:00.000Z");

const SERVICIO_ACTIVO = {
  id: "svc1",
  name: "Corte Clásico",
  price: 30000,
  duration_minutes: 20,
  is_active: true,
};

const APPOINTMENT: Appointment = {
  id: "apt1",
  barbershop_id: "b1",
  user_id: "user-1",
  service_id: "svc1",
  client_name: "Juan",
  start_time: "2026-09-16T18:00:00.000Z",
  end_time: "2026-09-16T18:20:00.000Z",
  status: "scheduled",
};

/**
 * Desde la spec 09, cobrar un turno agendado es una sola llamada:
 * `supabase.rpc("complete_appointment_and_charge", ...).single()`. El update
 * de `appointments` y el insert de `transactions` pasaron a la base, dentro
 * de una transacción, así que acá solo se verifica qué se le manda al RPC y
 * cómo se traduce lo que devuelve.
 */
function mockRpc(result: {
  data: unknown;
  error: { message: string; code?: string; details?: string } | null;
}) {
  const single = vi.fn(async () => result);
  const rpc = vi.fn(() => ({ single }));
  vi.mocked(createClient).mockResolvedValue({
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getAgendaAction", () => {
  it("rechaza una fecha con formato inválido sin tocar la base", async () => {
    const result = await getAgendaAction("20-09-2026");

    expect(result).toEqual({ success: false, error: "La fecha no es válida." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("filtra por el día de Paraguay (00:00 a 00:00 del día siguiente), ordenado por start_time", async () => {
    const appointmentsBuilder = createBuilder({
      data: [APPOINTMENT],
      error: null,
    });
    mockSupabase({ appointments: appointmentsBuilder });

    const result = await getAgendaAction("2026-09-16");

    // La agenda es personal: el filtro por user_id se hace acá, no sólo con
    // RLS (que desde la spec 08 deja al dueño ver los turnos del equipo).
    expect(appointmentsBuilder.eq).toHaveBeenCalledWith("user_id", PERFIL.id);
    expect(appointmentsBuilder.in).toHaveBeenCalledWith("status", [
      "scheduled",
      "completed",
      "cancelled",
    ]);
    expect(appointmentsBuilder.gte).toHaveBeenCalledWith(
      "start_time",
      "2026-09-16T03:00:00.000Z",
    );
    expect(appointmentsBuilder.lt).toHaveBeenCalledWith(
      "start_time",
      "2026-09-17T03:00:00.000Z",
    );
    expect(appointmentsBuilder.order).toHaveBeenCalledWith("start_time", {
      ascending: true,
    });
    expect(result).toEqual({ success: true, data: [APPOINTMENT] });
  });

  it("devuelve un error genérico si falla la consulta", async () => {
    const appointmentsBuilder = createBuilder({
      data: null,
      error: { message: "boom" },
    });
    mockSupabase({ appointments: appointmentsBuilder });

    const result = await getAgendaAction("2026-09-16");

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("scheduleAppointmentAction — validación", () => {
  it("rechaza un nombre de cliente vacío", async () => {
    const result = await scheduleAppointmentAction({
      clientName: "   ",
      serviceId: "svc1",
      dateISO: "2026-09-16",
      time: "15:00",
    });

    expect(result).toEqual({
      success: false,
      error: "El nombre del cliente es obligatorio.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it.each([
    ["fecha inválida", "2026-02-30", "15:00"],
    ["hora inválida", "2026-09-16", "25:00"],
  ])("rechaza %s", async (_caso, dateISO, time) => {
    const result = await scheduleAppointmentAction({
      clientName: "Juan",
      serviceId: "svc1",
      dateISO,
      time,
    });

    expect(result).toEqual({
      success: false,
      error: "El horario de inicio del turno no es válido.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("scheduleAppointmentAction — servicio", () => {
  it("rechaza si el servicio no existe", async () => {
    mockSupabase({ services: createBuilder({ data: null, error: null }) });

    const result = await scheduleAppointmentAction({
      clientName: "Juan",
      serviceId: "svc1",
      dateISO: "2026-09-16",
      time: "15:00",
    });

    expect(result).toEqual({
      success: false,
      error: "Servicio no encontrado o inactivo.",
    });
  });

  it("rechaza si el servicio está inactivo", async () => {
    mockSupabase({
      services: createBuilder({
        data: { ...SERVICIO_ACTIVO, is_active: false },
        error: null,
      }),
    });

    const result = await scheduleAppointmentAction({
      clientName: "Juan",
      serviceId: "svc1",
      dateISO: "2026-09-16",
      time: "15:00",
    });

    expect(result).toEqual({
      success: false,
      error: "Servicio no encontrado o inactivo.",
    });
  });
});

describe("scheduleAppointmentAction — happy path", () => {
  it("arma el instante en hora de Paraguay, suma la duración y recorta el nombre", async () => {
    const appointmentsBuilder = createBuilder({
      data: APPOINTMENT,
      error: null,
    });
    mockSupabase({
      services: createBuilder({ data: SERVICIO_ACTIVO, error: null }),
      appointments: appointmentsBuilder,
    });

    const result = await scheduleAppointmentAction({
      clientName: "  Juan  ",
      serviceId: "svc1",
      dateISO: "2026-09-16",
      time: "15:00",
    });

    expect(appointmentsBuilder.insert).toHaveBeenCalledWith({
      service_id: "svc1",
      client_name: "Juan",
      start_time: "2026-09-16T18:00:00.000Z",
      end_time: "2026-09-16T18:20:00.000Z",
      status: "scheduled",
    });
    expect(result).toEqual({ success: true, data: APPOINTMENT });
  });

  it("un turno a las 21:30 queda dentro del rango del mismo día de Paraguay", async () => {
    const appointmentsBuilder = createBuilder({
      data: APPOINTMENT,
      error: null,
    });
    mockSupabase({
      services: createBuilder({ data: SERVICIO_ACTIVO, error: null }),
      appointments: appointmentsBuilder,
    });

    await scheduleAppointmentAction({
      clientName: "Pedro",
      serviceId: "svc1",
      dateISO: "2026-09-16",
      time: "21:30",
    });

    const { start_time } = appointmentsBuilder.insert.mock.calls[0][0];
    expect(start_time).toBe("2026-09-17T00:30:00.000Z");
    // Rango de getAgendaAction("2026-09-16"): [03:00Z del 16, 03:00Z del 17)
    expect(start_time >= "2026-09-16T03:00:00.000Z").toBe(true);
    expect(start_time < "2026-09-17T03:00:00.000Z").toBe(true);
  });
});

describe("completeScheduledAppointmentAction — llamada al RPC", () => {
  it("manda el turno, la caja y el fin del día de Paraguay como tope", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHORA);
    const { rpc } = mockRpc({
      data: { ...APPOINTMENT, status: "completed" },
      error: null,
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    // La zona horaria se resuelve acá (src/lib/dates.ts) y viaja como
    // instante: el SQL no sabe nada de America/Asuncion. El miércoles
    // 16/09 termina a las 03:00Z del 17.
    expect(rpc).toHaveBeenCalledWith("complete_appointment_and_charge", {
      p_appointment_id: "apt1",
      p_cash_session_id: "cs1",
      p_max_start_time: "2026-09-17T03:00:00.000Z",
    });
    expect(result).toEqual({
      success: true,
      data: { ...APPOINTMENT, status: "completed" },
    });
  });

  it("nunca manda el monto: el precio lo lee la base", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHORA);
    const { rpc } = mockRpc({ data: APPOINTMENT, error: null });

    await completeScheduledAppointmentAction("apt1", "cs1");

    const params = (
      rpc.mock.calls[0] as unknown as [string, Record<string, unknown>]
    )[1];
    expect(params).not.toHaveProperty("p_amount");
  });
});

describe("completeScheduledAppointmentAction — errores de negocio del RPC", () => {
  it("traduce CL001 (caja ajena, inexistente o cerrada)", async () => {
    mockRpc({
      data: null,
      error: { message: "Caja inexistente, ajena o cerrada", code: "CL001" },
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "Debes abrir tu caja diaria antes de cobrar un corte.",
    });
  });

  it("traduce CL004 (turno inexistente, ajeno o ya resuelto)", async () => {
    mockRpc({
      data: null,
      error: { message: "Turno no encontrado o ya actualizado", code: "CL004" },
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "Turno no encontrado o ya fue actualizado.",
    });
  });

  it("traduce CL007 (turno de un día futuro)", async () => {
    mockRpc({
      data: null,
      error: { message: "Turno de un día futuro", code: "CL007" },
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "No podés cobrar un turno de un día futuro.",
    });
  });

  it("ya no existe el caso 'turno cobrado sin ingreso': el RPC revierte todo", async () => {
    // Antes de la spec 09, un fallo al insertar la transacción dejaba el
    // turno en 'completed' y devolvía "El corte se guardó, pero...". Ahora
    // la transacción de Postgres revierte también el update del turno.
    mockRpc({
      data: null,
      error: { message: "error al insertar transactions", code: "XX000" },
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("cancelAppointmentAction", () => {
  it("rechaza si el turno no existe, es ajeno, o ya fue resuelto", async () => {
    mockSupabase({ appointments: createBuilder({ data: null, error: null }) });

    const result = await cancelAppointmentAction("apt1");

    expect(result).toEqual({
      success: false,
      error: "Turno no encontrado o ya fue actualizado.",
    });
  });

  it("cancela un turno agendado", async () => {
    const cancelled = { ...APPOINTMENT, status: "cancelled" as const };
    const appointmentsBuilder = createBuilder({ data: cancelled, error: null });
    mockSupabase({ appointments: appointmentsBuilder });

    const result = await cancelAppointmentAction("apt1");

    expect(appointmentsBuilder.update).toHaveBeenCalledWith({
      status: "cancelled",
    });
    expect(result).toEqual({ success: true, data: cancelled });
  });
});
