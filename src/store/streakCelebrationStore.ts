import { create } from "zustand";

export interface StreakCelebration {
  previous: number;
  current: number;
  /** Saldo con el que se cerró la caja, para recordarlo en la hoja. */
  finalBalance: number | null;
}

interface StreakCelebrationState {
  celebration: StreakCelebration | null;
  show: (celebration: StreakCelebration) => void;
  dismiss: () => void;
}

/**
 * La hoja del poste que aparece al cerrar la caja con la racha arriba. Es un
 * store y no estado de `CloseCashButton` porque, apenas se cierra, `/caja`
 * se vuelve a renderizar como "Abrir caja" y el botón se desmonta: la hoja
 * vive en el layout del dashboard y lee de acá.
 *
 * Sin `persist` a propósito: un festejo no sobrevive a un F5.
 */
export const useStreakCelebration = create<StreakCelebrationState>((set) => ({
  celebration: null,
  show: (celebration) => set({ celebration }),
  dismiss: () => set({ celebration: null }),
}));
