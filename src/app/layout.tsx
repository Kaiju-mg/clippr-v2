import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Inter } from "next/font/google";
import { cookies } from "next/headers";
import { parseTheme, THEME_BROWSER_COLOR, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
});

// Sólo para montos y horas (`font-mono tabular-nums`, spec 10). Elegida
// sobre Space Mono y JetBrains Mono porque es la que mejor se lee al sol.
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "Clippr",
  description: "Gestión de turnos y caja para barberías",
  manifest: "/manifest.json",
  // El poste sobre papel (spec 10, fase 5). iOS no lee los íconos del
  // manifest: necesita su `apple-touch-icon`, sin transparencia (redondea
  // las esquinas solo). Los SVG fuente están en `design/icono/`.
  icons: {
    icon: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Clippr",
  },
};

/** Lee la cookie del tema (`@/lib/theme`), no `prefers-color-scheme`. */
async function currentTheme() {
  const store = await cookies();
  return parseTheme(store.get(THEME_COOKIE)?.value);
}

// La barra del navegador tiene que acompañar al tema elegido, así que el
// viewport se genera por request en vez de ser una constante.
export async function generateViewport(): Promise<Viewport> {
  return {
    themeColor: THEME_BROWSER_COLOR[await currentTheme()],
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
  };
}

/**
 * El tema se resuelve en el servidor y baja como `data-theme` en el `<html>`:
 * el HTML ya llega pintado, sin el parpadeo típico de leer `localStorage` en
 * un script inline. Leer la cookie vuelve dinámica la raíz, que ya lo era de
 * hecho por las cookies de sesión de Supabase.
 */
export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const theme = await currentTheme();

  return (
    <html
      lang="es"
      className={`${inter.variable} ${plexMono.variable}`}
      data-theme={theme}
    >
      <body>{children}</body>
    </html>
  );
}
