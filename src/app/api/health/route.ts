import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Health check. No toca base de datos ni auth: solo confirma que el
 * runtime de Next.js responde. Útil para probes de deploy y uptime.
 */
export function GET() {
  return NextResponse.json({
    status: "ok",
    service: "clippr-v2",
    timestamp: new Date().toISOString(),
  });
}
