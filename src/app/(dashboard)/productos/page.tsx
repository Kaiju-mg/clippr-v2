import { getProductsAction } from "@/actions/product.actions";
import { createClient } from "@/lib/supabase/server";
import { ProductList } from "./_components/ProductList";

export default async function ProductosPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [result, profileResult] = await Promise.all([
    getProductsAction(),
    supabase
      .from("users")
      .select("role")
      .eq("auth_id", user?.id ?? "")
      .maybeSingle<{ role: string }>(),
  ]);

  if (!result.success) {
    return (
      <p role="alert" className="text-danger p-4 text-sm">
        {result.error}
      </p>
    );
  }

  // Solo esconde los controles: la barrera real es el chequeo de rol en
  // product.actions.ts.
  const isOwner = profileResult.data?.role === "owner";

  return <ProductList products={result.data} isOwner={isOwner} />;
}
