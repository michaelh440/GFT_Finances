// src/routes/corp/website_sync/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

const BLOCKED_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.co.uk', 'ymail.com',
  'hotmail.com', 'hotmail.co.uk', 'hotmail.fr',
  'outlook.com', 'outlook.co.uk',
  'live.com', 'live.co.uk', 'msn.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'protonmail.com', 'proton.me',
  'zoho.com', 'mail.com',
  'comcast.net', 'att.net', 'verizon.net',
  'sbcglobal.net', 'bellsouth.net',
  'cox.net', 'charter.net', 'earthlink.net',
  'duck.com',
];

const PAGE_SIZE_OPTIONS = [25, 50, 100];
const DEFAULT_PAGE_SIZE = 25;

export async function load({ locals, url }) {
  requirePermission(locals.user, 'corp', 'manager');

  const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
  const pageSize = PAGE_SIZE_OPTIONS.includes(parseInt(url.searchParams.get('pageSize') || ''))
    ? parseInt(url.searchParams.get('pageSize'))
    : DEFAULT_PAGE_SIZE;
  const offset = (page - 1) * pageSize;

  // Get total count of all active companies
  const [{ total }] = await sql`
    SELECT COUNT(*)::int AS total
    FROM corp_companies
    WHERE status = 'active'
  `;

  // Get paginated companies — include existing website/industry,
  // plus a proposed domain derived from contact emails when no website exists
  const candidates = await sql`
    WITH domain_candidates AS (
      SELECT
        co.corp_company_id,
        LOWER(SUBSTRING(c.email FROM POSITION('@' IN c.email) + 1)) AS domain,
        COUNT(*)                                                      AS domain_count,
        STRING_AGG(
          c.first_name || ' ' || c.last_name, ', '
          ORDER BY c.first_name
        )                                                             AS contact_names
      FROM corp_companies co
      JOIN corp_contacts c ON c.corp_company_id = co.corp_company_id
      WHERE co.status = 'active'
        AND (co.website IS NULL OR TRIM(co.website) = '')
        AND c.email IS NOT NULL
        AND c.email LIKE '%@%'
        AND LOWER(SUBSTRING(c.email FROM POSITION('@' IN c.email) + 1))
            != ALL(${BLOCKED_DOMAINS})
      GROUP BY co.corp_company_id, domain
    ),
    best_domain AS (
      SELECT DISTINCT ON (corp_company_id)
        corp_company_id,
        domain,
        domain_count,
        contact_names
      FROM domain_candidates
      ORDER BY corp_company_id, domain_count DESC, domain ASC
    )
    SELECT
      co.corp_company_id,
      co.company_name,
      co.industry,
      co.summary,
      co.company_size,
      co.website AS existing_website,
      bd.domain          AS proposed_domain,
      COALESCE(bd.domain_count, 0)::int AS domain_count,
      bd.contact_names
    FROM corp_companies co
    LEFT JOIN best_domain bd ON bd.corp_company_id = co.corp_company_id
    WHERE co.status = 'active'
    ORDER BY co.company_name
    LIMIT ${pageSize} OFFSET ${offset}
  `;

  const totalPages = Math.ceil(total / pageSize);

  return {
    candidates: candidates.map(r => ({
      ...r,
      domain_count: Number(r.domain_count),
      has_website: !!(r.existing_website && r.existing_website.trim()),
      has_industry: !!(r.industry && r.industry.trim()),
      has_summary: !!(r.summary && r.summary.trim()),
      has_size: !!(r.company_size && r.company_size.trim()),
    })),
    pagination: { page, pageSize, total, totalPages },
    pageSizeOptions: PAGE_SIZE_OPTIONS,
    user: locals.user,
  };
}

/** Helper to parse selected IDs from form */
function getSelected(form) {
  return new Set(form.getAll('selected').map(v => parseInt(v.toString())).filter(Boolean));
}

/** Helper to parse key:value pairs from form */
function parseKeyValues(form, field) {
  /** @type {Record<number, string>} */
  const result = {};
  for (const v of form.getAll(field)) {
    const str = v.toString();
    const sep = str.indexOf(':');
    if (sep > 0) {
      const id = parseInt(str.slice(0, sep));
      const val = str.slice(sep + 1).trim();
      if (id && val) result[id] = val;
    }
  }
  return result;
}

export const actions = {
  updateWebsites: async ({ request, locals }) => {
    requirePermission(locals.user, 'corp', 'manager');
    const form = await request.formData();
    const selected = getSelected(form);

    const approved = form.getAll('approved').map(v => {
      const [id, domain] = v.toString().split(':');
      return { id: parseInt(id), domain };
    }).filter(r => r.id && r.domain);

    if (!selected.size) return { success: true, updated: 0, action: 'websites' };

    let updated = 0;
    for (const { id, domain } of approved) {
      if (!selected.has(id)) continue;
      const fullUrl = domain.startsWith('http://') || domain.startsWith('https://') ? domain : `https://${domain}`;
      const result = await sql`
        UPDATE corp_companies
        SET website = ${fullUrl}, updated_at = NOW()
        WHERE corp_company_id = ${id}
          AND (website IS NULL OR TRIM(website) = '')
      `;
      if (result.count > 0) updated++;
    }

    return { success: true, updated, action: 'websites' };
  },

  updateIndustries: async ({ request, locals }) => {
    requirePermission(locals.user, 'corp', 'manager');
    const form = await request.formData();
    const selected = getSelected(form);
    const industries = parseKeyValues(form, 'industry');

    if (!selected.size) return { success: true, updated: 0, action: 'industries' };

    let updated = 0;
    for (const [id, industry] of Object.entries(industries)) {
      const numId = parseInt(id);
      if (!selected.has(numId)) continue;
      await sql`
        UPDATE corp_companies
        SET industry = ${industry}, updated_at = NOW()
        WHERE corp_company_id = ${numId}
      `;
      updated++;
    }

    return { success: true, updated, action: 'industries' };
  },

  updateSummaries: async ({ request, locals }) => {
    requirePermission(locals.user, 'corp', 'manager');
    const form = await request.formData();
    const selected = getSelected(form);
    const summaries = parseKeyValues(form, 'summary');

    if (!selected.size) return { success: true, updated: 0, action: 'summaries' };

    let updated = 0;
    for (const [id, summary] of Object.entries(summaries)) {
      const numId = parseInt(id);
      if (!selected.has(numId)) continue;
      await sql`
        UPDATE corp_companies
        SET summary = ${summary}, updated_at = NOW()
        WHERE corp_company_id = ${numId}
      `;
      updated++;
    }

    return { success: true, updated, action: 'summaries' };
  },

  updateSizes: async ({ request, locals }) => {
    requirePermission(locals.user, 'corp', 'manager');
    const form = await request.formData();
    const selected = getSelected(form);
    const sizes = parseKeyValues(form, 'company_size');

    if (!selected.size) return { success: true, updated: 0, action: 'sizes' };

    let updated = 0;
    for (const [id, size] of Object.entries(sizes)) {
      const numId = parseInt(id);
      if (!selected.has(numId)) continue;
      await sql`
        UPDATE corp_companies
        SET company_size = ${size}, updated_at = NOW()
        WHERE corp_company_id = ${numId}
      `;
      updated++;
    }

    return { success: true, updated, action: 'sizes' };
  },
};
