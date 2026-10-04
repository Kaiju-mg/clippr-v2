import { Stamp } from "@/components/ui/Stamp";

/** Poste chico de un solo color, dibujado con rayas en la tinta del sello. */
function InkPole() {
  return (
    <span
      aria-hidden="true"
      className="h-[30px] w-[9px] flex-none rounded-[2px] border-[1.5px] border-current bg-[repeating-linear-gradient(-45deg,currentColor_0_3px,transparent_3px_6px)]"
    />
  );
}

interface StreakStampProps {
  days: number;
  /** Cae al aparecer (el cierre). En la imagen para compartir va quieto. */
  animate?: boolean;
  delayMs?: number;
}

/**
 * "13 DÍAS DE RACHA" con el poste de tinta (spec 10): lo que cae sobre el
 * ticket del cierre y lo que lleva la imagen para compartir el día. Va
 * adentro de un `TicketReceipt`, que le da el rojo del papel.
 */
export function StreakStamp({
  days,
  animate = false,
  delayMs,
}: StreakStampProps) {
  return (
    <Stamp
      size="md"
      double
      animate={animate}
      delayMs={delayMs}
      className="font-sans opacity-95 mix-blend-multiply"
    >
      <InkPole />
      <span className="text-[11px] leading-[1.05] tracking-[0.12em]">
        {/* Los espacios explícitos son para el lector de pantalla: sin
            ellos lee "13DÍASDE RACHA". */}
        <b className="mr-1 align-[-3px] text-[22px] tracking-[-0.02em]">
          {days}
        </b>{" "}
        {days === 1 ? "DÍA" : "DÍAS"}{" "}
        <small className="block text-[9px] tracking-[0.18em]">DE RACHA</small>
      </span>
    </Stamp>
  );
}
