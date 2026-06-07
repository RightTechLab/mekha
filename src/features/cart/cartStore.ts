import { create } from 'zustand';
import type { CartItem, CheckoutSession, Discount } from '../../types';

interface TableCart {
  items: CartItem[];
  discount: Discount | null;
}

const NO_TABLE = '__no_table__';

interface CartStore {
  items: CartItem[];
  discount: Discount | null;
  tableId: string | null;
  tableName: string | null;
  tableCarts: Record<string, TableCart>;
  checkoutSessions: Record<string, CheckoutSession>;
  addItem: (item: CartItem) => void;
  removeItem: (menuId: string) => void;
  updateQty: (menuId: string, qty: number) => void;
  setDiscount: (discount: Discount | null) => void;
  switchTable: (id: string | null, name: string | null) => void;
  setTable: (id: string | null, name: string | null) => void;
  clear: () => void;
  getSubtotal: () => number;
  getTotal: () => number;
  getTableItemCount: (tableId: string | null) => number;
  saveCheckoutSession: (session: CheckoutSession) => void;
  getCheckoutSession: (tableId?: string | null) => CheckoutSession | null;
  clearCheckoutSession: (tableId?: string | null) => void;
  hasActiveCheckoutSession: (tableId?: string | null) => boolean;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  discount: null,
  tableId: null,
  tableName: null,
  tableCarts: {},
  checkoutSessions: {},

  addItem: (item) =>
    set((state) => {
      const existing = state.items.find(
        (i) =>
          i.menuId === item.menuId &&
          JSON.stringify(i.selectedOptions) ===
            JSON.stringify(item.selectedOptions) &&
          i.note === item.note
      );
      let newItems: CartItem[];
      if (existing) {
        newItems = state.items.map((i) =>
          i === existing
            ? {
                ...i,
                quantity: i.quantity + item.quantity,
                itemTotal: (i.quantity + item.quantity) * i.unitPrice +
                  (i.quantity + item.quantity) *
                    i.selectedOptions.reduce((sum, o) => sum + o.priceDelta, 0),
              }
            : i
        );
      } else {
        newItems = [...state.items, item];
      }
      // Sync to tableCarts
      const key = state.tableId ?? NO_TABLE;
      if (state.checkoutSessions[key]) return state;
      return {
        items: newItems,
        tableCarts: {
          ...state.tableCarts,
          [key]: { items: newItems, discount: state.discount },
        },
      };
    }),

  removeItem: (menuId) =>
    set((state) => {
      const newItems = state.items.filter((i) => i.menuId !== menuId);
      const key = state.tableId ?? NO_TABLE;
      if (state.checkoutSessions[key]) return state;
      return {
        items: newItems,
        tableCarts: {
          ...state.tableCarts,
          [key]: { items: newItems, discount: state.discount },
        },
      };
    }),

  updateQty: (menuId, qty) =>
    set((state) => {
      const key = state.tableId ?? NO_TABLE;
      if (state.checkoutSessions[key]) return state;

      const newItems =
        qty <= 0
          ? state.items.filter((i) => i.menuId !== menuId)
          : state.items.map((i) =>
              i.menuId === menuId
                ? {
                    ...i,
                    quantity: qty,
                    itemTotal:
                      qty * i.unitPrice +
                      qty * i.selectedOptions.reduce((sum, o) => sum + o.priceDelta, 0),
                  }
                : i
            );
      return {
        items: newItems,
        tableCarts: {
          ...state.tableCarts,
          [key]: { items: newItems, discount: state.discount },
        },
      };
    }),

  setDiscount: (discount) =>
    set((state) => {
      const key = state.tableId ?? NO_TABLE;
      return {
        discount,
        tableCarts: {
          ...state.tableCarts,
          [key]: { items: state.items, discount },
        },
      };
    }),

  switchTable: (id, name) =>
    set((state) => {
      // Save current cart
      const currentKey = state.tableId ?? NO_TABLE;
      const saved = {
        ...state.tableCarts,
        [currentKey]: { items: state.items, discount: state.discount },
      };
      // Load target table's cart
      const targetKey = id ?? NO_TABLE;
      const target = saved[targetKey] ?? { items: [], discount: null };
      return {
        items: target.items,
        discount: target.discount,
        tableId: id,
        tableName: name,
        tableCarts: saved,
      };
    }),

  setTable: (id, name) => set({ tableId: id, tableName: name }),

  clear: () =>
    set((state) => {
      const key = state.tableId ?? NO_TABLE;
      const { [key]: _, ...rest } = state.tableCarts;
      const { [key]: __, ...restSessions } = state.checkoutSessions;
      return {
        items: [],
        discount: null,
        tableId: null,
        tableName: null,
        tableCarts: rest,
        checkoutSessions: restSessions,
      };
    }),

  getSubtotal: () => {
    return get().items.reduce((sum, i) => sum + i.itemTotal, 0);
  },

  getTotal: () => {
    const subtotal = get().getSubtotal();
    const discount = get().discount;
    if (!discount) return subtotal;
    if (discount.type === 'percent') {
      return subtotal - subtotal * (discount.value / 100);
    }
    return subtotal - discount.value;
  },

  getTableItemCount: (tableId) => {
    const key = tableId ?? NO_TABLE;
    const state = get();
    // If it's the current table, use items directly
    if ((state.tableId ?? NO_TABLE) === key) {
      return state.items.reduce((sum, i) => sum + i.quantity, 0);
    }
    const cart = state.tableCarts[key];
    if (!cart) return 0;
    return cart.items.reduce((sum, i) => sum + i.quantity, 0);
  },

  saveCheckoutSession: (session) =>
    set((state) => {
      const key = state.tableId ?? NO_TABLE;
      return {
        checkoutSessions: {
          ...state.checkoutSessions,
          [key]: session,
        },
      };
    }),

  getCheckoutSession: (tableId) => {
    const state = get();
    const key = tableId ?? state.tableId ?? NO_TABLE;
    return state.checkoutSessions[key] ?? null;
  },

  clearCheckoutSession: (tableId) =>
    set((state) => {
      const key = tableId ?? state.tableId ?? NO_TABLE;
      const { [key]: _, ...rest } = state.checkoutSessions;
      return { checkoutSessions: rest };
    }),

  hasActiveCheckoutSession: (tableId) => {
    const state = get();
    const key = tableId ?? state.tableId ?? NO_TABLE;
    const session = state.checkoutSessions[key];
    return !!session && session.paidSplits.length > 0;
  },
}));
