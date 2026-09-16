import { describe, expect, it, vi, beforeEach } from "vitest";
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

const CASH_SESSION_ABIERTA = { id: "cs1", status: "open" };
const CASH_SESSION_CERRADA = { id: "cs1", status: "closed" };
const SERVICIO_ACTIVO = {
  id: "svc1",
  name: "Corte Clásico",
  price: 30000,
  duration_minutes: 20,
  is_active: true,
};

const TURNO_AGENDADO = {
  id: "apt1",
  service_id: "svc1",
  status: "scheduled",
};

const APPOINTMENT: Appointment = {
  id: "apt1",
  barbershop_id: "b1",
  user_id: "user-1",
  service_id: "svc1",
  client_name: "Juan",
  start_time: "2026-09-20T13:00:00.000Z",
  end_time: "2026-09-20T13:20:00.000Z",
  status: "scheduled",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getAgendaAction", () => {
  it("rechaza una fecha con formato inválido sin tocar la base", async () => {
    const result = await getAgendaAction("20-09-2026");

    expect(result).toEqual({ success: false, error: "La fecha no es válida." });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("filtra por el rango [00:00, 24:00) UTC del día pedido, ordenado por start_time", async () => {
    const appointmentsBuilder = createBuilder({
      data: [APPOINTMENT],
      error: null,
    });
    mockSupabase({ appointments: appointmentsBuilder });

    const result = await getAgendaAction("2026-09-20");

    expect(appointmentsBuilder.in).toHaveBeenCalledWith("status", [
      "scheduled",
      "completed",
      "cancelled",
    ]);
    expect(appointmentsBuilder.gte).toHaveBeenCalledWith(
      "start_time",
      "2026-09-20T00:00:00.000Z",
    );
    expect(appointmentsBuilder.lt).toHaveBeenCalledWith(
      "start_time",
      "2026-09-21T00:00:00.000Z",
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

    const result = await getAgendaAction("2026-09-20");

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
      startTimeISO: "2026-09-20T13:00:00.000Z",
    });

    expect(result).toEqual({
      success: false,
      error: "El nombre del cliente es obligatorio.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza un startTimeISO que no es una fecha válida", async () => {
    const result = await scheduleAppointmentAction({
      clientName: "Juan",
      serviceId: "svc1",
      startTimeISO: "no-es-una-fecha",
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
    const servicesBuilder = createBuilder({ data: null, error: null });
    mockSupabase({ services: servicesBuilder });

    const result = await scheduleAppointmentAction({
      clientName: "Juan",
      serviceId: "svc1",
      startTimeISO: "2026-09-20T13:00:00.000Z",
    });

    expect(result).toEqual({
      success: false,
      error: "Servicio no encontrado o inactivo.",
    });
  });

  it("rechaza si el servicio está inactivo", async () => {
    const servicesBuilder = createBuilder({
      data: { ...SERVICIO_ACTIVO, is_active: false },
      error: null,
    });
    mockSupabase({ services: servicesBuilder });

    const result = await scheduleAppointmentAction({
      clientName: "Juan",
      serviceId: "svc1",
      startTimeISO: "2026-09-20T13:00:00.000Z",
    });

    expect(result).toEqual({
      success: false,
      error: "Servicio no encontrado o inactivo.",
    });
  });
});

describe("scheduleAppointmentAction — happy path", () => {
  it("calcula end_time sumando la duración del servicio y recorta el nombre del cliente", async () => {
    const servicesBuilder = createBuilder({
      data: SERVICIO_ACTIVO,
      error: null,
    });
    const appointmentsBuilder = createBuilder({
      data: APPOINTMENT,
      error: null,
    });
    mockSupabase({
      services: servicesBuilder,
      appointments: appointmentsBuilder,
    });

    const result = await scheduleAppointmentAction({
      clientName: "  Juan  ",
      serviceId: "svc1",
      startTimeISO: "2026-09-20T13:00:00.000Z",
    });

    expect(appointmentsBuilder.insert).toHaveBeenCalledWith({
      service_id: "svc1",
      client_name: "Juan",
      start_time: "2026-09-20T13:00:00.000Z",
      end_time: "2026-09-20T13:20:00.000Z",
      status: "scheduled",
    });
    expect(result).toEqual({ success: true, data: APPOINTMENT });
  });
});

describe("completeScheduledAppointmentAction — caja", () => {
  it("rechaza si la caja no está abierta", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_CERRADA,
      error: null,
    });
    mockSupabase({ cash_sessions: cashSessionsBuilder });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "Debes abrir tu caja diaria antes de cobrar un corte.",
    });
  });
});

