export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
      <h1 className="text-2xl font-semibold">Clippr v2</h1>
      <p className="text-sm opacity-70">
        Scaffolding listo. Health check en{" "}
        <code className="bg-surface-2 rounded px-1">/api/health</code>.
      </p>
    </main>
  );
}
