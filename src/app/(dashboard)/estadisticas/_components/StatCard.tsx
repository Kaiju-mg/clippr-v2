/**
 * Tarjeta de un número. Monocroma (`bg-surface-2`, sin borde de color ni
 * sombra) como el resto del sistema de diseño — la jerarquía la da el
 * tamaño del número, no el color.
 */
interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <div className="bg-surface-2 flex flex-col gap-1 rounded-lg p-4">
      <p className="text-muted text-xs font-medium">{label}</p>
      <p className="font-display text-2xl font-semibold tabular-nums">
        {value}
      </p>
      {hint && <p className="text-muted text-xs">{hint}</p>}
    </div>
  );
}
