<!-- src/routes/hsi/students/[id]/+page.svelte -->
<script>
	/**
	 * @typedef {Object} Student
	 * @property {number} student_id
	 * @property {string} first_name
	 * @property {string} last_name
	 * @property {string} email
	 * @property {string} phone
	 * @property {string|null} account_date
	 * @property {boolean} is_active
	 * @property {string|null} member_since
	 */

	/**
	 * @typedef {Object} Registration
	 * @property {number} registration_id
	 * @property {string} class_code
	 * @property {string|null} class_date
	 * @property {string|null} registration_date
	 * @property {number} amount_paid
	 * @property {number|null} session_id
	 * @property {string} class_name
	 * @property {string} track
	 * @property {string|null} session_name
	 * @property {string|null} instructor
	 * @property {string|null} location
	 */

	import { resolve } from '$app/paths';

	/** @type {{ student: Student|null, registrations: Registration[], totalPaid: number, user: any, canSeePII: boolean }} */
	export let data;

	$: student = data.student;
	$: registrations = data.registrations;
	$: totalPaid = data.totalPaid;
	$: canSeePII = data.canSeePII;

	let showPII = false;

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
	 * @param {string|null} dateStr
	 * @returns {string}
	 */
	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr + 'T12:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title
		>{student ? `${student.first_name} ${student.last_name}` : 'Student Not Found'} | StageLedger</title
	>
</svelte:head>

<div class="container">
	{#if !student}
		<div class="not-found">
			<h1>Student Not Found</h1>
			<p>The student you're looking for doesn't exist.</p>
			<a href={resolve('/hsi/students')} class="btn-secondary">Back to Students</a>
		</div>
	{:else}
		<header>
			<div>
				<a href={resolve('/hsi/students')} class="back-link">← Back to Students</a>
				<h1>{student.first_name} {student.last_name}</h1>
			</div>
			{#if canSeePII}
				<button class="btn-unmask" on:click={() => showPII = !showPII}>
					{showPII ? 'Hide PII' : 'Show PII'}
				</button>
			{/if}
		</header>

		<!-- Student Info Card -->
		<div class="info-card">
			<div class="info-grid">
				<div class="info-item">
					<span class="info-label">Email</span>
					<span class="info-value">{(showPII ? student.email : student.email_masked) || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Phone</span>
					<span class="info-value">{(showPII ? student.phone : student.phone_masked) || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Member Since</span>
					<span class="info-value">{formatDate(student.member_since)}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Status</span>
					<span class="status-badge" class:active={student.is_active}>
						{student.is_active ? 'Active' : 'Inactive'}
					</span>
				</div>
			</div>
		</div>

		<!-- Summary Stats -->
		<div class="stats-row">
			<div class="stat-card">
				<span class="stat-value">{formatCurrency(totalPaid)}</span>
				<span class="stat-label">Total Paid</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{registrations.length}</span>
				<span class="stat-label"
					>{registrations.length === 1 ? 'Registration' : 'Registrations'}</span
				>
			</div>
			<div class="stat-card">
				<span class="stat-value">{[...new Set(registrations.map((r) => r.class_code))].length}</span
				>
				<span class="stat-label">Unique Classes</span>
			</div>
		</div>

		<!-- Registrations Table -->
		<div class="section">
			<h2>Registration History</h2>
			{#if registrations.length === 0}
				<p class="empty-state">No registrations found for this student.</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Class</th>
							<th>Session</th>
							<th>Class Date</th>
							<th>Registered</th>
							<th class="col-right">Amount Paid</th>
						</tr>
					</thead>
					<tbody>
						{#each registrations as reg (reg.registration_id)}
							<tr>
								<td>
									<span class="class-code">{reg.class_code}</span>
									<span class="class-name">{reg.class_name}</span>
								</td>
								<td>
									{#if reg.session_name && reg.session_id}
										<a href={resolve(`/hsi/classes/${reg.class_code}/sessions/${reg.session_id}`)} class="session-link">{reg.session_name}</a>
										{#if reg.instructor}
											<span class="session-detail">{reg.instructor}</span>
										{/if}
									{:else if reg.session_name}
										<span class="session-name">{reg.session_name}</span>
										{#if reg.instructor}
											<span class="session-detail">{reg.instructor}</span>
										{/if}
									{:else}
										<span class="empty-value">—</span>
									{/if}
								</td>
								<td>{formatDate(reg.class_date)}</td>
								<td>{formatDate(reg.registration_date)}</td>
								<td class="col-right">{formatCurrency(reg.amount_paid)}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td colspan="4" class="total-label">Total</td>
							<td class="col-right total-value">{formatCurrency(totalPaid)}</td>
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
	.btn-unmask {
		padding: 0.4rem 0.85rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: white;
		color: #374151;
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
		margin-top: 1.5rem;
	}
	.btn-unmask:hover { background: #f3f4f6; border-color: #3b82f6; color: #3b82f6; }

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

	.info-card {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.info-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
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
		grid-template-columns: repeat(3, 1fr);
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

	.class-code {
		font-family: monospace;
		font-weight: 600;
		color: #6366f1;
		font-size: 0.85rem;
		margin-right: 0.5rem;
	}

	.class-name {
		color: #374151;
		font-size: 0.9rem;
	}

	.session-name {
		display: block;
		font-size: 0.9rem;
		color: #374151;
	}
	.session-link {
		display: block;
		font-size: 0.9rem;
		color: #3b82f6;
		text-decoration: none;
	}
	.session-link:hover { text-decoration: underline; }

	.session-detail {
		display: block;
		font-size: 0.8rem;
		color: #6b7280;
	}

	.empty-value {
		color: #9ca3af;
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

	@media (max-width: 768px) {
		.info-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.stats-row {
			grid-template-columns: 1fr;
		}

		.section {
			overflow-x: auto;
		}

		table {
			display: table;
			min-width: 600px;
			font-size: 0.875rem;
		}

		th,
		td {
			padding: 0.5rem 0.75rem;
			white-space: nowrap;
		}
	}
</style>