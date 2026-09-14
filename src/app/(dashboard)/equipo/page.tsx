import { createClient } from "@/lib/supabase/server";
import { getTeamAction } from "@/actions/team.actions";
import { TeamList } from "./_components/TeamList";

export default async function EquipoPage() {
  const result = await getTeamAction();

  if (!result.success) {
    return (
      <p role="alert" className="p-4 text-sm text-red-600">
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

  return <TeamList team={result.data} isOwner={isOwner} />;
}
