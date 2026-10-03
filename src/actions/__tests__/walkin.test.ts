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

interface RpcResult {
  data: unknown;
  error: { message: string; code?: string; details?: string } | null;
}

/**
 * Desde la spec 09, `completeWalkinAction` hace una sola llamada:
 * `supabase.rpc("complete_walkin_and_charge", ...).single()`. El mock ya no
 * necesita simular el query builder encadenable de varias tablas — alcanza
 * con devolver lo que resuelve el RPC, que es justamente lo que la
 * migración volvió atómico.
 */
function mockRpc(result: RpcResult) {
  const single = vi.fn(async () => result);
  const rpc = vi.fn(() => ({ single }));
  vi.mocked(createClient).mockResolvedValue({
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { rpc, single };
}

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

describe("completeWalkinAction — llamada al RPC", () => {
  it("manda service_id, caja y start_time, y nunca un monto", async () => {
    const { rpc } = mockRpc({ data: APPOINTMENT, error: null });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(rpc).toHaveBeenCalledTimes(1);
    const [nombre, params] = rpc.mock.calls[0] as unknown as [
      string,
      Record<string, unknown>,
    ];
    expect(nombre).toBe("complete_walkin_and_charge");
    expect(params).toEqual({
      p_service_id: "svc1",
      p_cash_session_id: "cs1",
      p_start_time: PAYLOAD_VALIDO.startTime,
      p_client_name: null,
    });
    // El precio lo lee la base: el cliente no tiene forma de mandarlo.
    expect(params).not.toHaveProperty("p_amount");
    expect(params).not.toHaveProperty("p_user_id");
    expect(params).not.toHaveProperty("p_barbershop_id");

    expect(result).toEqual({ success: true, data: APPOINTMENT });
  });

  it("manda el client_name recortado cuando viene en el payload", async () => {
    const { rpc } = mockRpc({ data: APPOINTMENT, error: null });

    await completeWalkinAction({ ...PAYLOAD_VALIDO, clientName: "  Juan  " });

    expect(rpc).toHaveBeenCalledWith(
      "complete_walkin_and_charge",
      expect.objectContaining({ p_client_name: "Juan" }),
    );
  });

  it("manda null si el client_name viene vacío", async () => {
    const { rpc } = mockRpc({ data: APPOINTMENT, error: null });

    await completeWalkinAction({ ...PAYLOAD_VALIDO, clientName: "   " });

    expect(rpc).toHaveBeenCalledWith(
      "complete_walkin_and_charge",
      expect.objectContaining({ p_client_name: null }),
    );
  });
});

describe("completeWalkinAction — errores de negocio del RPC", () => {
  it("traduce CL001 (caja ajena, inexistente o cerrada) al mensaje de caja", async () => {
    mockRpc({
      data: null,
      error: { message: "Caja inexistente, ajena o cerrada", code: "CL001" },
    });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "Debes abrir tu caja diaria antes de cobrar un corte.",
    });
  });

  it("traduce CL008 (sin sesión) al mismo mensaje de caja", async () => {
    mockRpc({
      data: null,
      error: { message: "No hay sesión autenticada", code: "CL008" },
    });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "Debes abrir tu caja diaria antes de cobrar un corte.",
    });
  });

  it("traduce CL002 (servicio inexistente o inactivo)", async () => {
    mockRpc({
      data: null,
      error: { message: "Servicio no encontrado o inactivo", code: "CL002" },
    });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "Servicio no encontrado o inactivo.",
    });
  });

  it("traduce CL003 (start_time inválido) aunque la validación previa lo deje pasar", async () => {
    mockRpc({
      data: null,
      error: { message: "Horario de inicio inválido", code: "CL003" },
    });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "El horario de inicio del turno no es válido.",
    });
  });

  it("devuelve un error genérico ante cualquier otro fallo", async () => {
    mockRpc({ data: null, error: { message: "boom", code: "08006" } });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });

  it("ya no existe el caso 'corte guardado sin cobrar': el RPC revierte todo", async () => {
    // Antes de la spec 09 esto devolvía "El corte se guardó, pero no se pudo
    // reflejar en la caja". Ahora un fallo al insertar la transacción
    // revierte también el appointment, así que el único resultado posible es
    // un error limpio, sin desfase que avisar.
    mockRpc({
      data: null,
      error: { message: "error al insertar transactions", code: "XX000" },
    });

    const result = await completeWalkinAction(PAYLOAD_VALIDO);

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});
