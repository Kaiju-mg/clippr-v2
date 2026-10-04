import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { updateBarbershopPhoneAction } from "../barbershop.actions";

interface MockResult {
  data: unknown;
  error: { message: string } | null;
}

function createBuilder(result: MockResult) {
  const builder = {
    select: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

/** Un builder por cada `.from(...)`: primero el perfil, después el update. */
function mockSupabase(
  results: MockResult[],
  user: { id: string } | null = { id: "auth-1" },
) {
  const builders = results.map(createBuilder);
  let call = 0;
  const from = vi.fn(() => builders[call++]);
  vi.mocked(createClient).mockResolvedValue({
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
    from,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { from, builders };
}

const OWNER = { data: { barbershop_id: "b1", role: "owner" }, error: null };
const BARBER = { data: { barbershop_id: "b1", role: "barber" }, error: null };

describe("updateBarbershopPhoneAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("el dueño guarda el teléfono normalizado en su propia barbería", async () => {
    const { from, builders } = mockSupabase([
      OWNER,
      { data: { phone: "0981 123 456" }, error: null },
    ]);

    const result = await updateBarbershopPhoneAction("  0981  123 456 ");

    expect(result).toEqual({ success: true, data: { phone: "0981 123 456" } });
    expect(from).toHaveBeenNthCalledWith(2, "barbershops");
    expect(builders[1].update).toHaveBeenCalledWith({ phone: "0981 123 456" });
    // La barbería sale del perfil, nunca del cliente.
    expect(builders[1].eq).toHaveBeenCalledWith("id", "b1");
    expect(revalidatePath).toHaveBeenCalledWith("/mas");
  });

  it("vacío borra el teléfono (null)", async () => {
    const { builders } = mockSupabase([
      OWNER,
      { data: { phone: null }, error: null },
    ]);

    const result = await updateBarbershopPhoneAction("   ");

    expect(result).toEqual({ success: true, data: { phone: null } });
    expect(builders[1].update).toHaveBeenCalledWith({ phone: null });
  });

  it("un barbero no puede editar la barbería (no llega ni a intentar el update)", async () => {
    const { from } = mockSupabase([BARBER]);

    const result = await updateBarbershopPhoneAction("0981 123 456");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/solo el dueño/i);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it("sin sesión, acceso denegado", async () => {
    const { from } = mockSupabase([], null);

    const result = await updateBarbershopPhoneAction("0981 123 456");

    expect(result.success).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("un teléfono inválido se rechaza antes de tocar la base", async () => {
    const { from } = mockSupabase([OWNER]);

    const result = await updateBarbershopPhoneAction("llamame al 0981");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/no es válido/i);
    expect(from).not.toHaveBeenCalled();
  });

  it("si la policy filtra la fila, no se muestra como éxito", async () => {
    mockSupabase([OWNER, { data: null, error: null }]);

    const result = await updateBarbershopPhoneAction("0981 123 456");

    expect(result.success).toBe(false);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("un error de la base devuelve el mensaje genérico", async () => {
    mockSupabase([
      OWNER,
      { data: null, error: { message: "permission denied for table" } },
    ]);

    const result = await updateBarbershopPhoneAction("0981 123 456");

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});
