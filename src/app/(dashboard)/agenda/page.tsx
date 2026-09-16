import { getAgendaAction } from "@/actions/agenda.actions";
import { getCurrentCashSessionAction } from "@/actions/cash.actions";
import { getServicesAction } from "@/actions/service.actions";
import { AgendaView } from "./_components/AgendaView";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AgendaPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const params = await searchParams;
  const dateISO =
    params.date && DATE_RE.test(params.date) ? params.date : todayISO();

  const [agendaResult, cashResult, servicesResult] = await Promise.all([
    getAgendaAction(dateISO),
    getCurrentCashSessionAction(),
    getServicesAction(),
  ]);

  if (!agendaResult.success) {
    return (
      <p role="alert" className="p-4 text-sm text-danger">
        {agendaResult.error}
      </p>
    );
  }

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

  return (
    <AgendaView
      dateISO={dateISO}
      appointments={agendaResult.data}
      cashSessionId={cashResult.data?.id ?? null}
      services={servicesResult.data}
    />
  );
}
