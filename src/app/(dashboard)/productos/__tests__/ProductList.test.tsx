import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProductList } from "../_components/ProductList";
import type { Product } from "@/types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/actions/product.actions", () => ({
  toggleProductStatusAction: vi.fn(),
  createProductAction: vi.fn(),
  updateProductAction: vi.fn(),
}));

const product = (overrides: Partial<Product>): Product => ({
  id: "p1",
  barbershop_id: "b1",
  name: "Cera mate",
  price: 60000,
  stock: 5,
  low_stock_threshold: null,
  is_active: true,
  ...overrides,
});

describe("ProductList — tema Recibo", () => {
  it("un producto sin stock lleva el sello AGOTADO, no el texto 'Sin stock'", () => {
    render(<ProductList products={[product({ stock: 0 })]} isOwner={false} />);
    const sello = screen.getByText("Agotado");
    expect(sello).toHaveAttribute("data-stamp");
    expect(sello).toHaveClass("uppercase", "text-stamp");
    expect(screen.queryByText(/Sin stock/)).not.toBeInTheDocument();
  });

  it("con stock, muestra la cantidad y ningún sello", () => {
    render(<ProductList products={[product({ stock: 5 })]} isOwner={false} />);
    expect(screen.getByText("Stock: 5")).toBeInTheDocument();
    expect(document.querySelector("[data-stamp]")).toBeNull();
  });

  it("el stock bajo se sigue avisando", () => {
    render(
      <ProductList
        products={[product({ stock: 2, low_stock_threshold: 3 })]}
        isOwner={false}
      />,
    );
    expect(screen.getByText("Stock: 2 · Stock bajo")).toBeInTheDocument();
  });

  it("el precio va en mono", () => {
    render(<ProductList products={[product({})]} isOwner={false} />);
    expect(screen.getByText(/60\.000/)).toHaveClass(
      "font-mono",
      "tabular-nums",
    );
  });
});

describe("ProductList — lista en papel (catálogos, 2026-10-04)", () => {
  it("arriba, el resumen del catálogo en mono", () => {
    render(
      <ProductList
        products={[
          product({ id: "a" }),
          product({ id: "b", stock: 0 }),
          product({ id: "c", is_active: false }),
        ]}
        isOwner={false}
      />,
    );
    expect(screen.getByText("2 activos · 1 pausado · 1 agotado")).toHaveClass(
      "font-mono",
    );
  });

  it("las filas van punteadas: cada una lleva un precio", () => {
    render(<ProductList products={[product({})]} isOwner={false} />);
    expect(screen.getByRole("listitem")).toHaveClass("border-dashed");
  });
});
