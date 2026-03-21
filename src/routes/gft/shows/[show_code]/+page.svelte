<!-- src/routes/shows/[show_code]/+page.svelte -->
<script>
	/**
	 * @typedef {Object} ShowInfo
	 * @property {string} show_code
	 * @property {string} show_name
	 * @property {string|null} format
	 * @property {string|null} audience_type
	 * @property {string|null} day_of_week
	 * @property {number} standard_ticket_price
	 * @property {string|null} vbo_event_id
	 * @property {string|null} description
	 * @property {boolean} is_active
	 * @property {string} created_at
	 * @property {string} updated_at
	 */

	/**
	 * @typedef {Object} Summary
	 * @property {string} show_code
	 * @property {string|Date} summary_month
	 * @property {number} summary_year
	 * @property {number} tickets_sold
	 * @property {number} revenue
	 */

	import { resolve } from '$app/paths';

	/** @type {{ showInfo: ShowInfo|null, summaries: Summary[], totalTickets: number, totalRevenue: number }} */
	export let data;

	$: showInfo = data.showInfo;
	$: summaries = data.summaries;
	$: totalTickets = data.totalTickets;
	$: totalRevenue = data.totalRevenue;

	/**
	 * @param {number} amount
	 * @returns {string}
	 */
	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}

	/**
	 * @param {*} dateStr
	 * @returns {string}
	 */
	function formatMonth(dateStr) {
		if (!dateStr) return '—';
		const str = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().split('T')[0];
		const d = new Date(str + 'T12:00:00');
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>{showInfo ? showInfo.show_name : 'Show Not Found'} | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	{#if !showInfo}
		<div class="not-found">
			<h1>Show Not Found</h1>
			<p>The show you're looking for doesn't exist.</p>
			<a href={resolve(/** @type {any} */ ('/shows'))} class="btn-secondary">Back to Shows</a>
		</div>
	{:else}
		<header>
			<div>
				<a href={resolve(/** @type {any} */ ('/shows'))} class="back-link">← Back to Shows</a>
				<h1>{showInfo.show_name}</h1>
			</div>
			<div class="header-actions">
				<a href={resolve(/** @type {any} */ (`/shows/${showInfo.show_code}/edit`))} class="btn-primary">Edit Show</a>
			</div>
		</header>

		<!-- Show Info Card -->
		<div class="info-card">
			<div class="info-grid">
				<div class="info-item">
					<span class="info-label">Show Code</span>
					<span class="info-value code">{showInfo.show_code}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Format</span>
					<span class="info-value">{showInfo.format || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Audience</span>
					{#if showInfo.audience_type}
						<span class="audience-badge">{showInfo.audience_type}</span>
					{:else}
						<span class="info-value">—</span>
					{/if}
				</div>
				<div class="info-item">
					<span class="info-label">Day of Week</span>
					<span class="info-value">{showInfo.day_of_week || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Ticket Price</span>
					<span class="info-value">{showInfo.standard_ticket_price > 0 ? formatCurrency(showInfo.standard_ticket_price) : '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Status</span>
					<span class="status-badge" class:active={showInfo.is_active}>
						{showInfo.is_active ? 'Active' : 'Inactive'}
					</span>
				</div>
				{#if showInfo.vbo_event_id}
					<div class="info-item">
						<span class="info-label">VBO Event ID</span>
						<span class="info-value code">{showInfo.vbo_event_id}</span>
					</div>
				{/if}
			</div>
			{#if showInfo.description}
				<div class="description">
					<span class="info-label">Description</span>
					<p>{showInfo.description}</p>
				</div>
			{/if}
		</div>

		<!-- Summary Stats -->
		<div class="stats-row">
			<div class="stat-card">
				<span class="stat-value">{summaries.length}</span>
				<span class="stat-label">{summaries.length === 1 ? 'Month' : 'Months'} of Data</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{totalTickets.toLocaleString()}</span>
				<span class="stat-label">Total Tickets Sold</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{formatCurrency(totalRevenue)}</span>
				<span class="stat-label">Total Revenue</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{totalTickets > 0 ? formatCurrency(totalRevenue / totalTickets) : '$0.00'}</span>
				<span class="stat-label">Avg per Ticket</span>
			</div>
		</div>

		<!-- Monthly Summary Table -->
		<div class="section">
			<h2>Monthly Summary</h2>
			{#if summaries.length === 0}
				<p class="empty-state">No monthly data found for this show.</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Month</th>
							<th class="col-right">Tickets Sold</th>
							<th class="col-right">Revenue</th>
							<th class="col-right">Avg / Ticket</th>
						</tr>
					</thead>
					<tbody>
						{#each summaries as summary (summary.summary_month)}
							<tr>
								<td>{formatMonth(summary.summary_month)}</td>
								<td class="col-right">{summary.tickets_sold.toLocaleString()}</td>
								<td class="col-right">{formatCurrency(summary.revenue)}</td>
								<td class="col-right">
									{summary.tickets_sold > 0
										? formatCurrency(summary.revenue / summary.tickets_sold)
										: '—'}
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td class="total-label">Total</td>
							<td class="col-right total-value">{totalTickets.toLocaleString()}</td>
							<td class="col-right total-value">{formatCurrency(totalRevenue)}</td>
							<td class="col-right total-value">
								{totalTickets > 0 ? formatCurrency(totalRevenue / totalTickets) : '—'}
							</td>
						</tr>
					</tfoot>
				</table>
			{/if}
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 1000px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	.back-link {
		color: #6b7280;
		text-decoration: none;
		font-size: 0.875rem;
		display: inline-block;
		margin-bottom: 0.5rem;
	}

	.back-link:hover {
		color: #3b82f6;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		color: #1a202c;
		margin: 0;
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: #1a202c;
		margin: 0 0 1rem 0;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		padding-top: 1.5rem;
	}

	.btn-primary {
		background-color: #3b82f6;
		color: white;
		padding: 0.6rem 1.25rem;
		border-radius: 0.5rem;
		text-decoration: none;
		font-weight: 500;
		font-size: 0.9rem;
		transition: background-color 0.2s;
	}

	.btn-primary:hover {
		background-color: #2563eb;
	}

	.info-card {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1.5rem;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.info-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.info-value {
		font-size: 0.95rem;
		color: #1a202c;
	}

	.info-value.code {
		font-family: monospace;
		font-weight: 600;
		color: #6366f1;
	}

	.audience-badge {
		display: inline-block;
		padding: 0.2rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-weight: 500;
		background-color: #fef3c7;
		color: #92400e;
		width: fit-content;
	}

	.description {
		margin-top: 1.25rem;
		padding-top: 1.25rem;
		border-top: 1px solid #f3f4f6;
	}

	.description p {
		margin: 0.25rem 0 0 0;
		color: #374151;
		font-size: 0.95rem;
		line-height: 1.5;
	}

	.status-badge {
		display: inline-block;
		padding: 0.2rem 0.6rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 500;
		background-color: #fee2e2;
		color: #991b1b;
		width: fit-content;
	}

	.status-badge.active {
		background-color: #dcfce7;
		color: #166534;
	}

	.stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		background: white;
		padding: 1.25rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1a202c;
	}

	.stat-label {
		font-size: 0.8rem;
		color: #6b7280;
		font-weight: 500;
	}

	.section {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
	}

	table {
		width: 100%;
		border-collapse: collapse;
	}

	thead {
		background-color: #f9fafb;
	}

	th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #374151;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		border-bottom: 2px solid #e5e7eb;
	}

	td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f3f4f6;
		color: #1a202c;
		vertical-align: top;
	}

	tr:last-child td {
		border-bottom: none;
	}

	tr:hover {
		background-color: #f9fafb;
	}

	.col-right {
		text-align: right;
	}

	tfoot td {
		border-top: 2px solid #e5e7eb;
		border-bottom: none;
		padding-top: 0.75rem;
	}

	.total-label {
		font-weight: 600;
		color: #374151;
	}

	.total-value {
		font-weight: 700;
		color: #1a202c;
		font-size: 1.05rem;
	}

	.empty-state {
		text-align: center;
		padding: 2rem;
		color: #6b7280;
	}

	.not-found {
		text-align: center;
		padding: 3rem;
	}

	.not-found h1 {
		margin-bottom: 0.5rem;
	}

	.not-found p {
		color: #6b7280;
		margin-bottom: 1.5rem;
	}

	.btn-secondary {
		background-color: #e5e7eb;
		color: #374151;
		padding: 0.75rem 1.5rem;
		border-radius: 0.5rem;
		text-decoration: none;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn-secondary:hover {
		background-color: #d1d5db;
	}

	@media (max-width: 768px) {
		header {
			flex-direction: column;
		}

		.header-actions {
			padding-top: 1rem;
		}

		.info-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.stats-row {
			grid-template-columns: repeat(2, 1fr);
		}

		table {
			font-size: 0.875rem;
		}

		th,
		td {
			padding: 0.5rem 0.75rem;
		}
	}
</style>