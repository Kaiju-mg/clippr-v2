import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("@/actions/barbershop.actions", () => ({
  updateBarbershopPhoneAction: vi.fn(),
}));

import { updateBarbershopPhoneAction } from "@/actions/barbershop.actions";
import { BarbershopCard } from "../_components/BarbershopCard";

describe("BarbershopCard — la barbería arriba de /mas", () => {
  it("muestra el nombre, 'Nombre · Rol' y el plan", () => {
    render(
      <BarbershopCard
        barbershopName="Barbería El Poste"
        userName="Eduardo Villalba"
        role="owner"
        plan="pro"
      />,
    );
    const card = screen.getByRole("region", { name: "Tu barbería" });
    expect(card).toHaveTextContent("Barbería El Poste");
    expect(screen.getByText("Eduardo Villalba · Dueño")).toBeInTheDocument();
    expect(screen.getByText("Plan Pro")).toBeInTheDocument();
  });

  it("tiene borde punteado, como un cupón", () => {
    render(
      <BarbershopCard
        barbershopName="El Poste"
        userName="Matías"
        role="barber"
        plan="trial"
      />,
    );
    expect(screen.getByRole("region", { name: "Tu barbería" })).toHaveClass(
      "border-dashed",
    );
    expect(screen.getByText("Matías · Barbero")).toBeInTheDocument();
    expect(screen.getByText("Plan de prueba")).toBeInTheDocument();
  });

  it("no muestra precios: el plan es sólo una etiqueta", () => {
    render(
      <BarbershopCard
        barbershopName="El Poste"
        userName="Matías"
        role="barber"
        plan="team"
      />,
    );
    expect(
      screen.getByRole("region", { name: "Tu barbería" }).textContent,
    ).not.toMatch(/Gs\.|\d/);
  });
});

describe("BarbershopCard — teléfono para turnos (fase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el teléfono si hay, para cualquiera del equipo", () => {
    render(
      <BarbershopCard
        barbershopName="El Poste"
        userName="Matías"
        role="barber"
        plan="pro"
        phone="0981 123 456"
      />,
    );
    expect(screen.getByText("0981 123 456")).toBeInTheDocument();
    // El barbero no edita la barbería.
    expect(screen.queryByRole("button", { name: /editar|agregar/i })).toBeNull();
  });

  it("al barbero sin teléfono no le muestra nada para editar", () => {
    render(
      <BarbershopCard
        barbershopName="El Poste"
        userName="Matías"
        role="barber"
        plan="pro"
      />,
    );
    expect(screen.queryByText(/turnos/i)).toBeNull();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("el dueño agrega el teléfono en línea y se ve guardado", async () => {
    vi.mocked(updateBarbershopPhoneAction).mockResolvedValue({
      success: true,
      data: { phone: "0981 123 456" },
    });
    render(
      <BarbershopCard
        barbershopName="El Poste"
        userName="Eduardo"
        role="owner"
        plan="pro"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Agregar teléfono" }));
    fireEvent.change(screen.getByLabelText("Teléfono para turnos"), {
      target: { value: "0981 123 456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() =>
      expect(screen.getByText("0981 123 456")).toBeInTheDocument(),
    );
    expect(updateBarbershopPhoneAction).toHaveBeenCalledWith("0981 123 456");
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("si el servidor rechaza el teléfono, muestra el error y sigue editando", async () => {
    vi.mocked(updateBarbershopPhoneAction).mockResolvedValue({
      success: false,
      error: "El teléfono no es válido.",
    });
    render(
      <BarbershopCard
        barbershopName="El Poste"
        userName="Eduardo"
        role="owner"
        plan="pro"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Agregar teléfono" }));
    fireEvent.change(screen.getByLabelText("Teléfono para turnos"), {
      target: { value: "abc" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "El teléfono no es válido.",
    );
    expect(screen.getByLabelText("Teléfono para turnos")).toBeInTheDocument();
  });
});
