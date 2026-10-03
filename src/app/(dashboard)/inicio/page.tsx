import Link from "next/link";
import { Scissors, Flame } from "lucide-react";
import { getAgendaAction } from "@/actions/agenda.actions";
import { getCurrentCashSessionAction } from "@/actions/cash.actions";
import { getServicesAction } from "@/actions/service.actions";
import { getBarberStatsAction } from "@/actions/stats.actions";
import { StatTile } from "@/components/ui/Tile";
import { TimerList } from "@/components/timers/TimerList";
import { businessToday, formatBusinessDateLabel } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { UpcomingAppointments } from "./_components/UpcomingAppointments";

/** "Eduardo Villalba" → "EV". Sin nombre, la inicial de "Barbero". */
function initials(name: string | null | undefined): string {
  const partes = (name ?? "Barbero").trim().split(/\s+/).slice(0, 2);
  return partes.map((parte) => parte.charAt(0).toUpperCase()).join("");
}

/**
 * Pantalla principal del barbero, como grilla bento: dos cubos con lo que
 * le importa del día (su racha y sus cortes), el cubo relleno para arrancar
 * un corte, y abajo los turnos agendados.
 *
 * La caja no está acá a propósito (decisión del 2026-09-20): tiene su
 * pantalla en la BottomNav y en /inicio competía con la única acción que
 * esta pantalla tiene que empujar. El nivel tampoco: vive en
 * /estadisticas, donde hay espacio para explicar la liga de 30 días.
 */
export default async function InicioPage() {
  const hoy = businessToday();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileResult, cashResult, servicesResult, statsResult, agendaResult] =
    await Promise.all([
      supabase
        .from("users")
        .select("name")
        .eq("auth_id", user?.id ?? "")
        .maybeSingle<{ name: string }>(),
      getCurrentCashSessionAction(),
      getServicesAction(),
      getBarberStatsAction(hoy),
      getAgendaAction(hoy),
    ]);

  if (!cashResult.success) {
    return (
      <p role="alert" className="text-danger p-4 text-sm">
        {cashResult.error}
      </p>
    );
  }

  if (!servicesResult.success) {
    return (
      <p role="alert" className="text-danger p-4 text-sm">
        {servicesResult.error}
      </p>
    );
  }

  // Ni las estadísticas ni la agenda tumban la pantalla si fallan: /inicio
  // es donde el barbero arranca el día y tiene que poder iniciar y cobrar
  // un corte aunque los números secundarios no carguen. Los cubos se
  // muestran sin cifra (mejor sin número que con uno inventado) y la lista
  // de turnos avisa que no cargó.
  const stats = statsResult.success ? statsResult.data : null;
  const appointments = agendaResult.success ? agendaResult.data : [];

  const nombre = profileResult.data?.name;
  const firstName = nombre?.split(" ")[0] ?? "Barbero";

  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-end justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="text-muted text-[11px] font-medium tracking-[0.14em] uppercase">
            {formatBusinessDateLabel(hoy)}
          </span>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Hola, {firstName}
          </h1>
        </div>
        <Link
          href="/mas"
          aria-label="Tu perfil y ajustes"
          className="bg-surface-2 border-line text-accent-ink grid h-10 w-10 flex-none place-items-center rounded-full border text-sm font-semibold"
        >
          {initials(nombre)}
        </Link>
      </header>

      {/* Racha y cortes arriba de "Iniciar corte": es lo primero que el
          barbero quiere ver al abrir la app (pedido del 2026-09-20).
          Compactos y sin `aspect-square`: cuadrados se comían media
          pantalla y el CTA quedaba abajo del pliegue. */}
      <div className="grid grid-cols-2 gap-3">
        <StatTile
          href="/estadisticas"
          compact
          icon={<Flame size={16} strokeWidth={1.5} />}
          value={stats ? String(stats.streakCount) : undefined}
          label={
            stats && stats.streakCount === 1 ? "Día de racha" : "Días de racha"
          }
        />
        <StatTile
          href="/estadisticas"
          compact
          icon={<Scissors size={16} strokeWidth={1.5} />}
          value={stats ? String(stats.completedCuts) : undefined}
          label={
            stats && stats.completedCuts === 1 ? "Corte hoy" : "Cortes hoy"
          }
        />
      </div>

      {/* Todos los servicios, no sólo los activos: `TimerList` filtra los
          activos para el walk-in, pero un turno agendado en curso puede
          apuntar a uno desactivado y su nombre igual tiene que mostrarse. */}
      <TimerList
        cashSessionId={cashResult.data?.id ?? null}
        services={servicesResult.data}
      />

      <UpcomingAppointments
        appointments={appointments}
        services={servicesResult.data}
        failed={!agendaResult.success}
      />
    </div>
  );
}
