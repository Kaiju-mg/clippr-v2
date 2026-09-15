import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import type { Appointment } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { completeWalkinAction } from "../walkin.actions";

interface MockResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface QueryBuilderMock<T> {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (onfulfilled: (value: MockResult<T>) => unknown) => Promise<unknown>;
}

/**
 * Simula el query builder encadenable de supabase-js, mismo patrón que
 * service.test.ts / cash.test.ts: cada método intermedio devuelve el mismo
 * builder, y single/maybeSingle (o el propio builder vía `then`, para el
 * insert de transactions que no encadena select) resuelven al resultado
 * configurado.
 */
function createBuilder<T>(result: MockResult<T>): QueryBuilderMock<T> {
  const builder: QueryBuilderMock<T> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onfulfilled) => Promise.resolve(result).then(onfulfilled),
  };
  return builder;
}

/**
 * completeWalkinAction toca cuatro tablas distintas (cash_sessions,
 * services, appointments, transactions); cada test arma solo los builders
 * que necesita, el resto queda undefined a propósito (si el código llegara
 * a tocarlos sin querer, el test explota con un error claro).
 */
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
  is_active: true,
};

const APPOINTMENT: Appointment = {
  id: "apt1",
  barbershop_id: "b1",
  user_id: "user-1",
  service_id: "svc1",
  client_name: null,
  start_time: "2026-09-15T10:00:00.000Z",
  end_time: "2026-09-15T10:20:00.000Z",
  status: "completed",
};

const PAYLOAD_VALIDO = {
  serviceId: "svc1",
  cashSessionId: "cs1",
  startTime: "2026-09-15T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("completeWalkinAction — validación de startTime", () => {
  it("rechaza un startTime que no es una fecha válida", async () => {
    const result = await completeWalkinAction({
      ...PAYLOAD_VALIDO,
      startTime: "no-es-una-fecha",
    });

    expect(result).toEqual({
      success: false,
      error: "El horario de inicio del turno no es válido.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza un startTime en el futuro", async () => {
    const enElFuturo = new Date(Date.now() + 60_000).toISOString();

    const result = await completeWalkinAction({
      ...PAYLOAD_VALIDO,
      startTime: enElFuturo,
    });

    expect(result).toEqual({
      success: false,
      error: "El horario de inicio del turno no es válido.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("completeWalkinAction — caja", () => {
  it("rechaza si la caja no existe (o RLS la bloquea por ser de otro barbero)", async () => {
    const cashSessionsBuilder = createBuilder({ data: null, error: null });
    mockSupabase({ cash_sessions: cashSessionsBuilder });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "Debes abrir tu caja diaria antes de cobrar un corte.",
    });
  });

  it("rechaza si la caja ya está cerrada", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_CERRADA,
      error: null,
    });
    mockSupabase({ cash_sessions: cashSessionsBuilder });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "Debes abrir tu caja diaria antes de cobrar un corte.",
    });
  });
});

describe("completeWalkinAction — servicio", () => {
  it("rechaza si el servicio no existe", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_ABIERTA,
      error: null,
    });
    const servicesBuilder = createBuilder({ data: null, error: null });
    mockSupabase({
      cash_sessions: cashSessionsBuilder,
      services: servicesBuilder,
    });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "Servicio no encontrado o inactivo.",
    });
  });

  it("rechaza si el servicio está inactivo", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_ABIERTA,
      error: null,
    });
    const servicesBuilder = createBuilder({
      data: { ...SERVICIO_ACTIVO, is_active: false },
      error: null,
    });
    mockSupabase({
      cash_sessions: cashSessionsBuilder,
      services: servicesBuilder,
    });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "Servicio no encontrado o inactivo.",
    });
  });
});

describe("completeWalkinAction — happy path y errores", () => {
  it("usa service.price del servidor, ignorando cualquier monto que mande el cliente", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_ABIERTA,
      error: null,
    });
    const servicesBuilder = createBuilder({
      data: SERVICIO_ACTIVO,
      error: null,
    });
    const appointmentsBuilder = createBuilder({
      data: APPOINTMENT,
      error: null,
    });
    const transactionsBuilder = createBuilder({ data: null, error: null });
    mockSupabase({
      cash_sessions: cashSessionsBuilder,
      services: servicesBuilder,
      appointments: appointmentsBuilder,
      transactions: transactionsBuilder,
    });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    const appointmentPayload = appointmentsBuilder.insert.mock.calls[0][0];
    expect(appointmentPayload).toMatchObject({
      service_id: "svc1",
      client_name: null,
      start_time: PAYLOAD_VALIDO.startTime,
      status: "completed",
    });
    expect(appointmentPayload).not.toHaveProperty("user_id");
    expect(appointmentPayload).not.toHaveProperty("barbershop_id");
    expect(appointmentPayload).not.toHaveProperty("amount");

    expect(transactionsBuilder.insert).toHaveBeenCalledWith({
      cash_session_id: "cs1",
      type: "income",
      amount: SERVICIO_ACTIVO.price,
      description: `Corte: ${SERVICIO_ACTIVO.name}`,
    });

    expect(result).toEqual({ success: true, data: APPOINTMENT });
  });

  it("manda el client_name recortado cuando viene en el payload", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_ABIERTA,
      error: null,
    });
    const servicesBuilder = createBuilder({
      data: SERVICIO_ACTIVO,
      error: null,
    });
    const appointmentsBuilder = createBuilder({
      data: APPOINTMENT,
      error: null,
    });
    const transactionsBuilder = createBuilder({ data: null, error: null });
    mockSupabase({
      cash_sessions: cashSessionsBuilder,
      services: servicesBuilder,
      appointments: appointmentsBuilder,
      transactions: transactionsBuilder,
    });

    await completeWalkinAction({
      ...PAYLOAD_VALIDO,
      clientName: "  Juan  ",
    });

    expect(appointmentsBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ client_name: "Juan" }),
    );
  });

  it("devuelve un error genérico si falla el insert de appointments", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_ABIERTA,
      error: null,
    });
    const servicesBuilder = createBuilder({
      data: SERVICIO_ACTIVO,
      error: null,
    });
    const appointmentsBuilder = createBuilder({
      data: null,
      error: { message: "boom" },
    });
    mockSupabase({
      cash_sessions: cashSessionsBuilder,
      services: servicesBuilder,
      appointments: appointmentsBuilder,
    });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });

  it("avisa del desfase si el appointment se guarda pero falla la transacción", async () => {
    const cashSessionsBuilder = createBuilder({
      data: CASH_SESSION_ABIERTA,
      error: null,
    });
    const servicesBuilder = createBuilder({
      data: SERVICIO_ACTIVO,
      error: null,
    });
    const appointmentsBuilder = createBuilder({
      data: APPOINTMENT,
      error: null,
    });
    const transactionsBuilder = createBuilder({
      data: null,
      error: { message: "boom" },
    });
    mockSupabase({
      cash_sessions: cashSessionsBuilder,
      services: servicesBuilder,
      appointments: appointmentsBuilder,
      transactions: transactionsBuilder,
    });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error:
        "El corte se guardó, pero no se pudo reflejar en la caja. Avisá para revisar el desfase.",
    });
  });
});
