import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
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
