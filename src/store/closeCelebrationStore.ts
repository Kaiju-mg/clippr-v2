import { create } from "zustand";
import type { StreakChange } from "@/actions/cash.actions";
import type { CashSummary } from "@/lib/cash-summary";
import type { ShareDay } from "@/lib/share-day";

/** Todo lo que imprime el ticket del cierre. Viene entero del servidor. */
export interface CloseCelebration {
  summary: CashSummary;
  /** `end_time` de la caja cerrada. */
  closedAt: string;
  barberName: string | null;
  /**
   * La racha después del cierre. null si la caja no tuvo cobros o la racha
   * no se pudo guardar (falta `SUPABASE_SERVICE_ROLE_KEY`, spec 09): el
   * ticket sale igual, sin sello.
   */
  streak: StreakChange | null;
  /**
   * Lo de la imagen "Compartir el día" (fase 3). null: el ticket sale sin el
   * botón "Compartir".
   */
  share: ShareDay | null;
}

interface CloseCelebrationState {
  celebration: CloseCelebration | null;
  show: (celebration: CloseCelebration) => void;
  dismiss: () => void;
}

/**
 * El ticket que se imprime al cerrar la caja (spec 10, fase 2; antes era la
 * hoja del poste). Es un store y no estado de `CloseCashButton` porque, apenas
 * se cierra, `/caja` se vuelve a renderizar como "Abrir caja" y el botón se
 * desmonta: el ticket vive en el layout del dashboard y lee de acá.
 *
 * Sin `persist` a propósito: el ticket no sobrevive a un F5.
 */
export const useCloseCelebration = create<CloseCelebrationState>((set) => ({
  celebration: null,
  show: (celebration) => set({ celebration }),
  dismiss: () => set({ celebration: null }),
}));
