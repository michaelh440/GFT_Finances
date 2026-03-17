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
    const form        = await request.formData();
    const mergesJson  = (form.get('merges') || '').toString();
    if (!mergesJson) return { success: false, error: 'No merge data.' };

    try {
      const merges = JSON.parse(mergesJson);
      // merges: [{ keep_id, discard_ids, updates: { company_name, email, phone, ... } }]

      let merged = 0;

      for (const m of merges) {
        const { keep_id, discard_ids, updates } = m;

        // Apply any field overrides chosen by the user
        if (updates && Object.keys(updates).length > 0) {
          const u = updates;
          await sql`
            UPDATE corp_contacts SET
              company_name  = COALESCE(${u.company_name  ?? null}, company_name),
              first_name    = COALESCE(${u.first_name    ?? null}, first_name),
              last_name     = COALESCE(${u.last_name     ?? null}, last_name),
              email         = COALESCE(${u.email         ?? null}, email),
              phone         = COALESCE(${u.phone         ?? null}, phone),
              address_line1 = COALESCE(${u.address_line1 ?? null}, address_line1),
              city          = COALESCE(${u.city          ?? null}, city),
              state         = COALESCE(${u.state         ?? null}, state),
              zip           = COALESCE(${u.zip           ?? null}, zip),
              updated_at    = NOW()
            WHERE corp_contact_id = ${keep_id}
          `;
        }

        // Reassign all engagements from discarded contacts to the keeper
        for (const discard_id of discard_ids) {
          await sql`
            UPDATE corp_engagements
            SET corp_contact_id = ${keep_id}, updated_at = NOW()
            WHERE corp_contact_id = ${discard_id}
          `;
          await sql`
            DELETE FROM corp_contacts WHERE corp_contact_id = ${discard_id}
          `;
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