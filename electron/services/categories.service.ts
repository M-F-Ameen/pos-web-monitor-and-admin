import { getDb } from "../database";
import type { Category } from "../shared/types";

// ============================================
// Categories Service
// ============================================

function rowToCategory(row: Record<string, unknown>): Category {
  return {
    id: row.id as string,
    name: row.name as string,
    image: (row.image as string) || "",
    createdAt: row.created_at as string,
  };
}

export function listCategories(): Category[] {
  const db = getDb();

  const rows = db
    .prepare("SELECT * FROM categories ORDER BY created_at DESC")
    .all() as Record<string, unknown>[];

  return rows.map(rowToCategory);
}

export function getCategoryById(id: string): Category | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as
    | Record<string, unknown>
    | undefined;
  return row ? rowToCategory(row) : null;
}

export function createCategory(data: {
  name: string;
  image?: string;
}): Category {
  const db = getDb();
  const id = crypto.randomUUID();
  const imageToSave = data.image ?? "";

  db.prepare(
    `
    INSERT INTO categories (id, name, image, created_at)
    VALUES (?, ?, ?, datetime('now','localtime'))
  `,
  ).run(id, data.name.trim(), imageToSave);

  return getCategoryById(id)!;
}

export function updateCategory(
  id: string,
  data: { name: string; image?: string },
): Category | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    fields.push("name = ?");
    values.push(data.name.trim());
  }

  if (data.image !== undefined) {
    fields.push("image = ?");
    values.push(data.image);
  }

  if (fields.length > 0) {
    values.push(id);
    db.prepare(`UPDATE categories SET ${fields.join(", ")} WHERE id = ?`).run(
      ...values,
    );
  }

  return getCategoryById(id);
}

export function deleteCategory(id: string): boolean {
  const db = getDb();
  const txn = db.transaction(() => {
    // Unlink products from deleted category
    db.prepare(
      "UPDATE products SET category_id = '' WHERE category_id = ?",
    ).run(id);
    const result = db.prepare("DELETE FROM categories WHERE id = ?").run(id);
    return result.changes > 0;
  });
  return txn();
}

export function deleteAllCategories(): number {
  const db = getDb();
  const txn = db.transaction(() => {
    db.prepare("UPDATE products SET category_id = ''").run();
    const result = db.prepare("DELETE FROM categories").run();
    return result.changes;
  });
  return txn();
}
