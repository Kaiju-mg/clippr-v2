import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logoutAction } from "@/actions/auth.actions";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("users")
    .select("name, barbershops(name)")
    .eq("auth_id", user.id)
    .single<{ name: string; barbershops: { name: string } | null }>();

  const barbershopName = profile?.barbershops?.name ?? "Clippr";

  return (
    <div className="min-h-screen">
      <nav className="flex items-center justify-between border-b px-4 py-3">
        <span className="font-semibold">{barbershopName}</span>
        <form action={logoutAction}>
          <button type="submit" className="text-sm underline">
            Cerrar sesión
          </button>
        </form>
      </nav>
      <main>{children}</main>
    </div>
  );
}
