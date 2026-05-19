import db from '../client';
import type { Order, OrderItem } from '../../types';

export function createOrder(order: Pick<Order, 'id' | 'status' | 'note'> & { table_id?: string | null }): void {
  db.runSync(
    `INSERT INTO orders (id, status, table_id, note) VALUES (?, ?, ?, ?)`,
    [order.id, order.status, order.table_id ?? null, order.note]
  );
}

export function getOrderById(id: string): Order | null {
  return db.getFirstSync<Order>('SELECT * FROM orders WHERE id = ?', [id]);
}

export function updateOrderStatus(id: string, status: string): void {
  db.runSync(
    `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
    [status, id]
  );
}

export function getHeldOrders(): Order[] {
  return db.getAllSync<Order>(
    `SELECT * FROM orders WHERE status = 'held' ORDER BY updated_at DESC`
  );
}

export function addOrderItem(item: OrderItem): void {
  db.runSync(
    `INSERT INTO order_items (id, order_id, menu_id, menu_name, unit_price, quantity, selected_options, item_total)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.order_id,
      item.menu_id,
      item.menu_name,
      item.unit_price,
      item.quantity,
      item.selected_options,
      item.item_total,
    ]
  );
}

export function getOrderItems(orderId: string): OrderItem[] {
  return db.getAllSync<OrderItem>(
    'SELECT * FROM order_items WHERE order_id = ?',
    [orderId]
  );
}

export function deleteOrderItems(orderId: string): void {
  db.runSync('DELETE FROM order_items WHERE order_id = ?', [orderId]);
}
