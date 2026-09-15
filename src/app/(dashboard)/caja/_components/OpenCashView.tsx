"use client";

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { openCashSessionAction } from "@/actions/cash.actions";

const FONT_SIZE_MAX_REM = 4.5;
const FONT_SIZE_MIN_REM = 1.75;
const CARACTERES_ANTES_DE_ACHICAR = 6;
const REM_POR_CARACTER_EXTRA = 0.3;

const FORMATO_MILES = new Intl.NumberFormat("es-PY");

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

function soloDigitos(value: string): string {
  return value.replace(/\D/g, "");
}

function quitarCerosALaIzquierda(digitos: string): string {
  return digitos.replace(/^0+(?=\d)/, "");
}

function formatearConPuntosDeMiles(digitos: string): string {
  return digitos ? FORMATO_MILES.format(Number(digitos)) : "";
}

/**
 * Pantalla de apertura de caja, estilo terminal de punto de venta: el
 * input del saldo inicial es el foco absoluto de la pantalla (spec 04,
 * sección 5) porque es una acción diaria obligatoria antes de poder
 * trabajar, no un formulario más.
 */
export function OpenCashView() {
  const router = useRouter();
  // Solo dígitos, sin puntos: lo que se manda al Server Action. Los puntos
  // de miles se agregan al mostrarlo (formatearConPuntosDeMiles), nunca se
  // guardan en el estado.
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const amountFormateado = formatearConPuntosDeMiles(amount);

  function handleAmountChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const cursorPos = input.selectionStart ?? input.value.length;
    const digitosAntesDelCursor = soloDigitos(
      input.value.slice(0, cursorPos),
    ).length;

    const nuevosDigitos = quitarCerosALaIzquierda(soloDigitos(input.value));
    setAmount(nuevosDigitos);

    // Los puntos de miles pueden aparecer/desaparecer con cada tecla y
    // correr el cursor (React re-renderiza el value ya formateado) — lo
    // recalculamos contando cuántos dígitos había antes del cursor y
    // ubicándolo después de esa misma cantidad de dígitos en el texto ya
    // formateado, en vez de dejar que salte al final en cada tecla.
    requestAnimationFrame(() => {
      const formateado = formatearConPuntosDeMiles(nuevosDigitos);
      let nextCursor = 0;
      if (digitosAntesDelCursor > 0) {
        let digitosVistos = 0;
        nextCursor = formateado.length;
        for (let i = 0; i < formateado.length; i++) {
          if (/\d/.test(formateado[i])) digitosVistos++;
          if (digitosVistos === digitosAntesDelCursor) {
            nextCursor = i + 1;
            break;
          }
        }
      }
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await openCashSessionAction(Number(amount));

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
        <p className="text-sm font-medium text-muted">
          Saldo inicial en el cajón
        </p>
        <div className="flex w-full items-baseline justify-center gap-2">
          <span className="font-display text-2xl font-semibold text-muted">
            Gs.
          </span>
          <input
            type="text"
            inputMode="numeric"
            autoFocus
            required
            value={amountFormateado}
            onChange={handleAmountChange}
            placeholder="0"
            aria-label="Saldo inicial"
            className="w-full min-w-0 border-none bg-transparent text-center font-display font-bold tabular-nums text-foreground outline-none"
            style={{
              fontSize: calcularTamanioFuente(
                Math.max(amountFormateado.length, 1),
              ),
            }}
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="text-sm text-danger">
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
