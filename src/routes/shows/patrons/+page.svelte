<!-- src/routes/shows/patrons/+page.svelte -->
<script>
	import { base } from '$app/paths';

	/** @type {{ patrons: any[], stats: any, pagination: any, search: string, shows: any[], formats: string[], audiences: string[], days: string[], years: number[], filters: any }} */
	export let data;

	$: patrons = data.patrons || [];
	$: stats = data.stats || {};
	$: pagination = data.pagination || { currentPage: 1, totalPages: 1, pageSize: 50, totalCount: 0 };

	let searchTerm = '';

	// Filter state
	let selectedShowCode = 'all';
	let selectedFormat = 'all';
	let selectedAudience = 'all';
	let selectedDay = 'all';
	let selectedYears = [];

	// Available filter options from server
	$: availableYears = (data.years || []).sort((a, b) => b - a);

	// Init filters from URL on data change
	$: {
		if (data.filters?.showCode) selectedShowCode = data.filters.showCode; else selectedShowCode = 'all';
		if (data.filters?.format) selectedFormat = data.filters.format; else selectedFormat = 'all';
		if (data.filters?.audienceType) selectedAudience = data.filters.audienceType; else selectedAudience = 'all';
		if (data.filters?.dayOfWeek) selectedDay = data.filters.dayOfWeek; else selectedDay = 'all';
		const urlYears = (data.filters?.years || '').split(',').filter(Boolean);
		if (urlYears.length > 0) {
			selectedYears = urlYears;
		} else {
			selectedYears = [];
		}
	}

	// Sync search from URL
	$: if (data.search !== undefined) {
		searchTerm = data.search || '';
	}

	$: hasFilters = selectedShowCode !== 'all' || selectedFormat !== 'all' || selectedAudience !== 'all' || selectedDay !== 'all' || selectedYears.length > 0;

	function toggleYear(y) {
		const str = y.toString();
		if (selectedYears.includes(str)) {
			selectedYears = selectedYears.filter(v => v !== str);
		} else {
			selectedYears = [...selectedYears, str];
		}
	}

	function buildFilterParams(page) {
		const params = new URLSearchParams();
		if (selectedShowCode !== 'all') params.set('show', selectedShowCode);
		if (selectedFormat !== 'all') params.set('format', selectedFormat);
		if (selectedAudience !== 'all') params.set('audience', selectedAudience);
		if (selectedDay !== 'all') params.set('day', selectedDay);
		if (selectedYears.length > 0) params.set('years', selectedYears.join(','));
		if (searchTerm) params.set('search', searchTerm);
		if (page && page > 1) params.set('page', page.toString());
		return params.toString();
	}

	function applyFilters() {
		const qs = buildFilterParams(1);
		window.location.href = `${base}/shows/patrons${qs ? '?' + qs : ''}`;
	}

	function clearFilters() {
		window.location.href = `${base}/shows/patrons`;
	}

	function applySearch() {
		const qs = buildFilterParams(1);
		window.location.href = `${base}/shows/patrons${qs ? '?' + qs : ''}`;
	}

	function clearSearch() {
		searchTerm = '';
		window.location.href = `${base}/shows/patrons`;
	}

	/** @param {number} page */
	function goToPage(page) {
		const qs = buildFilterParams(page);
		window.location.href = `${base}/shows/patrons${qs ? '?' + qs : ''}`;
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

<div class="container" data-sveltekit-reload>
	<header>
		<h1>Patrons</h1>
		<div class="header-actions">
			<a href="{base}/shows/ticket_purchases" class="btn-secondary-link">Ticket Purchases</a>
			<a href="{base}/shows/patrons/new" class="btn-primary">Add Patron</a>
		</div>
	</header>

	<!-- Filter Section — matches geo analytics layout -->
	<div class="filter-section">
		<div class="filter-row">
			<div class="filter-group">
				<label for="showSelect">Show:</label>
				<select id="showSelect" bind:value={selectedShowCode} class="filter-select">
					<option value="all">All Shows</option>
					{#each data.shows || [] as show}
						<option value={show.show_code}>{show.show_name}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="formatSelect">Format:</label>
				<select id="formatSelect" bind:value={selectedFormat} class="filter-select">
					<option value="all">All Formats</option>
					{#each data.formats || [] as f}
						<option value={f}>{f}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="audienceSelect">Audience:</label>
				<select id="audienceSelect" bind:value={selectedAudience} class="filter-select">
					<option value="all">All Audiences</option>
					{#each data.audiences || [] as a}
						<option value={a}>{a}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="daySelect">Day of Week:</label>
				<select id="daySelect" bind:value={selectedDay} class="filter-select">
					<option value="all">All Days</option>
					{#each data.days || [] as d}
						<option value={d}>{d}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	<!-- Year Filter Section -->
	{#if availableYears.length > 0}
		<h2 class="section-title">Years To Include in Analysis</h2>
		<div class="filter-section">
			<div class="filter-row">
				<div class="filter-group">
					<span class="filter-heading">Years to Display:</span>
					<div class="year-checkboxes">
						{#each availableYears as y (y)}
							<label class="checkbox-label">
								<input type="checkbox" checked={selectedYears.includes(y.toString())} on:change={() => toggleYear(y)} />
								<span>{y}</span>
							</label>
						{/each}
					</div>
				</div>
				<div class="filter-actions">
					<button class="btn-apply" on:click={applyFilters}>Apply Filters</button>
					{#if hasFilters}
						<button class="btn-clear" on:click={clearFilters}>Clear All</button>
					{/if}
				</div>
			</div>
		</div>
	{:else}
		<div class="filter-section">
			<div class="filter-row">
				<div class="filter-actions">
					<button class="btn-apply" on:click={applyFilters}>Apply Filters</button>
					{#if hasFilters}
						<button class="btn-clear" on:click={clearFilters}>Clear All</button>
					{/if}
				</div>
			</div>
		</div>
	{/if}

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

	<!-- Search & Table -->
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
				{data.search ? 'No patrons match your search.' : hasFilters ? 'No patrons match the selected filters.' : 'No patrons found. Add your first patron to get started.'}
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
		max-width: 1400px;
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

	/* Filter Section — matches geo analytics layout */
	.filter-section {
		background: white;
		padding: 1.25rem 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
		margin-bottom: 1.5rem;
	}
	.filter-row {
		display: flex;
		gap: 2rem;
		align-items: flex-end;
		flex-wrap: wrap;
	}
	.filter-group { display: flex; flex-direction: column; gap: 0.35rem; }
	.filter-group label, .filter-heading {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.filter-select {
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.85rem;
		color: #1a202c;
		background: white;
		min-width: 180px;
	}
	.filter-select:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }

	.section-title {
		font-size: 1.1rem;
		font-weight: 600;
		color: #374151;
		margin: 0 0 0.75rem 0;
	}

	.year-checkboxes { display: flex; gap: 0.75rem; flex-wrap: wrap; }
	.checkbox-label { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: #374151; cursor: pointer; white-space: nowrap; }
	.checkbox-label input[type="checkbox"] { accent-color: #6366f1; cursor: pointer; }

	.filter-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		margin-left: auto;
	}
	.btn-apply { padding: 0.5rem 1.5rem; background-color: #6366f1; color: white; border: none; border-radius: 0.375rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
	.btn-apply:hover { background-color: #4f46e5; }
	.btn-clear { background: none; border: none; color: #6366f1; font-size: 0.85rem; cursor: pointer; font-weight: 500; }
	.btn-clear:hover { text-decoration: underline; }

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
		white-space: nowrap;
	}

	td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f3f4f6;
		color: #1a202c;
		vertical-align: middle;
		font-size: 0.85rem;
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

		.filter-row { flex-direction: column; gap: 1rem; }
		.filter-select { min-width: 100%; }

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

		th, td {
			padding: 0.5rem 0.75rem;
		}

		.pagination {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>