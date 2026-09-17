import Link from "next/link";
import { Scissors, Flame } from "lucide-react";
import { getCurrentCashSessionAction } from "@/actions/cash.actions";
import { getServicesAction } from "@/actions/service.actions";
import { getBarberStatsAction } from "@/actions/stats.actions";
import { businessToday } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { TimerList } from "@/components/timers/TimerList";

export default async function InicioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileResult, cashResult, servicesResult, statsResult] =
    await Promise.all([
      supabase
        .from("users")
        .select("name")
        .eq("auth_id", user?.id ?? "")
        .maybeSingle<{ name: string }>(),
      getCurrentCashSessionAction(),
      getServicesAction(),
      getBarberStatsAction(businessToday()),
    ]);

  if (!cashResult.success) {
    return (
      <p role="alert" className="p-4 text-sm text-danger">
        {cashResult.error}
      </p>
    );
  }

  if (!servicesResult.success) {
    return (
      <p role="alert" className="p-4 text-sm text-danger">
        {servicesResult.error}
      </p>
    );
  }

  const activeServices = servicesResult.data.filter(
    (service) => service.is_active,
  );

  // Las píldoras dejaron de ser estáticas en la spec 08: ahora traen los
  // números reales del día. Si la consulta falla, se muestran sin cifra
  // (mismo criterio de antes: mejor sin número que con uno inventado) en
  // vez de tumbar toda la pantalla de inicio, que es donde el barbero
  // arranca los cortes.
  const stats = statsResult.success ? statsResult.data : null;

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Hola, {profileResult.data?.name?.split(" ")[0] ?? "Barbero"}
        </h1>
        <Link
          href="/estadisticas"
          className="flex items-center gap-2 transition-transform duration-100 active:scale-95"
        >
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
            <Scissors size={12} strokeWidth={1.5} />
            {stats
              ? `${stats.completedCuts} ${stats.completedCuts === 1 ? "corte" : "cortes"} hoy`
              : "Cortes de hoy"}
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
            <Flame size={12} strokeWidth={1.5} />
            {stats
              ? `Racha de ${stats.streakCount} ${stats.streakCount === 1 ? "día" : "días"}`
              : "Tu racha"}
          </span>
        </Link>
      </header>

      <TimerList
        cashSessionId={cashResult.data?.id ?? null}
        services={activeServices}
      />
    </div>
  );
}
