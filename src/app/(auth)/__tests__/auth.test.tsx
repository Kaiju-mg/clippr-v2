import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "../login/page";
import RegistroPage from "../registro/page";

const pushMock = vi.fn();
let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => searchParams,
}));

vi.mock("@/actions/auth.actions", () => ({
  loginAction: vi.fn(),
  registerOwnerAction: vi.fn(),
}));

import { loginAction, registerOwnerAction } from "@/actions/auth.actions";

beforeEach(() => {
  vi.clearAllMocks();
  searchParams = new URLSearchParams();
});

describe("LoginPage", () => {
  it("renderiza el formulario de login", () => {
    render(<LoginPage />);

    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ingresar" }),
    ).toBeInTheDocument();
  });

  it("deshabilita el botón mientras espera la respuesta", async () => {
    vi.mocked(loginAction).mockImplementation(
      () => new Promise(() => {}), // nunca resuelve
    );

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "barbero@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Ingresando..." }),
      ).toBeDisabled();
    });
  });

  it("muestra el mensaje de error si el Server Action falla", async () => {
    vi.mocked(loginAction).mockResolvedValue({
      success: false,
      error: "Email o contraseña incorrectos.",
    });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "barbero@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    expect(
      await screen.findByText("Email o contraseña incorrectos."),
    ).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("redirige a /inicio cuando el login es exitoso", async () => {
    vi.mocked(loginAction).mockResolvedValue({ success: true });

    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "barbero@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Ingresar" }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/inicio"));
  });
});

describe("RegistroPage", () => {
  it("renderiza el formulario de registro", () => {
    render(<RegistroPage />);

    expect(screen.getByLabelText("Nombre de la barbería")).toBeInTheDocument();
    expect(screen.getByLabelText("Tu nombre")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
  });

  it("llama al Server Action con los datos correctos", async () => {
    vi.mocked(registerOwnerAction).mockResolvedValue({ success: true });

    render(<RegistroPage />);

    fireEvent.change(screen.getByLabelText("Nombre de la barbería"), {
      target: { value: "Barbería Central" },
    });
    fireEvent.change(screen.getByLabelText("Tu nombre"), {
      target: { value: "Juan Pérez" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "juan@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /acepto los/i }));
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(registerOwnerAction).toHaveBeenCalledWith({
        email: "juan@test.com",
        password: "123456",
        ownerName: "Juan Pérez",
        barbershopName: "Barbería Central",
        acceptedTerms: true,
      });
    });
    expect(pushMock).toHaveBeenCalledWith("/inicio");
  });

  it("muestra el mensaje de error si el correo ya está registrado", async () => {
    vi.mocked(registerOwnerAction).mockResolvedValue({
      success: false,
      error: "Este correo ya está registrado.",
    });

    render(<RegistroPage />);

    fireEvent.change(screen.getByLabelText("Nombre de la barbería"), {
      target: { value: "Barbería Central" },
    });
    fireEvent.change(screen.getByLabelText("Tu nombre"), {
      target: { value: "Juan Pérez" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "juan@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Contraseña"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /acepto los/i }));
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText("Este correo ya está registrado."),
    ).toBeInTheDocument();
  });
});

describe("Login y registro — tema Recibo", () => {
  it.each([
    ["login", LoginPage, "Iniciar sesión"],
    ["registro", RegistroPage, "Crear cuenta"],
  ])("%s: poste, 'Clippr', la bajada y el form en papel", (_, Page, titulo) => {
    const { container } = render(<Page />);

    expect(screen.getByText("Clippr")).toBeInTheDocument();
    expect(
      screen.getByText("Turnos, caja y racha de tu barbería"),
    ).toBeInTheDocument();
    expect(container.querySelector("[data-tier]")).not.toBeNull();

    const tarjeta = screen.getByRole("region", { name: titulo });
    expect(tarjeta).toHaveClass("ticket-edge", "bg-surface-2");
    expect(tarjeta.querySelector("form")).not.toBeNull();
  });

  it("el login invita a registrar la barbería", () => {
    render(<LoginPage />);
    expect(
      screen.getByRole("link", { name: "Registrá tu barbería" }),
    ).toHaveAttribute("href", "/registro");
  });
});

describe("Términos, privacidad y cuenta eliminada (2026-10-04)", () => {
  it("el registro no se puede enviar sin aceptar los Términos y la Privacidad", () => {
    render(<RegistroPage />);
    const crear = screen.getByRole("button", { name: "Crear cuenta" });
    expect(crear).toBeDisabled();

    const casilla = screen.getByRole("checkbox", { name: /acepto los/i });
    expect(casilla).toBeRequired();
    fireEvent.click(casilla);
    expect(crear).toBeEnabled();
  });

  it("la casilla enlaza a los Términos y a la Política de Privacidad", () => {
    render(<RegistroPage />);
    expect(
      screen.getByRole("link", { name: "Términos y Condiciones" }),
    ).toHaveAttribute("href", "/terminos");
    expect(
      screen.getByRole("link", { name: "Política de Privacidad" }),
    ).toHaveAttribute("href", "/privacidad");
  });

  it("login y registro tienen los links legales al pie", () => {
    render(<LoginPage />);
    const nav = screen.getByRole("navigation", {
      name: "Documentos de Clippr",
    });
    expect(nav).toHaveTextContent("Términos");
    expect(nav).toHaveTextContent("Privacidad");
    expect(nav).toHaveTextContent("Ayuda");
  });

  it("después de eliminar la cuenta, el login lo confirma", () => {
    searchParams = new URLSearchParams("cuenta=eliminada");
    render(<LoginPage />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Tu cuenta se eliminó.",
    );
  });

  it("sin el parámetro, no hay aviso", () => {
    render(<LoginPage />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
