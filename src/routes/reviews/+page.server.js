// src/routes/reviews/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';
import { hasPermission } from '$lib/permissions';

export const load = async ({ url, locals }) => {
  // Any viewer across hsi, gft, or corp can see reviews
  const canSee = hasPermission(locals.user, 'hsi', 'viewer')
    || hasPermission(locals.user, 'gft', 'viewer')
    || hasPermission(locals.user, 'corp', 'viewer')
    || locals.user?.is_super_admin;
  if (!canSee) requirePermission(locals.user, 'hsi', 'viewer'); // triggers redirect

  const canManage = hasPermission(locals.user, 'hsi', 'manager')
    || hasPermission(locals.user, 'gft', 'manager')
    || hasPermission(locals.user, 'corp', 'manager')
    || locals.user?.is_super_admin;

  // Filters
  const source = url.searchParams.get('source') || '';
  const search = url.searchParams.get('search') || '';
  const linked = url.searchParams.get('linked') || ''; // 'yes', 'no', ''
  const minRating = url.searchParams.get('min_rating') || '';
  const pageParam = parseInt(url.searchParams.get('page') || '1') || 1;
  const pageSize = 25;

  try {
    const sourceFilter = source ? sql`AND r.source = ${source}` : sql``;
    const searchFilter = search
      ? sql`AND (LOWER(r.reviewer_name) LIKE ${'%' + search.toLowerCase() + '%'} OR LOWER(r.review_text) LIKE ${'%' + search.toLowerCase() + '%'})`
      : sql``;
    const linkedFilter = linked === 'yes'
      ? sql`AND (r.class_code IS NOT NULL OR r.show_code IS NOT NULL OR r.corp_company_id IS NOT NULL OR r.corp_engagement_id IS NOT NULL)`
      : linked === 'no'
        ? sql`AND r.class_code IS NULL AND r.show_code IS NULL AND r.corp_company_id IS NULL AND r.corp_engagement_id IS NULL`
        : sql``;
    const ratingFilter = minRating ? sql`AND r.rating >= ${parseFloat(minRating)}` : sql``;

    const [countResult] = await sql`
      SELECT COUNT(*)::int AS total FROM customer_reviews r
      WHERE 1=1 ${sourceFilter} ${searchFilter} ${linkedFilter} ${ratingFilter}
    `;
    const totalCount = countResult.total;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const currentPage = Math.min(pageParam, totalPages);
    const offset = (currentPage - 1) * pageSize;

    const reviews = await sql`
      SELECT
        r.*,
        c.class_name,
        s.show_name,
        co.company_name,
        ce.title AS engagement_title,
        cs.session_name
      FROM customer_reviews r
      LEFT JOIN classes c ON r.class_code = c.class_code
      LEFT JOIN shows s ON r.show_code = s.show_code
      LEFT JOIN corp_companies co ON r.corp_company_id = co.corp_company_id
      LEFT JOIN corp_engagements ce ON r.corp_engagement_id = ce.corp_engagement_id
      LEFT JOIN class_sessions cs ON r.session_id = cs.session_id
      WHERE 1=1 ${sourceFilter} ${searchFilter} ${linkedFilter} ${ratingFilter}
      ORDER BY r.review_date DESC NULLS LAST, r.created_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    // Stats
    const [stats] = await sql`
      SELECT
        COUNT(*)::int AS total,
        ROUND(AVG(rating), 1) AS avg_rating,
        COUNT(CASE WHEN rating >= 4 THEN 1 END)::int AS positive,
        COUNT(DISTINCT source) AS source_count
      FROM customer_reviews
    `;

    // Load linking options for managers
    let classes = [];
    let shows = [];
    let companies = [];
    let engagements = [];
    let sessions = [];
    if (canManage) {
      [classes, shows, companies, engagements, sessions] = await Promise.all([
        sql`SELECT class_code, class_name FROM classes WHERE is_active = true ORDER BY class_name`,
        sql`SELECT show_code, show_name FROM shows WHERE is_active = true ORDER BY show_name`,
        sql`SELECT corp_company_id, company_name FROM corp_companies WHERE status = 'active' ORDER BY company_name`,
        sql`SELECT corp_engagement_id, title FROM corp_engagements ORDER BY engagement_date DESC LIMIT 200`,
        sql`SELECT session_id, session_name, class_code FROM class_sessions ORDER BY start_date DESC LIMIT 200`,
      ]);
    }

    return {
      reviews: reviews.map(r => ({
        ...r,
        rating: r.rating ? Number(r.rating) : null,
        review_date: r.review_date ? r.review_date.toISOString().split('T')[0] : null,
        created_at: r.created_at?.toISOString() || null,
      })),
      stats: { ...stats, avg_rating: stats.avg_rating ? Number(stats.avg_rating) : null },
      pagination: { currentPage, totalPages, pageSize, totalCount },
      filters: { source, search, linked, minRating },
      linkOptions: { classes, shows, companies, engagements, sessions },
      canManage,
      user: locals.user,
    };
  } catch (error) {
    console.error('Error loading reviews:', error);
    return {
      reviews: [], stats: { total: 0, avg_rating: null, positive: 0, source_count: 0 },
      pagination: { currentPage: 1, totalPages: 1, pageSize: 25, totalCount: 0 },
      filters: { source: '', search: '', linked: '', minRating: '' },
      linkOptions: { classes: [], shows: [], companies: [], engagements: [], sessions: [] },
      canManage: false,
    };
  }
};

export const actions = {
  add: async ({ request, locals }) => {
    const canManage = hasPermission(locals.user, 'hsi', 'manager')
      || hasPermission(locals.user, 'gft', 'manager')
      || hasPermission(locals.user, 'corp', 'manager')
      || locals.user?.is_super_admin;
    if (!canManage) requirePermission(locals.user, 'hsi', 'manager');

    const form = await request.formData();
    const source = form.get('source')?.toString().trim() || 'manual';
    const reviewerName = form.get('reviewer_name')?.toString().trim() || null;
    const rating = form.get('rating')?.toString().trim();
    const reviewText = form.get('review_text')?.toString().trim() || null;
    const reviewDate = form.get('review_date')?.toString().trim() || null;
    const sourceUrl = form.get('source_url')?.toString().trim() || null;
    const isFeatured = form.get('is_featured') === 'on';

    if (!reviewText && !rating) return { success: false, error: 'Review must have text or a rating.' };

    try {
      await sql`
        INSERT INTO customer_reviews (source, reviewer_name, rating, review_text, review_date, source_url, is_featured)
        VALUES (${source}, ${reviewerName}, ${rating ? parseFloat(rating) : null}, ${reviewText}, ${reviewDate || null}, ${sourceUrl}, ${isFeatured})
      `;
      return { success: true, message: 'Review added.' };
    } catch (err) {
      return { success: false, error: 'Failed: ' + (err instanceof Error ? err.message : String(err)) };
    }
  },

  link: async ({ request, locals }) => {
    const canManage = hasPermission(locals.user, 'hsi', 'manager')
      || hasPermission(locals.user, 'gft', 'manager')
      || hasPermission(locals.user, 'corp', 'manager')
      || locals.user?.is_super_admin;
    if (!canManage) requirePermission(locals.user, 'hsi', 'manager');

    const form = await request.formData();
    const reviewId = parseInt(form.get('review_id')?.toString() || '0');
    if (!reviewId) return { success: false, error: 'No review ID.' };

    const classCode = form.get('class_code')?.toString().trim() || null;
    const sessionId = form.get('session_id')?.toString().trim() || null;
    const showCode = form.get('show_code')?.toString().trim() || null;
    const companyId = form.get('corp_company_id')?.toString().trim() || null;
    const engagementId = form.get('corp_engagement_id')?.toString().trim() || null;
    const isFeatured = form.get('is_featured') === 'on';
    const notes = form.get('notes')?.toString().trim() || null;

    await sql`
      UPDATE customer_reviews SET
        class_code = ${classCode},
        session_id = ${sessionId ? parseInt(sessionId) : null},
        show_code = ${showCode},
        corp_company_id = ${companyId ? parseInt(companyId) : null},
        corp_engagement_id = ${engagementId ? parseInt(engagementId) : null},
        is_featured = ${isFeatured},
        notes = ${notes},
        updated_at = NOW()
      WHERE review_id = ${reviewId}
    `;
    return { success: true, message: 'Review updated.' };
  },

  delete: async ({ request, locals }) => {
    const canManage = hasPermission(locals.user, 'hsi', 'manager')
      || hasPermission(locals.user, 'gft', 'manager')
      || locals.user?.is_super_admin;
    if (!canManage) requirePermission(locals.user, 'hsi', 'manager');

    const form = await request.formData();
    const reviewId = parseInt(form.get('review_id')?.toString() || '0');
    if (!reviewId) return { success: false, error: 'No review ID.' };

    await sql`DELETE FROM customer_reviews WHERE review_id = ${reviewId}`;
    return { success: true, message: 'Review deleted.' };
  },

  import_csv: async ({ request, locals }) => {
    const canManage = hasPermission(locals.user, 'hsi', 'manager')
      || hasPermission(locals.user, 'gft', 'manager')
      || hasPermission(locals.user, 'corp', 'manager')
      || locals.user?.is_super_admin;
    if (!canManage) requirePermission(locals.user, 'hsi', 'manager');

    const form = await request.formData();
    const csvText = form.get('csv_text')?.toString() || '';
    const source = form.get('import_source')?.toString().trim() || 'google';

    if (!csvText.trim()) return { success: false, error: 'No CSV data provided.' };

    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return { success: false, error: 'CSV must have a header row and at least one data row.' };

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/"/g, ''));
    let imported = 0;
    let skipped = 0;

    for (let i = 1; i < lines.length; i++) {
      // Simple CSV parse (handles quoted fields)
      const vals = lines[i].match(/(".*?"|[^",]+)/g)?.map(v => v.replace(/^"|"$/g, '').trim()) || [];
      if (vals.length < 2) continue;

      /** @param {string} name */
      const col = (name) => {
        const idx = headers.indexOf(name);
        return idx >= 0 ? vals[idx] || null : null;
      };

      const reviewerName = col('reviewer_name') || col('reviewer') || col('name') || col('author');
      const ratingStr = col('rating') || col('stars') || col('score');
      const reviewText = col('review_text') || col('review') || col('text') || col('comment');
      const reviewDate = col('review_date') || col('date');
      const sourceUrl = col('source_url') || col('url') || col('link');
      const sourceReviewId = col('source_review_id') || col('review_id') || col('id');

      if (!reviewText && !ratingStr) { skipped++; continue; }

      try {
        await sql`
          INSERT INTO customer_reviews (source, source_review_id, source_url, reviewer_name, rating, review_text, review_date)
          VALUES (${source}, ${sourceReviewId}, ${sourceUrl}, ${reviewerName},
            ${ratingStr ? parseFloat(ratingStr) : null}, ${reviewText}, ${reviewDate || null})
          ON CONFLICT (source, source_review_id) DO NOTHING
        `;
        imported++;
      } catch {
        skipped++;
      }
    }

    return { success: true, message: `Imported ${imported} reviews, ${skipped} skipped.` };
  },
};
