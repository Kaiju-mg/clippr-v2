import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

import { deleteAccountAction } from "../account.actions";
import { NOMBRE_CUENTA_ELIMINADA } from "@/lib/legal";

type Result = { data: unknown; error: { message: string } | null };

function builder(result: Result) {
  const b: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const m of ["select", "eq", "update", "delete"]) {
    b[m] = vi.fn(() => b);
  }
  b.maybeSingle = vi.fn(async () => result);
  (b as unknown as { then: unknown }).then = (ok: (v: Result) => unknown) =>
    Promise.resolve(result).then(ok);
  return b;
}

const BARBERO = {
  id: "u-barber",
  role: "barber",
  barbershop_id: "b1",
  barbershops: { name: "El Poste" },
};
const DUENO = { ...BARBERO, id: "u-owner", role: "owner" };

interface Opciones {
  perfil?: typeof BARBERO | null;
  cajaAbierta?: boolean;
  anonError?: boolean;
  equipo?: { auth_id: string | null }[];
  barberiaError?: boolean;
  authFallaPara?: string[];
}

function mock({
  perfil = BARBERO,
  cajaAbierta = false,
  anonError = false,
  equipo = [
    { auth_id: "auth-owner" },
    { auth_id: "auth-b1" },
    { auth_id: null },
  ],
  barberiaError = false,
  authFallaPara = [],
}: Opciones = {}) {
  const sesionUsers = builder({ data: perfil, error: null });
  const sesionCaja = builder({
    data: cajaAbierta ? { id: "cs1" } : null,
    error: null,
  });
  const signOut = vi.fn(async () => ({ error: null }));
  vi.mocked(createClient).mockResolvedValue({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "auth-me" } } })),
      signOut,
    },
    from: vi.fn((t: string) => (t === "users" ? sesionUsers : sesionCaja)),
  } as unknown as Awaited<ReturnType<typeof createClient>>);

  const adminUsersUpdate = builder({
    data: null,
    error: anonError ? { message: "x" } : null,
  });
  const adminUsersSelect = builder({ data: equipo, error: null });
  const adminBarberias = builder({
    data: null,
    error: barberiaError ? { message: "x" } : null,
  });
  const deleteUser = vi.fn(async (id: string) => ({
    error: authFallaPara.includes(id) ? { message: "no" } : null,
  }));
  const adminFrom = vi.fn((t: string) => {
    if (t === "barbershops") return adminBarberias;
    // users: el barbero hace update, el dueño hace select del equipo.
    return perfil?.role === "barber" ? adminUsersUpdate : adminUsersSelect;
  });
  vi.mocked(createAdminClient).mockReturnValue({
    from: adminFrom,
    auth: { admin: { deleteUser } },
  } as unknown as ReturnType<typeof createAdminClient>);

  return {
    adminFrom,
    adminUsersUpdate,
    adminUsersSelect,
    adminBarberias,
    deleteUser,
    signOut,
  };
}

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = KEY;
});

describe("deleteAccountAction — barbero", () => {
  it("anonimiza su fila, borra su login y cierra la sesión (la caja del negocio queda)", async () => {
    const m = mock();

    await deleteAccountAction("eliminar");

    expect(m.adminUsersUpdate.update).toHaveBeenCalledWith({
      name: NOMBRE_CUENTA_ELIMINADA,
      commission_pct: 0,
    });
    expect(m.adminUsersUpdate.eq).toHaveBeenCalledWith("id", "u-barber");
    expect(m.deleteUser).toHaveBeenCalledWith("auth-me");
    // Nunca se borra la barbería por un barbero.
    expect(m.adminFrom).not.toHaveBeenCalledWith("barbershops");
    expect(m.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(redirect).toHaveBeenCalledWith("/login?cuenta=eliminada");
  });

  it("sin escribir ELIMINAR no borra nada", async () => {
    const m = mock();

    const result = await deleteAccountAction("dale");

    expect(result.success).toBe(false);
    expect(m.adminFrom).not.toHaveBeenCalled();
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("con una caja abierta no deja eliminar (quedaría abierta para siempre)", async () => {
    const m = mock({ cajaAbierta: true });

    const result = await deleteAccountAction("ELIMINAR");

    expect(result).toEqual({
      success: false,
      error: "Tenés una caja abierta. Cerrala antes de eliminar tu cuenta.",
    });
    expect(m.adminUsersUpdate.update).not.toHaveBeenCalled();
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("si no se pudo anonimizar, no borra el login (no queda un nombre sin dueño)", async () => {
    const m = mock({ anonError: true });

    const result = await deleteAccountAction("ELIMINAR");

    expect(result.success).toBe(false);
    expect(m.deleteUser).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("deleteAccountAction — dueño", () => {
  it("borra la barbería entera y los logins de todo el equipo", async () => {
    const m = mock({ perfil: DUENO });

    await deleteAccountAction("  el poste ");

    expect(m.adminUsersSelect.eq).toHaveBeenCalledWith("barbershop_id", "b1");
    expect(m.adminBarberias.delete).toHaveBeenCalled();
    expect(m.adminBarberias.eq).toHaveBeenCalledWith("id", "b1");
    // Las cuentas ya eliminadas (auth_id null) se saltean.
    expect(m.deleteUser.mock.calls.map(([id]) => id)).toEqual([
      "auth-owner",
      "auth-b1",
    ]);
    expect(redirect).toHaveBeenCalledWith("/login?cuenta=eliminada");
  });

  it("tiene que escribir el nombre de la barbería, no ELIMINAR", async () => {
    const m = mock({ perfil: DUENO });

    const result = await deleteAccountAction("ELIMINAR");

    expect(result.success).toBe(false);
    expect(m.adminBarberias.delete).not.toHaveBeenCalled();
  });

  it("si no se puede borrar la barbería, no toca ningún login", async () => {
    const m = mock({ perfil: DUENO, barberiaError: true });

    const result = await deleteAccountAction("El Poste");

    expect(result.success).toBe(false);
    expect(m.deleteUser).not.toHaveBeenCalled();
  });

  it("si falla borrar algún login, avisa (los datos ya no están)", async () => {
    const m = mock({ perfil: DUENO, authFallaPara: ["auth-b1"] });

    const result = await deleteAccountAction("El Poste");

    expect(result.success).toBe(false);
    expect(m.adminBarberias.delete).toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("deleteAccountAction — sin clave de servicio", () => {
  it("no intenta nada y lo dice", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const m = mock();

    const result = await deleteAccountAction("ELIMINAR");

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toMatch(/no está disponible/);
    expect(m.adminFrom).not.toHaveBeenCalled();
  });
});
