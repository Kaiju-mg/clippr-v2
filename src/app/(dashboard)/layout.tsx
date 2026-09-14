export default function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Placeholder: acá irán nav lateral, guard de sesión y contexto de barbería.
  return <div className="min-h-screen">{children}</div>;
}
