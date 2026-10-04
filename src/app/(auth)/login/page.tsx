"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loginAction } from "@/actions/auth.actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AuthShell } from "../_components/AuthShell";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const result = await loginAction({ email, password });

    if (!result.success) {
      setError(result.error);
      setIsLoading(false);
      return;
    }

    router.push("/inicio");
  }

  return (
    <AuthShell
      title="Iniciar sesión"
      footer={
        <>
          ¿No tenés cuenta?{" "}
          <Link href="/registro" className="text-foreground underline">
            Registrá tu barbería
          </Link>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
          autoComplete="current-password"
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
          {isLoading ? "Ingresando..." : "Ingresar"}
        </Button>
      </form>
    </AuthShell>
  );
}
