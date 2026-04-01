// src/routes/hsi/students/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';
import { hasPermission } from '$lib/permissions';

/** @param {string|null} email */
function maskEmail(email) {
	if (!email) return null;
	const [local, domain] = email.split('@');
	if (!domain) return '***';
	return local[0] + '***@' + domain;
}

/** @param {string|null} phone */
function maskPhone(phone) {
	if (!phone) return null;
	const digits = phone.replace(/\D/g, '');
	if (digits.length <= 4) return '***';
	return '***-***-' + digits.slice(-4);
}

export const load = async ({ url, locals }) => {
	requirePermission(locals.user, 'hsi', 'viewer');
	const canSeePII = hasPermission(locals.user, 'hsi', 'data_entry');

	// Read filter params
	const search      = url.searchParams.get('search') || '';
	const classCode   = url.searchParams.get('class') || '';
	const track       = url.searchParams.get('track') || '';
	const status      = url.searchParams.get('status') || '';      // 'active', 'inactive', or ''
	const hasClasses  = url.searchParams.get('has_classes') || ''; // 'yes', 'no', or ''
	const pageParam   = parseInt(url.searchParams.get('page') || '1') || 1;
	const pageSize    = 50;

	try {
		// Build WHERE clauses
		const conditions = [];
		const searchFilter = search
			? sql`AND (
				LOWER(s.first_name) LIKE ${'%' + search.toLowerCase() + '%'} OR
				LOWER(s.last_name)  LIKE ${'%' + search.toLowerCase() + '%'} OR
				LOWER(s.email)      LIKE ${'%' + search.toLowerCase() + '%'} OR
				s.phone LIKE ${'%' + search + '%'} OR
				s.mobile_phone LIKE ${'%' + search + '%'}
			)`
			: sql``;

		const classFilter = classCode
			? sql`AND s.student_id IN (SELECT DISTINCT student_id FROM registrations WHERE class_code = ${classCode})`
			: sql``;

		const trackFilter = track
			? sql`AND s.student_id IN (
				SELECT DISTINCT r.student_id FROM registrations r
				JOIN classes c ON r.class_code = c.class_code
				WHERE c.track = ${track}
			)`
			: sql``;

		const statusFilter = status === 'active'
			? sql`AND s.is_active = true`
			: status === 'inactive'
				? sql`AND s.is_active = false`
				: sql``;

		const hasClassesFilter = hasClasses === 'yes'
			? sql`AND (SELECT COUNT(*) FROM registrations r2 WHERE r2.student_id = s.student_id) > 0`
			: hasClasses === 'no'
				? sql`AND (SELECT COUNT(*) FROM registrations r2 WHERE r2.student_id = s.student_id) = 0`
				: sql``;

		// Count total for pagination
		const [countResult] = await sql`
			SELECT COUNT(DISTINCT s.student_id)::int AS total
			FROM students s
			WHERE 1=1
			${searchFilter} ${classFilter} ${trackFilter} ${statusFilter} ${hasClassesFilter}
		`;
		const totalCount = countResult.total;
		const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
		const currentPage = Math.min(pageParam, totalPages);
		const offset = (currentPage - 1) * pageSize;

		const students = await sql`
			SELECT
				s.student_id,
				s.first_name,
				s.last_name,
				s.email,
				s.phone,
				s.mobile_phone,
				s.gender,
				s.age,
				s.account_date,
				s.is_active,
				COUNT(r.registration_id) AS registration_count,
				MAX(r.class_date) AS last_class_date
			FROM students s
			LEFT JOIN registrations r ON s.student_id = r.student_id
			WHERE 1=1
			${searchFilter} ${classFilter} ${trackFilter} ${statusFilter} ${hasClassesFilter}
			GROUP BY s.student_id
			ORDER BY s.last_name ASC, s.first_name ASC
			LIMIT ${pageSize} OFFSET ${offset}
		`;

		// Load filter options
		const [classes, tracks] = await Promise.all([
			sql`
				SELECT class_code, class_name FROM classes
				WHERE is_active = true
				ORDER BY class_name ASC
			`,
			sql`
				SELECT DISTINCT track FROM classes
				WHERE track IS NOT NULL AND TRIM(track) != ''
				ORDER BY track ASC
			`,
		]);

		return {
			students: students.map((s) => ({
				...s,
				email: canSeePII ? s.email : maskEmail(s.email),
				phone: canSeePII ? s.phone : maskPhone(s.phone),
				mobile_phone: canSeePII ? s.mobile_phone : maskPhone(s.mobile_phone),
				email_masked: maskEmail(s.email),
				phone_masked: maskPhone(s.phone),
				mobile_phone_masked: maskPhone(s.mobile_phone),
				registration_count: Number(s.registration_count),
				account_date: s.account_date ? s.account_date.toISOString().split('T')[0] : null,
				last_class_date: s.last_class_date ? s.last_class_date.toISOString().split('T')[0] : null
			})),
			classes,
			tracks: tracks.map(t => t.track),
			pagination: { currentPage, totalPages, pageSize, totalCount },
			filters: { search, classCode, track, status, hasClasses },
			user: locals.user,
			canSeePII,
		};
	} catch (error) {
		console.error('Error loading students:', error);
		return {
			students: [], classes: [], tracks: [],
			pagination: { currentPage: 1, totalPages: 1, pageSize: 50, totalCount: 0 },
			filters: { search: '', classCode: '', track: '', status: '', hasClasses: '' },
			canSeePII: false,
		};
	}
};
