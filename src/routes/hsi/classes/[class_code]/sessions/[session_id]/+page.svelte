<!-- src/routes/hsi/classes/[class_code]/sessions/[session_id]/+page.svelte -->
<script>
	/**
	 * @typedef {Object} ClassInfo
	 * @property {string} class_code
	 * @property {string} class_name
	 * @property {string|null} track
	 * @property {number} standard_price
	 */

	/**
	 * @typedef {Object} Session
	 * @property {number} session_id
	 * @property {string} session_name
	 * @property {string} class_code
	 * @property {string|null} start_date
	 * @property {string|null} end_date
	 * @property {string|null} instructor
	 * @property {string|null} location
	 * @property {boolean} is_active
	 */

	/**
	 * @typedef {Object} Student
	 * @property {number} registration_id
	 * @property {number} student_id
	 * @property {string} first_name
	 * @property {string} last_name
	 * @property {string|null} email
	 * @property {string|null} phone
	 * @property {number} amount_paid
	 * @property {string|null} registration_date
	 * @property {string|null} class_date
	 */

	import { resolve } from '$app/paths';
	import { canDataEntry } from '$lib/permissions';

	/** @type {{ classInfo: ClassInfo|null, session: Session|null, students: Student[], totalRevenue: number, user: any }} */
	export let data;

	$: user = data.user;
	$: classInfo = data.classInfo;
	$: session = data.session;
	$: students = data.students;
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
	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const str = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().split('T')[0];
		const d = new Date(str + 'T12:00:00');
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>
		{session ? session.session_name : 'Session Not Found'} | B&C Financial Tracker
	</title>
</svelte:head>

<div class="container">
	{#if !classInfo || !session}
		<div class="not-found">
			<h1>Session Not Found</h1>
			<p>The session you're looking for doesn't exist.</p>
			{#if classInfo}
				<a href={resolve(`/hsi/classes/${classInfo.class_code}`)} class="btn-secondary">Back to Class</a>
			{:else}
				<a href={resolve('/hsi/classes')} class="btn-secondary">Back to Classes</a>
			{/if}
		</div>
	{:else}
		<header>
			<div>
				<div class="breadcrumb">
					<a href={resolve('/hsi/classes')}>Classes</a>
					<span class="separator">›</span>
					<a href={resolve(`/hsi/classes/${classInfo.class_code}`)}>{classInfo.class_name}</a>
					<span class="separator">›</span>
					<span class="current">{session.session_name}</span>
				</div>
				<h1>{session.session_name}</h1>
			</div>
			<div class="header-actions">
				{#if canDataEntry(user, 'hsi')}
					<a href={resolve(`/hsi/classes/${classInfo.class_code}/sessions/${session.session_id}/edit`)} class="btn-primary">Edit Session</a>
				{/if}
			</div>
		</header>

		<!-- Session Info Card -->
		<div class="info-card">
			<div class="info-grid">
				<div class="info-item">
					<span class="info-label">Class</span>
					<span class="info-value">
						<span class="code">{classInfo.class_code}</span>
						{classInfo.class_name}
					</span>
				</div>
				<div class="info-item">
					<span class="info-label">Track</span>
					<span class="info-value">{classInfo.track || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Start Date</span>
					<span class="info-value">{formatDate(session.start_date)}</span>
				</div>
				{#if session.end_date}
					<div class="info-item">
						<span class="info-label">End Date</span>
						<span class="info-value">{formatDate(session.end_date)}</span>
					</div>
				{/if}
				<div class="info-item">
					<span class="info-label">Instructor</span>
					<span class="info-value">{session.instructor || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Location</span>
					<span class="info-value">{session.location || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Duration</span>
					<span class="info-value">
						{#if session.duration_value}
							{session.duration_value} {session.duration_unit}
						{:else if classInfo.duration_value}
							{classInfo.duration_value} {classInfo.duration_unit} <span class="inherited">(class default)</span>
						{:else}
							—
						{/if}
					</span>
				</div>
				<div class="info-item">
					<span class="info-label">Status</span>
					<span class="status-badge" class:active={session.is_active}>
						{session.is_active ? 'Active' : 'Inactive'}
					</span>
				</div>
			</div>
		</div>

		<!-- Summary Stats -->
		<div class="stats-row">
			<div class="stat-card">
				<span class="stat-value">{students.length}</span>
				<span class="stat-label">{students.length === 1 ? 'Student' : 'Students'}</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{formatCurrency(totalRevenue)}</span>
				<span class="stat-label">Total Revenue</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{students.length > 0 ? formatCurrency(totalRevenue / students.length) : '$0.00'}</span>
				<span class="stat-label">Avg per Student</span>
			</div>
		</div>

		<!-- Students Table -->
		<div class="section">
			<h2>Registered Students</h2>
			{#if students.length === 0}
				<p class="empty-state">No students registered for this session.</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Name</th>
							<th>Email</th>
							<th>Phone</th>
							<th>Registered</th>
							<th class="col-right">Amount Paid</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each students as student (student.registration_id)}
							<tr>
								<td class="student-name">
									<a href={resolve(`/hsi/students/${student.student_id}`)}>{student.last_name}, {student.first_name}</a>
								</td>
								<td>{student.email || '—'}</td>
								<td>{student.phone || '—'}</td>
								<td>{formatDate(student.registration_date)}</td>
								<td class="col-right">{formatCurrency(student.amount_paid)}</td>
								<td>
									<a href={resolve(`/hsi/students/${student.student_id}`)} class="btn-view">View</a>
								</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td colspan="4" class="total-label">Total</td>
							<td class="col-right total-value">{formatCurrency(totalRevenue)}</td>
							<td></td>
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

	.breadcrumb {
		font-size: 0.875rem;
		margin-bottom: 0.5rem;
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex-wrap: wrap;
	}

	.breadcrumb a {
		color: #6b7280;
		text-decoration: none;
	}

	.breadcrumb a:hover {
		color: #3b82f6;
	}

	.breadcrumb .separator {
		color: #9ca3af;
	}

	.breadcrumb .current {
		color: #374151;
		font-weight: 500;
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

	.code {
		font-family: monospace;
		font-weight: 600;
		color: #6366f1;
		margin-right: 0.4rem;
	}

	.inherited { font-size: 0.8rem; color: #9ca3af; font-style: italic; }

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

	.student-name a {
		color: #3b82f6;
		text-decoration: none;
		font-weight: 500;
	}

	.student-name a:hover {
		text-decoration: underline;
	}

	.col-right {
		text-align: right;
	}

	.btn-view {
		display: inline-block;
		padding: 0.3rem 0.75rem;
		background-color: #e5e7eb;
		color: #374151;
		border-radius: 0.375rem;
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn-view:hover {
		background-color: #d1d5db;
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

		table {
			font-size: 0.875rem;
		}

		th,
		td {
			padding: 0.5rem 0.75rem;
		}
	}
</style>