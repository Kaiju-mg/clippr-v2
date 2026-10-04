import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BARBER_DELETE_CONFIRMATION } from "@/lib/legal";
import type { UserRole } from "@/types";
import { DeleteAccountForm } from "./_components/DeleteAccountForm";

interface Perfil {
  role: UserRole;
  barbershops: { name: string } | null;
}

async function perfilPropio(): Promise<Perfil | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("users")
    .select("role, barbershops(name)")
    .eq("auth_id", user.id)
    .maybeSingle<Perfil>();
  return data;
}

/** Cuántos barberos (sin contar al dueño) se borran con la barbería. */
async function barberosDelEquipo(): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("users")
    .select("id", { count: "exact", head: true })
    .eq("role", "barber")
    .not("auth_id", "is", null);
  return count ?? 0;
}

/**
 * "Eliminar mi cuenta" (2026-10-04). Explica qué se borra según el rol
 * antes de pedir la confirmación escrita: el dueño se lleva la barbería
 * entera; el barbero se va sin llevarse la caja del negocio.
 */
export default async function EliminarCuentaPage() {
  const perfil = await perfilPropio();
  const esBarbero = perfil?.role === "barber";
  const barberia = perfil?.barbershops?.name ?? "tu barbería";
  const barberos = esBarbero ? 0 : await barberosDelEquipo();

  return (
    <div className="flex flex-col gap-5 p-4">
      <div className="flex items-center gap-2.5">
        <Link
          href="/mas"
          aria-label="Volver a Más"
          className="border-line bg-surface-2 grid h-8 w-8 flex-none place-items-center rounded-full border"
        >
          <ChevronLeft size={16} strokeWidth={2} />
        </Link>
        <h1 className="font-display text-xl font-semibold">
          Eliminar mi cuenta
        </h1>
      </div>

      {esBarbero ? (
        <section className="flex flex-col gap-2 text-[15px] leading-relaxed">
          <p>Al eliminar tu cuenta:</p>
          <ul className="text-muted flex list-disc flex-col gap-1.5 pl-5 text-sm">
            <li>
              Se borran tu email y tu contraseña: no vas a poder volver a
              entrar.
            </li>
            <li>
              Tu nombre se reemplaza por “Barbero eliminado” en la barbería.
            </li>
            <li>
              Los cortes y cobros que hiciste quedan en la caja de{" "}
              <strong className="text-foreground">{barberia}</strong>, sin tus
              datos: son registros del negocio.
            </li>
            <li>Si tenés una caja abierta, primero cerrala.</li>
          </ul>
        </section>
      ) : (
        <section className="flex flex-col gap-2 text-[15px] leading-relaxed">
          <p>
            Sos el dueño: eliminar tu cuenta borra <strong>{barberia}</strong>{" "}
            entera.
          </p>
          <ul className="text-muted flex list-disc flex-col gap-1.5 pl-5 text-sm">
            <li>
              Todos los turnos, cajas, cobros, servicios y productos, para
              siempre.
            </li>
            <li>
              {barberos === 0
                ? "Tu cuenta, con tu email y tu contraseña."
                : barberos === 1
                  ? "Tu cuenta y la de tu barbero: ninguno va a poder volver a entrar."
                  : `Tu cuenta y las de tus ${barberos} barberos: nadie del equipo va a poder volver a entrar.`}
            </li>
            <li>
              No se puede deshacer. Si querés guardar algo, anotalo antes.
            </li>
          </ul>
        </section>
      )}

      <DeleteAccountForm
        expected={esBarbero ? BARBER_DELETE_CONFIRMATION : barberia}
        label={
          esBarbero
            ? `Escribí ${BARBER_DELETE_CONFIRMATION} para confirmar`
            : "Escribí el nombre de tu barbería"
        }
      />

      <p className="text-muted text-xs">
        Más detalles en la{" "}
        <Link href="/privacidad" className="underline">
          Política de Privacidad
        </Link>
        .
      </p>
    </div>
  );
}
