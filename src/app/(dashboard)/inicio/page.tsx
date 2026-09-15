import { Scissors, Flame } from "lucide-react";
import { getCurrentCashSessionAction } from "@/actions/cash.actions";
import { getServicesAction } from "@/actions/service.actions";
import { createClient } from "@/lib/supabase/server";
import { TimerList } from "@/components/timers/TimerList";

export default async function InicioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [profileResult, cashResult, servicesResult] = await Promise.all([
    supabase
      .from("users")
      .select("name")
      .eq("auth_id", user?.id ?? "")
      .maybeSingle<{ name: string }>(),
    getCurrentCashSessionAction(),
    getServicesAction(),
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

  return (
    <div className="flex flex-col gap-6 p-4">
      {/* Píldoras sin número a propósito: cortes/racha todavía no tienen
          lógica real (spec 08). Un "0" fijo se leería como dato real y
          siempre diría lo mismo — peor que no mostrar nada. */}
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-xl font-semibold tracking-tight">
          Hola, {profileResult.data?.name?.split(" ")[0] ?? "Barbero"}
        </h1>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
            <Scissors size={12} strokeWidth={1.5} />
            Cortes de hoy
          </span>
          <span className="flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted">
            <Flame size={12} strokeWidth={1.5} />
            Tu racha
          </span>
        </div>
      </header>

      <TimerList
        cashSessionId={cashResult.data?.id ?? null}
        services={activeServices}
      />
    </div>
  );
}
