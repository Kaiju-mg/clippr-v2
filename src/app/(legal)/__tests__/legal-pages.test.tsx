import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import PrivacidadPage from "../privacidad/page";
import TerminosPage from "../terminos/page";
import AyudaPage from "../ayuda/page";
import EliminarCuentaPublicaPage from "../eliminar-cuenta/page";
import { LEGAL } from "@/lib/legal";

describe("Páginas legales públicas", () => {
  it("la Política de Privacidad nombra al responsable, los proveedores y el borrado", () => {
    render(<PrivacidadPage />);
    const texto = document.body.textContent ?? "";
    expect(texto).toContain(LEGAL.responsable);
    expect(texto).toContain("Supabase");
    expect(texto).toContain("Cloudflare");
    expect(texto).toMatch(/No vendemos datos/);
    expect(texto).toMatch(/Barbero eliminado/);
    expect(
      screen.getByRole("heading", {
        name: "Cookies y almacenamiento en el dispositivo",
      }),
    ).toBeInTheDocument();
  });

  it("los Términos aclaran que Clippr no factura y que hoy no se cobra", () => {
    render(<TerminosPage />);
    const texto = document.body.textContent ?? "";
    expect(texto).toMatch(/No emite facturas/);
    expect(texto).toMatch(/período de prueba, sin costo/);
    expect(texto).toMatch(/República del Paraguay/);
  });

  it("mientras falte el email de soporte, se ve como pendiente (no se inventa uno)", () => {
    render(<AyudaPage />);
    if (LEGAL.contactEmail) {
      expect(screen.getByText(LEGAL.contactEmail)).toBeInTheDocument();
    } else {
      expect(
        screen.getByText("[email de soporte pendiente]"),
      ).toBeInTheDocument();
    }
  });

  it("la página pública de eliminar cuenta explica qué se borra y qué se conserva", () => {
    render(<EliminarCuentaPublicaPage />);
    expect(
      screen.getByRole("heading", { name: "Qué se borra" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Qué se conserva" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Iniciar sesión" }),
    ).toHaveAttribute("href", "/login");
  });

  it("todas llevan los links entre documentos al pie", () => {
    render(<TerminosPage />);
    const nav = screen.getByRole("navigation", {
      name: "Documentos de Clippr",
    });
    for (const href of [
      "/terminos",
      "/privacidad",
      "/ayuda",
      "/eliminar-cuenta",
    ]) {
      expect(nav.querySelector(`a[href="${href}"]`)).not.toBeNull();
    }
  });
});
