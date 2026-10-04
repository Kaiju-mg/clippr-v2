import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { OwnerViewSwitch } from "../_components/OwnerViewSwitch";

describe("OwnerViewSwitch", () => {
  it("son links: 'Mi barbería' a /estadisticas y 'Yo' a ?vista=yo", () => {
    render(<OwnerViewSwitch active="barberia" />);
    expect(screen.getByRole("link", { name: "Mi barbería" })).toHaveAttribute(
      "href",
      "/estadisticas",
    );
    expect(screen.getByRole("link", { name: "Yo" })).toHaveAttribute(
      "href",
      "/estadisticas?vista=yo",
    );
  });

  it("marca la vista activa", () => {
    render(<OwnerViewSwitch active="yo" />);
    expect(screen.getByRole("link", { name: "Yo" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: "Mi barbería" }),
    ).not.toHaveAttribute("aria-current");
  });
});
