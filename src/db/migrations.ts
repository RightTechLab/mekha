import db from './client';
import { CREATE_TABLES } from './schema';

const CURRENT_VERSION = 6;

export function runMigrations(): void {
  db.execSync('PRAGMA journal_mode = WAL;');
  db.execSync('PRAGMA foreign_keys = ON;');

  // Get current version
  const result = db.getFirstSync<{ user_version: number }>(
    'PRAGMA user_version'
  );
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion < 1) {
    // Split CREATE_TABLES by statement and execute each
    const statements = CREATE_TABLES.split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      db.execSync(statement + ';');
    }

    // Insert default settings
    db.runSync(
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('vat_rate', '7')`
    );
    db.runSync(
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('vat_included', '1')`
    );
    db.runSync(
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('shop_name', 'Mekha')`
    );
  }

  if (currentVersion < 2) {
    // Add tables table
    db.execSync(`CREATE TABLE IF NOT EXISTS tables (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      sort_order  INTEGER DEFAULT 0,
      is_active   INTEGER DEFAULT 1,
      status      TEXT DEFAULT 'available',
      current_order_id TEXT,
      created_at  TEXT DEFAULT (datetime('now'))
    );`);
    // Add table_id column to orders
    try {
      db.execSync('ALTER TABLE orders ADD COLUMN table_id TEXT;');
    } catch (_) {
      // Column may already exist
    }
  }

  if (currentVersion < 3) {
    db.execSync(`CREATE TABLE IF NOT EXISTS categories (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      color       TEXT,
      sort_order  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );`);
  }

  if (currentVersion < 4) {
    // Add service_charge_amount column to transactions
    try {
      db.execSync('ALTER TABLE transactions ADD COLUMN service_charge_amount REAL DEFAULT 0;');
    } catch (_) {
      // Column may already exist
    }
    // Add default service charge and VAT mode settings
    db.runSync(
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('service_charge_rate', '0')`
    );
    db.runSync(
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('vat_mode', 'included')`
    );
  }

  if (currentVersion < 5) {
    // Add serial_number column to transactions for QR reference
    try {
      db.execSync('ALTER TABLE transactions ADD COLUMN serial_number INTEGER;');
    } catch (_) {
      // Column may already exist
    }
    // Initialize qr_serial counter
    db.runSync(
      `INSERT OR IGNORE INTO settings (key, value) VALUES ('qr_serial_counter', '0')`
    );
  }

  if (currentVersion < 6) {
    try {
      db.execSync('ALTER TABLE transactions ADD COLUMN lightning_verify_url TEXT;');
    } catch (_) {
      // Column may already exist
    }
  }

  db.execSync(`PRAGMA user_version = ${CURRENT_VERSION};`);
}
