// src/routes/+layout.server.js
/** @param {any} event */
export const load = async ({ locals }) => {
	return {
		user: locals.user || null
	};
};