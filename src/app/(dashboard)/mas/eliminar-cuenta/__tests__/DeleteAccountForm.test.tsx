import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

vi.mock("@/actions/account.actions", () => ({
  deleteAccountAction: vi.fn(),
}));

import { deleteAccountAction } from "@/actions/account.actions";
import { DeleteAccountForm } from "../_components/DeleteAccountForm";

beforeEach(() => {
  vi.clearAllMocks();
});

function abrir(expected = "ELIMINAR") {
  render(
    <DeleteAccountForm
      expected={expected}
      label="Escribí ELIMINAR para confirmar"
    />,
  );
  return {
    campo: screen.getByLabelText("Escribí ELIMINAR para confirmar"),
    boton: screen.getByRole("button", { name: /eliminar mi cuenta/i }),
  };
}

describe("DeleteAccountForm", () => {
  it("el botón queda deshabilitado hasta escribir la confirmación", () => {
    const { campo, boton } = abrir();
    expect(boton).toBeDisabled();

    fireEvent.change(campo, { target: { value: "elimina" } });
    expect(boton).toBeDisabled();

    fireEvent.change(campo, { target: { value: " eliminar " } });
    expect(boton).toBeEnabled();
  });

  it("para el dueño, la confirmación es el nombre de su barbería", () => {
    render(
      <DeleteAccountForm
        expected="El Poste"
        label="Escribí el nombre de tu barbería"
      />,
    );
    const boton = screen.getByRole("button", { name: /eliminar mi cuenta/i });
    fireEvent.change(
      screen.getByLabelText("Escribí el nombre de tu barbería"),
      {
        target: { value: "el poste" },
      },
    );
    expect(boton).toBeEnabled();
  });

  it("si el servidor rechaza, muestra el motivo y no se va de la pantalla", async () => {
    vi.mocked(deleteAccountAction).mockResolvedValue({
      success: false,
      error: "Tenés una caja abierta. Cerrala antes de eliminar tu cuenta.",
    });
    const { campo, boton } = abrir();

    fireEvent.change(campo, { target: { value: "ELIMINAR" } });
    fireEvent.click(boton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tenés una caja abierta",
    );
    await waitFor(() =>
      expect(deleteAccountAction).toHaveBeenCalledWith("ELIMINAR"),
    );
  });
});
