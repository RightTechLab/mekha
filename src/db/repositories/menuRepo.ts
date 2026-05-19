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
    'SELECT DISTINCT category FROM menus WHERE category IS NOT NULL AND is_active = 1 ORDER BY category'
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
