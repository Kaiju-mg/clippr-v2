import { getServicesAction } from "@/actions/service.actions";
import { ServiceList } from "./_components/ServiceList";

export default async function ServiciosPage() {
  const result = await getServicesAction();

  if (!result.success) {
    return (
      <p role="alert" className="text-danger p-4 text-sm">
        {result.error}
      </p>
    );
  }

  return <ServiceList services={result.data} />;
}
