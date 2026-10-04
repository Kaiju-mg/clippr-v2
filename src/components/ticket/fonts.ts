import { Courier_Prime } from "next/font/google";

/**
 * Courier Prime, la letra de máquina del ticket (spec 10). `preload: false`
 * para que el archivo no se baje en todas las pantallas del dashboard, sino
 * recién cuando aparece un ticket. Una sola instancia: `next/font` exige
 * declararla en el nivel del módulo y la comparten `TicketReceipt` y
 * `BlankTicket`.
 */
export const courier = Courier_Prime({
  subsets: ["latin"],
  weight: ["400", "700"],
  preload: false,
});
