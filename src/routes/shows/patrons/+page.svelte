<!-- src/routes/shows/patrons/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { goto } from '$app/navigation';

	/** @type {{ patrons: any[], stats: any, pagination: any, search: string }} */
	export let data;

	$: patrons = data.patrons || [];
	$: stats = data.stats || {};
	$: pagination = data.pagination || { currentPage: 1, totalPages: 1, pageSize: 50, totalCount: 0 };

	let searchTerm = '';

	// Sync search from URL
	$: if (data.search !== undefined) {
		searchTerm = data.search || '';
	}

	/**
	 * @param {number} [page]
	 */
	function buildParams(page) {
		const params = new URLSearchParams();
		if (searchTerm) params.set('search', searchTerm);
		if (page && page > 1) params.set('page', page.toString());
		return params.toString();
	}

	function applySearch() {
		const qs = buildParams(1);
		goto(`${base}/shows/patrons${qs ? '?' + qs : ''}`, { invalidateAll: true });
	}

	function clearSearch() {
		searchTerm = '';
		goto(`${base}/shows/patrons`, { invalidateAll: true });
	}

	/** @param {number} page */
	function goToPage(page) {
		const qs = buildParams(page);
		goto(`${base}/shows/patrons${qs ? '?' + qs : ''}`, { invalidateAll: true });
	}

	/**
	 * @param {number} current
	 * @param {number} total
	 * @returns {(number|string)[]}
	 */
	function pageNumbers(current, total) {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
		/** @type {(number|string)[]} */
		const pages = [];
		pages.push(1);
		if (current > 3) pages.push('...');
		const start = Math.max(2, current - 1);
		const end = Math.min(total - 1, current + 1);
		for (let i = start; i <= end; i++) pages.push(i);
		if (current < total - 2) pages.push('...');
		pages.push(total);
		return pages;
	}

	$: visiblePages = pageNumbers(pagination.currentPage, pagination.totalPages);
	$: rangeStart = (pagination.currentPage - 1) * pagination.pageSize + 1;
	$: rangeEnd = Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount);

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
</script>

