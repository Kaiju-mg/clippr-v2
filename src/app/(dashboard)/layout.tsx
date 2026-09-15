import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BottomNav } from "@/components/ui/BottomNav";

/**
 * Sin barra superior a propósito (spec 05.5 en adelante): el nombre de la
 * barbería no aporta nada una vez logueado, y "Cerrar sesión" ya vive en
 * `/mas`. Esta capa solo hace de guard de sesión para todo el grupo.
 */
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

  return (
    <div className="min-h-screen bg-background">
      <main className="pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
