// src/routes/hsi/workflows/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export async function load({ locals }) {
  requirePermission(locals.user, 'hsi', 'manager');
  const rows = await sql`
    SELECT workflow_id, category, value, label, sort_order, is_active,
           created_at::text, updated_at::text
    FROM class_workflow
    ORDER BY category, sort_order, label
  `;

  /** @type {Record<string, any[]>} */
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }

  return { grouped, user: locals.user };
}

export const actions = {
  add: async ({ request, locals }) => {
    requirePermission(locals.user, 'hsi', 'manager');
    const form = await request.formData();
    const category  = form.get('category')?.toString().trim()  || '';
    const value     = form.get('value')?.toString().trim()     || '';
    const label     = form.get('label')?.toString().trim()     || '';
    const sortOrder = parseInt(form.get('sort_order')?.toString() || '0');

    if (!category || !value || !label)
      return { success: false, error: 'Category, value, and label are required.' };

    try {
      await sql`
        INSERT INTO class_workflow (category, value, label, sort_order)
        VALUES (${category}, ${value}, ${label}, ${sortOrder})
      `;
      return { success: true, action: 'add' };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('unique')) return { success: false, error: `Value "${value}" already exists in ${category}.` };
      return { success: false, error: 'Add failed: ' + msg };
    }
  },

  update: async ({ request, locals }) => {
    requirePermission(locals.user, 'hsi', 'manager');
    const form = await request.formData();
    const id        = parseInt(form.get('workflow_id')?.toString() || '0');
    const label     = form.get('label')?.toString().trim()     || '';
    const sortOrder = parseInt(form.get('sort_order')?.toString() || '0');
    const isActive  = form.get('is_active') === 'true';

    if (!id || !label)
      return { success: false, error: 'ID and label are required.' };

    await sql`
      UPDATE class_workflow SET
        label      = ${label},
        sort_order = ${sortOrder},
        is_active  = ${isActive},
        updated_at = NOW()
      WHERE workflow_id = ${id}
    `;
    return { success: true, action: 'update' };
  },

  delete: async ({ request, locals }) => {
    requirePermission(locals.user, 'hsi', 'manager');
    const form = await request.formData();
    const id = parseInt(form.get('workflow_id')?.toString() || '0');
    if (!id) return { success: false, error: 'No ID provided.' };

    const row = await sql`SELECT category, value FROM class_workflow WHERE workflow_id = ${id}`;
    if (!row.length) return { success: false, error: 'Not found.' };

    const { category, value } = row[0];

    // Check if value is in use in the classes table
    let inUseCount = 0;
    if (category === 'class_type') {
      const [r] = await sql`SELECT COUNT(*)::int AS n FROM classes WHERE class_type = ${value}`;
      inUseCount = r.n;
    } else if (category === 'student_type') {
      const [r] = await sql`SELECT COUNT(*)::int AS n FROM classes WHERE student_type = ${value}`;
      inUseCount = r.n;
    } else if (category === 'duration_unit') {
      const [r] = await sql`SELECT COUNT(*)::int AS n FROM classes WHERE duration_unit = ${value}`;
      inUseCount = r.n;
    }

    if (inUseCount > 0)
      return { success: false, error: `Cannot delete — "${value}" is used by ${inUseCount} class${inUseCount !== 1 ? 'es' : ''}.` };

    await sql`DELETE FROM class_workflow WHERE workflow_id = ${id}`;
    return { success: true, action: 'delete' };
  },
};
