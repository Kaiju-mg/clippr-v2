"use client";

import { useState, type FormEvent } from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import {
  createServiceAction,
  updateServiceAction,
  toggleServiceStatusAction,
} from "@/actions/service.actions";
import type { Service } from "@/types";

interface ServiceInlineFormProps {
  service: Service | null;
  onCancel: () => void;
  onSaved: () => void;
}

export function ServiceInlineForm({
  service,
  onCancel,
  onSaved,
}: ServiceInlineFormProps) {
  const [name, setName] = useState(service?.name ?? "");
  const [price, setPrice] = useState(service ? String(service.price) : "");
  const [durationMinutes, setDurationMinutes] = useState(
    service ? String(service.duration_minutes) : "30",
  );
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fieldPrefix = service?.id ?? "new";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const payload = {
      name,
      price: Number(price),
      duration_minutes: Number(durationMinutes),
    };

    const result = service
      ? await updateServiceAction(service.id, payload)
      : await createServiceAction(payload);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  async function handleDelete() {
    if (!service) return;

    setError(null);
    setIsLoading(true);

    const result = await toggleServiceStatusAction(service.id, false);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onSaved();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-surface-2 mx-0.5 mb-3.5 flex flex-col gap-3 rounded-lg p-3.5"
    >
      <Input
        id={`service-name-${fieldPrefix}`}
        label="Nombre"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      <Input
        id={`service-price-${fieldPrefix}`}
        label="Precio (₲)"
        type="number"
        min="0"
        step="1"
        className="tabular-nums"
        value={price}
        onChange={(event) => setPrice(event.target.value)}
        required
      />
      <Input
        id={`service-duration-${fieldPrefix}`}
        label="Duración (minutos)"
        type="number"
        min="1"
        step="1"
        className="tabular-nums"
        value={durationMinutes}
        onChange={(event) => setDurationMinutes(event.target.value)}
        required
      />

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-2">
        {service ? (
          <Button
            type="button"
            variant="danger"
            onClick={handleDelete}
            disabled={isLoading}
          >
            Eliminar
          </Button>
        ) : (
          <span />
        )}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>
    </form>
  );
}
