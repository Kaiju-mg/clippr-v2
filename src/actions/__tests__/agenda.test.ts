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

function mockSupabase(builders: Record<string, QueryBuilderMock<unknown>>) {
  const from = vi.fn((table: string) => builders[table]);
  vi.mocked(createClient).mockResolvedValue({
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from };
}

// "Ahora" fijo para los tests de cobro: miércoles 16/09/2026 10:12 en
// Paraguay (UTC-3).
const AHORA = new Date("2026-09-16T13:12:00.000Z");

const CASH_SESSION_ABIERTA = { id: "cs1", status: "open" };
const CASH_SESSION_CERRADA = { id: "cs1", status: "closed" };
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

function turnoAgendado(startTime: string) {
  return { id: "apt1", service_id: "svc1", status: "scheduled", start_time: startTime };
}

/** Arma los builders de un cobro completo; el select y el update de appointments comparten builder. */
function mockCobro(startTime: string, transactionsError: { message: string } | null = null) {
  const cashSessionsBuilder = createBuilder({ data: CASH_SESSION_ABIERTA, error: null });
  const appointmentsBuilder = createBuilder<unknown>({ data: null, error: null });
  appointmentsBuilder.maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({ data: turnoAgendado(startTime), error: null })
    .mockResolvedValueOnce({ data: { ...APPOINTMENT, status: "completed" }, error: null });
  const servicesBuilder = createBuilder({ data: SERVICIO_ACTIVO, error: null });
  const transactionsBuilder = createBuilder({ data: null, error: transactionsError });
  mockSupabase({
    cash_sessions: cashSessionsBuilder,
    appointments: appointmentsBuilder,
    services: servicesBuilder,
    transactions: transactionsBuilder,
  });
  return { appointmentsBuilder, transactionsBuilder };
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
    const appointmentsBuilder = createBuilder({ data: [APPOINTMENT], error: null });
    mockSupabase({ appointments: appointmentsBuilder });

    const result = await getAgendaAction("2026-09-16");

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
    const appointmentsBuilder = createBuilder({ data: null, error: { message: "boom" } });
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
      services: createBuilder({ data: { ...SERVICIO_ACTIVO, is_active: false }, error: null }),
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
    const appointmentsBuilder = createBuilder({ data: APPOINTMENT, error: null });
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
    const appointmentsBuilder = createBuilder({ data: APPOINTMENT, error: null });
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

describe("completeScheduledAppointmentAction — caja y turno", () => {
  it("rechaza si la caja no está abierta", async () => {
    mockSupabase({
      cash_sessions: createBuilder({ data: CASH_SESSION_CERRADA, error: null }),
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "Debes abrir tu caja diaria antes de cobrar un corte.",
    });
  });

  it("rechaza si el turno no existe (o es de otro barbero vía RLS)", async () => {
    mockSupabase({
      cash_sessions: createBuilder({ data: CASH_SESSION_ABIERTA, error: null }),
      appointments: createBuilder({ data: null, error: null }),
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "Turno no encontrado o ya fue actualizado.",
    });
  });

  it("rechaza si el turno ya fue completado o cancelado", async () => {
    mockSupabase({
      cash_sessions: createBuilder({ data: CASH_SESSION_ABIERTA, error: null }),
      appointments: createBuilder({
        data: { ...turnoAgendado(APPOINTMENT.start_time), status: "cancelled" },
        error: null,
      }),
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "Turno no encontrado o ya fue actualizado.",
    });
  });

  it("rechaza cobrar un turno de un día futuro (en hora de Paraguay)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHORA);
    const { appointmentsBuilder, transactionsBuilder } = mockCobro(
      "2026-09-17T12:00:00.000Z", // jueves 09:00 en Paraguay
    );

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "No podés cobrar un turno de un día futuro.",
    });
    expect(appointmentsBuilder.update).not.toHaveBeenCalled();
    expect(transactionsBuilder.insert).not.toHaveBeenCalled();
  });
});

describe("completeScheduledAppointmentAction — cobro", () => {
  it("cobrado antes de la hora agendada: corre start_time a ahora - duración", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHORA);
    const { appointmentsBuilder, transactionsBuilder } = mockCobro(
      "2026-09-16T18:00:00.000Z", // turno de las 15:00, cobrado a las 10:12
    );

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(appointmentsBuilder.update).toHaveBeenCalledWith({
      status: "completed",
      end_time: "2026-09-16T13:12:00.000Z",
      start_time: "2026-09-16T12:52:00.000Z",
    });
    expect(transactionsBuilder.insert).toHaveBeenCalledWith({
      cash_session_id: "cs1",
      type: "income",
      amount: SERVICIO_ACTIVO.price,
      description: `Corte: ${SERVICIO_ACTIVO.name}`,
    });
    expect(result.success).toBe(true);
  });

  it("cobrado después de la hora agendada: no toca start_time", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHORA);
    const { appointmentsBuilder } = mockCobro("2026-09-16T12:30:00.000Z");

    await completeScheduledAppointmentAction("apt1", "cs1");

    expect(appointmentsBuilder.update).toHaveBeenCalledWith({
      status: "completed",
      end_time: "2026-09-16T13:12:00.000Z",
    });
  });

  it("avisa del desfase si el turno se actualiza pero falla la transacción", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AHORA);
    mockCobro("2026-09-16T12:30:00.000Z", { message: "boom" });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error:
        "El corte se guardó, pero no se pudo reflejar en la caja. Avisá para revisar el desfase.",
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

    expect(appointmentsBuilder.update).toHaveBeenCalledWith({ status: "cancelled" });
    expect(result).toEqual({ success: true, data: cancelled });
  });
});