<svelte:head>
	<title>Patrons | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Patrons</h1>
		<div class="header-actions">
			<a href="{base}/shows/ticket_purchases" class="btn-secondary-link">Ticket Purchases</a>
			<a href="{base}/shows/patrons/new" class="btn-primary">Add Patron</a>
		</div>
	</header>

	<!-- Summary Stats -->
	<div class="stats-row">
		<div class="stat-card">
			<span class="stat-value">{stats.totalPatrons?.toLocaleString() || 0}</span>
			<span class="stat-label">Total Patrons</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{stats.repeatPatrons?.toLocaleString() || 0}</span>
			<span class="stat-label">Repeat Patrons</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{stats.totalTransactions?.toLocaleString() || 0}</span>
			<span class="stat-label">Transactions</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{stats.totalTickets?.toLocaleString() || 0}</span>
			<span class="stat-label">Tickets Sold</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{formatCurrency(stats.totalRevenue || 0)}</span>
			<span class="stat-label">Total Revenue</span>
		</div>
		{#if stats.anonymousTransactions > 0}
			<div class="stat-card stat-card-muted">
				<span class="stat-value">{stats.anonymousTransactions.toLocaleString()}</span>
				<span class="stat-label">Anonymous Txns</span>
				<span class="stat-sub">{stats.anonymousTickets.toLocaleString()} tickets · {formatCurrency(stats.anonymousRevenue)}</span>
			</div>
		{/if}
	</div>

	<div class="toolbar">
		<div class="search-row">
			<input
				type="text"
				placeholder="Search by name or email..."
				bind:value={searchTerm}
				class="search-input"
				on:keydown={(e) => e.key === 'Enter' && applySearch()}
			/>
			{#if searchTerm}
				<button class="btn-search" on:click={applySearch}>Search</button>
				<button class="btn-clear-search" on:click={clearSearch}>✕</button>
			{/if}
		</div>
		<span class="result-count">
			{#if data.search}
				{pagination.totalCount} {pagination.totalCount === 1 ? 'result' : 'results'}
			{:else}
				{pagination.totalCount} {pagination.totalCount === 1 ? 'patron' : 'patrons'}
			{/if}
		</span>
	</div>

	<div class="table-wrapper">
		{#if patrons.length === 0}
			<p class="empty-state">
				{data.search ? 'No patrons match your search.' : 'No patrons found. Add your first patron to get started.'}
			</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th>Name</th>
						<th>Email</th>
						<th>Phone</th>
						<th class="col-right">Purchases</th>
						<th class="col-right">Total Tickets</th>
						<th class="col-right">Total Spent</th>
					</tr>
				</thead>
				<tbody>
					{#each patrons as patron (patron.patron_id)}
						<tr class:inactive={!patron.is_active}>
							<td>
								<a href="{base}/shows/patrons/{patron.patron_id}" class="patron-link">
									{patron.last_name}, {patron.first_name}
								</a>
							</td>
							<td>{patron.email || '—'}</td>
							<td>{patron.phone || '—'}</td>
							<td class="col-right">{patron.purchase_count}</td>
							<td class="col-right">{patron.total_tickets}</td>
							<td class="col-right">{formatCurrency(patron.total_spent)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

	<!-- Pagination -->
	{#if pagination.totalPages > 1}
		<div class="pagination">
			<span class="page-info">
				Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()} of {pagination.totalCount.toLocaleString()}
			</span>

			<div class="page-controls">
				<button
					class="page-btn"
					disabled={pagination.currentPage <= 1}
					on:click={() => goToPage(pagination.currentPage - 1)}
				>
					← Prev
				</button>

				{#each visiblePages as pg (typeof pg === 'number' ? pg : `ellipsis-${pg}-${Math.random()}`)}
					{#if typeof pg === 'number'}
						<button
							class="page-btn page-num"
							class:active={pg === pagination.currentPage}
							on:click={() => goToPage(pg)}
						>
							{pg}
						</button>
					{:else}
						<span class="page-ellipsis">…</span>
					{/if}
				{/each}

				<button
					class="page-btn"
					disabled={pagination.currentPage >= pagination.totalPages}
					on:click={() => goToPage(pagination.currentPage + 1)}
				>
					Next →
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 1.5rem;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		color: #1a202c;
		margin: 0;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
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

	.btn-secondary-link {
		background-color: #e5e7eb;
		color: #374151;
		padding: 0.6rem 1.25rem;
		border-radius: 0.5rem;
		text-decoration: none;
		font-weight: 500;
		font-size: 0.9rem;
		transition: background-color 0.2s;
	}

	.btn-secondary-link:hover {
		background-color: #d1d5db;
	}

	/* Stats */
	.stats-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.stat-card {
		background: white;
		padding: 1rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}

	.stat-card-muted {
		background: #f9fafb;
	}

	.stat-value {
		font-size: 1.4rem;
		font-weight: 700;
		color: #1a202c;
	}

	.stat-label {
		font-size: 0.75rem;
		color: #6b7280;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.stat-sub {
		font-size: 0.7rem;
		color: #9ca3af;
		margin-top: 0.1rem;
	}

	/* Toolbar */
	.toolbar {
		display: flex;
		align-items: center;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.search-row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
	}

	.search-input {
		padding: 0.6rem 1rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.95rem;
		width: 300px;
		transition: border-color 0.2s;
	}

	.search-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.btn-search {
		padding: 0.6rem 1rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.375rem;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
	}

	.btn-search:hover {
		background: #2563eb;
	}

	.btn-clear-search {
		padding: 0.6rem 0.75rem;
		background: #f3f4f6;
		color: #6b7280;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.85rem;
		cursor: pointer;
	}

	.btn-clear-search:hover {
		background: #e5e7eb;
		color: #374151;
	}

	.result-count {
		font-size: 0.85rem;
		color: #6b7280;
	}

	/* Table */
	.table-wrapper {
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		overflow-x: auto;
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
		vertical-align: middle;
	}

	tr:last-child td {
		border-bottom: none;
	}

	tr:hover {
		background-color: #f9fafb;
	}

	tr.inactive {
		opacity: 0.5;
	}

	.patron-link {
		color: #3b82f6;
		text-decoration: none;
		font-weight: 500;
	}

	.patron-link:hover {
		text-decoration: underline;
	}

	.col-right {
		text-align: right;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: #6b7280;
	}

	/* Pagination */
	.pagination {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-top: 1.25rem;
		flex-wrap: wrap;
		gap: 0.75rem;
	}

	.page-info {
		font-size: 0.85rem;
		color: #6b7280;
	}

	.page-controls {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.page-btn {
		padding: 0.4rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: white;
		color: #374151;
		font-size: 0.85rem;
		cursor: pointer;
		transition: all 0.15s;
	}

	.page-btn:hover:not(:disabled) {
		background: #f3f4f6;
		border-color: #9ca3af;
	}

	.page-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.page-num {
		min-width: 36px;
		text-align: center;
		padding: 0.4rem 0.5rem;
	}

	.page-num.active {
		background: #3b82f6;
		border-color: #3b82f6;
		color: white;
		font-weight: 600;
	}

	.page-num.active:hover {
		background: #2563eb;
	}

	.page-ellipsis {
		padding: 0.4rem 0.35rem;
		color: #9ca3af;
		font-size: 0.85rem;
		user-select: none;
	}

	@media (max-width: 768px) {
		header {
			flex-direction: column;
			gap: 1rem;
			align-items: flex-start;
		}

		.toolbar {
			flex-direction: column;
			align-items: flex-start;
		}

		.search-input {
			width: 100%;
		}

		table {
			font-size: 0.875rem;
		}

		th,
		td {
			padding: 0.5rem 0.75rem;
		}

		.pagination {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>