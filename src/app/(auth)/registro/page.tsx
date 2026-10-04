"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerOwnerAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthShell } from "../_components/AuthShell";

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
    <AuthShell
      title="Crear cuenta"
      footer={
        <>
          ¿Ya tenés cuenta?{" "}
          <Link href="/login" className="text-foreground underline">
            Iniciá sesión
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          id="barbershopName"
          label="Nombre de la barbería"
          name="barbershopName"
          type="text"
          required
          value={barbershopName}
          onChange={(event) => setBarbershopName(event.target.value)}
        />

        <Input
          id="ownerName"
          label="Tu nombre"
          name="ownerName"
          type="text"
          required
          value={ownerName}
          onChange={(event) => setOwnerName(event.target.value)}
        />

        <Input
          id="email"
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />

        <Input
          id="password"
          label="Contraseña"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        {error && (
          <p role="alert" className="text-danger text-sm">
            {error}
          </p>
        )}

        <Button type="submit" disabled={isLoading} className="w-full py-2.5">
          {isLoading ? "Creando cuenta..." : "Crear cuenta"}
        </Button>
      </form>
    </AuthShell>
  );
}
