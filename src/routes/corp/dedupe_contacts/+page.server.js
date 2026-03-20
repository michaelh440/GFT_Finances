// src/routes/corp/dedupe_contacts/+page.server.js
import sql from '$lib/db';

export async function load() {
  // ── Find all duplicate groups ─────────────────────────────────────────
  // A "group" is contacts that share the same normalized email OR
  // same (first_name + last_name + phone) combination.
  // We union both detection methods then group by the lowest contact_id.

  const groups = await sql`
    WITH email_dupes AS (
      -- Same normalized email
      SELECT
        MIN(corp_contact_id) AS canonical_id,
        ARRAY_AGG(corp_contact_id ORDER BY corp_contact_id) AS all_ids,
        'email' AS match_type
      FROM corp_contacts
      WHERE email IS NOT NULL AND TRIM(email) != ''
        AND LOWER(TRIM(email)) NOT LIKE '%placeholder.local%'
      GROUP BY LOWER(TRIM(email))
      HAVING COUNT(*) > 1
    ),
    name_phone_dupes AS (
      -- Same name + phone
      SELECT
        MIN(corp_contact_id) AS canonical_id,
        ARRAY_AGG(corp_contact_id ORDER BY corp_contact_id) AS all_ids,
        'name_phone' AS match_type
      FROM corp_contacts
      WHERE first_name IS NOT NULL AND last_name IS NOT NULL
        AND phone IS NOT NULL
        AND TRIM(phone) NOT IN ('', '0', '111111111')
      GROUP BY
        LOWER(TRIM(first_name)),
        LOWER(TRIM(last_name)),
        TRIM(phone)
      HAVING COUNT(*) > 1
    ),
    all_dupes AS (
      SELECT canonical_id, all_ids, match_type FROM email_dupes
      UNION
      SELECT canonical_id, all_ids, match_type FROM name_phone_dupes
    ),
    -- Collapse groups that share any ID (e.g. person detected by both methods)
    -- by picking the minimum canonical_id across overlapping groups
    collapsed AS (
      SELECT
        MIN(canonical_id) AS canonical_id,
        ARRAY_AGG(DISTINCT id ORDER BY id) AS all_ids,
        STRING_AGG(DISTINCT match_type, '+' ORDER BY match_type) AS match_types
      FROM all_dupes, UNNEST(all_ids) AS id
      GROUP BY (
        -- Group by the unnested IDs to collapse overlapping sets
        SELECT MIN(canonical_id) FROM all_dupes a2
        WHERE id = ANY(a2.all_ids)
      )
    )
    SELECT canonical_id, all_ids, match_types
    FROM collapsed
    ORDER BY canonical_id
  `;

  if (!groups.length) {
    return { groups: [] };
  }

  // ── Load full contact data for all IDs ────────────────────────────────
  const allIds = [...new Set(groups.flatMap(g => g.all_ids))];

  const contacts = await sql`
    SELECT
      c.corp_contact_id,
      c.corp_company_id,
      c.company_name,
      c.first_name,
      c.last_name,
      c.email,
      c.phone,
      c.address_line1,
      c.city,
      c.state,
      c.zip,
      COUNT(e.corp_engagement_id)::int AS engagement_count,
      MAX(e.engagement_date)::text      AS last_engagement
    FROM corp_contacts c
    LEFT JOIN corp_engagements e ON e.corp_contact_id = c.corp_contact_id
    WHERE c.corp_contact_id = ANY(${allIds})
    GROUP BY c.corp_contact_id
    ORDER BY c.corp_contact_id
  `;

  const contactMap = Object.fromEntries(contacts.map(c => [c.corp_contact_id, c]));

  // ── Build group objects ───────────────────────────────────────────────
  const result = groups
    .filter(g => g.all_ids.length > 1)
    .map(g => ({
      canonical_id: g.canonical_id,
      match_types:  g.match_types,
      contacts:     g.all_ids.map(id => contactMap[id]).filter(Boolean),
    }))
    .filter(g => g.contacts.length > 1);

  return { groups: result };
}

