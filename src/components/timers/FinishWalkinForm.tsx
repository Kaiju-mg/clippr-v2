"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { OfflineNotice } from "@/components/ui/OfflineNotice";
import { useOnline } from "@/lib/useOnline";
import { completeWalkinAction } from "@/actions/walkin.actions";
import { formatGuaranies } from "@/lib/utils";
import { SinCajaAviso } from "./SinCajaAviso";
import type { Service } from "@/types";
import type { Timer } from "@/store/timerStore";

interface FinishWalkinFormProps {
  timer: Timer;
  cashSessionId: string | null;
  services: Service[];
  onCancel: () => void;
  onDone: () => void;
}

/**
 * Aparece al detener un timer (spec 05, sección 2). Sin caja abierta no
 * deja cobrar — muestra el aviso y bloquea el formulario en vez de
 * intentar la acción (sección 6, "Sin Caja Abierta"). Sin señal tampoco
 * (spec 10, fase 3): el cobro es un Server Action y fallaría.
 */
export function FinishWalkinForm({
  timer,
  cashSessionId,
  services,
  onCancel,
  onDone,
}: FinishWalkinFormProps) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [clientName, setClientName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const online = useOnline();

  if (!cashSessionId) {
    return <SinCajaAviso onCancel={onCancel} />;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!online) return;

    if (!serviceId) {
      setError("Elegí un servicio.");
      return;
    }

    setIsLoading(true);

    // cashSessionId ya está garantizado no-null acá: el guard de arriba
    // corta el render antes de llegar a este formulario si es null.
    const result = await completeWalkinAction({
      serviceId,
      cashSessionId: cashSessionId as string,
      startTime: new Date(timer.startTime).toISOString(),
      clientName: clientName.trim() || undefined,
    });

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    onDone();
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-background mt-3 flex flex-col gap-3 rounded-lg p-3.5"
    >
      <div className="flex flex-col gap-1">
        <label
          htmlFor={`service-${timer.id}`}
          className="text-muted text-sm font-medium"
        >
          Servicio
        </label>
        <select
          id={`service-${timer.id}`}
          value={serviceId}
          onChange={(event) => setServiceId(event.target.value)}
          className="border-line bg-background text-foreground rounded border px-3 py-2"
          required
          disabled={services.length === 0}
        >
          {services.length === 0 ? (
            <option value="">No hay servicios activos</option>
          ) : (
            services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} — {formatGuaranies(service.price)}
              </option>
            ))
          )}
        </select>
      </div>

      <Input
        id={`client-${timer.id}`}
        label="Cliente (opcional)"
        placeholder="Cliente de paso"
        value={clientName}
        onChange={(event) => setClientName(event.target.value)}
      />

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      {!online && <OfflineNotice pending="se cobró" />}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isLoading}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading || services.length === 0 || !online}
        >
          {isLoading ? "Cobrando..." : "Cobrar"}
        </Button>
      </div>
    </form>
  );
}
