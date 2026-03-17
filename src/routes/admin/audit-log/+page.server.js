// src/routes/admin/audit-log/+page.server.js
import sql from '$lib/db';
import { redirect } from '@sveltejs/kit';

export const load = async ({ locals, url }) => {
	if (!locals.user?.is_super_admin) {
		throw redirect(303, '/');
	}

	const page = parseInt(url.searchParams.get('page') || '1');
	const perPage = 50;
	const offset = (page - 1) * perPage;
	const actionFilter = url.searchParams.get('action') || '';
	const userFilter = url.searchParams.get('user') || '';

	try {
		const conditions = [];
		if (actionFilter) conditions.push(sql`al.action = ${actionFilter}`);
		if (userFilter) conditions.push(sql`al.user_id = ${parseInt(userFilter)}`);

		const where = conditions.length > 0
			? sql`WHERE ${conditions.reduce((a, b) => sql`${a} AND ${b}`)}`
			: sql``;

		const logs = await sql`
			SELECT al.log_id, al.user_id, al.user_email, al.action, al.table_name,
			       al.record_id, al.details, al.ip_address, al.created_at,
			       u.first_name, u.last_name
			FROM audit_log al
			LEFT JOIN app_users u ON u.user_id = al.user_id
			${where}
			ORDER BY al.created_at DESC
			LIMIT ${perPage} OFFSET ${offset}
		`;

		const [countResult] = await sql`
			SELECT COUNT(*)::int AS total FROM audit_log al ${where}
		`;

		const actions = await sql`SELECT DISTINCT action FROM audit_log ORDER BY action`;
		const users = await sql`SELECT user_id, first_name, last_name, email FROM app_users ORDER BY last_name`;

		return {
			logs: logs.map((l) => ({
				...l,
				created_at: l.created_at ? l.created_at.toISOString() : null
			})),
			total: countResult.total,
			page,
			perPage,
			actions: actions.map((a) => a.action),
			users,
			filters: { actionFilter, userFilter }
		};
	} catch (error) {
		console.error('Error loading audit log:', error);
		return { logs: [], total: 0, page: 1, perPage, actions: [], users: [], filters: {} };
	}
};