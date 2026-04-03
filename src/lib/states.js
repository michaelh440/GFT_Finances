// src/lib/states.js

/** @type {Record<string, string>} */
const STATE_MAP = {
	'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
	'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
	'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
	'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
	'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
	'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
	'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
	'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
	'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
	'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
	'district of columbia': 'DC', 'puerto rico': 'PR', 'guam': 'GU', 'virgin islands': 'VI',
};

const VALID_ABBREVS = new Set(Object.values(STATE_MAP));

/**
 * Standardize a state value to a 2-letter uppercase abbreviation.
 * Returns the standardized value if recognized, or the original trimmed value if not.
 * @param {string|null|undefined} state
 * @returns {string}
 */
export function standardizeState(state) {
	if (!state || state.trim() === '') return '';
	const trimmed = state.trim();
	// Already standard
	if (VALID_ABBREVS.has(trimmed)) return trimmed;
	// Try lowercase lookup (handles "tx", "Texas", "new jersey", etc.)
	const lookup = STATE_MAP[trimmed.toLowerCase()];
	if (lookup) return lookup;
	// Try uppercase 2-letter (handles "Tx", "tX", etc.)
	const upper = trimmed.toUpperCase();
	if (upper.length === 2 && VALID_ABBREVS.has(upper)) return upper;
	// Unrecognized — return as-is
	return trimmed;
}

/**
 * Check if a state value is a valid 2-letter uppercase abbreviation.
 * @param {string|null|undefined} state
 * @returns {boolean}
 */
export function isStandardState(state) {
	if (!state) return false;
	return VALID_ABBREVS.has(state.trim());
}
