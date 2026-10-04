import Link from "next/link";
import { cn } from "@/lib/utils";

export type OwnerView = "barberia" | "yo";

const OPCIONES: { view: OwnerView; label: string; href: string }[] = [
  { view: "barberia", label: "Mi barbería", href: "/estadisticas" },
  { view: "yo", label: "Yo", href: "/estadisticas?vista=yo" },
];

interface OwnerViewSwitchProps {
  active: OwnerView;
}

/**
 * Selector del dueño en `/estadisticas` (2026-10-04): "Mi barbería" es el
 * tablero del negocio (por defecto) y "Yo" es su propio rendimiento como
 * barbero, sólo sus números. Son links (`?vista=yo`) y no estado de
 * cliente, igual que los filtros de rango: cada cambio lo resuelve el
 * servidor.
 */
export function OwnerViewSwitch({ active }: OwnerViewSwitchProps) {
  return (
    <nav
      aria-label="Qué estadísticas ver"
      className="bg-surface-2 border-line grid grid-cols-2 rounded-full border p-[3px]"
    >
      {OPCIONES.map(({ view, label, href }) => (
        <Link
          key={view}
          href={href}
          aria-current={view === active ? "page" : undefined}
          className={cn(
            "rounded-full py-1.5 text-center text-[13px] font-semibold transition-transform duration-100 active:scale-95",
            view === active
              ? "bg-background text-foreground shadow-sm"
              : "text-muted",
          )}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
