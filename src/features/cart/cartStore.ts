import { create } from 'zustand';
import type { CartItem, Discount } from '../../types';

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
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  discount: null,
  tableId: null,
  tableName: null,
  tableCarts: {},

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
      const key = state.tableId ?? NO_TABLE;
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
      return {
        items: [],
        discount: null,
        tableId: null,
        tableName: null,
        tableCarts: rest,
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
}));
