<!-- src/routes/hsi/tracks/[track_id]/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { canDataEntry, canManage } from '$lib/permissions';
	import { page } from '$app/stores';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form;

	$: user = data.user;
	$: track = data.track;
	$: classes = data.classes || [];

	let editing = $page.url.searchParams.get('edit') === '1';

	/**
	 * @param {number} amount
	 * @returns {string}
	 */
	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}
</script>

<svelte:head>
	<title>{track ? track.track_name : 'Track Not Found'} | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	{#if !track}
		<div class="not-found">
			<h1>Track Not Found</h1>
			<p>The track you're looking for doesn't exist.</p>
			<a href={resolve('/hsi/tracks')} class="btn-secondary">Back to Tracks</a>
		</div>
	{:else}
		<header>
			<div>
				<a href={resolve('/hsi/tracks')} class="back-link">← Back to Tracks</a>
				<h1>{track.track_name}</h1>
			</div>
			<div class="header-actions">
				{#if canManage(user, 'hsi') && !editing}
					<button class="btn-primary" on:click={() => editing = true}>Edit Track</button>
				{/if}
			</div>
		</header>

		{#if form?.error}
			<div class="alert alert-error">{form.error}</div>
		{/if}

		{#if editing && canManage(user, 'hsi')}
			<!-- Edit Form -->
			<div class="form-card">
				<form method="POST" use:enhance>
					<div class="form-grid">
						<div class="form-group">
							<label for="track_name">Track Name *</label>
							<input type="text" id="track_name" name="track_name" value={track.track_name} required class="input" />
						</div>

						<div class="form-group">
							<label for="sort_order">Sort Order</label>
							<input type="number" id="sort_order" name="sort_order" value={track.sort_order || 0} class="input" />
						</div>
					</div>

					<div class="form-group form-group-full">
						<label for="description">Description</label>
						<textarea id="description" name="description" rows="3" class="input">{track.description || ''}</textarea>
					</div>

					<div class="form-group">
						<label class="checkbox-label">
							<input type="checkbox" name="is_active" checked={track.is_active} />
							Active
						</label>
					</div>

					<div class="form-actions">
						<button type="submit" class="btn-primary">Save Changes</button>
						<button type="button" class="btn-secondary" on:click={() => editing = false}>Cancel</button>
					</div>
				</form>
			</div>
		{:else}
			<!-- Track Info Card -->
			<div class="info-card">
				<div class="info-grid">
					<div class="info-item">
						<span class="info-label">Track Name</span>
						<span class="info-value">{track.track_name}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Sort Order</span>
						<span class="info-value">{track.sort_order || 0}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Status</span>
						<span class="status-badge" class:active={track.is_active}>
							{track.is_active ? 'Active' : 'Inactive'}
						</span>
					</div>
				</div>
				{#if track.description}
					<div class="description">
						<span class="info-label">Description</span>
						<p>{track.description}</p>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Stats -->
		<div class="stats-row">
			<div class="stat-card">
				<span class="stat-value">{classes.length}</span>
				<span class="stat-label">Total {classes.length === 1 ? 'Class' : 'Classes'}</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{classes.filter(c => c.is_active).length}</span>
				<span class="stat-label">Active Classes</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{classes.reduce((s, c) => s + c.registration_count, 0)}</span>
				<span class="stat-label">Total Registrations</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{formatCurrency(classes.reduce((s, c) => s + c.total_revenue, 0))}</span>
				<span class="stat-label">Total Revenue</span>
			</div>
		</div>

		<!-- Classes Table -->
		<div class="section">
			<h2>Classes in this Track</h2>
			{#if classes.length === 0}
				<p class="empty-state">No classes assigned to this track.</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Code</th>
							<th>Class Name</th>
							<th>Type</th>
							<th>Student Type</th>
							<th class="col-right">Price</th>
							<th class="col-right">Sessions</th>
							<th class="col-right">Registrations</th>
							<th class="col-right">Revenue</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each classes as cls (cls.class_code)}
							<tr class:inactive={!cls.is_active}>
								<td><a href={resolve(`/hsi/classes/${cls.class_code}`)} class="code-link">{cls.class_code}</a></td>
								<td>{cls.class_name}</td>
								<td>{cls.class_type || '—'}</td>
								<td>{cls.student_type || '—'}</td>
								<td class="col-right">{formatCurrency(cls.standard_price)}</td>
								<td class="col-right">{cls.session_count}</td>
								<td class="col-right">{cls.registration_count}</td>
								<td class="col-right">{formatCurrency(cls.total_revenue)}</td>
								<td>
									<span class="status-badge" class:active={cls.is_active}>
										{cls.is_active ? 'Active' : 'Inactive'}
									</span>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1.25rem; font-weight: 600; color: #1a202c; margin: 0 0 1rem 0; }
	.header-actions { display: flex; gap: 0.75rem; align-items: center; padding-top: 1.5rem; }

	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; text-decoration: none; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; text-decoration: none; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	.alert-error { padding: 1rem 1.5rem; background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 0.5rem; margin-bottom: 1rem; font-weight: 500; }

	.info-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); margin-bottom: 1.5rem; }
	.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
	.info-item { display: flex; flex-direction: column; gap: 0.25rem; }
	.info-label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
	.info-value { font-size: 0.95rem; color: #1a202c; }
	.description { margin-top: 1.25rem; padding-top: 1.25rem; border-top: 1px solid #f3f4f6; }
	.description p { margin: 0.25rem 0 0 0; color: #374151; font-size: 0.95rem; line-height: 1.5; }

	.form-card { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); margin-bottom: 1.5rem; }
	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
	.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
	.form-group-full { margin-bottom: 1.25rem; }
	.form-group label { font-size: 0.8rem; font-weight: 600; color: #374151; }
	.input { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	.input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
	textarea.input { resize: vertical; font-family: inherit; }
	.checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; font-weight: 500; color: #374151; cursor: pointer; margin-bottom: 1.25rem; }
	.checkbox-label input { width: 1rem; height: 1rem; cursor: pointer; }
	.form-actions { display: flex; gap: 1rem; }

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
	.col-right { text-align: right; }
	.code-link { font-family: monospace; font-weight: 600; color: #6366f1; text-decoration: none; }
	.code-link:hover { text-decoration: underline; }

	.empty-state { text-align: center; padding: 2rem; color: #6b7280; }
	.not-found { text-align: center; padding: 3rem; }
	.not-found h1 { margin-bottom: 0.5rem; }
	.not-found p { color: #6b7280; margin-bottom: 1.5rem; }

	@media (max-width: 768px) {
		header { flex-direction: column; }
		.header-actions { padding-top: 1rem; }
		.info-grid { grid-template-columns: repeat(2, 1fr); }
		.stats-row { grid-template-columns: 1fr 1fr; }
		.form-grid { grid-template-columns: 1fr; }
		table { font-size: 0.875rem; }
		th, td { padding: 0.5rem 0.75rem; }
	}
</style>
