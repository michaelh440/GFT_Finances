<!-- src/routes/hsi/classes/[class_code]/+page.svelte -->
<script>
	/**
	 * @typedef {Object} ClassInfo
	 * @property {string} class_code
	 * @property {string} class_name
	 * @property {string} class_type
	 * @property {string} student_type
	 * @property {number} standard_price
	 * @property {string|null} track
	 * @property {string|null} vbo_event_id
	 * @property {string|null} description
	 * @property {boolean} is_active
	 * @property {string} created_at
	 * @property {string} updated_at
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
	 * @property {number} student_count
	 * @property {number} registration_count
	 * @property {number} session_revenue
	 */

	import { resolve } from '$app/paths';
	import { canDataEntry } from '$lib/permissions';

	/** @type {any} */
	export let data;

	$: user = data.user;
	$: classInfo = data.classInfo;
	$: sessions = data.sessions;
	$: totalStudents = data.totalStudents;
	$: totalRegistrations = data.totalRegistrations;
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
	 * @param {string|null} dateStr
	 * @returns {string}
	 */
	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr + 'T12:00:00');
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title
		>{classInfo ? `${classInfo.class_name}` : 'Class Not Found'} | B&C Financial Tracker</title
	>
</svelte:head>

<div class="container">
	{#if !classInfo}
		<div class="not-found">
			<h1>Class Not Found</h1>
			<p>The class you're looking for doesn't exist.</p>
			<a href={resolve('/hsi/classes')} class="btn-secondary">Back to Classes</a>
		</div>
	{:else}
		<header>
			<div>
				<a href={resolve('/hsi/classes')} class="back-link">← Back to Classes</a>
				<h1>{classInfo.class_name}</h1>
			</div>
			<div class="header-actions">
				{#if canDataEntry(user, 'hsi')}
					<a href={resolve(`/hsi/classes/${classInfo.class_code}/edit`)} class="btn-primary">Edit Class</a>
				{/if}
			</div>
		</header>

		<!-- Class Info Card -->
		<div class="info-card">
			<div class="info-grid">
				<div class="info-item">
					<span class="info-label">Class Code</span>
					<span class="info-value code">{classInfo.class_code}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Track</span>
					<span class="info-value">{classInfo.track || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Type</span>
					<span class="info-value">{classInfo.class_type || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Student Type</span>
					<span class="info-value">{classInfo.student_type || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Standard Price</span>
					<span class="info-value">{formatCurrency(classInfo.standard_price)}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Duration</span>
					<span class="info-value">{classInfo.duration_value ? `${classInfo.duration_value} ${classInfo.duration_unit}` : '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Status</span>
					<span class="status-badge" class:active={classInfo.is_active}>
						{classInfo.is_active ? 'Active' : 'Inactive'}
					</span>
				</div>
				{#if classInfo.vbo_event_id}
					<div class="info-item">
						<span class="info-label">VBO Event ID</span>
						<span class="info-value code">{classInfo.vbo_event_id}</span>
					</div>
				{/if}
			</div>
			{#if classInfo.description}
				<div class="description">
					<span class="info-label">Description</span>
					<p>{classInfo.description}</p>
				</div>
			{/if}
		</div>

		<!-- Summary Stats -->
		<div class="stats-row">
			<div class="stat-card">
				<span class="stat-value">{sessions.length}</span>
				<span class="stat-label">{sessions.length === 1 ? 'Session' : 'Sessions'}</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{totalStudents}</span>
				<span class="stat-label">{totalStudents === 1 ? 'Student' : 'Students'}</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{totalRegistrations}</span>
				<span class="stat-label">{totalRegistrations === 1 ? 'Registration' : 'Registrations'}</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{formatCurrency(totalRevenue)}</span>
				<span class="stat-label">Total Revenue</span>
			</div>
		</div>

		<!-- Sessions Table -->
		<div class="section">
			<div class="section-header-row">
				<h2>Class Sessions</h2>
				{#if canDataEntry(user, 'hsi')}
					<a href={resolve(`/hsi/classes/${classInfo.class_code}/sessions/new`)} class="btn-primary-sm">Add Session</a>
				{/if}
			</div>
			{#if sessions.length === 0}
				<p class="empty-state">No sessions found for this class.</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Session Name</th>
							<th>Start Date</th>
							<th>End Date</th>
							<th>Instructor</th>
							<th>Location</th>
							<th class="col-right">Students</th>
							<th class="col-right">Revenue</th>
						</tr>
					</thead>
					<tbody>
						{#each sessions as session (session.session_id)}
							<tr class:inactive={!session.is_active}>
								<td>
									<a href={resolve(`/hsi/classes/${classInfo.class_code}/sessions/${session.session_id}`)} class="session-link">{session.session_name}</a>
								</td>
								<td>{formatDate(session.start_date)}</td>
								<td>{formatDate(session.end_date)}</td>
								<td>{session.instructor || '—'}</td>
								<td>{session.location || '—'}</td>
								<td class="col-right">{session.student_count}</td>
								<td class="col-right">{formatCurrency(session.session_revenue)}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td colspan="5" class="total-label">Total</td>
							<td class="col-right total-value">{totalStudents}</td>
							<td class="col-right total-value">{formatCurrency(totalRevenue)}</td>
						</tr>
					</tfoot>
				</table>
			{/if}
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1.25rem; font-weight: 600; color: #1a202c; margin: 0 0 1rem 0; }
	.header-actions { display: flex; gap: 0.75rem; align-items: center; padding-top: 1.5rem; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-primary-sm { background-color: #3b82f6; color: white; padding: 0.4rem 1rem; border-radius: 0.375rem; text-decoration: none; font-weight: 500; font-size: 0.85rem; }
	.btn-primary-sm:hover { background-color: #2563eb; }
	.section-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
	.section-header-row h2 { margin: 0; }
	.info-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); margin-bottom: 1.5rem; }
	.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
	.info-item { display: flex; flex-direction: column; gap: 0.25rem; }
	.info-label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
	.info-value { font-size: 0.95rem; color: #1a202c; }
	.info-value.code { font-family: monospace; font-weight: 600; color: #6366f1; }
	.description { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid #f3f4f6; }
	.description p { margin: 0.25rem 0 0 0; color: #374151; font-size: 0.95rem; line-height: 1.5; }
	.status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; width: fit-content; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }
	.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
	.stat-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); text-align: center; display: flex; flex-direction: column; gap: 0.25rem; }
	.stat-value { font-size: 1.5rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }
	.section { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; }
	td { padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; vertical-align: top; }
	tr:last-child td { border-bottom: none; }
	tr:hover { background-color: #f9fafb; }
	tr.inactive { opacity: 0.5; }
	.session-link { font-weight: 500; color: #3b82f6; text-decoration: none; }
	.session-link:hover { text-decoration: underline; }
	.col-right { text-align: right; }
	tfoot td { border-top: 2px solid #e5e7eb; border-bottom: none; padding-top: 0.75rem; }
	.total-label { font-weight: 600; color: #374151; text-align: right; }
	.total-value { font-weight: 700; color: #1a202c; font-size: 1.05rem; }
	.empty-state { text-align: center; padding: 2rem; color: #6b7280; }
	.not-found { text-align: center; padding: 3rem; }
	.not-found h1 { margin-bottom: 0.5rem; }
	.not-found p { color: #6b7280; margin-bottom: 1.5rem; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }
	@media (max-width: 768px) {
		header { flex-direction: column; }
		.header-actions { padding-top: 1rem; }
		.info-grid { grid-template-columns: repeat(2, 1fr); }
		.stats-row { grid-template-columns: 1fr; }
		table { font-size: 0.875rem; }
		th, td { padding: 0.5rem 0.75rem; }
	}
</style>