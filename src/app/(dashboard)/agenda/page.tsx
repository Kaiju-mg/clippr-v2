import { getAgendaAction } from "@/actions/agenda.actions";
import { getCurrentCashSessionAction } from "@/actions/cash.actions";
import { getServicesAction } from "@/actions/service.actions";
import { businessToday, isValidDateISO } from "@/lib/dates";
import { AgendaView } from "./_components/AgendaView";

interface AgendaPageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const params = await searchParams;
  const hoy = businessToday();
  const dateISO =
    params.date && isValidDateISO(params.date) ? params.date : hoy;
  // El "hoy" se resuelve acá, en el servidor, y baja como booleano: si la
  // agenda lo calculara en el cliente, el día del negocio dependería del
  // reloj del celular y además podría no coincidir con el render del
  // servidor (hidratación).
  const esDiaFuturo = dateISO > hoy;

  const [agendaResult, cashResult, servicesResult] = await Promise.all([
    getAgendaAction(dateISO),
    getCurrentCashSessionAction(),
    getServicesAction(),
  ]);

  if (!agendaResult.success) {
    return (
      <p role="alert" className="text-danger p-4 text-sm">
        {agendaResult.error}
      </p>
    );
  }

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

  return (
    <AgendaView
      dateISO={dateISO}
      esDiaFuturo={esDiaFuturo}
      appointments={agendaResult.data}
      cashSessionId={cashResult.data?.id ?? null}
      services={servicesResult.data}
    />
  );
}
