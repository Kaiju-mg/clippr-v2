import { createClient } from "@/lib/supabase/server";
import { getTeamAction, getTeamEmailsAction } from "@/actions/team.actions";
import { TeamList } from "./_components/TeamList";

export default async function EquipoPage() {
  const result = await getTeamAction();

  if (!result.success) {
    return (
      <p role="alert" className="text-danger p-4 text-sm">
        {result.error}
      </p>
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isOwner = result.data.some(
    (member) => member.auth_id === user?.id && member.role === "owner",
  );

  // Los mails sólo los ve el dueño; la acción igual lo vuelve a validar.
  const emails = isOwner ? await getTeamEmailsAction() : {};

  return <TeamList team={result.data} isOwner={isOwner} emails={emails} />;
}
