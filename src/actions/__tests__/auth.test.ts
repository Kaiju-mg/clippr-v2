import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { changePasswordAction } from "../auth.actions";

interface AuthMockOptions {
  user?: { id: string; email?: string } | null;
  signInError?: { message: string } | null;
  updateError?: { message: string; code?: string } | null;
}

function mockAuth({
  user = { id: "auth-1", email: "barbero@example.com" },
  signInError = null,
  updateError = null,
}: AuthMockOptions = {}) {
  const auth = {
    getUser: vi.fn(async () => ({ data: { user } })),
    signInWithPassword: vi.fn(async () => ({ error: signInError })),
    updateUser: vi.fn(async () => ({ error: updateError })),
  };
  vi.mocked(createClient).mockResolvedValue({
    auth,
  } as unknown as Awaited<ReturnType<typeof createClient>>);
  return auth;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("changePasswordAction — validaciones", () => {
  it("rechaza una contraseña nueva de menos de 6 caracteres", async () => {
    const result = await changePasswordAction({
      currentPassword: "A7X9P2",
      newPassword: "abc",
    });

    expect(result).toEqual({
      success: false,
      error: "La contraseña nueva debe tener al menos 6 caracteres.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza una contraseña nueva igual a la actual", async () => {
    const result = await changePasswordAction({
      currentPassword: "A7X9P2",
      newPassword: "A7X9P2",
    });

    expect(result).toEqual({
      success: false,
      error: "La contraseña nueva tiene que ser distinta de la actual.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("changePasswordAction", () => {
  it("verifica la contraseña actual y después la cambia", async () => {
    const auth = mockAuth();

    const result = await changePasswordAction({
      currentPassword: "A7X9P2",
      newPassword: "mi-clave-nueva",
    });

    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: "barbero@example.com",
      password: "A7X9P2",
    });
    expect(auth.updateUser).toHaveBeenCalledWith({
      password: "mi-clave-nueva",
    });
    expect(result).toEqual({ success: true });
  });

  it("no cambia nada si la contraseña actual es incorrecta", async () => {
    const auth = mockAuth({
      signInError: { message: "Invalid login credentials" },
    });

    const result = await changePasswordAction({
      currentPassword: "equivocada",
      newPassword: "mi-clave-nueva",
    });

    expect(result).toEqual({
      success: false,
      error: "La contraseña actual no es correcta.",
    });
    expect(auth.updateUser).not.toHaveBeenCalled();
  });

  it("sin sesión devuelve un error genérico", async () => {
    const auth = mockAuth({ user: null });

    const result = await changePasswordAction({
      currentPassword: "A7X9P2",
      newPassword: "mi-clave-nueva",
    });

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
    expect(auth.signInWithPassword).not.toHaveBeenCalled();
  });

  it("traduce la contraseña débil de Supabase a un mensaje legible", async () => {
    mockAuth({
      updateError: { message: "Password is too weak", code: "weak_password" },
    });

    const result = await changePasswordAction({
      currentPassword: "A7X9P2",
      newPassword: "123456",
    });

    expect(result).toEqual({
      success: false,
      error: "Esa contraseña es muy débil. Probá con una más larga.",
    });
  });
});
