import db from '../client';
import type { PaymentMethod, Transaction, AuditLog, TransactionStatus } from '../../types';

export function createTransaction(txn: Omit<Transaction, 'created_at'>): void {
  db.runSync(
    `INSERT INTO transactions (id, order_id, payment_method, amount_thb, amount_sat, btc_rate_thb, discount_amount, service_charge_amount, vat_amount, vat_included, serial_number, status, lightning_invoice, lightning_verify_url, lightning_preimage, promptpay_ref, cashier_id, void_reason)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      txn.id,
      txn.order_id,
      txn.payment_method,
      txn.amount_thb,
      txn.amount_sat,
      txn.btc_rate_thb,
      txn.discount_amount,
      txn.service_charge_amount,
      txn.vat_amount,
      txn.vat_included,
      txn.serial_number,
      txn.status,
      txn.lightning_invoice,
      txn.lightning_verify_url,
      txn.lightning_preimage,
      txn.promptpay_ref,
      txn.cashier_id,
      txn.void_reason,
    ]
  );
}

export function updateTransactionStatus(
  id: string,
  status: TransactionStatus,
  data?: { lightningPreimage?: string | null; voidReason?: string | null }
): void {
  db.runSync(
    `UPDATE transactions
     SET status = ?, lightning_preimage = COALESCE(?, lightning_preimage), void_reason = COALESCE(?, void_reason)
     WHERE id = ?`,
    [status, data?.lightningPreimage ?? null, data?.voidReason ?? null, id]
  );
}

export function completeTransaction(id: string): void {
  updateTransactionStatus(id, 'completed');
}

export function cancelTransaction(id: string, reason?: string): void {
  updateTransactionStatus(id, 'cancelled', { voidReason: reason ?? null });
}

export function updatePendingTransactionMethod(
  id: string,
  data: {
    paymentMethod: PaymentMethod;
    amountSat?: number | null;
    btcRateThb?: number | null;
    lightningInvoice?: string | null;
    lightningVerifyUrl?: string | null;
    promptpayRef?: string | null;
    serialNumber?: number | null;
  }
): void {
  db.runSync(
    `UPDATE transactions
     SET payment_method = ?,
         amount_sat = ?,
         btc_rate_thb = ?,
         lightning_invoice = ?,
         lightning_verify_url = ?,
         promptpay_ref = ?,
         serial_number = ?,
         status = 'pending'
     WHERE id = ? AND status = 'pending'`,
    [
      data.paymentMethod,
      data.amountSat ?? null,
      data.btcRateThb ?? null,
      data.lightningInvoice ?? null,
      data.lightningVerifyUrl ?? null,
      data.promptpayRef ?? null,
      data.serialNumber ?? null,
      id,
    ]
  );
}

export function getNextSerial(): number {
  const current = db.getFirstSync<{ value: string }>(
    "SELECT value FROM settings WHERE key = 'qr_serial_counter'"
  );
  const next = (parseInt(current?.value ?? '0', 10) || 0) + 1;
  db.runSync(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('qr_serial_counter', ?)",
    [String(next)]
  );
  return next;
}

export function getTransactions(options?: {
  date?: string;
  method?: string;
  status?: string;
  limit?: number;
  offset?: number;
}): Transaction[] {
  let query = 'SELECT * FROM transactions WHERE 1=1';
  const params: (string | number)[] = [];

  if (options?.date) {
    query += ' AND date(created_at) = ?';
    params.push(options.date);
  }
  if (options?.method) {
    query += ' AND payment_method = ?';
    params.push(options.method);
  }
  if (options?.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }

  query += ' ORDER BY created_at DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  if (options?.offset) {
    query += ' OFFSET ?';
    params.push(options.offset);
  }

  return db.getAllSync<Transaction>(query, params);
}

export function getTransactionById(id: string): Transaction | null {
  return db.getFirstSync<Transaction>(
    'SELECT * FROM transactions WHERE id = ?',
    [id]
  );
}

export function getTransactionsByOrderId(orderId: string): Transaction[] {
  return db.getAllSync<Transaction>(
    'SELECT * FROM transactions WHERE order_id = ? ORDER BY created_at ASC',
    [orderId]
  );
}

export function voidTransaction(id: string, reason: string): void {
  db.runSync(`UPDATE transactions SET status = 'voided', void_reason = ? WHERE id = ?`, [
    reason,
    id,
  ]);
}

export function getTodayRevenue(): number {
  const today = new Date().toISOString().split('T')[0];
  const result = db.getFirstSync<{ total: number }>(
    `SELECT COALESCE(SUM(amount_thb), 0) as total FROM transactions WHERE date(created_at) = ? AND status = 'completed'`,
    [today]
  );
  return result?.total ?? 0;
}

export function getRevenueByDateRange(
  startDate: string,
  endDate: string
): { date: string; total: number }[] {
  return db.getAllSync<{ date: string; total: number }>(
    `SELECT date(created_at) as date, SUM(amount_thb) as total
     FROM transactions
     WHERE date(created_at) BETWEEN ? AND ? AND status = 'completed'
     GROUP BY date(created_at)
     ORDER BY date(created_at)`,
    [startDate, endDate]
  );
}

export function getPaymentMethodBreakdown(startDate?: string, endDate?: string): {
  method: string;
  total: number;
  count: number;
}[] {
  let query = `SELECT payment_method as method, SUM(amount_thb) as total, COUNT(*) as count
     FROM transactions
     WHERE status = 'completed'`;
  const params: string[] = [];
  if (startDate) {
    query += ' AND date(created_at) >= ?';
    params.push(startDate);
  }
  if (endDate) {
    query += ' AND date(created_at) <= ?';
    params.push(endDate);
  }
  query += ' GROUP BY payment_method';
  return db.getAllSync<{ method: string; total: number; count: number }>(query, params);
}

export function getTopMenuItems(
  limit: number = 5,
  startDate?: string,
  endDate?: string,
  paymentMethod?: string
): { menu_name: string; quantity: number; revenue: number }[] {
  let query = `SELECT oi.menu_name, SUM(oi.quantity) as quantity, SUM(oi.item_total) as revenue
     FROM order_items oi
     JOIN orders o ON oi.order_id = o.id
     WHERE o.status = 'paid'`;
  const params: (string | number)[] = [];
  if (startDate || endDate || paymentMethod) {
    query += ' AND o.id IN (SELECT order_id FROM transactions WHERE status = \'completed\'';
    if (startDate) {
      query += ' AND date(created_at) >= ?';
      params.push(startDate);
    }
    if (endDate) {
      query += ' AND date(created_at) <= ?';
      params.push(endDate);
    }
    if (paymentMethod) {
      query += ' AND payment_method = ?';
      params.push(paymentMethod);
    }
    query += ')';
  }
  query += ` GROUP BY oi.menu_name ORDER BY quantity DESC LIMIT ?`;
  params.push(limit);
  return db.getAllSync<{ menu_name: string; quantity: number; revenue: number }>(query, params);
}

export function getFilteredRevenue(
  startDate: string,
  endDate: string,
  paymentMethod?: string
): { total: number; count: number } {
  let query = `SELECT COALESCE(SUM(amount_thb), 0) as total, COUNT(*) as count
     FROM transactions
     WHERE status = 'completed' AND date(created_at) BETWEEN ? AND ?`;
  const params: string[] = [startDate, endDate];
  if (paymentMethod) {
    query += ' AND payment_method = ?';
    params.push(paymentMethod);
  }
  const result = db.getFirstSync<{ total: number; count: number }>(query, params);
  return { total: result?.total ?? 0, count: result?.count ?? 0 };
}

export function getFilteredRevenueByDate(
  startDate: string,
  endDate: string,
  paymentMethod?: string
): { date: string; total: number }[] {
  let query = `SELECT date(created_at) as date, SUM(amount_thb) as total
     FROM transactions
     WHERE status = 'completed' AND date(created_at) BETWEEN ? AND ?`;
  const params: string[] = [startDate, endDate];
  if (paymentMethod) {
    query += ' AND payment_method = ?';
    params.push(paymentMethod);
  }
  query += ' GROUP BY date(created_at) ORDER BY date(created_at)';
  return db.getAllSync<{ date: string; total: number }>(query, params);
}

// Audit logs
export function createAuditLog(log: Omit<AuditLog, 'created_at'>): void {
  db.runSync(
    `INSERT INTO audit_logs (id, entity_type, entity_id, action, performed_by, reason)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [log.id, log.entity_type, log.entity_id, log.action, log.performed_by, log.reason]
  );
}

// Settings helpers
export function getSetting(key: string): string | null {
  const result = db.getFirstSync<{ value: string }>(
    'SELECT value FROM settings WHERE key = ?',
    [key]
  );
  return result?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.runSync(
    `INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)`,
    [key, value]
  );
}
