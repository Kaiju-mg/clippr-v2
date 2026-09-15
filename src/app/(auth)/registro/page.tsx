"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerOwnerAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/Button";

export default function RegistroPage() {
  const router = useRouter();
  const [barbershopName, setBarbershopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await registerOwnerAction({
      email,
      password,
      ownerName,
      barbershopName,
    });

    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    router.push("/inicio");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-xl font-semibold">Crear cuenta</h1>
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <label htmlFor="barbershopName" className="text-sm">
            Nombre de la barbería
          </label>
          <input
            id="barbershopName"
            name="barbershopName"
            type="text"
            required
            value={barbershopName}
            onChange={(event) => setBarbershopName(event.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="ownerName" className="text-sm">
            Tu nombre
          </label>
          <input
            id="ownerName"
            name="ownerName"
            type="text"
            required
            value={ownerName}
            onChange={(event) => setOwnerName(event.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <Button type="submit" disabled={isLoading} className="w-full py-2.5">
          {isLoading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>

      <p className="text-sm">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="underline">
          Iniciá sesión
        </Link>
      </p>
    </main>
  );
}
