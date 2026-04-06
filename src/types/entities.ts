export type UserRole = "client" | "worker" | "admin" | "curator";
export type UserStatus = "active" | "inactive";
export type BotKind = "teambot" | "servicebot";
export type CardCategory = "girls" | "pepper";
export type CardReviewStatus = "pending" | "approved" | "rejected";
export type CuratorRequestStatus = "pending" | "accepted" | "rejected";

export interface User {
  id: number;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  role: UserRole;
  status: UserStatus;
  curator_id: number | null;
  referred_by_user_id: number | null;
  balance: number;
  total_profit: number;
  avg_profit: number;
  best_profit: number;
  created_at: string;
  is_blocked: number;
  has_worker_access: number;
}

export interface Curator {
  id: number;
  name: string;
  telegram_username: string | null;
  linked_user_id: number | null;
  description: string | null;
  is_active: number;
  created_at: string;
}

export interface CuratorRequest {
  id: number;
  user_id: number;
  curator_id: number;
  status: CuratorRequestStatus;
  reviewed_by_user_id: number | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface Card {
  id: number;
  owner_user_id: number;
  category: CardCategory;
  source: string;
  review_status: CardReviewStatus;
  reviewed_by_user_id: number | null;
  reviewed_at: string | null;
  city: string;
  name: string;
  age: number;
  description: string;
  price_1h: number;
  price_3h: number;
  price_full_day: number;
  is_active: number;
  created_at: string;
}

export interface CardPhoto {
  id: number;
  card_id: number;
  telegram_file_id: string;
}

export interface Review {
  id: number;
  user_id: number;
  text: string;
  created_at: string;
  username?: string | null;
  first_name?: string | null;
}

export interface SupportTicket {
  id: number;
  user_id: number;
  message: string;
  status: string;
  created_at: string;
}

export interface ClientLink {
  id: number;
  worker_user_id: number;
  telegram_id: number;
  username: string | null;
  created_at: string;
}

export interface Favorite {
  id: number;
  user_id: number;
  card_id: number;
  created_at: string;
}

export type BookingStatus = "requested" | "completed";
export type PaymentMethod = "cash" | "bot_balance";
export type PaymentRequestStatus = "pending" | "approved" | "rejected";

export interface Booking {
  id: number;
  user_id: number;
  card_id: number;
  slot_label: string;
  payment_method: PaymentMethod;
  status: BookingStatus;
  created_at: string;
}

export interface PaymentRequest {
  id: number;
  user_id: number;
  worker_user_id: number | null;
  amount: number;
  receipt_file_id: string;
  comment: string | null;
  status: PaymentRequestStatus;
  admin_user_id: number | null;
  created_at: string;
  reviewed_at: string | null;
}

export interface SettingRecord {
  id: number;
  key: string;
  value: string;
}

export interface AdminLog {
  id: number;
  admin_user_id: number;
  action: string;
  details: string | null;
  created_at: string;
}

export interface ErrorLog {
  id: number;
  bot_name: string;
  user_telegram_id: number | null;
  message: string;
  stack: string | null;
  created_at: string;
}

export interface ProjectStats {
  totalProfits: number;
  totalProfitAmount: number;
  payoutPercent: number;
}

export interface CardWithPhotos extends Card {
  photos: CardPhoto[];
}
