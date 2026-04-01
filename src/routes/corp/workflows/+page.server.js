// src/routes/corp/workflow/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export async function load({ locals }) {
  requirePermission(locals.user, 'corp', 'manager');
  const rows = await sql`
    SELECT workflow_id, category, value, label, sort_order, is_active,
           created_at::text, updated_at::text
    FROM corp_workflow
    ORDER BY category, sort_order, label
  `;

  // Group by category
  /** @type {Record<string, any[]>} */
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.category]) grouped[row.category] = [];
    grouped[row.category].push(row);
  }

  return { grouped };
}

export const actions = {

  add: async ({ request, locals }) => {
    requirePermission(locals.user, 'corp', 'manager');
    const form = await request.formData();
    const category  = form.get('category')?.toString().trim()  || '';
    const value     = form.get('value')?.toString().trim()     || '';
    const label     = form.get('label')?.toString().trim()     || '';
    const sortOrder = parseInt(form.get('sort_order')?.toString() || '0');

    if (!category || !value || !label)
      return { success: false, error: 'Category, value, and label are required.' };

    try {
      await sql`
        INSERT INTO corp_workflow (category, value, label, sort_order)
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
    requirePermission(locals.user, 'corp', 'manager');
    const form = await request.formData();
    const id        = parseInt(form.get('workflow_id')?.toString() || '0');
    const label     = form.get('label')?.toString().trim()     || '';
    const sortOrder = parseInt(form.get('sort_order')?.toString() || '0');
    const isActive  = form.get('is_active') === 'true';

    if (!id || !label)
      return { success: false, error: 'ID and label are required.' };

    await sql`
      UPDATE corp_workflow SET
        label      = ${label},
        sort_order = ${sortOrder},
        is_active  = ${isActive},
        updated_at = NOW()
      WHERE workflow_id = ${id}
    `;
    return { success: true, action: 'update' };
  },

  delete: async ({ request, locals }) => {
    requirePermission(locals.user, 'corp', 'manager');
    const form = await request.formData();
    const id = parseInt(form.get('workflow_id')?.toString() || '0');
    if (!id) return { success: false, error: 'No ID provided.' };

    // Check if value is in use before deleting
    const row = await sql`SELECT category, value FROM corp_workflow WHERE workflow_id = ${id}`;
    if (!row.length) return { success: false, error: 'Not found.' };

    const { category, value } = row[0];
    const col =
      category === 'engagement_type' ? sql`engagement_type` :
      category === 'pipeline_status' ? sql`pipeline_status` :
      sql`contract_status`;

    const inUse = await sql`
      SELECT COUNT(*)::int AS n FROM corp_engagements WHERE ${col} = ${value}
    `;
    if (inUse[0].n > 0)
      return { success: false, error: `Cannot delete — "${value}" is used by ${inUse[0].n} engagement${inUse[0].n !== 1 ? 's' : ''}.` };

    await sql`DELETE FROM corp_workflow WHERE workflow_id = ${id}`;
    return { success: true, action: 'delete' };
  },

  reorder: async ({ request, locals }) => {
    requirePermission(locals.user, 'corp', 'manager');
    const form = await request.formData();
    const ordersJson = form.get('orders')?.toString() || '';
    if (!ordersJson) return { success: false, error: 'No order data.' };

    const orders = JSON.parse(ordersJson); // [{ workflow_id, sort_order }]
    for (const o of orders) {
      await sql`
        UPDATE corp_workflow SET sort_order = ${o.sort_order}, updated_at = NOW()
        WHERE workflow_id = ${o.workflow_id}
      `;
    }
    return { success: true, action: 'reorder' };
  },
};