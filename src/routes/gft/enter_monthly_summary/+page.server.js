// src/routes/shows/enter_monthly_summary/+page.server.js
import sql from '$lib/db';

export const load = async () => {
	try {
		const shows = await sql`
			SELECT 
				show_code,
				show_name,
				format
			FROM shows
			WHERE is_active = true
			ORDER BY format ASC, show_name ASC
		`;

		return {
			shows
		};
	} catch (error) {
		console.error('Error loading shows:', error);
		return {
			shows: []
		};
	}
};

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const rowCount = parseInt(String(formData.get('row_count'))) || 0;

		console.log(`[enter_monthly_summary] Processing ${rowCount} rows`);

		if (rowCount === 0) {
			return { success: false, error: 'No data to save.' };
		}

		let saved = 0;
		let skipped = 0;
		const errors = [];

		for (let i = 0; i < rowCount; i++) {
			const showCode = String(formData.get(`show_code_${i}`) || '').trim();
			const month = String(formData.get(`month_${i}`) || '').trim();
			const ticketsSold = parseInt(String(formData.get(`tickets_sold_${i}`))) || 0;
			const revenue = parseFloat(String(formData.get(`revenue_${i}`))) || 0;

			console.log(`[row ${i}] show=${showCode}, month=${month}, tickets=${ticketsSold}, revenue=${revenue}`);

			if (!showCode || !month) {
				console.log(`[row ${i}] SKIPPED — missing show_code or month`);
				skipped++;
				continue;
			}

			if (ticketsSold === 0 && revenue === 0) {
				console.log(`[row ${i}] SKIPPED — zero tickets and revenue`);
				skipped++;
				continue;
			}

			const summaryMonth = month + '-01';
			const summaryYear = parseInt(month.split('-')[0]);

			try {
				console.log(`[row ${i}] EXECUTING SQL:
  INSERT INTO monthly_show_summary (show_code, summary_month, summary_year, tickets_sold, revenue)
  VALUES ('${showCode}', '${summaryMonth}', ${summaryYear}, ${ticketsSold}, ${revenue})
  ON CONFLICT (show_code, summary_month) DO UPDATE SET tickets_sold=${ticketsSold}, revenue=${revenue}`);

				const result = await sql`
					INSERT INTO monthly_show_summary (
						show_code,
						summary_month,
						summary_year,
						tickets_sold,
						revenue,
						updated_at
					) VALUES (
						${showCode},
						${summaryMonth},
						${summaryYear},
						${ticketsSold},
						${revenue},
						CURRENT_TIMESTAMP
					)
					ON CONFLICT (show_code, summary_month)
					DO UPDATE SET
						tickets_sold = ${ticketsSold},
						revenue = ${revenue},
						summary_year = ${summaryYear},
						updated_at = CURRENT_TIMESTAMP
					RETURNING *
				`;
				saved++;
				console.log(`[row ${i}] SAVED — result:`, JSON.stringify(result));
			} catch (error) {
				console.error(`[row ${i}] ERROR:`, error);
				errors.push(`Row ${i + 1} (${showCode} ${month}): ${/** @type {Error} */ (error).message || 'Unknown error'}`);
			}
		}

		if (errors.length > 0) {
			const response = {
				success: saved > 0,
				message: saved > 0 ? `Saved ${saved} ${saved === 1 ? 'entry' : 'entries'}.` : undefined,
				error: `${errors.length} error(s): ${errors.join('; ')}`
			};
			console.log(`[enter_monthly_summary] RESPONSE (with errors):`, JSON.stringify(response));
			return response;
		}

		const response = {
			success: true,
			message: `Saved ${saved} ${saved === 1 ? 'entry' : 'entries'}${skipped > 0 ? `, skipped ${skipped} empty rows` : ''}.`
		};
		console.log(`[enter_monthly_summary] RESPONSE:`, JSON.stringify(response));
		return response;
	}
};