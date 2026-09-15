import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LoginPage from "../login/page";
import RegistroPage from "../registro/page";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/actions/auth.actions", () => ({
  loginAction: vi.fn(),
  registerOwnerAction: vi.fn(),
}));

import { loginAction, registerOwnerAction } from "@/actions/auth.actions";

beforeEach(() => {
  vi.clearAllMocks();
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
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => {
      expect(registerOwnerAction).toHaveBeenCalledWith({
        email: "juan@test.com",
        password: "123456",
        ownerName: "Juan Pérez",
        barbershopName: "Barbería Central",
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
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    expect(
      await screen.findByText("Este correo ya está registrado."),
    ).toBeInTheDocument();
  });
});
