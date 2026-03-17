// src/routes/logout/+page.server.js
import { redirect } from '@sveltejs/kit';
import { destroySession, auditLog, SESSION_COOKIE_NAME } from '$lib/auth';

export const load = async ({ cookies, locals, getClientAddress }) => {
	const sessionId = cookies.get(SESSION_COOKIE_NAME);

	if (locals.user) {
		await auditLog({
			userId: locals.user.user_id,
			userEmail: locals.user.email,
			action: 'logout',
			ipAddress: getClientAddress()
		});
	}

	if (sessionId) {
		await destroySession(sessionId);
		cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
	}

	throw redirect(303, '/login');
};