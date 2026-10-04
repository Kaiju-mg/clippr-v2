"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Switch } from "@/components/ui/Switch";
import { ServiceInlineForm } from "./ServiceInlineForm";
import { toggleServiceStatusAction } from "@/actions/service.actions";
import { formatGuaranies } from "@/lib/utils";
import type { Service } from "@/types";
import { BlankTicket } from "@/components/ticket/BlankTicket";
import { catalogSummary } from "@/lib/catalog-summary";

interface ServiceListProps {
  services: Service[];
}

interface ToggleAction {
  id: string;
  isActive: boolean;
}

export function ServiceList({ services }: ServiceListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [optimisticServices, applyOptimisticToggle] = useOptimistic(
    services,
    (state: Service[], action: ToggleAction) =>
      state.map((service) =>
        service.id === action.id
          ? { ...service, is_active: action.isActive }
          : service,
      ),
  );

  function closeForms() {
    setIsCreating(false);
    setEditingId(null);
  }

  function toggleCreate() {
    setError(null);
    setEditingId(null);
    setIsCreating((current) => !current);
  }

  function toggleEdit(id: string) {
    setError(null);
    setIsCreating(false);
    setEditingId((current) => (current === id ? null : id));
  }

  function handleSaved() {
    closeForms();
    router.refresh();
  }

  function handleToggleActive(service: Service) {
    const nextActive = !service.is_active;
    setError(null);

    startTransition(async () => {
      applyOptimisticToggle({ id: service.id, isActive: nextActive });

      const result = await toggleServiceStatusAction(service.id, nextActive);
      if (!result.success) {
        setError(result.error);
      }

      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Servicios</h1>
        <Button
          onClick={toggleCreate}
          variant={isCreating ? "secondary" : "primary"}
        >
          {isCreating ? "Cancelar" : "Nuevo servicio"}
        </Button>
      </div>

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      {isCreating && (
        <ServiceInlineForm
          service={null}
          onCancel={closeForms}
          onSaved={handleSaved}
        />
      )}

      {optimisticServices.length === 0 && !isCreating ? (
        <BlankTicket text="Todavía no cargaste servicios." />
      ) : (
        <>
          <p className="text-muted font-mono text-xs tabular-nums">
            {catalogSummary({
              active: optimisticServices.filter((s) => s.is_active).length,
              paused: optimisticServices.filter((s) => !s.is_active).length,
            })}
          </p>
          <ul className="flex flex-col">
            {optimisticServices.map((service) => {
              const isOpen = editingId === service.id;
              return (
                <li
                  key={service.id}
                  // Punteado: cada fila lleva un precio (spec 10, regla 3),
                  // el mismo renglón que la agenda y la caja.
                  className="border-muted/55 border-b border-dashed last:border-b-0"
                >
                  <div className="flex items-center justify-between gap-3 py-3.5">
                    <div
                      className={`flex min-w-0 flex-col gap-1 ${
                        service.is_active ? "" : "opacity-40"
                      }`}
                    >
                      <span className="font-display truncate text-[17px] font-semibold">
                        {service.name}
                      </span>
                      <span className="text-muted font-mono text-[13px] tabular-nums">
                        {service.duration_minutes} min
                      </span>
                    </div>
                    <span
                      className={`text-accent-ink font-mono text-[15px] font-semibold whitespace-nowrap tabular-nums ${
                        service.is_active ? "" : "opacity-40"
                      }`}
                    >
                      {formatGuaranies(service.price)}
                    </span>
                    <div className="flex flex-none items-center gap-2">
                      <Switch
                        checked={service.is_active}
                        onChange={() => handleToggleActive(service)}
                        label={
                          service.is_active
                            ? `Desactivar ${service.name}`
                            : `Activar ${service.name}`
                        }
                      />
                      <button
                        type="button"
                        onClick={() => toggleEdit(service.id)}
                        aria-label={isOpen ? "Cerrar edición" : "Editar"}
                        aria-expanded={isOpen}
                        className={`grid h-8 w-8 place-items-center rounded-md border ${
                          isOpen
                            ? "border-accent text-accent-ink"
                            : "border-line text-muted"
                        }`}
                      >
                        {isOpen ? (
                          <svg
                            viewBox="0 0 20 20"
                            width="15"
                            height="15"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                          >
                            <path d="M5.5 12.5 10 8l4.5 4.5" />
                          </svg>
                        ) : (
                          <svg
                            viewBox="0 0 20 20"
                            width="15"
                            height="15"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="1.6"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M13.3 3.3a1.6 1.6 0 0 1 2.3 2.3L6.4 14.8l-3 .8.8-3Z" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  {isOpen && (
                    <ServiceInlineForm
                      service={service}
                      onCancel={closeForms}
                      onSaved={handleSaved}
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
