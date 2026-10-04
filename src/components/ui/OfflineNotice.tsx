interface OfflineNoticeProps {
  /** Lo que todavía no pasó: "se cobró", "se cerró la caja". */
  pending: string;
}

/**
 * "Sin señal · todavía no se cobró" (spec 10, fase 3, paso A). Honesto a
 * propósito: no existe cola offline, así que no promete "se guarda cuando
 * vuelva" (eso es el paso B, ver docs/deuda-tecnica.md). En `font-mono`,
 * como lo que imprime una máquina; sin rojo, porque no es un error del
 * barbero.
 */
export function OfflineNotice({ pending }: OfflineNoticeProps) {
  return (
    <p role="status" className="text-muted font-mono text-xs">
      Sin señal · todavía no {pending}
    </p>
  );
}
