import { describe, expect, it, vi, beforeEach } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { User } from "@/types";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import {
  getTeamAction,
  createBarberAction,
  updateBarberAction,
} from "../team.actions";

interface MockResult<T> {
  data: T | null;
  error: { message: string } | null;
}

interface QueryBuilderMock<T> {
  select: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  order: ReturnType<typeof vi.fn>;
  single: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
  then: (onfulfilled: (value: MockResult<T>) => unknown) => Promise<unknown>;
}

/** Igual al builder de service.test.ts: cada método intermedio se
 * encadena a sí mismo y single/maybeSingle/then resuelven al resultado. */
function createBuilder<T>(result: MockResult<T>): QueryBuilderMock<T> {
  const builder: QueryBuilderMock<T> = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    order: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (onfulfilled) => Promise.resolve(result).then(onfulfilled),
  };
  return builder;
}

interface SupabaseMockOptions {
  user?: { id: string } | null;
  /** Un builder por cada `.from("users")` esperado, en el orden en que las
   * acciones de team.actions.ts las hacen (primero el perfil propio, después
   * la consulta/mutación real). */
  fromResults: MockResult<unknown>[];
  /** Resultado del `.rpc("update_team_member", ...)` de updateBarberAction
   * (spec 09: el update de nivel/comisión dejó de ser un `.from().update()`
   * porque `authenticated` ya no tiene ese privilegio). */
  rpcResult?: {
    data: unknown;
    error: { message: string; code?: string } | null;
  };
}

function mockSupabaseClient({
  user = { id: "auth-owner" },
  fromResults,
  rpcResult,
}: SupabaseMockOptions) {
  const builders = fromResults.map((result) => createBuilder(result));
  let callIndex = 0;
  const from = vi.fn(() => {
    const builder = builders[callIndex];
    callIndex += 1;
    return builder;
  });

  const single = vi.fn(async () => rpcResult);
  const rpc = vi.fn(() => ({ single }));

  const client = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
    from,
    rpc,
  };

  vi.mocked(createClient).mockResolvedValue(
    client as unknown as Awaited<ReturnType<typeof createClient>>,
  );

  return { from, builders, rpc };
}

function mockAdminClient(result: {
  data: { user: { id: string } } | null;
  error: { message: string } | null;
}) {
  const createUser = vi.fn(async () => result);
  vi.mocked(createAdminClient).mockReturnValue({
    auth: { admin: { createUser } },
  } as unknown as ReturnType<typeof createAdminClient>);
  return createUser;
}

const OWNER_PROFILE = {
  id: "u-owner",
  barbershop_id: "b1",
  role: "owner" as const,
};
const BARBER_PROFILE = {
  id: "u-barber",
  barbershop_id: "b1",
  role: "barber" as const,
};

const BARBER: User = {
  id: "u2",
  auth_id: "auth-barber",
  barbershop_id: "b1",
  role: "barber",
  name: "Juan Pérez",
  level: "junior",
  commission_pct: 40,
  streak_count: 0,
};

