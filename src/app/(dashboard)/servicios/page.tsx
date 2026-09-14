import { getServicesAction } from "@/actions/service.actions";
import { ServiceList } from "./_components/ServiceList";

export default async function ServiciosPage() {
  const result = await getServicesAction();

  if (!result.success) {
    return (
      <p role="alert" className="p-4 text-sm text-red-600">
        {result.error}
      </p>
    );
  }

  return <ServiceList services={result.data} />;
}
