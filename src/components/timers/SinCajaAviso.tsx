"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface SinCajaAvisoProps {
  onCancel: () => void;
}

/**
 * Lo que se muestra al querer cobrar sin caja abierta (spec 05, sección 6).
 * Bloquea el formulario en vez de intentar la acción y rebotar: el servidor
 * igual la rechaza, pero un error después de tocar "Cobrar" se lee como una
 * falla de la app y no como "te falta un paso".
 *
 * Lo usan los dos formularios de cierre, el del walk-in y el del turno
 * agendado.
 */
export function SinCajaAviso({ onCancel }: SinCajaAvisoProps) {
  return (
    <div className="bg-background mt-3 flex flex-col gap-3 rounded-lg p-3.5">
      <p role="alert" className="text-danger text-sm">
        Debes abrir tu caja diaria antes de cobrar un corte.
      </p>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Volver
        </Button>
        <Link href="/caja">
          <Button type="button">Ir a caja</Button>
        </Link>
      </div>
    </div>
  );
}
