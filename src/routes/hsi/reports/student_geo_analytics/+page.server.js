// src/routes/hsi/reports/student_geo_analytics/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ url, locals }) => {
	requirePermission(locals.user, 'hsi', 'manager');
	const classCode = url.searchParams.get('class') || '';
	const track = url.searchParams.get('track') || '';
	const yearsParam = url.searchParams.get('years') || '';
	const selectedYears = yearsParam.split(',').filter(Boolean).map(y => parseInt(y)).filter(y => !isNaN(y));

	try {
		const conditions = [];
		if (classCode) conditions.push(sql`r.class_code = ${classCode}`);
		if (track) conditions.push(sql`c.track = ${track}`);
		if (selectedYears.length > 0) conditions.push(sql`EXTRACT(YEAR FROM r.class_date)::int IN ${sql(selectedYears)}`);

		const regWhere = conditions.length > 0
			? sql`AND ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
			: sql``;

		// Zip code breakdown
		const zipData = await sql`
			SELECT
				COALESCE(NULLIF(s.zip_code, ''), 'Unknown') AS zip_code,
				s.city,
				s.state,
				COUNT(DISTINCT s.student_id)::int AS student_count,
				COUNT(r.registration_id)::int AS registration_count,
				COALESCE(SUM(r.amount_paid), 0)::numeric AS revenue
			FROM students s
			JOIN registrations r ON r.student_id = s.student_id
			JOIN classes c ON c.class_code = r.class_code
			WHERE 1=1 ${regWhere}
			GROUP BY COALESCE(NULLIF(s.zip_code, ''), 'Unknown'), s.city, s.state
			ORDER BY student_count DESC
		`;

		// City breakdown
		const cityData = await sql`
			SELECT
				COALESCE(NULLIF(s.city, ''), 'Unknown') AS city,
				s.state,
				COUNT(DISTINCT s.student_id)::int AS student_count,
				COUNT(r.registration_id)::int AS registration_count,
				COALESCE(SUM(r.amount_paid), 0)::numeric AS revenue,
				COUNT(DISTINCT COALESCE(NULLIF(s.zip_code, ''), 'Unknown'))::int AS zip_count
			FROM students s
			JOIN registrations r ON r.student_id = s.student_id
			JOIN classes c ON c.class_code = r.class_code
			WHERE 1=1 ${regWhere}
			GROUP BY COALESCE(NULLIF(s.city, ''), 'Unknown'), s.state
			ORDER BY student_count DESC
		`;

		// State breakdown
		const stateData = await sql`
			SELECT
				COALESCE(NULLIF(s.state, ''), 'Unknown') AS state,
				COUNT(DISTINCT s.student_id)::int AS student_count,
				COUNT(r.registration_id)::int AS registration_count,
				COALESCE(SUM(r.amount_paid), 0)::numeric AS revenue,
				COUNT(DISTINCT COALESCE(NULLIF(s.city, ''), 'Unknown'))::int AS city_count
			FROM students s
			JOIN registrations r ON r.student_id = s.student_id
			JOIN classes c ON c.class_code = r.class_code
			WHERE 1=1 ${regWhere}
			GROUP BY COALESCE(NULLIF(s.state, ''), 'Unknown')
			ORDER BY student_count DESC
		`;

		// Stats
		const [stats] = await sql`
			SELECT
				COUNT(DISTINCT s.student_id)::int AS total_students,
				COUNT(DISTINCT CASE WHEN s.zip_code IS NOT NULL AND s.zip_code != '' THEN s.student_id END)::int AS with_zip,
				COUNT(DISTINCT CASE WHEN s.city IS NOT NULL AND s.city != '' THEN s.student_id END)::int AS with_city,
				COUNT(DISTINCT COALESCE(NULLIF(s.zip_code, ''), 'Unknown'))::int AS unique_zips,
				COUNT(DISTINCT COALESCE(NULLIF(s.city, ''), 'Unknown'))::int AS unique_cities
			FROM students s
			JOIN registrations r ON r.student_id = s.student_id
			JOIN classes c ON c.class_code = r.class_code
			WHERE 1=1 ${regWhere}
		`;

		// Filters data
		const classes = await sql`
			SELECT class_code, class_name, track
			FROM classes ORDER BY track ASC, class_name ASC
		`;

		const tracks = await sql`
			SELECT DISTINCT track FROM classes WHERE track IS NOT NULL ORDER BY track ASC
		`;

		const years = await sql`
			SELECT DISTINCT EXTRACT(YEAR FROM class_date)::int AS year
			FROM registrations ORDER BY year DESC
		`;

		return {
			zipData: zipData.map((z) => ({ ...z, revenue: Number(z.revenue) })),
			cityData: cityData.map((c) => ({ ...c, revenue: Number(c.revenue) })),
			stateData: stateData.map((s) => ({ ...s, revenue: Number(s.revenue) })),
			stats: { ...stats, unique_zips: Number(stats.unique_zips), unique_cities: Number(stats.unique_cities) },
			classes,
			tracks: tracks.map((t) => t.track),
			years: years.map((y) => y.year),
			filters: { classCode, track, years: yearsParam }
		};
	} catch (error) {
		console.error('Error loading student geo analytics:', error);
		return {
			zipData: [], cityData: [], stateData: [],
			stats: { total_students: 0, with_zip: 0, with_city: 0, unique_zips: 0, unique_cities: 0 },
			classes: [], tracks: [], years: [],
			filters: { classCode, track, years: yearsParam }
		};
	}
};