describe("completeScheduledAppointmentAction — turno", () => {
  it("rechaza si el turno no existe (o es de otro barbero vía RLS)", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_ABIERTA,
      error: null,
    });
    const appointmentsBuilder = createBuilder({ data: null, error: null });
    mockSupabase({
      cash_sessions: cashSessionsBuilder,
      appointments: appointmentsBuilder,
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "Turno no encontrado o ya fue actualizado.",
    });
  });

  it("rechaza si el turno ya fue completado o cancelado", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_ABIERTA,
      error: null,
    });
    const appointmentsBuilder = createBuilder({
      data: { ...TURNO_AGENDADO, status: "cancelled" },
      error: null,
    });
    mockSupabase({
      cash_sessions: cashSessionsBuilder,
      appointments: appointmentsBuilder,
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(result).toEqual({
      success: false,
      error: "Turno no encontrado o ya fue actualizado.",
    });
  });
});

describe("completeScheduledAppointmentAction — happy path y errores", () => {
  it("usa service.price del servidor y arma la transacción de ingreso", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_ABIERTA,
      error: null,
    });
    // appointments se usa dos veces: el select inicial y el update final.
    // Ambos devuelven vía maybeSingle, así que un solo builder alcanza.
    const appointmentsBuilder = createBuilder<unknown>({
      data: TURNO_AGENDADO,
      error: null,
    });
    appointmentsBuilder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: TURNO_AGENDADO, error: null })
      .mockResolvedValueOnce({ data: { ...APPOINTMENT, status: "completed" }, error: null });
    const servicesBuilder = createBuilder({
      data: SERVICIO_ACTIVO,
      error: null,
    });
    const transactionsBuilder = createBuilder({ data: null, error: null });
    mockSupabase({
      cash_sessions: cashSessionsBuilder,
      appointments: appointmentsBuilder,
      services: servicesBuilder,
      transactions: transactionsBuilder,
    });

    const result = await completeScheduledAppointmentAction("apt1", "cs1");

    expect(appointmentsBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "completed" }),
    );
    expect(transactionsBuilder.insert).toHaveBeenCalledWith({
      cash_session_id: "cs1",
      type: "income",
      amount: SERVICIO_ACTIVO.price,
      description: `Corte: ${SERVICIO_ACTIVO.name}`,
    });
    expect(result).toEqual({
      success: true,
      data: { ...APPOINTMENT, status: "completed" },
    });
  });

  it("avisa del desfase si el turno se actualiza pero falla la transacción", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_ABIERTA,
      error: null,
    });
    const appointmentsBuilder = createBuilder<unknown>({
      data: TURNO_AGENDADO,
      error: null,
    });
    appointmentsBuilder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: TURNO_AGENDADO, error: null })
      .mockResolvedValueOnce({ data: APPOINTMENT, error: null });
    const servicesBuilder = createBuilder({
      data: SERVICIO_ACTIVO,
      error: null,
    });
    const transactionsBuilder = createBuilder({
      data: null,
      error: { message: "boom" },
    });
    mockSupabase({
      cash_sessions: cashSessionsBuilder,
      appointments: appointmentsBuilder,
      services: servicesBuilder,
      transactions: transactionsBuilder,
    });

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
    const appointmentsBuilder = createBuilder({ data: null, error: null });
    mockSupabase({ appointments: appointmentsBuilder });

    const result = await cancelAppointmentAction("apt1");

    expect(result).toEqual({
      success: false,
      error: "Turno no encontrado o ya fue actualizado.",
    });
  });

  it("cancela un turno agendado", async () => {
    const cancelled = { ...APPOINTMENT, status: "cancelled" as const };
    const appointmentsBuilder = createBuilder({
      data: cancelled,
      error: null,
    });
    mockSupabase({ appointments: appointmentsBuilder });

    const result = await cancelAppointmentAction("apt1");

    expect(appointmentsBuilder.update).toHaveBeenCalledWith({
      status: "cancelled",
    });
    expect(result).toEqual({ success: true, data: cancelled });
  });
});
