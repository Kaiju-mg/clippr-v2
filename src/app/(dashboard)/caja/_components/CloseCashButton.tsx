"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { closeCashSessionAction } from "@/actions/cash.actions";
import { useStreakCelebration } from "@/store/streakCelebrationStore";

interface CloseCashButtonProps {
  sessionId: string;
}

/**
 * Botón de cierre con confirmación in-line (no modal, mismo patrón que el
 * resto del dashboard) para evitar cierres accidentales con un solo toque.
 * Si la racha subió, dispara la hoja del poste (`StreakCelebration`).
 */
export function CloseCashButton({ sessionId }: CloseCashButtonProps) {
  const router = useRouter();
  const showCelebration = useStreakCelebration((state) => state.show);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleConfirm() {
    setError(null);
    setIsLoading(true);

    const result = await closeCashSessionAction(sessionId);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    // Sólo se festeja si la racha subió de verdad: la segunda caja del día
    // o una caja sin cobros no suman.
    const { streak, session } = result.data;
    if (streak && streak.current > streak.previous) {
      showCelebration({
        previous: streak.previous,
        current: streak.current,
        finalBalance: session.final_balance,
      });
    }

    router.refresh();
  }

  if (isConfirming) {
    return (
      <div className="border-line bg-surface-2 rounded-tile flex flex-col gap-3 border p-4">
        <p className="text-foreground text-sm">
          ¿Cerrar la caja? No vas a poder deshacer esto.
        </p>

        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsConfirming(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? "Cerrando..." : "Sí, cerrar caja"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() => setIsConfirming(true)}
      className="rounded-tile w-full py-4 text-lg"
    >
      Cerrar caja
    </Button>
  );
}
