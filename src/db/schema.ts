export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS menus (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  price       REAL NOT NULL,
  category    TEXT,
  image_path  TEXT,
  is_active   INTEGER DEFAULT 1,
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS option_groups (
  id       TEXT PRIMARY KEY,
  menu_id  TEXT REFERENCES menus(id) ON DELETE CASCADE,
  name     TEXT NOT NULL,
  required INTEGER DEFAULT 0,
  multiple INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS option_items (
  id               TEXT PRIMARY KEY,
  option_group_id  TEXT REFERENCES option_groups(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  price_delta      REAL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  status       TEXT DEFAULT 'open',
  table_id     TEXT,
  note         TEXT,
  created_at   TEXT DEFAULT (datetime('now')),
  updated_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
  id               TEXT PRIMARY KEY,
  order_id         TEXT REFERENCES orders(id) ON DELETE CASCADE,
  menu_id          TEXT REFERENCES menus(id),
  menu_name        TEXT NOT NULL,
  unit_price       REAL NOT NULL,
  quantity         INTEGER NOT NULL,
  selected_options TEXT,
  item_total       REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id                TEXT PRIMARY KEY,
  order_id          TEXT REFERENCES orders(id),
  payment_method    TEXT NOT NULL,
  amount_thb        REAL NOT NULL,
  amount_sat        INTEGER,
  btc_rate_thb      REAL,
  discount_amount   REAL DEFAULT 0,
  service_charge_amount REAL DEFAULT 0,
  vat_amount        REAL DEFAULT 0,
  vat_included      INTEGER DEFAULT 1,
  status            TEXT DEFAULT 'completed',
  lightning_invoice TEXT,
  lightning_preimage TEXT,
  promptpay_ref     TEXT,
  cashier_id        TEXT,
  void_reason       TEXT,
  created_at        TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id           TEXT PRIMARY KEY,
  entity_type  TEXT NOT NULL,
  entity_id    TEXT NOT NULL,
  action       TEXT NOT NULL,
  performed_by TEXT,
  reason       TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tables (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  sort_order  INTEGER DEFAULT 0,
  is_active   INTEGER DEFAULT 1,
  status      TEXT DEFAULT 'available',
  current_order_id TEXT,
  created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  color       TEXT,
  sort_order  INTEGER DEFAULT 0,
  created_at  TEXT DEFAULT (datetime('now'))
);
`;
