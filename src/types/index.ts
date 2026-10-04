/**
 * Tipos del dominio de Clippr. Reflejan el modelo de datos de
 * docs/arquitectura.md. Sin lógica todavía: solo formas de datos.
 */

export type SubscriptionPlan = "trial" | "pro" | "team";
export type UserRole = "owner" | "barber" | "independent";
export type UserLevel = "junior" | "pro" | "senior" | "elite";
export type AppointmentStatus =
  "scheduled" | "walkin" | "completed" | "cancelled";
export type CashSessionStatus = "open" | "closed";
export type TransactionType = "income" | "expense";

/**
 * De dónde salió el movimiento (spec 09): un corte cobrado, una venta de
 * producto o un ingreso/egreso cargado a mano. Antes sólo se distinguía por
 * el prefijo de `description`, lo que mezclaba cortes con ventas en el
 * ticket promedio del dueño.
 */
export type TransactionCategory = "service" | "product" | "manual";

export interface Barbershop {
  id: string;
  name: string;
  subscription_plan: SubscriptionPlan;
  /** Para "Turnos: …" en la imagen de compartir el día (spec 10, fase 3). */
  phone: string | null;
  created_at: string;
}

export interface User {
  id: string;
  /** null: la cuenta se eliminó (la fila queda anonimizada, 2026-10-04). */
  auth_id: string | null;
  barbershop_id: string;
  role: UserRole;
  name: string;
  level: UserLevel;
  commission_pct: number;
  streak_count: number;
}

export interface Product {
  id: string;
  barbershop_id: string;
  name: string;
  price: number;
  stock: number;
  low_stock_threshold: number | null;
  is_active: boolean;
}

export interface Service {
  id: string;
  barbershop_id: string;
  name: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
}

export interface Appointment {
  id: string;
  barbershop_id: string;
  user_id: string;
  client_name: string | null;
  service_id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
}

export interface CashSession {
  id: string;
  barbershop_id: string;
  user_id: string;
  start_time: string;
  end_time: string | null;
  initial_balance: number;
  final_balance: number | null;
  status: CashSessionStatus;
}

export interface Transaction {
  id: string;
  cash_session_id: string;
  type: TransactionType;
  category: TransactionCategory;
  amount: number;
  description: string;
  created_at: string;
}
