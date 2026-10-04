import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { CashMovements } from "../_components/CashMovements";
import { formatGuaranies } from "@/lib/utils";
import type { Transaction } from "@/types";

// Horas en UTC−3: 12:10 UTC = 09:10 en Paraguay.
const tx = (
  id: string,
  hhmmUtc: string,
  type: Transaction["type"],
  category: Transaction["category"],
  amount: number,
  description: string,
): Transaction => ({
  id,
  cash_session_id: "cs1",
  type,
  category,
  amount,
  description,
  created_at: `2026-10-03T${hhmmUtc}:00.000Z`,
});

// Del más nuevo al más viejo, como los devuelve el servidor.
const MOVEMENTS = [
  tx("t3", "19:15", "income", "service", 30000, "Perfilado"),
  tx("t2", "16:05", "expense", "manual", 40000, "Insumos"),
  tx("t1", "12:10", "income", "product", 60000, "Cera mate"),
];

const BASE = {
  movements: MOVEMENTS,
  initialBalance: 50000,
  openedAt: "2026-10-03T11:30:00.000Z",
  total: 100000,
};

function filas() {
  return within(screen.getByRole("list")).getAllByRole("listitem");
}

describe("CashMovements — el ticket de la caja", () => {
  it("se lee en orden de llegada, con el saldo inicial arriba", () => {
    render(<CashMovements {...BASE} />);
    const textos = filas().map((fila) => fila.textContent);

    expect(textos[0]).toContain("08:30");
    expect(textos[0]).toContain("Saldo inicial");
    expect(textos[0]).toContain("50.000");
    expect(textos.slice(1).map((t) => t?.match(/\d\d:\d\d/)?.[0])).toEqual([
      "09:10",
      "13:05",
      "16:15",
    ]);
  });

  it("el TOTAL es el saldo del servidor, no la suma de la lista", () => {
    // 50.000 + 60.000 − 40.000 + 30.000 = 100.000, pero se le pasa otro
    // número a propósito: la lista podría estar recortada.
    render(<CashMovements {...BASE} total={777000} />);
    expect(screen.getByText("Total").nextSibling?.textContent).toBe(
      formatGuaranies(777000),
    );
  });

  it("cada fila lleva línea punteada y la hora en mono", () => {
    render(<CashMovements {...BASE} />);
    for (const fila of filas()) {
      expect(fila).toHaveClass("border-dashed");
      expect(fila.querySelector(".font-mono")).not.toBeNull();
    }
  });

  it("los ingresos van con + en tinta; los egresos con − y sin rojo de error", () => {
    render(<CashMovements {...BASE} />);
    const ingreso = screen.getByText("+ 30.000");
    const egreso = screen.getByText("− 40.000");
    expect(ingreso).toHaveClass("text-accent-ink");
    expect(egreso).not.toHaveClass("text-danger");
    expect(screen.getByText("Egreso")).toBeInTheDocument();
  });

  it("es una tarjeta de papel con el borde en zigzag", () => {
    const { container } = render(<CashMovements {...BASE} />);
    expect(container.querySelector(".ticket-edge")).toHaveClass("bg-surface-2");
  });

  it("si la lista está recortada, no imprime el saldo inicial", () => {
    render(<CashMovements {...BASE} hasMore />);
    expect(screen.queryByText("Saldo inicial")).not.toBeInTheDocument();
    expect(screen.getByText(/Más movimientos antes/)).toBeInTheDocument();
  });

  it("sin movimientos todavía, el ticket tiene el saldo inicial y el total", () => {
    render(<CashMovements {...BASE} movements={[]} total={50000} />);
    expect(filas()).toHaveLength(1);
    expect(screen.getByText("Saldo inicial")).toBeInTheDocument();
  });

  it("si falla la consulta, avisa en vez de mostrar un ticket vacío", () => {
    render(<CashMovements {...BASE} failed />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "No pudimos cargar los movimientos",
    );
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
  });
});
