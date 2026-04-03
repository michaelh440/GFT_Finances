// src/routes/gft/enter_monthly_bar_summary/+page.server.js
import sql from '$lib/db';
import { requirePermission } from '$lib/guards';

export const load = async ({ locals }) => {
	requirePermission(locals.user, 'gft', 'data_entry');
	try {
		const barItems = await sql`
			SELECT
				item_code,
				item_name,
				category
			FROM bar_items
			WHERE is_active = true
			ORDER BY category ASC, item_name ASC
		`;

		return {
			barItems
		};
	} catch (error) {
		console.error('Error loading bar items:', error);
		return {
			barItems: []
		};
	}
};

export const actions = {
	default: async ({ request, locals }) => {
		requirePermission(locals.user, 'gft', 'data_entry');
		const formData = await request.formData();
		const rowCount = parseInt(String(formData.get('row_count'))) || 0;

		if (rowCount === 0) {
			return { success: false, error: 'No data to save.' };
		}

		let saved = 0;
		let skipped = 0;
		const errors = [];

		for (let i = 0; i < rowCount; i++) {
			const itemCode = String(formData.get(`item_code_${i}`) || '').trim();
			const month = String(formData.get(`month_${i}`) || '').trim();
			const unitsSold = parseInt(String(formData.get(`units_sold_${i}`))) || 0;
			const revenue = parseFloat(String(formData.get(`revenue_${i}`))) || 0;

			if (!itemCode || !month) {
				skipped++;
				continue;
			}

			if (unitsSold === 0 && revenue === 0) {
				skipped++;
				continue;
			}

			const summaryMonth = month + '-01';
			const summaryYear = parseInt(month.split('-')[0]);

			try {
				await sql`
					INSERT INTO monthly_bar_summary (
						item_code,
						summary_month,
						summary_year,
						units_sold,
						revenue,
						updated_at
					) VALUES (
						${itemCode},
						${summaryMonth},
						${summaryYear},
						${unitsSold},
						${revenue},
						CURRENT_TIMESTAMP
					)
					ON CONFLICT (item_code, summary_month)
					DO UPDATE SET
						units_sold = ${unitsSold},
						revenue = ${revenue},
						summary_year = ${summaryYear},
						updated_at = CURRENT_TIMESTAMP
				`;
				saved++;
			} catch (error) {
				console.error(`[bar_summary row ${i}] ERROR:`, error);
				errors.push(`Row ${i + 1} (${itemCode} ${month}): ${/** @type {Error} */ (error).message || 'Unknown error'}`);
			}
		}

		if (errors.length > 0) {
			return {
				success: saved > 0,
				message: saved > 0 ? `Saved ${saved} ${saved === 1 ? 'entry' : 'entries'}.` : undefined,
				error: `${errors.length} error(s): ${errors.join('; ')}`
			};
		}

		return {
			success: true,
			message: `Saved ${saved} ${saved === 1 ? 'entry' : 'entries'}${skipped > 0 ? `, skipped ${skipped} empty rows` : ''}.`
		};
	}
};
