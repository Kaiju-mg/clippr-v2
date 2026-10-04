"use client";

import { useState, useTransition } from "react";
import { updateBarbershopPhoneAction } from "@/actions/barbershop.actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface BarbershopPhoneProps {
  phone: string | null;
  /** Sólo el dueño edita (la base también lo exige, ver la migración). */
  canEdit: boolean;
}

/**
 * El teléfono de la barbería dentro de la tarjeta de `/mas` (spec 10, fase
 * 3). Es el "Turnos: …" de la imagen de compartir el día; si no hay, la
 * imagen no dibuja ese renglón. Edición en línea, sin modal, como el resto
 * de los formularios de la app.
 */
export function BarbershopPhone({ phone, canEdit }: BarbershopPhoneProps) {
  const [current, setCurrent] = useState(phone);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(phone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const result = await updateBarbershopPhoneAction(value);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setCurrent(result.data.phone);
      setValue(result.data.phone ?? "");
      setEditing(false);
    });
  }

  if (editing) {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <Input
          id="barbershop-phone"
          label="Teléfono para turnos"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="0981 123 456"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="font-mono"
        />
        {error && (
          <p role="alert" className="text-danger text-xs">
            {error}
          </p>
        )}
        <p className="text-muted text-xs">
          Sale como “Turnos: …” en la imagen para compartir. Vacío, no sale.
        </p>
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              setEditing(false);
              setValue(current ?? "");
              setError(null);
            }}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={isPending}>
            {isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1 flex items-center gap-2 text-[12.5px]">
      {current && (
        <span className="text-muted truncate">
          Turnos: <span className="text-foreground font-mono">{current}</span>
        </span>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-accent-ink flex-none font-semibold"
        >
          {current ? "Editar" : "Agregar teléfono"}
        </button>
      )}
    </div>
  );
}
