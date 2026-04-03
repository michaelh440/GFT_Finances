<!-- src/routes/admin/audit-log/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	/** @type {any} */
	export let data;

	let actionFilter = data.filters?.actionFilter || '';
	let userFilter = data.filters?.userFilter || '';

	$: actionFilter = data.filters?.actionFilter || '';
	$: userFilter = data.filters?.userFilter || '';

	function applyFilters() {
		const params = new URLSearchParams();
		if (actionFilter) params.set('action', actionFilter);
		if (userFilter) params.set('user', userFilter);
		goto(`${base}/admin/audit-log${params.toString() ? '?' + params.toString() : ''}`, { invalidateAll: true });
	}

	function clearFilters() {
		goto(`${base}/admin/audit-log`, { invalidateAll: true });
	}

	/** @param {any} p */
	function goToPage(p) {
		const params = new URLSearchParams();
		if (actionFilter) params.set('action', actionFilter);
		if (userFilter) params.set('user', userFilter);
		params.set('page', p.toString());
		goto(`${base}/admin/audit-log?${params.toString()}`, { invalidateAll: true });
	}

	/** @param {any} d */
	function formatDateTime(d) {
		if (!d) return '—';
		const dt = new Date(d);
		return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
	}

	/** @type {Record<string, string>} */
	const actionColors = {
		login: '#dbeafe', login_failed: '#fee2e2', logout: '#f3f4f6',
		create: '#dcfce7', update: '#fef3c7', delete: '#fee2e2', import: '#e0e7ff'
	};

	$: totalPages = Math.ceil(data.total / data.perPage);
</script>

<svelte:head>
	<title>Audit Log | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href="{base}/admin/users" class="back-link">← Back to User Management</a>
			<h1>Audit Log</h1>
			<p class="subtitle">{data.total} total entries</p>
		</div>
	</header>

	<div class="filter-card">
		<div class="filter-row">
			<div class="filter-group">
				<label for="af">Action</label>
				<select id="af" bind:value={actionFilter} on:change={applyFilters}>
					<option value="">All Actions</option>
					{#each data.actions as action}
						<option value={action}>{action}</option>
					{/each}
				</select>
			</div>
			<div class="filter-group">
				<label for="uf">User</label>
				<select id="uf" bind:value={userFilter} on:change={applyFilters}>
					<option value="">All Users</option>
					{#each data.users as u}
						<option value={u.user_id.toString()}>{u.first_name} {u.last_name} ({u.email})</option>
					{/each}
				</select>
			</div>
			{#if actionFilter || userFilter}
				<button class="btn-clear" on:click={clearFilters}>Clear</button>
			{/if}
		</div>
	</div>

	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th>When</th>
					<th>User</th>
					<th>Action</th>
					<th>Table</th>
					<th>Record</th>
					<th>Details</th>
					<th>IP</th>
				</tr>
			</thead>
			<tbody>
				{#each data.logs as log}
					<tr>
						<td class="date-cell">{formatDateTime(log.created_at)}</td>
						<td>
							{#if log.first_name}{log.first_name} {log.last_name}{:else}{log.user_email || '—'}{/if}
						</td>
						<td>
							<span class="action-badge" style="background:{actionColors[log.action] || '#f3f4f6'}">{log.action}</span>
						</td>
						<td class="mono">{log.table_name || '—'}</td>
						<td class="mono">{log.record_id || '—'}</td>
						<td class="details-cell">
							{#if log.details}
								<details>
									<summary>View</summary>
									<pre>{JSON.stringify(log.details, null, 2)}</pre>
								</details>
							{:else}—{/if}
						</td>
						<td class="mono ip-cell">{log.ip_address || '—'}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	{#if totalPages > 1}
		<div class="pagination">
			<button disabled={data.page <= 1} on:click={() => goToPage(data.page - 1)}>← Prev</button>
			<span>Page {data.page} of {totalPages}</span>
			<button disabled={data.page >= totalPages} on:click={() => goToPage(data.page + 1)}>Next →</button>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 1.5rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; }

	.filter-card { background: white; padding: 1rem 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
	.filter-row { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
	.filter-group { display: flex; flex-direction: column; gap: 0.25rem; min-width: 180px; }
	.filter-group label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
	.filter-group select { padding: 0.45rem 0.6rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; }
	.btn-clear { background: none; border: none; color: #3b82f6; font-size: 0.85rem; cursor: pointer; padding-bottom: 0.45rem; }

	.table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background: #f9fafb; }
	th { padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; }
	td { padding: 0.45rem 0.75rem; border-bottom: 1px solid #f3f4f6; font-size: 0.8rem; vertical-align: top; }
	tr:hover { background: #f9fafb; }

	.date-cell { font-size: 0.75rem; color: #6b7280; white-space: nowrap; }
	.mono { font-family: monospace; font-size: 0.75rem; color: #6b7280; }
	.ip-cell { font-size: 0.7rem; }
	.action-badge { padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; }
	.details-cell details { font-size: 0.75rem; }
	.details-cell summary { cursor: pointer; color: #3b82f6; }
	.details-cell pre { background: #f9fafb; padding: 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; max-width: 300px; overflow-x: auto; margin: 0.25rem 0 0 0; }

	.pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-top: 1.5rem; }
	.pagination button { padding: 0.4rem 1rem; background: white; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; cursor: pointer; }
	.pagination button:hover { background: #f9fafb; }
	.pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
	.pagination span { font-size: 0.85rem; color: #6b7280; }

	@media (max-width: 768px) {
		.filter-row { flex-direction: column; align-items: stretch; gap: 0.75rem; }
		.filter-group { width: 100%; min-width: 0; }
		.filter-group select { width: 100%; box-sizing: border-box; }
	}
</style>