import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { setOnline } from "@/test/network";
import { useOnline } from "./useOnline";

function Estado() {
  return <span>{useOnline() ? "con señal" : "sin señal"}</span>;
}

describe("useOnline", () => {
  it("arranca con lo que dice navigator.onLine", () => {
    render(<Estado />);
    expect(screen.getByText("con señal")).toBeInTheDocument();
  });

  it("sigue los eventos offline/online sin recargar", () => {
    render(<Estado />);

    setOnline(false);
    expect(screen.getByText("sin señal")).toBeInTheDocument();

    setOnline(true);
    expect(screen.getByText("con señal")).toBeInTheDocument();
  });

  it("si se monta ya sin señal, lo sabe desde el principio", () => {
    setOnline(false);
    render(<Estado />);
    expect(screen.getByText("sin señal")).toBeInTheDocument();
  });
});
