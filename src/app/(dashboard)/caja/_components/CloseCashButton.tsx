"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { closeCashSessionAction } from "@/actions/cash.actions";

interface CloseCashButtonProps {
  sessionId: string;
}

/**
 * Botón de cierre con confirmación in-line (no modal, mismo patrón que el
 * resto del dashboard) para evitar cierres accidentales con un solo toque.
 */
export function CloseCashButton({ sessionId }: CloseCashButtonProps) {
  const router = useRouter();
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

    router.refresh();
  }

  if (isConfirming) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-3.5">
        <p className="text-sm text-foreground">
          ¿Cerrar la caja? No vas a poder deshacer esto.
        </p>

        {error && (
          <p role="alert" className="text-sm text-danger">
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
      className="w-full py-4 text-lg"
    >
      Cerrar caja
    </Button>
  );
}
