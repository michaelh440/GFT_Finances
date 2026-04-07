// src/lib/phone.js

/**
 * Normalize a phone number to just the last 10 digits (US format).
 * Strips all non-digit characters, removes leading country code (1).
 * Returns empty string if fewer than 7 digits remain.
 * @param {string|null|undefined} phone
 * @returns {string}
 */
export function normalizePhone(phone) {
	if (!phone) return '';
	const digits = phone.replace(/\D/g, '');
	if (digits.length < 7) return '';
	// Strip leading '1' for US country code if 11 digits
	if (digits.length === 11 && digits.startsWith('1')) return digits.slice(1);
	// Return last 10 digits if longer
	if (digits.length > 10) return digits.slice(-10);
	return digits;
}
