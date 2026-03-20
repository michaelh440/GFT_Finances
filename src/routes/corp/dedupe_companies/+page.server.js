// src/routes/corp/dedupe_companies/+page.server.js
import sql from '$lib/db';

// ── Fuzzy matching helpers ────────────────────────────────────────────────

/**
 * Normalize a company name for comparison:
 * lowercase, strip punctuation, expand common abbreviations,
 * remove generic suffixes (Inc, LLC, Ltd, Corp, etc.)
 * @param {string} name
 */
function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_\`~()]/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|co|company|the|of|and|&)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Trigram set for a string — all 3-char substrings
 * @param {string} s
 * @returns {Set<string>}
 */
function trigrams(s) {
  const padded = `  ${s} `;
  const t = new Set();
  for (let i = 0; i < padded.length - 2; i++) {
    t.add(padded.slice(i, i + 3));
  }
  return t;
}

/**
 * Trigram similarity score between 0 and 1 (like pg_trgm similarity)
 * @param {string} a
 * @param {string} b
 */
function similarity(a, b) {
  if (!a || !b) return 0;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let intersection = 0;
  for (const t of ta) { if (tb.has(t)) intersection++; }
  return intersection / (ta.size + tb.size - intersection);
}

/**
 * Check if name b "starts with" name a (parent/division detection).
 * e.g. "exxonmobil" is a prefix of "exxonmobil global projects"
 * @param {string} a
 * @param {string} b
 */
function isPrefixOf(a, b) {
  return b.startsWith(a) && b.length > a.length + 1;
}

// Thresholds
const EXACT_THRESHOLD     = 0.85; // very likely same company
const SIMILAR_THRESHOLD   = 0.55; // possible match, show for review
const PREFIX_MIN_LENGTH   = 5;    // min chars before prefix check applies

/**
 * Group companies by fuzzy similarity.
 * @param {{ corp_company_id: number, company_name: string, parent_company_id: number|null }[]} companies
 */
function buildFuzzyGroups(companies) {
  // Normalize all names up front
  const normalized = companies.map(c => ({
    id:   c.corp_company_id,
    name: c.company_name,
    norm: normalize(c.company_name),
  }));

  // Union-Find
  const parent = new Map(normalized.map(c => [c.id, c.id]));

  function find(/** @type {number} */ id) {
    while (parent.get(id) !== id) {
      const p = parent.get(id);
      parent.set(id, parent.get(p) ?? p);
      id = p ?? id;
    }
    return id;
  }

  function union(/** @type {number} */ a, /** @type {number} */ b) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) {
      // Always keep the lower ID as root
      if (ra < rb) parent.set(rb, ra);
      else         parent.set(ra, rb);
    }
  }

  // Compare every pair — O(n²) but company counts are small (~1500)
  for (let i = 0; i < normalized.length; i++) {
    for (let j = i + 1; j < normalized.length; j++) {
      const a = normalized[i];
      const b = normalized[j];

      if (!a.norm || !b.norm) continue;

      // Skip pairs that already have a formal parent/child relationship
      const aParentOfB = companies.find(c => c.corp_company_id === b.id)?.parent_company_id === a.id;
      const bParentOfA = companies.find(c => c.corp_company_id === a.id)?.parent_company_id === b.id;
      if (aParentOfB || bParentOfA) continue;

      const sim = similarity(a.norm, b.norm);
      const aIsPrefix = a.norm.length >= PREFIX_MIN_LENGTH && isPrefixOf(a.norm, b.norm);
      const bIsPrefix = b.norm.length >= PREFIX_MIN_LENGTH && isPrefixOf(b.norm, a.norm);

      if (sim >= EXACT_THRESHOLD || aIsPrefix || bIsPrefix) {
        union(a.id, b.id);
      }
    }
  }

  // Collect groups
  /** @type {Map<number, number[]>} */
  const groupMap = new Map();
  for (const c of normalized) {
    const root = find(c.id);
    if (!groupMap.has(root)) groupMap.set(root, []);
    groupMap.get(root)?.push(c.id);
  }

  // Only return groups with 2+ members, sorted so lowest ID is first
  return [...groupMap.values()]
    .filter(g => g.length > 1)
    .map(g => g.sort((a, b) => a - b));
}

// ── Load ──────────────────────────────────────────────────────────────────

export async function load() {
  // Load all companies with stats
  const allCompanies = await sql`
    SELECT
      co.corp_company_id,
      co.company_name,
      co.industry,
      co.website,
      co.notes,
      co.parent_company_id,
      COUNT(DISTINCT c.corp_contact_id)::int    AS contact_count,
      COUNT(DISTINCT h.history_id)::int         AS history_count,
      COUNT(DISTINCT e.corp_engagement_id)::int AS engagement_count,
      SUM(e.amount_paid)                        AS total_revenue
    FROM corp_companies co
    LEFT JOIN corp_contacts c        ON c.corp_company_id = co.corp_company_id
    LEFT JOIN corp_contact_history h ON h.corp_company_id = co.corp_company_id
    LEFT JOIN corp_engagements e     ON e.corp_contact_id = c.corp_contact_id
    WHERE co.status = 'active'
    GROUP BY co.corp_company_id
    ORDER BY co.corp_company_id
  `;

  if (!allCompanies.length) return { groups: [] };

  const coMap = Object.fromEntries(
    allCompanies.map(c => [c.corp_company_id, {
      ...c,
      contact_count:    c.contact_count    ?? 0,
      history_count:    c.history_count    ?? 0,
      engagement_count: c.engagement_count ?? 0,
      total_revenue:    c.total_revenue    ? parseFloat(c.total_revenue) : null,
    }])
  );

  // Run fuzzy grouping in JS
  const groupIds = buildFuzzyGroups(allCompanies);

  const groups = groupIds.map(ids => {
    const companies = ids.map(id => coMap[id]).filter(Boolean);
    const canonical = companies[0]; // lowest ID

    // Classify the match type for display
    const norms = companies.map(c => normalize(c.company_name));
    const hasExact   = norms.some((n, i) => i > 0 && similarity(norms[0], n) >= EXACT_THRESHOLD);
    const hasPrefix  = companies.slice(1).some(c => {
      const nb = normalize(c.company_name);
      return isPrefixOf(norms[0], nb) || isPrefixOf(nb, norms[0]);
    });

    return {
      canonical_id: canonical.corp_company_id,
      match_type:   hasExact ? 'similar' : hasPrefix ? 'parent_division' : 'similar',
      companies,
      total_contacts:    companies.reduce((s, c) => s + c.contact_count,    0),
      total_engagements: companies.reduce((s, c) => s + c.engagement_count, 0),
      total_revenue:     companies.reduce((s, c) => s + (c.total_revenue ?? 0), 0),
    };
  });

  return { groups };
}

// ── Actions ───────────────────────────────────────────────────────────────

export const actions = {
  // ── Manual merge search ───────────────────────────────────────────────
  search: async ({ request }) => {
    const form   = await request.formData();
    const query  = (form.get('query')  || '').toString().trim();
    const target = (form.get('target') || '').toString().trim(); // 'discard' | 'keep'
    if (!query) return { success: true, action: 'search', target, results: [] };

    const byId = /^\d+$/.test(query);

    const rows = await sql`
      SELECT
        co.corp_company_id,
        co.company_name,
        co.industry,
        co.website,
        co.status,
        COUNT(DISTINCT c.corp_contact_id)::int    AS contact_count,
        COUNT(DISTINCT e.corp_engagement_id)::int AS engagement_count,
        SUM(e.amount_paid)                        AS total_revenue
      FROM corp_companies co
      LEFT JOIN corp_contacts c    ON c.corp_company_id = co.corp_company_id
      LEFT JOIN corp_engagements e ON e.corp_contact_id = c.corp_contact_id
      WHERE ${byId
        ? sql`co.corp_company_id = ${parseInt(query)}`
        : sql`LOWER(co.company_name) LIKE ${'%' + query.toLowerCase() + '%'}`
      }
      GROUP BY co.corp_company_id
      ORDER BY co.status = 'active' DESC, co.company_name
      LIMIT 20
    `;

    return {
      success: true,
      action:  'search',
      target,
      results: rows.map(r => ({
        ...r,
        total_revenue: r.total_revenue ? parseFloat(r.total_revenue) : null,
      })),
    };
  },

  // ── Merge action ──────────────────────────────────────────────────────
  merge: async ({ request }) => {
    const form       = await request.formData();
    const mergesJson = (form.get('merges') || '').toString();
    if (!mergesJson) return { success: false, error: 'No merge data.' };

    try {
      const merges = JSON.parse(mergesJson);
      let merged = 0;

      for (const m of merges) {
        const { keep_id, discard_ids, updates } = m;

        // Run the whole group as a transaction so partial failures roll back
        await sql.begin(async sql => {

          // Apply field overrides on the keeper — only update fields that have values
          if (updates && Object.keys(updates).length > 0) {
            const u = updates;
            if (u.company_name != null) await sql`UPDATE corp_companies SET company_name = ${u.company_name}, updated_at = NOW() WHERE corp_company_id = ${keep_id}`;
            if (u.industry     != null) await sql`UPDATE corp_companies SET industry     = ${u.industry},     updated_at = NOW() WHERE corp_company_id = ${keep_id}`;
            if (u.website      != null) await sql`UPDATE corp_companies SET website      = ${u.website},      updated_at = NOW() WHERE corp_company_id = ${keep_id}`;
            if (u.notes        != null) await sql`UPDATE corp_companies SET notes        = ${u.notes},        updated_at = NOW() WHERE corp_company_id = ${keep_id}`;
          }

          // Get the canonical company name AFTER any update
          const coRows = await sql`
            SELECT company_name FROM corp_companies WHERE corp_company_id = ${keep_id}
          `;
          const canonicalName = coRows[0]?.company_name ?? null;

          for (const discard_id of discard_ids) {
            // Reassign contacts — also update their company_name text to canonical
            await sql`
              UPDATE corp_contacts SET
                corp_company_id = ${keep_id},
                company_name    = ${canonicalName},
                updated_at      = NOW()
              WHERE corp_company_id = ${discard_id}
            `;

            // Reassign contact history entries
            await sql`
              UPDATE corp_contact_history SET
                corp_company_id = ${keep_id}
              WHERE corp_company_id = ${discard_id}
            `;

            // Soft-delete: mark as merged rather than hard delete
            const marked = await sql`
              UPDATE corp_companies SET
                status             = 'merged',
                merged_into_id     = ${keep_id},
                status_note        = ${'Merged into: ' + (canonicalName ?? keep_id)},
                status_changed_at  = NOW(),
                updated_at         = NOW()
              WHERE corp_company_id = ${discard_id}
              RETURNING corp_company_id
            `;

            if (!marked.length) {
              throw new Error(`Failed to mark company ID ${discard_id} as merged — record not found`);
            }
          }

          // Sync canonical name on all contacts already linked to keep_id
          // (covers contacts that were linked before this merge)
          if (canonicalName) {
            await sql`
              UPDATE corp_contacts SET
                company_name = ${canonicalName},
                updated_at   = NOW()
              WHERE corp_company_id = ${keep_id}
            `;
          }
        });

        merged++;
      }

      return { success: true, message: `Merged ${merged} company group${merged !== 1 ? 's' : ''}.` };

    } catch (err) {
      console.error('company merge error:', err);
      return { success: false, error: 'Merge failed: ' + (err instanceof Error ? err.message : String(err)) };
    }
  },
};