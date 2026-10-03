import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/**
 * Caja de los campos de formulario (Input y Select), con etiqueta flotante:
 * el nombre del campo vive adentro y sube achicado al escribir. Elegido el
 * 2026-10-03 en el muestrario "Campos de Clippr" (ver docs/decisiones.md).
 * 58 px de alto: cómodo con el pulgar, y deja lugar para la etiqueta arriba.
 */
export const fieldBoxClasses =
  "peer border-line-strong bg-background text-foreground h-[58px] w-full rounded-[14px] border-[1.5px] px-4 pt-[22px] pb-1.5 text-base outline-none transition-[border-color,box-shadow] focus:border-accent-ink focus:ring-4 focus:ring-accent-ink/20 disabled:opacity-50";

/**
 * Etiqueta en su posición "arriba". Va **después** del control en el DOM
 * para poder reaccionar a su estado con `peer-*`. El orden de los variantes
 * importa: `peer-placeholder-shown` (campo vacío, etiqueta grande al medio)
 * pierde contra `peer-focus` (al tocarlo vuelve a subir), porque Tailwind
 * emite `focus` después de `placeholder-shown`.
 */
export const floatingLabelClasses =
  "text-muted pointer-events-none absolute top-[9px] left-[17px] text-xs font-semibold transition-all peer-focus:text-accent-ink";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Texto fijo delante del valor, ej. "Gs.". Aparece cuando la etiqueta sube. */
  prefix?: string;
}

/**
 * La etiqueta sabe si el campo está vacío por `:placeholder-shown`, así que
 * el input siempre necesita un placeholder: si no viene uno, va un espacio.
 * Si viene uno ("Ej. Juan Pérez") queda invisible hasta que se toca el
 * campo, para no pisarse con la etiqueta.
 *
 * Los `type="time"`/`date"` no tienen placeholder, nunca están
 * `:placeholder-shown` y por eso muestran la etiqueta siempre arriba — es lo
 * correcto, porque el navegador ya dibuja "--:--" en el valor.
 */
export function Input({
  label,
  prefix,
  id,
  className,
  placeholder,
  ...props
}: InputProps) {
  return (
    <div className="relative">
      <input
        id={id}
        placeholder={placeholder ?? " "}
        className={cn(
          fieldBoxClasses,
          "focus:placeholder:text-muted placeholder:text-transparent",
          prefix && "pl-[46px]",
          className,
        )}
        {...props}
      />
      <label
        htmlFor={id}
        className={cn(
          floatingLabelClasses,
          "peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:text-base peer-placeholder-shown:font-normal",
          "peer-focus:top-[9px] peer-focus:translate-y-0 peer-focus:text-xs peer-focus:font-semibold",
          // Email y contraseña completados por el navegador en /login: el
          // valor está pero el campo puede seguir contando como vacío.
          "peer-autofill:top-[9px] peer-autofill:translate-y-0 peer-autofill:text-xs peer-autofill:font-semibold",
        )}
      >
        {label}
      </label>
      {prefix && (
        <span
          aria-hidden="true"
          className="text-muted pointer-events-none absolute top-[22px] bottom-1.5 left-4 flex items-center font-semibold transition-opacity peer-placeholder-shown:opacity-0 peer-focus:opacity-100"
        >
          {prefix}
        </span>
      )}
    </div>
  );
}
