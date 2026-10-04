import type { ComponentPropsWithRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

// Con `ref`: React 19 lo pasa como una prop más; sirve para poner el foco
// desde afuera (lo usaba la hoja del poste, que ya no existe).
interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: ButtonVariant;
}

/**
 * Un solo botón "gritón" (fondo Tinta sólido) por pantalla — el resto es
 * secundario (fondo `surface-2`) o fantasma (solo texto). Sin bordes de
 * color ni sombras: la separación de `danger` es el único borde que queda,
 * porque es una acción destructiva y necesita su propia señal.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-contrast",
  secondary: "bg-surface-2 text-foreground",
  ghost: "bg-transparent text-foreground",
  danger: "border border-danger text-danger",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`rounded px-3 py-2 text-sm font-medium transition-transform duration-100 active:scale-95 disabled:opacity-50 disabled:active:scale-100 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  );
}
