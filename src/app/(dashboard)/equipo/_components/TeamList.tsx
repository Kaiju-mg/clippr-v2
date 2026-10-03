"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { BarberInlineForm } from "./BarberInlineForm";
import type { User, UserLevel } from "@/types";

interface TeamListProps {
  team: User[];
  isOwner: boolean;
}

const NIVEL_LABELS: Record<UserLevel, string> = {
  junior: "Junior",
  pro: "Pro",
  senior: "Senior",
  elite: "Elite",
};

export function TeamList({ team, isOwner }: TeamListProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  function closeForms() {
    setIsCreating(false);
    setEditingId(null);
  }

  function toggleCreate() {
    setEditingId(null);
    setIsCreating((current) => !current);
  }

  function toggleEdit(id: string) {
    setIsCreating(false);
    setEditingId((current) => (current === id ? null : id));
  }

  function handleSaved() {
    closeForms();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold">Equipo</h1>
        {isOwner && (
          <Button
            onClick={toggleCreate}
            variant={isCreating ? "secondary" : "primary"}
          >
            {isCreating ? "Cancelar" : "Agregar barbero"}
          </Button>
        )}
      </div>

      {isCreating && (
        <BarberInlineForm
          barber={null}
          onCancel={closeForms}
          onSaved={handleSaved}
        />
      )}

      {team.length === 0 && !isCreating ? (
        <p className="text-muted text-sm">Todavía no hay nadie en el equipo.</p>
      ) : (
        <ul className="flex flex-col">
          {team.map((member) => {
            const isOpen = editingId === member.id;
            const isEditable = isOwner && member.role !== "owner";

            return (
              <li
                key={member.id}
                className="border-line border-b last:border-b-0"
              >
                <div className="flex items-center justify-between gap-3 py-3.5">
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="font-display truncate text-[17px] font-semibold">
                      {member.name}
                    </span>
                    <span className="text-muted text-[13px]">
                      {member.role === "owner"
                        ? "Dueño"
                        : NIVEL_LABELS[member.level]}
                    </span>
                  </div>
                  {/* El dueño no cobra comisión: mostrarle "0%" era ruido
                      visual que parecía un dato mal cargado (spec 09). */}
                  {member.role !== "owner" && (
                    <span className="text-accent-ink text-[17px] font-bold whitespace-nowrap tabular-nums">
                      {member.commission_pct}%
                    </span>
                  )}
                  {isEditable && (
                    <button
                      type="button"
                      onClick={() => toggleEdit(member.id)}
                      aria-label={isOpen ? "Cerrar edición" : "Editar"}
                      aria-expanded={isOpen}
                      className={`grid h-8 w-8 flex-none place-items-center rounded-md border ${
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
                  )}
                </div>
                {isOpen && (
                  <BarberInlineForm
                    barber={member}
                    onCancel={closeForms}
                    onSaved={handleSaved}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
