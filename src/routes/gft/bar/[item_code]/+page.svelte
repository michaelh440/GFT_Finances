<!-- src/routes/gft/bar/[item_code]/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { canDataEntry } from '$lib/permissions';

	/** @type {any} */
	export let data;

	$: item = data.item;
	$: summaries = data.summaries || [];
	$: totalUnits = data.totalUnits || 0;
	$: totalRevenue = data.totalRevenue || 0;
	$: user = data.user;

	/** @param {number} amount */
	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	/** @param {*} dateStr */
	function formatMonth(dateStr) {
		if (!dateStr) return '—';
		const str = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().split('T')[0];
		const d = new Date(str + 'T12:00:00');
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
	}

	let confirmDelete = false;
</script>

<svelte:head>
	<title>{item ? item.item_name : 'Item Not Found'} | StageLedger</title>
</svelte:head>

<div class="container">
	{#if !item}
		<div class="not-found">
			<h1>Item Not Found</h1>
			<p>The bar item you're looking for doesn't exist.</p>
			<a href={resolve('/gft/bar')} class="btn-secondary">Back to Bar Items</a>
		</div>
	{:else}
		<header>
			<div>
				<a href={resolve('/gft/bar')} class="back-link">← Back to Bar Items</a>
				<h1>{item.item_name}</h1>
			</div>
			<div class="header-actions">
				{#if canDataEntry(user, 'gft')}
					<a href={resolve(`/gft/bar/${item.item_code}/edit`)} class="btn-primary">Edit Item</a>
					{#if !confirmDelete}
						<button class="btn-danger" on:click={() => confirmDelete = true}>Delete</button>
					{:else}
						<form method="POST" action="?/delete" use:enhance class="delete-form">
							<span class="confirm-text">Are you sure?</span>
							<button type="submit" class="btn-danger">Yes, Delete</button>
							<button type="button" class="btn-secondary" on:click={() => confirmDelete = false}>Cancel</button>
						</form>
					{/if}
				{/if}
			</div>
		</header>

		<div class="info-card">
			<div class="info-grid">
				<div class="info-item">
					<span class="info-label">Item Code</span>
					<span class="info-value code">{item.item_code}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Category</span>
					<span class="info-value">{item.category || '—'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Status</span>
					<span class="status-badge" class:active={item.is_active}>
						{item.is_active ? 'Active' : 'Inactive'}
					</span>
				</div>
			</div>
		</div>

		<div class="stats-row">
			<div class="stat-card">
				<span class="stat-value">{summaries.length}</span>
				<span class="stat-label">Months Tracked</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{totalUnits.toLocaleString()}</span>
				<span class="stat-label">Total Units Sold</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{formatCurrency(totalRevenue)}</span>
				<span class="stat-label">Total Revenue</span>
			</div>
		</div>

		<div class="section">
			<h2>Monthly Summary</h2>
			{#if summaries.length === 0}
				<p class="empty-state">No monthly data yet.</p>
			{:else}
				<table>
					<thead>
						<tr>
							<th>Month</th>
							<th class="col-right">Units Sold</th>
							<th class="col-right">Revenue</th>
						</tr>
					</thead>
					<tbody>
						{#each summaries as s (s.summary_month)}
							<tr>
								<td>{formatMonth(s.summary_month)}</td>
								<td class="col-right">{s.units_sold.toLocaleString()}</td>
								<td class="col-right">{formatCurrency(s.revenue)}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td class="total-label">Total</td>
							<td class="col-right total-value">{totalUnits.toLocaleString()}</td>
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
	.header-actions { display: flex; gap: 0.75rem; align-items: center; padding-top: 1.5rem; flex-wrap: wrap; }

	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; border: none; cursor: pointer; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }
	.btn-danger { background-color: #ef4444; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-danger:hover { background-color: #dc2626; }
	.delete-form { display: flex; align-items: center; gap: 0.5rem; }
	.confirm-text { font-size: 0.85rem; color: #991b1b; font-weight: 500; }

	.info-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); margin-bottom: 1.5rem; }
	.info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
	.info-item { display: flex; flex-direction: column; gap: 0.25rem; }
	.info-label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
	.info-value { font-size: 0.95rem; color: #1a202c; }
	.info-value.code { font-family: monospace; font-weight: 600; color: #6366f1; }

	.status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; width: fit-content; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }

	.stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem; margin-bottom: 2rem; }
	.stat-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); text-align: center; display: flex; flex-direction: column; gap: 0.25rem; }
	.stat-value { font-size: 1.5rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	.section { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; }
	td { padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; }
	tr:last-child td { border-bottom: none; }
	tr:hover { background-color: #f9fafb; }
	.col-right { text-align: right; }
	tfoot td { border-top: 2px solid #e5e7eb; border-bottom: none; padding-top: 0.75rem; }
	.total-label { font-weight: 600; color: #374151; }
	.total-value { font-weight: 700; color: #1a202c; font-size: 1.05rem; }
	.empty-state { text-align: center; padding: 2rem; color: #6b7280; }
	.not-found { text-align: center; padding: 3rem; }
	.not-found h1 { margin-bottom: 0.5rem; }
	.not-found p { color: #6b7280; margin-bottom: 1.5rem; }

	@media (max-width: 768px) {
		header { flex-direction: column; }
		.header-actions { padding-top: 1rem; }
		.info-grid { grid-template-columns: 1fr; }
		.stats-row { grid-template-columns: 1fr; }
		.section { overflow-x: auto; }
		table { display: table; min-width: 400px; }
	}
</style>
