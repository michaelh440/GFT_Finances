// src/routes/corp/companies/[id]/+page.server.js
import sql from '$lib/db';
import { error } from '@sveltejs/kit';

export async function load({ params }) {
  const id = parseInt(params.id);

  // ── Company record ────────────────────────────────────────────────────
  const coRows = await sql`
    SELECT
      co.corp_company_id, co.company_name, co.industry, co.website, co.notes,
      co.status, co.merged_into_id, co.status_note, co.parent_company_id,
      co.created_at::text, co.updated_at::text,
      mc.company_name AS merged_into_name,
      pc.company_name AS parent_company_name
    FROM corp_companies co
    LEFT JOIN corp_companies mc ON mc.corp_company_id = co.merged_into_id
    LEFT JOIN corp_companies pc ON pc.corp_company_id = co.parent_company_id
    WHERE co.corp_company_id = ${id}
  `;
  if (!coRows.length) throw error(404, 'Company not found');
  const company = coRows[0];

  // ── Divisions ─────────────────────────────────────────────────────────
  const divisions = await sql`
    SELECT
      co.corp_company_id,
      co.company_name,
      co.industry,
      co.status,
      COUNT(DISTINCT c.corp_contact_id)::int    AS contact_count,
      COUNT(DISTINCT e.corp_engagement_id)::int AS engagement_count,
      SUM(e.amount_paid)                        AS total_revenue,
      MAX(e.engagement_date)::text              AS last_engagement
    FROM corp_companies co
    LEFT JOIN corp_contacts c    ON c.corp_company_id = co.corp_company_id
    LEFT JOIN corp_engagements e ON e.corp_contact_id = c.corp_contact_id
    WHERE co.parent_company_id = ${id}
      AND co.status = 'active'
    GROUP BY co.corp_company_id
    ORDER BY co.company_name
  `;

  // ── All company IDs in scope (self + divisions) ───────────────────────
  // All queries below use this set so a parent sees everything rolled up
  const divisionIds   = divisions.map(d => d.corp_company_id);
  const allCompanyIds = [id, ...divisionIds];

  // ── Active contacts ───────────────────────────────────────────────────
  const activeContacts = await sql`
    SELECT
      c.corp_contact_id, c.first_name, c.last_name,
      c.email, c.phone, c.city, c.state,
      c.corp_company_id,
      co.company_name AS contact_company_name,
      COUNT(e.corp_engagement_id)::int AS engagement_count,
      MAX(e.engagement_date)::text     AS last_engagement
    FROM corp_contacts c
    JOIN corp_companies co ON co.corp_company_id = c.corp_company_id
    LEFT JOIN corp_engagements e ON e.corp_contact_id = c.corp_contact_id
    WHERE c.corp_company_id = ANY(${allCompanyIds})
    GROUP BY c.corp_contact_id, co.company_name
    ORDER BY c.last_name NULLS LAST, c.first_name NULLS LAST
  `;

  // ── Previous contacts ─────────────────────────────────────────────────
  const activeIds = activeContacts.map(c => c.corp_contact_id);
  const prevContacts = await sql`
    SELECT DISTINCT ON (h.corp_contact_id)
      h.corp_contact_id,
      c.first_name, c.last_name,
      h.email, h.phone,
      h.company_name     AS historical_company,
      c.company_name     AS current_company,
      c.corp_company_id  AS current_company_id,
      h.created_at::text AS recorded_at,
      h.notes
    FROM corp_contact_history h
    JOIN corp_contacts c ON c.corp_contact_id = h.corp_contact_id
    WHERE h.corp_company_id = ANY(${allCompanyIds})
      AND h.corp_contact_id != ALL(${activeIds.length ? activeIds : [0]})
    ORDER BY h.corp_contact_id, h.created_at DESC
  `;

  // ── Engagements ───────────────────────────────────────────────────────
  const engagements = await sql`
    SELECT
      e.corp_engagement_id, e.title, e.engagement_type,
      e.pipeline_status, e.contract_status,
      e.engagement_date::text, e.amount_paid, e.is_archived,
      c.first_name, c.last_name, c.corp_contact_id,
      c.corp_company_id,
      co.company_name AS contact_company_name
    FROM corp_engagements e
    JOIN corp_contacts c   ON c.corp_contact_id   = e.corp_contact_id
    JOIN corp_companies co ON co.corp_company_id  = c.corp_company_id
    WHERE c.corp_company_id = ANY(${allCompanyIds})
    ORDER BY e.engagement_date DESC NULLS LAST
  `;

  // ── Stats (rolled up across all company IDs in scope) ─────────────────
  const statsRows = await sql`
    SELECT
      COUNT(e.corp_engagement_id)::int                    AS total_engagements,
      COUNT(CASE WHEN e.amount_paid > 0 THEN 1 END)::int  AS paid_engagements,
      COALESCE(SUM(e.amount_paid), 0)                     AS total_revenue,
      MAX(e.engagement_date)::text                        AS last_engagement_date,
      MIN(e.engagement_date)::text                        AS first_engagement_date
    FROM corp_engagements e
    JOIN corp_contacts c ON c.corp_contact_id = e.corp_contact_id
    WHERE c.corp_company_id = ANY(${allCompanyIds})
  `;

  const isDivision = !!company.parent_company_id;

  return {
    company,
    isDivision,
    divisions:      divisions.map(d => ({
      ...d,
      total_revenue: d.total_revenue ? parseFloat(d.total_revenue) : null,
    })),
    allCompanyIds,
    activeContacts: activeContacts.map(c => ({ ...c })),
    prevContacts:   prevContacts.map(c => ({ ...c })),
    engagements:    engagements.map(e => ({
      ...e,
      amount_paid: e.amount_paid ? parseFloat(e.amount_paid) : null,
    })),
    stats: {
      ...statsRows[0],
      total_revenue: statsRows[0]?.total_revenue
        ? parseFloat(statsRows[0].total_revenue) : null,
    },
  };
}

export const actions = {
  updateCompany: async ({ request, params }) => {
    const id   = parseInt(params.id);
    const form = await request.formData();
    const g    = (/** @type {string} */ k) => form.get(k)?.toString() || null;

    const parentName = g('parent_company_name');
    let parentId = null;
    if (parentName) {
      const pRows = await sql`
        SELECT corp_company_id FROM corp_companies
        WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(${parentName}))
          AND status = 'active'
          AND corp_company_id != ${id}
        LIMIT 1
      `;
      parentId = pRows[0]?.corp_company_id ?? null;
    }

    await sql`
      UPDATE corp_companies SET
        company_name      = ${g('company_name')},
        industry          = ${g('industry')},
        website           = ${g('website')},
        notes             = ${g('notes')},
        parent_company_id = ${parentId},
        updated_at        = NOW()
      WHERE corp_company_id = ${id}
    `;

    if (g('company_name')) {
      await sql`
        UPDATE corp_contacts
        SET company_name = ${g('company_name')}, updated_at = NOW()
        WHERE corp_company_id = ${id}
      `;
    }

    return { success: true };
  },
};