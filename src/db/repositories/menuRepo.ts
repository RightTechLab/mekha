import db from '../client';
import type { Menu, OptionGroup, OptionItem } from '../../types';

export function getAllMenus(): Menu[] {
  return db.getAllSync<Menu>(
    'SELECT * FROM menus WHERE is_active = 1 ORDER BY category ASC, sort_order, name'
  );
}

export function getMenuById(id: string): Menu | null {
  return db.getFirstSync<Menu>('SELECT * FROM menus WHERE id = ?', [id]);
}

export function createMenu(menu: Omit<Menu, 'created_at'>): void {
  ensureCategory(menu.category);
  db.runSync(
    `INSERT INTO menus (id, name, price, category, image_path, is_active, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      menu.id,
      menu.name,
      menu.price,
      menu.category,
      menu.image_path,
      menu.is_active,
      menu.sort_order,
    ]
  );
}

export function updateMenu(
  id: string,
  data: Partial<Omit<Menu, 'id' | 'created_at'>>
): void {
  if (data.category !== undefined) {
    ensureCategory(data.category);
  }

  const fields: string[] = [];
  const values: (string | number | null)[] = [];

  if (data.name !== undefined) {
    fields.push('name = ?');
    values.push(data.name);
  }
  if (data.price !== undefined) {
    fields.push('price = ?');
    values.push(data.price);
  }
  if (data.category !== undefined) {
    fields.push('category = ?');
    values.push(data.category);
  }
  if (data.image_path !== undefined) {
    fields.push('image_path = ?');
    values.push(data.image_path);
  }
  if (data.is_active !== undefined) {
    fields.push('is_active = ?');
    values.push(data.is_active);
  }
  if (data.sort_order !== undefined) {
    fields.push('sort_order = ?');
    values.push(data.sort_order);
  }

  if (fields.length === 0) return;

  values.push(id);
  db.runSync(`UPDATE menus SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteMenu(id: string): void {
  db.runSync('UPDATE menus SET is_active = 0 WHERE id = ?', [id]);
}

export function getMenuCategories(): string[] {
  const rows = db.getAllSync<{ category: string }>(
    "SELECT DISTINCT TRIM(category) as category FROM menus WHERE category IS NOT NULL AND TRIM(category) != '' AND is_active = 1 ORDER BY category"
  );
  return rows.map((r) => r.category);
}

// Option Groups
export function getOptionGroups(menuId: string): OptionGroup[] {
  return db.getAllSync<OptionGroup>(
    'SELECT * FROM option_groups WHERE menu_id = ?',
    [menuId]
  );
}

export function createOptionGroup(group: OptionGroup): void {
  db.runSync(
    `INSERT INTO option_groups (id, menu_id, name, required, multiple)
     VALUES (?, ?, ?, ?, ?)`,
    [group.id, group.menu_id, group.name, group.required, group.multiple]
  );
}

export function deleteOptionGroup(id: string): void {
  db.runSync('DELETE FROM option_groups WHERE id = ?', [id]);
}

// Option Items
export function getOptionItems(groupId: string): OptionItem[] {
  return db.getAllSync<OptionItem>(
    'SELECT * FROM option_items WHERE option_group_id = ?',
    [groupId]
  );
}

export function createOptionItem(item: OptionItem): void {
  db.runSync(
    `INSERT INTO option_items (id, option_group_id, name, price_delta)
     VALUES (?, ?, ?, ?)`,
    [item.id, item.option_group_id, item.name, item.price_delta]
  );
}

export function deleteOptionItem(id: string): void {
  db.runSync('DELETE FROM option_items WHERE id = ?', [id]);
}

// Categories (user-defined)
export interface CategoryItem {
  id: string;
  name: string;
  color: string | null;
  sort_order: number;
  created_at?: string;
}

export function getAllCategories(): CategoryItem[] {
  syncMenuCategoriesToCategories();
  return db.getAllSync<CategoryItem>(
    'SELECT * FROM categories ORDER BY sort_order, name'
  );
}

export function getCategoryMenuCounts(): Record<string, number> {
  const rows = db.getAllSync<{ category: string; count: number }>(
    `SELECT TRIM(category) as category, COUNT(*) as count
     FROM menus
     WHERE is_active = 1 AND category IS NOT NULL AND TRIM(category) != ''
     GROUP BY TRIM(category)`
  );

  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.category.trim().toLowerCase()] = row.count;
    return counts;
  }, {});
}

export function createCategory(cat: Omit<CategoryItem, 'created_at'>): void {
  const existing = db.getFirstSync<{ id: string }>(
    'SELECT id FROM categories WHERE lower(name) = lower(?)',
    [cat.name.trim()]
  );
  if (existing || !cat.name.trim()) return;

  db.runSync(
    `INSERT INTO categories (id, name, color, sort_order) VALUES (?, ?, ?, ?)`,
    [cat.id, cat.name.trim(), cat.color, cat.sort_order]
  );
}

export function ensureCategory(name: string | null | undefined): void {
  const normalized = name?.trim();
  if (!normalized) return;

  const existing = db.getFirstSync<{ id: string }>(
    'SELECT id FROM categories WHERE lower(name) = lower(?)',
    [normalized]
  );
  if (existing) return;

  const maxSort = db.getFirstSync<{ max_sort: number | null }>(
    'SELECT MAX(sort_order) as max_sort FROM categories'
  );
  db.runSync(
    `INSERT INTO categories (id, name, color, sort_order)
     VALUES (lower(hex(randomblob(16))), ?, NULL, ?)`,
    [normalized, (maxSort?.max_sort ?? -1) + 1]
  );
}

export function syncMenuCategoriesToCategories(): number {
  const menuCategories = getMenuCategories();
  const existingCategories = db.getAllSync<{ name: string }>('SELECT name FROM categories');
  const existingNames = new Set(existingCategories.map((c) => c.name.trim().toLowerCase()));
  let added = 0;

  for (const category of menuCategories) {
    if (existingNames.has(category.toLowerCase())) continue;
    ensureCategory(category);
    existingNames.add(category.toLowerCase());
    added += 1;
  }

  return added;
}

export function updateCategory(id: string, data: { name?: string; color?: string | null; sort_order?: number }): void {
  const fields: string[] = [];
  const values: (string | number | null)[] = [];
  if (data.name !== undefined) { fields.push('name = ?'); values.push(data.name); }
  if (data.color !== undefined) { fields.push('color = ?'); values.push(data.color); }
  if (data.sort_order !== undefined) { fields.push('sort_order = ?'); values.push(data.sort_order); }
  if (fields.length === 0) return;
  values.push(id);
  db.runSync(`UPDATE categories SET ${fields.join(', ')} WHERE id = ?`, values);
}

export function deleteCategory(id: string): void {
  db.runSync('DELETE FROM categories WHERE id = ?', [id]);
}
