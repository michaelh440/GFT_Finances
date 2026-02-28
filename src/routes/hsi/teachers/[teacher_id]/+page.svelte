<!-- src/routes/hsi/teachers/[teacher_id]/+page.svelte -->
<script>
	import { base } from '$app/paths';

	/** @type {any} */
	export let data;

	$: teacher = data.teacher;
	/** @type {any[]} */
	$: sessions = data.sessions || [];
	/** @type {Record<string, any>} */
	$: stats = data.stats || {};
	/** @type {any[]} */
	$: surveyStats = data.surveyStats || [];

	/** @param {number} amount */
	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	/** @param {string} dateStr */
	function formatDate(dateStr) {
		if (!dateStr) return '\u2014';
		const d = new Date(dateStr + 'T12:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	/** @param {string} type @param {number} value */
	function ratingLabel(type, value) {
		if (type === 'likert') {
			const labels = ['', 'Strongly Disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly Agree'];
			const idx = Math.round(value);
			return labels[idx] || '';
		}
		return '';
	}

	/** @param {string} type @returns {number} */
	function ratingMax(type) {
		if (type === 'rating_1_10') return 10;
		return 5;
	}
</script>

<svelte:head>
	<title>{teacher ? `${teacher.first_name} ${teacher.last_name}` : 'Teacher'} | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	{#if !teacher}
		<div class="alert alert-error">Teacher not found.</div>
		<a href="{base}/hsi/teachers" class="btn-secondary">Back to Teachers</a>
	{:else}
		<header>
			<div>
				<a href="{base}/hsi/teachers" class="breadcrumb">← Teachers</a>
				<h1>{teacher.first_name} {teacher.last_name}</h1>
				<span class="status-badge" class:active={teacher.is_active}>
					{teacher.is_active ? 'Active' : 'Inactive'}
				</span>
			</div>
			<a href="{base}/hsi/teachers/{teacher.teacher_id}/edit" class="btn-primary">Edit Teacher</a>
		</header>

		<!-- Info Card -->
		<div class="info-card">
			<div class="info-grid">
				{#if teacher.email}
					<div class="info-item">
						<span class="info-label">Email</span>
						<span class="info-value">{teacher.email}</span>
					</div>
				{/if}
				{#if teacher.phone}
					<div class="info-item">
						<span class="info-label">Phone</span>
						<span class="info-value">{teacher.phone}</span>
					</div>
				{/if}
				{#if teacher.created_at}
					<div class="info-item">
						<span class="info-label">Added</span>
						<span class="info-value">{formatDate(teacher.created_at)}</span>
					</div>
				{/if}
			</div>
			{#if teacher.bio}
				<div class="bio-section">
					<span class="info-label">Bio</span>
					<p class="bio-text">{teacher.bio}</p>
				</div>
			{/if}
		</div>

		<!-- Stats -->
		<div class="stats-row">
			<div class="stat-card">
				<span class="stat-value">{stats.totalSessions || 0}</span>
				<span class="stat-label">Sessions Taught</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{stats.totalStudents || 0}</span>
				<span class="stat-label">Students Taught</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{stats.uniqueClasses || 0}</span>
				<span class="stat-label">Unique Classes</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{formatCurrency(stats.totalRevenue || 0)}</span>
				<span class="stat-label">Total Revenue</span>
			</div>
		</div>

		<!-- Survey Averages -->
		{#if surveyStats.length > 0}
			<div class="section">
				<h2>Survey Averages</h2>
				<div class="survey-table-wrapper">
					<table class="survey-table">
						<thead>
							<tr>
								<th>#</th>
								<th>Question</th>
								<th class="col-center">Avg Rating</th>
								<th class="col-center">Responses</th>
								<th>Visual</th>
							</tr>
						</thead>
						<tbody>
							{#each surveyStats as q (q.question_number)}
								<tr>
									<td class="q-num">{q.question_number}</td>
									<td>{q.question_text}</td>
									<td class="col-center">
										<span class="rating-value">{q.avg_rating}</span>
										<span class="rating-max">/ {ratingMax(q.question_type)}</span>
									</td>
									<td class="col-center">{q.response_count}</td>
									<td>
										<div class="rating-bar-bg">
											<div
												class="rating-bar-fill"
												style="width: {(q.avg_rating / ratingMax(q.question_type)) * 100}%"
											></div>
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		{/if}

		<!-- Sessions History -->
		<div class="section">
			<h2>Session History ({sessions.length})</h2>
			{#if sessions.length === 0}
				<p class="empty-state">No sessions assigned to this teacher yet.</p>
			{:else}
				<div class="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Session</th>
								<th>Class</th>
								<th>Track</th>
								<th>Start Date</th>
								<th>Location</th>
								<th class="col-right">Students</th>
								<th class="col-right">Revenue</th>
							</tr>
						</thead>
						<tbody>
							{#each sessions as session (session.session_id)}
								<tr>
									<td class="session-name">{session.session_name || '—'}</td>
									<td>
										<a href="{base}/hsi/class/{session.class_code}" class="link">{session.class_name}</a>
									</td>
									<td>{session.track || '—'}</td>
									<td>{formatDate(session.start_date)}</td>
									<td>{session.location || '—'}</td>
									<td class="col-right">{session.registration_count}</td>
									<td class="col-right">{formatCurrency(session.session_revenue)}</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr>
								<td colspan="5" class="total-label">Total</td>
								<td class="col-right total-value">{stats.totalStudents}</td>
								<td class="col-right total-value">{formatCurrency(stats.totalRevenue || 0)}</td>
							</tr>
						</tfoot>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0.25rem 0 0.5rem 0; }
	h2 { font-size: 1.25rem; font-weight: 600; color: #1a202c; margin: 0 0 1rem 0; }
	.breadcrumb { color: #3b82f6; text-decoration: none; font-size: 0.85rem; }
	.breadcrumb:hover { text-decoration: underline; }

	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; }

	.status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }

	.info-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); padding: 1.5rem; margin-bottom: 1.5rem; }
	.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
	.info-item { display: flex; flex-direction: column; gap: 0.2rem; }
	.info-label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
	.info-value { font-size: 0.95rem; color: #1a202c; }
	.bio-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #f3f4f6; }
	.bio-text { color: #374151; font-size: 0.9rem; line-height: 1.6; margin: 0.5rem 0 0 0; }

	.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
	.stat-card { background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); text-align: center; display: flex; flex-direction: column; gap: 0.2rem; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }

	.section { margin-bottom: 2rem; }
	.table-wrapper, .survey-table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
	td { padding: 0.6rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; font-size: 0.9rem; }
	tr:hover td { background-color: #f9fafb; }
	.col-right { text-align: right; }
	.col-center { text-align: center; }
	.link { color: #3b82f6; text-decoration: none; font-weight: 500; }
	.link:hover { text-decoration: underline; }
	.session-name { font-weight: 500; }

	tfoot td { border-top: 2px solid #e5e7eb; border-bottom: none; padding-top: 0.75rem; }
	.total-label { text-align: right; font-weight: 600; color: #374151; font-size: 0.85rem; }
	.total-value { font-weight: 700; color: #1a202c; }

	.q-num { color: #9ca3af; font-size: 0.8rem; width: 30px; }
	.rating-value { font-weight: 700; color: #1a202c; }
	.rating-max { font-size: 0.75rem; color: #9ca3af; }
	.rating-bar-bg { width: 100px; height: 8px; background: #e5e7eb; border-radius: 4px; overflow: hidden; }
	.rating-bar-fill { height: 100%; background: #3b82f6; border-radius: 4px; transition: width 0.3s; }

	.empty-state { text-align: center; padding: 2rem; color: #6b7280; }
	.alert-error { padding: 1rem 1.5rem; background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 0.5rem; margin-bottom: 1rem; }

	@media (max-width: 768px) {
		header { flex-direction: column; gap: 1rem; }
		.stats-row { grid-template-columns: repeat(2, 1fr); }
	}
</style>