"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { useAmountInput } from "@/components/forms/useAmountInput";
import { openCashSessionAction } from "@/actions/cash.actions";

const FONT_SIZE_MAX_REM = 4.5;
const FONT_SIZE_MIN_REM = 1.75;
const CARACTERES_ANTES_DE_ACHICAR = 6;
const REM_POR_CARACTER_EXTRA = 0.3;

/**
 * Tamaño de fuente del monto según la cantidad de caracteres visibles
 * (dígitos + puntos de miles), no del ancho de la ventana: un `clamp()` con
 * unidades `vw` se calcula por el viewport, así que en una pantalla ancha
 * con un número largo el input igual desborda su contenedor (y el
 * navegador, al mantener el cursor visible, recorta el principio del
 * número en vez de mostrarlo completo). Atar el tamaño a lo que realmente
 * se está por renderizar garantiza que un número largo siempre entre.
 */
function calcularTamanioFuente(cantidadCaracteres: number): string {
  const extra = Math.max(0, cantidadCaracteres - CARACTERES_ANTES_DE_ACHICAR);
  const rem = FONT_SIZE_MAX_REM - extra * REM_POR_CARACTER_EXTRA;
  return `${Math.max(FONT_SIZE_MIN_REM, rem)}rem`;
}

/**
 * Pantalla de apertura de caja, estilo terminal de punto de venta: el
 * input del saldo inicial es el foco absoluto de la pantalla (spec 04,
 * sección 5) porque es una acción diaria obligatoria antes de poder
 * trabajar, no un formulario más.
 */
export function OpenCashView() {
  const router = useRouter();
  // Separador de miles en vivo y manejo del cursor: ver useAmountInput.
  const amount = useAmountInput();
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await openCashSessionAction(Number(amount.digits));

    setIsLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-[calc(100vh-57px)] flex-col items-center justify-center gap-8 p-4"
    >
      <div className="flex w-full max-w-sm flex-col items-center gap-2 text-center">
        <p className="text-muted text-sm font-medium">
          Saldo inicial en el cajón
        </p>
        <div className="flex w-full items-baseline justify-center gap-2">
          <span className="font-display text-muted text-2xl font-semibold">
            Gs.
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            required
            value={amount.formatted}
            onChange={amount.handleChange}
            placeholder="0"
            aria-label="Saldo inicial"
            className="font-display text-foreground w-full min-w-0 border-none bg-transparent text-center font-bold tabular-nums outline-none"
            style={{
              fontSize: calcularTamanioFuente(
                Math.max(amount.formatted.length, 1),
              ),
            }}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full max-w-xs py-4 text-lg"
      >
        {isLoading ? "Abriendo caja..." : "Abrir caja"}
      </Button>
    </form>
  );
}
