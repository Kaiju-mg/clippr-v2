import type { ReactNode } from "react";
import Link from "next/link";
import { BarberPole } from "@/components/ui/BarberPole";
import { LEGAL } from "@/lib/legal";

interface LegalPageProps {
  title: string;
  /** "Última actualización: …"; las páginas de ayuda no lo llevan. */
  dated?: boolean;
  children: ReactNode;
}

/**
 * Marco de las páginas públicas (privacidad, términos, ayuda, eliminar
 * cuenta): se leen sin iniciar sesión, desde el registro, desde `/mas` y
 * desde las tiendas. Texto corrido a ~65 caracteres, sin la barra de
 * navegación del dashboard.
 */
export function LegalPage({ title, dated = true, children }: LegalPageProps) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8">
      <Link href="/login" className="flex items-center gap-3 self-start">
        <BarberPole size="sm" tier="acero" status="activa" />
        <span className="text-2xl leading-none font-extrabold tracking-[-0.04em]">
          Clippr
        </span>
      </Link>

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight text-balance">
          {title}
        </h1>
        {dated && (
          <p className="text-muted text-sm">
            Última actualización: {LEGAL.actualizado}
          </p>
        )}
      </header>

      <article className="flex max-w-[65ch] flex-col gap-6 text-[15px] leading-relaxed">
        {children}
      </article>

      <nav
        aria-label="Documentos de Clippr"
        className="border-line text-muted flex flex-wrap gap-x-4 gap-y-1 border-t pt-4 text-sm"
      >
        <Link href="/terminos" className="underline">
          Términos
        </Link>
        <Link href="/privacidad" className="underline">
          Privacidad
        </Link>
        <Link href="/ayuda" className="underline">
          Ayuda
        </Link>
        <Link href="/eliminar-cuenta" className="underline">
          Eliminar cuenta
        </Link>
      </nav>
    </main>
  );
}

/** Una sección del documento: título y párrafos o listas. */
export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

/** Lista con viñetas, en el gris de la app. */
export function Bullets({ children }: { children: ReactNode }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 pl-5 marker:text-[var(--muted)]">
      {children}
    </ul>
  );
}

/** El email de contacto, o un aviso bien visible si todavía no está. */
export function ContactEmail() {
  if (LEGAL.contactEmail) {
    return (
      <span className="font-mono text-[14px] select-all">
        {LEGAL.contactEmail}
      </span>
    );
  }
  return (
    <span className="bg-surface-2 text-danger rounded px-1.5 font-mono text-[14px]">
      [email de soporte pendiente]
    </span>
  );
}
