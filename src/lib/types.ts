import type { TradeId } from "@/lib/trades";

export type Profile = {
  id: string;
  business_name: string | null;
  trade: TradeId | null;
  language: string;
  upi_id: string | null;
};

export type Customer = {
  id: string;
  name: string;
  phone: string | null;
  created_at: string;
};

export type EntryRow = {
  id: string;
  kind: string;
  total: number;
  paid: boolean;
  created_at: string;
  customer_id: string | null;
  customers: { name: string } | null;
};
