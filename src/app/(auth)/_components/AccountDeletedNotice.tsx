"use client";

import { useSearchParams } from "next/navigation";

/**
 * Aviso en `/login` después de eliminar la cuenta (`deleteAccountAction`
 * redirige a `/login?cuenta=eliminada`). Va en su propio componente con
 * `Suspense` alrededor: `useSearchParams` lo exige para no romper el build.
 */
export function AccountDeletedNotice() {
  const params = useSearchParams();
  if (params.get("cuenta") !== "eliminada") return null;
  return (
    <p role="status" className="bg-background rounded-lg p-3 text-sm">
      Tu cuenta se eliminó. Gracias por haber usado Clippr.
    </p>
  );
}