export const actions = {
  merge: async ({ request }) => {
    const form       = await request.formData();
    const mergesJson = (form.get('merges') || '').toString();
    if (!mergesJson) return { success: false, error: 'No merge data.' };

    try {
      const merges = JSON.parse(mergesJson);
      let merged = 0;

      for (const m of merges) {
        const { keep_id, discard_ids, updates } = m;

        // ── Fetch the canonical contact's current state ───────────────────
        const canonicalRows = await sql`
          SELECT company_name, email, phone FROM corp_contacts
          WHERE corp_contact_id = ${keep_id}
        `;
        const canonical = canonicalRows[0] ?? {};

        // ── Fetch the most recent history entry (to compare against) ──────
        const lastHistoryRows = await sql`
          SELECT company_name, email, phone FROM corp_contact_history
          WHERE corp_contact_id = ${keep_id}
          ORDER BY created_at DESC
          LIMIT 1
        `;
        const lastHistory = lastHistoryRows[0] ?? null;

        // ── Process each discarded contact ────────────────────────────────
        for (const discard_id of discard_ids) {
          const discardRows = await sql`
            SELECT company_name, email, phone FROM corp_contacts
            WHERE corp_contact_id = ${discard_id}
          `;
          const discard = discardRows[0];
          if (!discard) continue;

          // Compare discard's data against the canonical AND the last history row.
          // Only write a history entry if at least one field differs from both.
          const compareTo = lastHistory ?? canonical;

          const differsFromCurrent =
            (discard.company_name ?? '') !== (canonical.company_name ?? '') ||
            (discard.email        ?? '') !== (canonical.email        ?? '') ||
            (discard.phone        ?? '') !== (canonical.phone        ?? '');

          const differsFromLastHistory =
            !lastHistory ||
            (discard.company_name ?? '') !== (compareTo.company_name ?? '') ||
            (discard.email        ?? '') !== (compareTo.email        ?? '') ||
            (discard.phone        ?? '') !== (compareTo.phone        ?? '');

          if (differsFromCurrent && differsFromLastHistory) {
            // Look up the company_id for the discard contact's company name
            const companyRows = await sql`
              SELECT corp_company_id FROM corp_companies
              WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(${discard.company_name ?? ''}))
              LIMIT 1
            `;
            const companyId = companyRows[0]?.corp_company_id ?? null;

            await sql`
              INSERT INTO corp_contact_history
                (corp_contact_id, company_name, email, phone, notes, corp_company_id)
              VALUES (
                ${keep_id},
                ${discard.company_name ?? null},
                ${discard.email        ?? null},
                ${discard.phone        ?? null},
                ${'Merged from contact ID ' + discard_id},
                ${companyId}
              )
            `;
          }

          // Reassign engagements then delete
          await sql`
            UPDATE corp_engagements
            SET corp_contact_id = ${keep_id}, updated_at = NOW()
            WHERE corp_contact_id = ${discard_id}
          `;
          await sql`
            DELETE FROM corp_contacts WHERE corp_contact_id = ${discard_id}
          `;
        }

        // ── Apply field overrides the user chose ──────────────────────────
        // Write the CURRENT canonical values to history first (before overwriting),
        // but only if they differ from the last history entry.
        if (updates && Object.keys(updates).length > 0) {
          const u = updates;

          // Check if current canonical state differs from last history
          const canonicalDiffersFromHistory =
            !lastHistory ||
            (canonical.company_name ?? '') !== (lastHistory.company_name ?? '') ||
            (canonical.email        ?? '') !== (lastHistory.email        ?? '') ||
            (canonical.phone        ?? '') !== (lastHistory.phone        ?? '');

          if (canonicalDiffersFromHistory) {
            await sql`
              INSERT INTO corp_contact_history
                (corp_contact_id, company_name, email, phone, notes)
              VALUES (
                ${keep_id},
                ${canonical.company_name ?? null},
                ${canonical.email        ?? null},
                ${canonical.phone        ?? null},
                ${'Previous values before field update'}
              )
            `;
          }

          // Apply field overrides — only update fields that have chosen values
          if (u.company_name  != null) await sql`UPDATE corp_contacts SET company_name  = ${u.company_name},  updated_at = NOW() WHERE corp_contact_id = ${keep_id}`;
          if (u.first_name    != null) await sql`UPDATE corp_contacts SET first_name    = ${u.first_name},    updated_at = NOW() WHERE corp_contact_id = ${keep_id}`;
          if (u.last_name     != null) await sql`UPDATE corp_contacts SET last_name     = ${u.last_name},     updated_at = NOW() WHERE corp_contact_id = ${keep_id}`;
          if (u.email         != null) await sql`UPDATE corp_contacts SET email         = ${u.email},         updated_at = NOW() WHERE corp_contact_id = ${keep_id}`;
          if (u.phone         != null) await sql`UPDATE corp_contacts SET phone         = ${u.phone},         updated_at = NOW() WHERE corp_contact_id = ${keep_id}`;
          if (u.address_line1 != null) await sql`UPDATE corp_contacts SET address_line1 = ${u.address_line1}, updated_at = NOW() WHERE corp_contact_id = ${keep_id}`;
          if (u.city          != null) await sql`UPDATE corp_contacts SET city          = ${u.city},          updated_at = NOW() WHERE corp_contact_id = ${keep_id}`;
          if (u.state         != null) await sql`UPDATE corp_contacts SET state         = ${u.state},         updated_at = NOW() WHERE corp_contact_id = ${keep_id}`;
          if (u.zip           != null) await sql`UPDATE corp_contacts SET zip           = ${u.zip},           updated_at = NOW() WHERE corp_contact_id = ${keep_id}`;

          // If company_name changed, resolve the new corp_company_id
          if (u.company_name) {
            const coRows = await sql`
              SELECT corp_company_id FROM corp_companies
              WHERE LOWER(TRIM(company_name)) = LOWER(TRIM(${u.company_name}))
              LIMIT 1
            `;
            const newCompanyId = coRows[0]?.corp_company_id ?? null;
            await sql`
              UPDATE corp_contacts SET corp_company_id = ${newCompanyId}
              WHERE corp_contact_id = ${keep_id}
            `;
          }
        }

        merged++;
      }

      return {
        success: true,
        message: `Merged ${merged} duplicate group${merged !== 1 ? 's' : ''}.`
      };

    } catch (err) {
      console.error('merge error:', err);
      return { success: false, error: 'Merge failed: ' + (err instanceof Error ? err.message : String(err)) };
    }
  },

  skip: async ({ request }) => {
    // Just a no-op — user chose to skip a group without merging
    return { success: true, message: 'Group skipped.' };
  },
};