"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Product, UserRole } from "@/types";

export type ProductActionResult<T> =
  { success: true; data: T } | { success: false; error: string };

export interface ProductPayload {
  name: string;
  price: number;
  stock: number;
  low_stock_threshold: number | null;
}

const MENSAJE_ERROR_GENERICO = "Algo salió mal. Intentá de nuevo.";
const MENSAJE_NO_ENCONTRADO = "Producto no encontrado.";
const MENSAJE_ACCESO_DENEGADO =
  "Acceso denegado: solo el dueño puede gestionar los productos.";

function esEnteroNoNegativo(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Valida los campos presentes en el payload. `Partial` porque
 * updateProductAction permite mandar solo los campos que cambian.
 */
function validateProductPayload(data: Partial<ProductPayload>): string | null {
  if (data.name !== undefined && data.name.trim().length === 0) {
    return "El nombre del producto es obligatorio.";
  }

  if (
    data.price !== undefined &&
    (typeof data.price !== "number" ||
      !Number.isInteger(data.price) ||
      data.price <= 0)
  ) {
    // Guaraníes, sin centavos: mismo criterio que services.price.
    return "El precio debe ser un número entero mayor a cero.";
  }

  if (data.stock !== undefined && !esEnteroNoNegativo(data.stock)) {
    return "El stock debe ser un número entero mayor o igual a cero.";
  }

  if (
    data.low_stock_threshold !== undefined &&
    data.low_stock_threshold !== null &&
    !esEnteroNoNegativo(data.low_stock_threshold)
  ) {
    return "El aviso de stock bajo debe ser un número entero mayor o igual a cero.";
  }

  return null;
}

/**
 * Rol del usuario autenticado. Editar el catálogo es solo del dueño
 * (decisión de la spec 07, ver docs/decisiones.md); RLS de `products` deja
 * actualizar a toda la barbería porque una venta descuenta stock.
 */
async function isOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<boolean> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return false;

  const { data } = await supabase
    .from("users")
    .select("role")
    .eq("auth_id", user.id)
    .maybeSingle<{ role: UserRole }>();

  return data?.role === "owner";
}

/**
 * Devuelve todos los productos de la barbería (activos primero). Lo puede
 * leer cualquier integrante del equipo. RLS
 * (`products_select_same_barbershop`) filtra por tenant.
 */
export async function getProductsAction(): Promise<
  ProductActionResult<Product[]>
> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .order("is_active", { ascending: false })
    .order("name");

  if (error) {
    console.error("getProductsAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  return { success: true, data: (data ?? []) as Product[] };
}

/**
 * Crea un producto. No manda barbershop_id: la columna lo completa sola vía
 * `default current_barbershop_id()`, igual que services.
 */
export async function createProductAction(
  data: ProductPayload,
): Promise<ProductActionResult<Product>> {
  const validationError = validateProductPayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const supabase = await createClient();

  if (!(await isOwner(supabase))) {
    return { success: false, error: MENSAJE_ACCESO_DENEGADO };
  }

  const { data: created, error } = await supabase
    .from("products")
    .insert({
      name: data.name.trim(),
      price: data.price,
      stock: data.stock,
      low_stock_threshold: data.low_stock_threshold,
    })
    .select()
    .single();

  if (error) {
    console.error("createProductAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  revalidatePath("/productos");
  return { success: true, data: created as Product };
}

/**
 * Modifica nombre, precio, stock o aviso de stock bajo. Si el id es de otro
 * tenant, RLS hace que no matchee ninguna fila y se trata como "no
 * encontrado", igual que updateServiceAction.
 */
export async function updateProductAction(
  id: string,
  data: Partial<ProductPayload>,
): Promise<ProductActionResult<Product>> {
  const validationError = validateProductPayload(data);
  if (validationError) {
    return { success: false, error: validationError };
  }

  const updatePayload: Partial<ProductPayload> = {};
  if (data.name !== undefined) updatePayload.name = data.name.trim();
  if (data.price !== undefined) updatePayload.price = data.price;
  if (data.stock !== undefined) updatePayload.stock = data.stock;
  if (data.low_stock_threshold !== undefined) {
    updatePayload.low_stock_threshold = data.low_stock_threshold;
  }

  const supabase = await createClient();

  if (!(await isOwner(supabase))) {
    return { success: false, error: MENSAJE_ACCESO_DENEGADO };
  }

  const { data: updated, error } = await supabase
    .from("products")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("updateProductAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!updated) {
    return { success: false, error: MENSAJE_NO_ENCONTRADO };
  }

  revalidatePath("/productos");
  return { success: true, data: updated as Product };
}

/**
 * Activa/desactiva un producto (borrado lógico). Recibe el estado destino
 * explícito, mismo criterio que toggleServiceStatusAction.
 */
export async function toggleProductStatusAction(
  id: string,
  isActive: boolean,
): Promise<ProductActionResult<Product>> {
  const supabase = await createClient();

  if (!(await isOwner(supabase))) {
    return { success: false, error: MENSAJE_ACCESO_DENEGADO };
  }

  const { data: updated, error } = await supabase
    .from("products")
    .update({ is_active: isActive })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) {
    console.error("toggleProductStatusAction:", error.message);
    return { success: false, error: MENSAJE_ERROR_GENERICO };
  }

  if (!updated) {
    return { success: false, error: MENSAJE_NO_ENCONTRADO };
  }

  revalidatePath("/productos");
  return { success: true, data: updated as Product };
}
