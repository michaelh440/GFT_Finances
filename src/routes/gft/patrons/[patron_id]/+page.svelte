<!-- src/routes/shows/patrons/[patron_id]/+page.svelte -->
<script>
	import { resolve } from '$app/paths';

	/** @type {{ patron: any, tickets: any[], totalTickets: number, totalSpent: number }} */
	export let data;

	$: patron = data.patron;
	$: tickets = data.tickets;
	$: totalTickets = data.totalTickets;
	$: totalSpent = data.totalSpent;
	$: studentMatch = data.studentMatch;
	$: studentRegistrations = data.studentRegistrations || [];
	$: studentTotalPaid = data.studentTotalPaid || 0;
	$: combinedTotal = totalSpent + studentTotalPaid;

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
	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const str = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().split('T')[0];
		const d = new Date(str + 'T12:00:00');
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	$: uniqueShows = [...new Set(tickets.map((t) => t.show_code))].length;
</script>

<svelte:head>
	<title>{patron ? `${patron.first_name} ${patron.last_name}` : 'Patron Not Found'} | StageLedger</title>
</svelte:head>

<div class="container">
	{#if !patron}
		<div class="not-found">
			<h1>Patron Not Found</h1>
			<p>The patron you're looking for doesn't exist.</p>
			<a href={resolve(/** @type {any} */ ('/gft/patrons'))} class="btn-secondary">Back to Patrons</a>
		</div>
	{:else}
		<header>
			<div>
				<a href={resolve(/** @type {any} */ ('/gft/patrons'))} class="back-link">← Back to Patrons</a>
				<h1>{patron.first_name} {patron.last_name}</h1>
			</div>
			<div class="header-actions">
				<a href={resolve(/** @type {any} */ (`/gft/patrons/${patron.patron_id}/edit`))} class="btn-primary">Edit Patron</a>
			</div>
		</header>

		<!-- Patron Info Card -->
		<div class="info-card">
			<div class="info-grid">
				<div class="info-item">
					<span class="info-label">Email</span>
					<span class="info-value">{patron.email || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Phone</span>
					<span class="info-value">{patron.phone || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Status</span>
					<span class="status-badge" class:active={patron.is_active}>
						{patron.is_active ? 'Active' : 'Inactive'}
					</span>
				</div>
			</div>
		</div>

		<!-- Summary Stats -->
		<div class="stats-row">
			{#if studentMatch}
				<div class="stat-card stat-highlight">
					<span class="stat-value">{formatCurrency(combinedTotal)}</span>
					<span class="stat-label">Combined Total</span>
				</div>
			{/if}
			<div class="stat-card">
				<span class="stat-value">{formatCurrency(totalSpent)}</span>
				<span class="stat-label">Ticket Revenue</span>
			</div>
			{#if studentMatch}
				<div class="stat-card">
					<span class="stat-value">{formatCurrency(studentTotalPaid)}</span>
					<span class="stat-label">Class Revenue</span>
				</div>
			{/if}
			<div class="stat-card">
				<span class="stat-value">{totalTickets}</span>
				<span class="stat-label">Total Tickets</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{uniqueShows}</span>
				<span class="stat-label">Unique Shows</span>
			</div>
		</div>

		<!-- Ticket Purchases Table -->
		<div class="section">
			<h2>Ticket Purchase History</h2>
			{#if tickets.length === 0}
				<p class="empty-state">No ticket purchases found for this patron.</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Show</th>
							<th>Show Date</th>
							<th>Purchased</th>
							<th class="col-right">Tickets</th>
							<th class="col-right">Amount Paid</th>
							<th>Payment</th>
						</tr>
					</thead>
					<tbody>
						{#each tickets as ticket (ticket.ticket_id)}
							<tr>
								<td>
									<a href={resolve(/** @type {any} */ (`/gft/shows/${ticket.show_code}`))} class="show-link">{ticket.show_name}</a>
									<span class="show-format">{ticket.format || ''}</span>
								</td>
								<td>{formatDate(ticket.show_date)}</td>
								<td>{formatDate(ticket.purchase_date)}</td>
								<td class="col-right">{ticket.tickets_purchased}</td>
								<td class="col-right">{formatCurrency(ticket.amount_paid)}</td>
								<td>{ticket.payment_method || '—'}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td colspan="3" class="total-label">Total</td>
							<td class="col-right total-value">{totalTickets}</td>
							<td class="col-right total-value">{formatCurrency(totalSpent)}</td>
							<td></td>
						</tr>
					</tfoot>
				</table>
			{/if}
		</div>

		<!-- Student Registration History (cross-reference) -->
		{#if studentMatch}
			<div class="section" style="margin-top: 2rem;">
				<div class="section-header-row">
					<h2>Class Registration History</h2>
					<a href={resolve(`/hsi/students/${studentMatch.student_id}`)} class="btn-link">View Student Profile →</a>
				</div>
				{#if studentRegistrations.length === 0}
					<p class="empty-state">No class registrations found.</p>
				{:else}
					<table>
						<thead>
							<tr>
								<th>Class</th>
								<th>Session</th>
								<th>Class Date</th>
								<th class="col-right">Amount Paid</th>
							</tr>
						</thead>
						<tbody>
							{#each studentRegistrations as reg (reg.registration_id)}
								<tr>
									<td>
										<a href={resolve(`/hsi/classes/${reg.class_code}`)} class="show-link">{reg.class_name}</a>
										<span class="show-format">{reg.track || ''}</span>
									</td>
									<td>{reg.session_name || '—'}</td>
									<td>{formatDate(reg.class_date)}</td>
									<td class="col-right">{formatCurrency(reg.amount_paid)}</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr>
								<td colspan="3" class="total-label">Total</td>
								<td class="col-right total-value">{formatCurrency(studentTotalPaid)}</td>
							</tr>
						</tfoot>
					</table>
				{/if}
			</div>
		{/if}
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

	.show-link {
		color: #3b82f6;
		text-decoration: none;
		font-weight: 500;
		display: block;
	}

	.show-link:hover {
		text-decoration: underline;
	}

	.show-format {
		display: block;
		font-size: 0.8rem;
		color: #6b7280;
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
		text-align: right;
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

	.stat-highlight {
		background: linear-gradient(135deg, #eff6ff, #dbeafe);
		border: 1px solid #bfdbfe;
	}

	.section-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1rem;
	}
	.section-header-row h2 { margin: 0; }

	.btn-link {
		color: #3b82f6;
		text-decoration: none;
		font-size: 0.85rem;
		font-weight: 500;
	}
	.btn-link:hover { text-decoration: underline; }

	@media (max-width: 768px) {
		header {
			flex-direction: column;
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