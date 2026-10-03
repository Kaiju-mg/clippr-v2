import { redirect } from "next/navigation";

/**
 * La raíz no tiene pantalla propia: manda a /inicio, y si no hay sesión el
 * guard de `(dashboard)/layout.tsx` la rebota a /login. Antes quedaba la
 * página del scaffolding ("Health check en /api/health"), que era lo que
 * abría la app instalada en el celular.
 */
export default function Home() {
  redirect("/inicio");
}
