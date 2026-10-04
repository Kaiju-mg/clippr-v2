import type { ReactNode } from "react";
import { BarberPole } from "@/components/ui/BarberPole";

interface AuthShellProps {
  title: string;
  children: ReactNode;
  /** El link a la otra pantalla ("¿No tenés cuenta? …"). */
  footer: ReactNode;
}

/**
 * La primera impresión de Clippr (spec 10): el poste, el nombre y qué hace,
 * y el formulario sobre una tarjeta de papel con el borde de abajo en
 * zigzag. Compartido por login y registro.
 */
export function AuthShell({ title, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <header className="flex items-center gap-3.5">
          <BarberPole size="sm" tier="acero" status="activa" />
          <div className="flex flex-col gap-1">
            <span className="text-[30px] leading-none font-extrabold tracking-[-0.04em]">
              Clippr
            </span>
            <span className="text-muted text-[12.5px]">
              Turnos, caja y racha de tu barbería
            </span>
          </div>
        </header>

        <section
          aria-labelledby="auth-title"
          className="ticket-edge bg-surface-2 mb-2 flex flex-col gap-4 rounded-t-2xl p-4 [--edge-color:var(--surface-2)]"
        >
          <h1 id="auth-title" className="text-xl font-semibold tracking-tight">
            {title}
          </h1>
          {children}
        </section>

        <p className="text-muted text-center text-sm">{footer}</p>
      </div>
    </main>
  );
}
