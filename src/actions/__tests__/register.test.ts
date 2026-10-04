import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { registerOwnerAction } from "../auth.actions";
import { LEGAL } from "@/lib/legal";

const DATOS = {
  email: "juan@test.com",
  password: "123456",
  ownerName: "Juan Pérez",
  barbershopName: "Barbería Central",
  acceptedTerms: true,
};

function mock() {
  const signUp = vi.fn(async () => ({ error: null }));
  const rpc = vi.fn(async () => ({ error: null }));
  vi.mocked(createClient).mockResolvedValue({
    auth: { signUp },
    rpc,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return { signUp, rpc };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("registerOwnerAction — Términos y Privacidad", () => {
  it("sin aceptar los términos no crea nada, aunque se llame directo", async () => {
    const { signUp, rpc } = mock();

    const result = await registerOwnerAction({
      ...DATOS,
      acceptedTerms: false,
    });

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/aceptar los Términos/);
    expect(signUp).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("deja la versión aceptada y la fecha en el usuario de Auth", async () => {
    const { signUp, rpc } = mock();

    const result = await registerOwnerAction(DATOS);

    expect(result).toEqual({ success: true });
    expect(signUp).toHaveBeenCalledWith({
      email: "juan@test.com",
      password: "123456",
      options: {
        data: {
          terms_version: LEGAL.version,
          terms_accepted_at: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
        },
      },
    });
    expect(rpc).toHaveBeenCalledWith("register_owner", {
      p_barbershop_name: "Barbería Central",
      p_owner_name: "Juan Pérez",
    });
  });
});
