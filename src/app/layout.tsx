import type { Metadata, Viewport } from "next";
import { Work_Sans, Zilla_Slab } from "next/font/google";
import "./globals.css";

const workSans = Work_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-work-sans",
});

const zillaSlab = Zilla_Slab({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-zilla-slab",
});

export const metadata: Metadata = {
  title: "Clippr",
  description: "Gestión de turnos y caja para barberías",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Clippr",
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${workSans.variable} ${zillaSlab.variable}`}>
      <body>{children}</body>
    </html>
  );
}
