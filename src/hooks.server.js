// src/hooks.server.js
import { redirect } from '@sveltejs/kit';
import { validateSession, SESSION_COOKIE_NAME } from '$lib/auth';

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/login'];

export const handle = async ({ event, resolve }) => {
	const sessionId = event.cookies.get(SESSION_COOKIE_NAME);
	const path = event.url.pathname;

	// Check if route is public
	const isPublic = PUBLIC_ROUTES.some((r) => path === r || path.startsWith(r + '/'));

	if (sessionId) {
		// Validate the session
		const user = await validateSession(sessionId);
		if (user) {
			// Attach user to event.locals for all server-side code
			event.locals.user = {
				user_id: user.user_id,
				email: user.email,
				first_name: user.first_name,
				last_name: user.last_name,
				display_name: user.display_name,
				is_super_admin: user.is_super_admin,
				hsi_role: user.hsi_role,
				gft_role: user.gft_role,
				csz_role: user.csz_role,
				corp_role: user.corp_role
			};

			// If authenticated user visits /login, redirect to home
			if (path === '/login') {
				throw redirect(303, '/');
			}
		} else {
			// Invalid/expired session — clear cookie
			event.cookies.delete(SESSION_COOKIE_NAME, { path: '/' });
			event.locals.user = null;
		}
	} else {
		event.locals.user = null;
	}

	// Redirect unauthenticated users to login (except public routes)
	if (!event.locals.user && !isPublic) {
		const redirectTo = encodeURIComponent(path + event.url.search);
		throw redirect(303, `/login?redirect=${redirectTo}`);
	}

	return resolve(event);
};