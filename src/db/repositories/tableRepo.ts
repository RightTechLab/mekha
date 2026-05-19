import db from '../client';

export interface TableItem {
  id: string;
  name: string;
  sort_order: number;
  is_active: number;
  status: 'available' | 'occupied' | 'reserved';
  current_order_id: string | null;
  created_at: string;
}

export function getAllTables(): TableItem[] {
  return db.getAllSync<TableItem>(
    'SELECT * FROM tables WHERE is_active = 1 ORDER BY sort_order ASC, name ASC'
  );
}

export function getTableById(id: string): TableItem | null {
  return db.getFirstSync<TableItem>('SELECT * FROM tables WHERE id = ?', [id]);
}

export function createTable(table: Pick<TableItem, 'id' | 'name' | 'sort_order'>): void {
  db.runSync(
    'INSERT INTO tables (id, name, sort_order) VALUES (?, ?, ?)',
    [table.id, table.name, table.sort_order]
  );
}

export function updateTable(id: string, data: { name?: string; sort_order?: number }): void {
  if (data.name !== undefined) {
    db.runSync('UPDATE tables SET name = ? WHERE id = ?', [data.name, id]);
  }
  if (data.sort_order !== undefined) {
    db.runSync('UPDATE tables SET sort_order = ? WHERE id = ?', [data.sort_order, id]);
  }
}

export function deleteTable(id: string): void {
  db.runSync('UPDATE tables SET is_active = 0 WHERE id = ?', [id]);
}

export function setTableStatus(id: string, status: TableItem['status'], orderId?: string | null): void {
  db.runSync(
    'UPDATE tables SET status = ?, current_order_id = ? WHERE id = ?',
    [status, orderId ?? null, id]
  );
}

export function clearTable(id: string): void {
  db.runSync(
    'UPDATE tables SET status = ?, current_order_id = NULL WHERE id = ?',
    ['available', id]
  );
}

export function getOccupiedTables(): TableItem[] {
  return db.getAllSync<TableItem>(
    "SELECT * FROM tables WHERE is_active = 1 AND status = 'occupied' ORDER BY sort_order ASC"
  );
}