const MENSAJE_ACCESO_DENEGADO =
  "Acceso denegado: solo el dueño puede gestionar el equipo.";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getTeamAction", () => {
  it("devuelve todo el equipo (dueño y barberos) ordenado por nombre", async () => {
    const { from, builders } = mockSupabaseClient({
      fromResults: [{ data: [BARBER], error: null }],
    });

    const result = await getTeamAction();

    expect(from).toHaveBeenCalledWith("users");
    expect(builders[0].order).toHaveBeenCalledWith("name");
    expect(result).toEqual({ success: true, data: [BARBER] });
  });

  it("no filtra por barbershop_id a mano (delega el aislamiento de tenant en RLS)", async () => {
    const { builders } = mockSupabaseClient({
      fromResults: [{ data: [BARBER], error: null }],
    });

    await getTeamAction();

    expect(builders[0].eq).not.toHaveBeenCalled();
  });

  it("devuelve un error legible si supabase falla", async () => {
    mockSupabaseClient({
      fromResults: [{ data: null, error: { message: "boom" } }],
    });

    const result = await getTeamAction();

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("createBarberAction — validaciones", () => {
  it("rechaza un nombre vacío", async () => {
    const result = await createBarberAction({
      name: "   ",
      email: "a@b.com",
      level: "junior",
      commission_pct: 40,
    });

    expect(result).toEqual({
      success: false,
      error: "El nombre es obligatorio.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza un correo inválido", async () => {
    const result = await createBarberAction({
      name: "Juan",
      email: "no-es-un-correo",
      level: "junior",
      commission_pct: 40,
    });

    expect(result).toEqual({
      success: false,
      error: "El correo no es válido.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });

  it("rechaza una comisión fuera de rango (0-100)", async () => {
    const result = await createBarberAction({
      name: "Juan",
      email: "juan@example.com",
      level: "junior",
      commission_pct: 150,
    });

    expect(result).toEqual({
      success: false,
      error: "La comisión debe ser un porcentaje entre 0 y 100.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});

describe("createBarberAction — control de acceso (RBAC)", () => {
  it("rechaza si quien llama no es dueño", async () => {
    mockSupabaseClient({
      fromResults: [{ data: BARBER_PROFILE, error: null }],
    });

    const result = await createBarberAction({
      name: "Juan",
      email: "juan@example.com",
      level: "junior",
      commission_pct: 40,
    });

    expect(result).toEqual({ success: false, error: MENSAJE_ACCESO_DENEGADO });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("rechaza si no hay sesión activa", async () => {
    mockSupabaseClient({ user: null, fromResults: [] });

    const result = await createBarberAction({
      name: "Juan",
      email: "juan@example.com",
      level: "junior",
      commission_pct: 40,
    });

    expect(result).toEqual({ success: false, error: MENSAJE_ACCESO_DENEGADO });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("createBarberAction — happy path y errores de servidor", () => {
  it("crea la cuenta de Auth y el perfil heredando el barbershop_id del dueño (nunca del payload)", async () => {
    const { builders } = mockSupabaseClient({
      fromResults: [
        { data: OWNER_PROFILE, error: null },
        { data: BARBER, error: null },
      ],
    });
    const createUser = mockAdminClient({
      data: { user: { id: "auth-barber" } },
      error: null,
    });

    const result = await createBarberAction({
      name: "  Juan Pérez  ",
      email: "juan@example.com",
      level: "junior",
      commission_pct: 40,
    });

    expect(createUser).toHaveBeenCalledWith({
      email: "juan@example.com",
      password: expect.stringMatching(/^[A-HJKMNP-Z2-9]{6}$/),
      email_confirm: true,
    });
    expect(builders[1].insert).toHaveBeenCalledWith({
      auth_id: "auth-barber",
      barbershop_id: "b1",
      role: "barber",
      name: "Juan Pérez",
      level: "junior",
      commission_pct: 40,
    });
    // La contraseña que se devuelve al dueño es la misma con la que se creó
    // la cuenta, no otra.
    const [{ password }] = createUser.mock.calls[0] as unknown as [
      { password: string },
    ];
    expect(result).toEqual({
      success: true,
      data: { barber: BARBER, temporaryPassword: password },
    });
  });

  it("genera una contraseña distinta para cada barbero", async () => {
    const passwords: string[] = [];
    for (let i = 0; i < 2; i++) {
      mockSupabaseClient({
        fromResults: [
          { data: OWNER_PROFILE, error: null },
          { data: BARBER, error: null },
        ],
      });
      mockAdminClient({ data: { user: { id: `auth-${i}` } }, error: null });

      const result = await createBarberAction({
        name: "Juan",
        email: `juan${i}@example.com`,
        level: "junior",
        commission_pct: 40,
      });
      if (result.success) passwords.push(result.data.temporaryPassword);
    }

    expect(passwords).toHaveLength(2);
    expect(passwords[0]).not.toBe(passwords[1]);
  });

  it("muestra un mensaje limpio si el correo ya está registrado", async () => {
    mockSupabaseClient({ fromResults: [{ data: OWNER_PROFILE, error: null }] });
    mockAdminClient({
      data: null,
      error: {
        message: "A user with this email address has already been registered",
      },
    });

    const result = await createBarberAction({
      name: "Juan",
      email: "juan@example.com",
      level: "junior",
      commission_pct: 40,
    });

    expect(result).toEqual({
      success: false,
      error: "Este correo ya está registrado en Clippr.",
    });
  });

  it("devuelve un error genérico si falla el insert del perfil (el usuario de Auth ya se creó)", async () => {
    mockSupabaseClient({
      fromResults: [
        { data: OWNER_PROFILE, error: null },
        { data: null, error: { message: "boom" } },
      ],
    });
    mockAdminClient({ data: { user: { id: "auth-barber" } }, error: null });

    const result = await createBarberAction({
      name: "Juan",
      email: "juan@example.com",
      level: "junior",
      commission_pct: 40,
    });

    expect(result).toEqual({
      success: false,
      error: "Algo salió mal. Intentá de nuevo.",
    });
  });
});

describe("updateBarberAction — control de acceso (RBAC)", () => {
  it("rechaza si quien llama tiene role 'barber' (no puede subirse la comisión)", async () => {
    const { rpc } = mockSupabaseClient({
      fromResults: [{ data: BARBER_PROFILE, error: null }],
    });

    const result = await updateBarberAction("u2", { commission_pct: 100 });

    expect(result).toEqual({ success: false, error: MENSAJE_ACCESO_DENEGADO });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("traduce el CL010 del RPC si el chequeo de rol se saltea", async () => {
    // La barrera real está en la base: el RPC revalida el rol aunque alguien
    // llame a la acción (o directo a la función) con una sesión de barbero.
    mockSupabaseClient({
      fromResults: [{ data: OWNER_PROFILE, error: null }],
      rpcResult: {
        data: null,
        error: {
          message: "Solo el dueño puede gestionar el equipo",
          code: "CL010",
        },
      },
    });

    const result = await updateBarberAction("u2", { commission_pct: 50 });

    expect(result).toEqual({ success: false, error: MENSAJE_ACCESO_DENEGADO });
  });
});

describe("updateBarberAction — happy path y casos borde", () => {
  it("actualiza nivel y comisión por RPC cuando quien llama es dueño", async () => {
    const updated = { ...BARBER, level: "senior" as const, commission_pct: 50 };
    const { rpc } = mockSupabaseClient({
      fromResults: [{ data: OWNER_PROFILE, error: null }],
      rpcResult: { data: updated, error: null },
    });

    const result = await updateBarberAction("u2", {
      level: "senior",
      commission_pct: 50,
    });

    // Ya no es un `.from("users").update(...)`: `authenticated` perdió el
    // privilegio de escribir level/commission_pct (migración 20260920010000).
    expect(rpc).toHaveBeenCalledWith("update_team_member", {
      p_user_id: "u2",
      p_level: "senior",
      p_commission_pct: 50,
    });
    expect(result).toEqual({ success: true, data: updated });
  });

  it("manda null en el campo que no cambia (el RPC lo interpreta como 'dejalo igual')", async () => {
    const { rpc } = mockSupabaseClient({
      fromResults: [{ data: OWNER_PROFILE, error: null }],
      rpcResult: { data: BARBER, error: null },
    });

    await updateBarberAction("u2", { commission_pct: 50 });

    expect(rpc).toHaveBeenCalledWith("update_team_member", {
      p_user_id: "u2",
      p_level: null,
      p_commission_pct: 50,
    });
  });

  it("devuelve 'no encontrado' si el barbero es de otro tenant (CL011)", async () => {
    mockSupabaseClient({
      fromResults: [{ data: OWNER_PROFILE, error: null }],
      rpcResult: {
        data: null,
        error: { message: "Barbero no encontrado", code: "CL011" },
      },
    });

    const result = await updateBarberAction("otro-tenant", {
      commission_pct: 50,
    });

    expect(result).toEqual({
      success: false,
      error: "Barbero no encontrado.",
    });
  });

  it("rechaza una comisión inválida antes de tocar supabase", async () => {
    const result = await updateBarberAction("u2", { commission_pct: -5 });

    expect(result).toEqual({
      success: false,
      error: "La comisión debe ser un porcentaje entre 0 y 100.",
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});
