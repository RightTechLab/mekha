// Type definitions for Mekha POS

export type PaymentMethod = 'cash' | 'promptpay' | 'lightning';

export type OrderStatus = 'open' | 'held' | 'paid' | 'voided';

export type TransactionStatus = 'completed' | 'voided' | 'refunded';

export type UserRole = 'owner' | 'cashier';

export type DiscountType = 'percent' | 'fixed';

export interface Menu {
  id: string;
  name: string;
  price: number;
  category: string | null;
  image_path: string | null;
  is_active: number;
  sort_order: number;
  created_at: string;
}

export interface OptionGroup {
  id: string;
  menu_id: string;
  name: string;
  required: number;
  multiple: number;
}

export interface OptionItem {
  id: string;
  option_group_id: string;
  name: string;
  price_delta: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  table_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  menu_id: string | null;
  menu_name: string;
  unit_price: number;
  quantity: number;
  selected_options: string | null; // JSON string
  item_total: number;
}

export interface Transaction {
  id: string;
  order_id: string;
  payment_method: PaymentMethod;
  amount_thb: number;
  amount_sat: number | null;
  btc_rate_thb: number | null;
  discount_amount: number;
  vat_amount: number;
  vat_included: number;
  status: TransactionStatus;
  lightning_invoice: string | null;
  lightning_preimage: string | null;
  promptpay_ref: string | null;
  cashier_id: string | null;
  void_reason: string | null;
  created_at: string;
}

export interface AuditLog {
  id: string;
  entity_type: 'transaction' | 'order';
  entity_id: string;
  action: 'void' | 'refund' | 'edit';
  performed_by: string | null;
  reason: string | null;
  created_at: string;
}

export interface SelectedOption {
  groupId: string;
  groupName: string;
  itemId: string;
  itemName: string;
  priceDelta: number;
}

export interface CartItem {
  menuId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  selectedOptions: SelectedOption[];
  note: string;
  itemTotal: number;
}

export interface Discount {
  type: DiscountType;
  value: number;
}

export interface Setting {
  key: string;
  value: string;
}
