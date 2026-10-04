"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { OfflineNotice } from "@/components/ui/OfflineNotice";
import { useOnline } from "@/lib/useOnline";
import { closeCashSessionAction } from "@/actions/cash.actions";
import { useCloseCelebration } from "@/store/closeCelebrationStore";

interface CloseCashButtonProps {
  sessionId: string;
}

/**
 * Botón de cierre con confirmación in-line (no modal, mismo patrón que el
 * resto del dashboard) para evitar cierres accidentales con un solo toque.
 * Al cerrar, dispara el ticket del cierre (`CloseTicket`, spec 10) con el
 * resumen que armó el servidor: sale siempre, con o sin racha.
 *
 * Sin señal (spec 10, fase 3) no deja cerrar: el cierre es un Server Action
 * y la caja seguiría abierta. Lo dice en vez de fallar al tocar.
 */
export function CloseCashButton({ sessionId }: CloseCashButtonProps) {
  const router = useRouter();
  const showTicket = useCloseCelebration((state) => state.show);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const online = useOnline();

  async function handleConfirm() {
    if (!online) return;
    setError(null);
    setIsLoading(true);

    const result = await closeCashSessionAction(sessionId);

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    // El ticket sale en todo cierre: es el resumen del día. El sello de la
    // racha va sólo si la racha se guardó (`streak` no es null).
    const { session, streak, summary, barberName, share } = result.data;
    showTicket({
      summary,
      // `end_time` lo pone el servidor; el respaldo es sólo por las dudas.
      closedAt: session.end_time ?? new Date().toISOString(),
      barberName,
      streak,
      share,
    });

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

        {!online && <OfflineNotice pending="se cerró la caja" />}

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
            disabled={isLoading || !online}
          >
            {isLoading ? "Cerrando..." : "Sí, cerrar caja"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={() => setIsConfirming(true)}
        disabled={!online}
        className="rounded-tile w-full py-4 text-lg"
      >
        Cerrar caja
      </Button>
      {!online && (
        <div className="text-center">
          <OfflineNotice pending="se cerró la caja" />
        </div>
      )}
    </div>
  );
}
