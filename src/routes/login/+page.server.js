// src/routes/login/+page.server.js
import { fail, redirect } from '@sveltejs/kit';
import { verifyPassword, createSession, auditLog, SESSION_COOKIE_NAME } from '$lib/auth';

export const load = async ({ locals, url }) => {
	// Already logged in
	if (locals.user) {
		throw redirect(303, '/');
	}
	return {
		redirectTo: url.searchParams.get('redirect') || '/'
	};
};

export const actions = {
	default: async ({ request, cookies, getClientAddress, url }) => {
		const formData = await request.formData();
		const email = formData.get('email')?.toString().trim() || '';
		const password = formData.get('password')?.toString() || '';
		const redirectTo = formData.get('redirect')?.toString() || url.searchParams.get('redirect') || '/';

		if (!email || !password) {
			return fail(400, { error: 'Email and password are required.', email });
		}

		const user = await verifyPassword(email, password);
		if (!user) {
			// Log failed attempt
			await auditLog({
				action: 'login_failed',
				details: { email },
				ipAddress: getClientAddress()
			});
			return fail(401, { error: 'Invalid email or password.', email });
		}

		// Create session
		const ipAddress = getClientAddress();
		const userAgent = request.headers.get('user-agent') || '';
		const { sessionId, expiresAt } = await createSession(user.user_id, ipAddress, userAgent);

		// Set cookie
		cookies.set(SESSION_COOKIE_NAME, sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			secure: true,
			expires: expiresAt
		});

		// Log success
		await auditLog({
			userId: user.user_id,
			userEmail: user.email,
			action: 'login',
			details: { ip: ipAddress },
			ipAddress
		});

		throw redirect(303, decodeURIComponent(redirectTo));
	}
};