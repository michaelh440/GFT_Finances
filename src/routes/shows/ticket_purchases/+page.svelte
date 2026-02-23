<!-- src/routes/shows/ticket_purchases/+page.svelte -->
<script>
	import { base } from '$app/paths';

	export let data;

	$: tickets = data.tickets || [];
	$: pagination = data.pagination || { currentPage: 1, totalPages: 1, pageSize: 50, totalCount: 0 };

	// Local filter state — initialized from server
	let showCode = data.filters?.showCode || '';
	let year = data.filters?.year || '';
	let dateFrom = data.filters?.dateFrom || '';
	let dateTo = data.filters?.dateTo || '';
	let patronSearch = data.filters?.patronSearch || '';
	let paymentMethod = data.filters?.paymentMethod || '';

	$: hasFilters = data.filters?.showCode || data.filters?.year || data.filters?.dateFrom || data.filters?.dateTo || data.filters?.patronSearch || data.filters?.paymentMethod;

	// Group shows by format for dropdown
	$: showsByFormat = (data.shows || []).reduce((acc, s) => {
		const fmt = s.format || 'Other';
		if (!acc[fmt]) acc[fmt] = [];
		acc[fmt].push(s);
		return acc;
	}, {});
	$: formats = Object.keys(showsByFormat).sort();

	function buildUrl(page) {
		const params = new URLSearchParams();
		if (showCode) params.set('show', showCode);
		if (year) params.set('year', year);
		if (dateFrom) params.set('from', dateFrom);
		if (dateTo) params.set('to', dateTo);
		if (patronSearch) params.set('patron', patronSearch);
		if (paymentMethod) params.set('payment', paymentMethod);
		if (page && page > 1) params.set('page', page.toString());
		const qs = params.toString();
		return `${base}/shows/ticket_purchases${qs ? '?' + qs : ''}`;
	}

	function applyFilters() {
		window.location.href = buildUrl(1);
	}

	function clearFilters() {
		window.location.href = `${base}/shows/ticket_purchases`;
	}

	function goToPage(page) {
		// Use applied filters from server, not local state
		const params = new URLSearchParams();
		if (data.filters?.showCode) params.set('show', data.filters.showCode);
		if (data.filters?.year) params.set('year', data.filters.year);
		if (data.filters?.dateFrom) params.set('from', data.filters.dateFrom);
		if (data.filters?.dateTo) params.set('to', data.filters.dateTo);
		if (data.filters?.patronSearch) params.set('patron', data.filters.patronSearch);
		if (data.filters?.paymentMethod) params.set('payment', data.filters.paymentMethod);
		if (page > 1) params.set('page', page.toString());
		const qs = params.toString();
		window.location.href = `${base}/shows/ticket_purchases${qs ? '?' + qs : ''}`;
	}

	function setYearFilter(y) {
		showCode = data.filters?.showCode || '';
		year = y.toString();
		dateFrom = '';
		dateTo = '';
		patronSearch = data.filters?.patronSearch || '';
		paymentMethod = data.filters?.paymentMethod || '';
		applyFilters();
	}

	function pageNumbers(current, total) {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
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

	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const str = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().split('T')[0];
		const d = new Date(str + 'T12:00:00');
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function formatDateShort(dateStr) {
		if (!dateStr) return '—';
		const str = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().split('T')[0];
		const d = new Date(str + 'T12:00:00');
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}
</script>

<svelte:head>
	<title>Ticket Purchases | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<h1>Ticket Purchases</h1>
			<p class="subtitle">
				{#if hasFilters}Filtered results{:else}All ticket purchases{/if}
			</p>
		</div>
		<div class="header-actions">
			<a href="{base}/shows/ticket_purchases/enter_ticket_purchases" class="btn-primary">Enter Ticket Purchases</a>
			<a href="{base}/shows/patrons" class="btn-secondary-link">View Patrons</a>
		</div>
	</header>

	<!-- Summary Stats -->
	<div class="stats-row">
		<div class="stat-card">
			<span class="stat-value">{data.transactionCount.toLocaleString()}</span>
			<span class="stat-label">Transactions</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{data.totalTickets.toLocaleString()}</span>
			<span class="stat-label">Tickets Sold</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{formatCurrency(data.totalRevenue)}</span>
			<span class="stat-label">Revenue</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{data.totalTickets > 0 ? formatCurrency(data.totalRevenue / data.totalTickets) : '$0.00'}</span>
			<span class="stat-label">Avg / Ticket</span>
		</div>
		{#if data.anonymousCount > 0}
			<div class="stat-card">
				<span class="stat-value">{data.anonymousCount.toLocaleString()}</span>
				<span class="stat-label">Anonymous</span>
			</div>
		{/if}
	</div>

	<!-- Filters -->
	<div class="filter-card">
		<div class="filter-header">
			<h2>Filters</h2>
			{#if hasFilters}
				<button class="btn-clear" on:click={clearFilters}>Clear all</button>
			{/if}
		</div>

		<div class="filter-grid">
			<div class="filter-group">
				<label for="filterShow">Show</label>
				<select id="filterShow" bind:value={showCode}>
					<option value="">All Shows</option>
					{#each formats as fmt (fmt)}
						<optgroup label={fmt}>
							{#each showsByFormat[fmt] as s (s.show_code)}
								<option value={s.show_code}>{s.show_name}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="filterYear">Year</label>
				<select id="filterYear" bind:value={year} on:change={() => { dateFrom = ''; dateTo = ''; }}>
					<option value="">All Years</option>
					{#each data.years as y (y)}
						<option value={y.toString()}>{y}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="filterFrom">From Date</label>
				<input type="date" id="filterFrom" bind:value={dateFrom} on:change={() => { year = ''; }} />
			</div>

			<div class="filter-group">
				<label for="filterTo">To Date</label>
				<input type="date" id="filterTo" bind:value={dateTo} on:change={() => { year = ''; }} />
			</div>

			<div class="filter-group">
				<label for="filterPatron">Patron</label>
				<input
					type="text"
					id="filterPatron"
					bind:value={patronSearch}
					placeholder="Name or email..."
					on:keydown={(e) => e.key === 'Enter' && applyFilters()}
				/>
			</div>

			<div class="filter-group">
				<label for="filterPayment">Payment</label>
				<select id="filterPayment" bind:value={paymentMethod}>
					<option value="">All Methods</option>
					{#each data.paymentMethods as pm (pm)}
						<option value={pm}>{pm}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="filter-bottom">
			{#if data.years.length > 0}
				<div class="quick-filters">
					<span class="quick-label">Quick:</span>
					{#each data.years.slice(0, 5) as y (y)}
						<button
							class="quick-btn"
							class:active={(data.filters?.year || '') === y.toString()}
							on:click={() => setYearFilter(y)}
						>{y}</button>
					{/each}
				</div>
			{/if}

			<button class="btn-apply" on:click={applyFilters}>
				Apply Filters
			</button>
		</div>
	</div>

	<!-- Table -->
	<div class="table-wrapper">
		{#if tickets.length === 0}
			<p class="empty-state">
				{hasFilters ? 'No ticket purchases match your filters.' : 'No ticket purchases found. Import or add your first ticket purchase.'}
			</p>
		{:else}
			<table>
				<thead>
					<tr>
						<th>Show Date</th>
						<th>Show</th>
						<th>Patron</th>
						<th class="col-right">Tickets</th>
						<th class="col-right">Amount</th>
						<th>Purchased</th>
						<th>Payment</th>
					</tr>
				</thead>
				<tbody>
					{#each tickets as ticket (ticket.ticket_id)}
						<tr>
							<td class="col-date">{formatDate(ticket.show_date)}</td>
							<td>
								<a href="{base}/shows/{ticket.show_code}" class="link">{ticket.show_name}</a>
								<span class="show-format">{ticket.format || ''}</span>
							</td>
							<td>
								{#if ticket.patron_id}
									<a href="{base}/shows/patrons/{ticket.patron_id}" class="link">
										{ticket.patron_first_name} {ticket.patron_last_name}
									</a>
									{#if ticket.patron_email}
										<span class="patron-email">{ticket.patron_email}</span>
									{/if}
								{:else}
									<span class="anonymous-tag">Anonymous</span>
								{/if}
							</td>
							<td class="col-right">{ticket.tickets_purchased}</td>
							<td class="col-right">{formatCurrency(ticket.amount_paid)}</td>
							<td class="col-date">{formatDateShort(ticket.purchase_date)}</td>
							<td>
								{#if ticket.payment_method}
									<span class="payment-badge">{ticket.payment_method}</span>
								{:else}
									<span class="text-muted">—</span>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
				<tfoot>
					<tr>
						<td colspan="3" class="total-label">
							Total ({data.transactionCount.toLocaleString()} transactions)
						</td>
						<td class="col-right total-value">{data.totalTickets.toLocaleString()}</td>
						<td class="col-right total-value">{formatCurrency(data.totalRevenue)}</td>
						<td colspan="2"></td>
					</tr>
				</tfoot>
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
				<button class="page-btn" disabled={pagination.currentPage <= 1} on:click={() => goToPage(pagination.currentPage - 1)}>
					← Prev
				</button>

				{#each visiblePages as pg (typeof pg === 'number' ? pg : `ellipsis-${pg}-${Math.random()}`)}
					{#if typeof pg === 'number'}
						<button class="page-btn page-num" class:active={pg === pagination.currentPage} on:click={() => goToPage(pg)}>
							{pg}
						</button>
					{:else}
						<span class="page-ellipsis">…</span>
					{/if}
				{/each}

				<button class="page-btn" disabled={pagination.currentPage >= pagination.totalPages} on:click={() => goToPage(pagination.currentPage + 1)}>
					Next →
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1rem; font-weight: 600; color: #374151; margin: 0; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; font-size: 0.9rem; }
	.header-actions { display: flex; gap: 0.75rem; align-items: center; padding-top: 0.25rem; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary-link { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-secondary-link:hover { background-color: #d1d5db; }

	.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
	.stat-card { background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); text-align: center; display: flex; flex-direction: column; gap: 0.2rem; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }

	.filter-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); margin-bottom: 1.5rem; }
	.filter-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
	.btn-clear { background: none; border: none; color: #3b82f6; font-size: 0.85rem; cursor: pointer; padding: 0; }
	.btn-clear:hover { text-decoration: underline; }

	.filter-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem; }
	.filter-group { display: flex; flex-direction: column; gap: 0.3rem; }
	.filter-group label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
	.filter-group select,
	.filter-group input { padding: 0.5rem 0.6rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	.filter-group select:focus,
	.filter-group input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

	.filter-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid #f3f4f6; gap: 1rem; flex-wrap: wrap; }

	.btn-apply { margin-left: auto; padding: 0.5rem 1.5rem; background-color: #3b82f6; color: white; border: none; border-radius: 0.375rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; transition: background-color 0.2s; }
	.btn-apply:hover { background-color: #2563eb; }

	.quick-filters { display: flex; align-items: center; gap: 0.5rem; }
	.quick-label { font-size: 0.75rem; color: #9ca3af; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }
	.quick-btn { padding: 0.3rem 0.75rem; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 0.375rem; font-size: 0.8rem; color: #374151; cursor: pointer; transition: all 0.15s; }
	.quick-btn:hover { background: #e5e7eb; }
	.quick-btn.active { background: #dbeafe; border-color: #93c5fd; color: #1e40af; font-weight: 600; }

	.table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
	td { padding: 0.6rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; vertical-align: top; font-size: 0.9rem; }
	tr:hover td { background-color: #f9fafb; }

	.link { color: #3b82f6; text-decoration: none; font-weight: 500; }
	.link:hover { text-decoration: underline; }
	.show-format { display: block; font-size: 0.75rem; color: #9ca3af; }
	.patron-email { display: block; font-size: 0.75rem; color: #9ca3af; }
	.anonymous-tag { color: #9ca3af; font-style: italic; font-size: 0.85rem; }
	.col-right { text-align: right; }
	.col-date { white-space: nowrap; }
	.payment-badge { display: inline-block; padding: 0.15rem 0.5rem; background: #f3f4f6; border-radius: 0.25rem; font-size: 0.8rem; color: #374151; }
	.text-muted { color: #d1d5db; }

	tfoot td { border-top: 2px solid #e5e7eb; border-bottom: none; padding-top: 0.75rem; }
	.total-label { text-align: right; font-weight: 600; color: #374151; font-size: 0.85rem; }
	.total-value { font-weight: 700; color: #1a202c; font-size: 0.95rem; }
	.empty-state { text-align: center; padding: 3rem; color: #6b7280; }

	.pagination { display: flex; justify-content: space-between; align-items: center; margin-top: 1.25rem; flex-wrap: wrap; gap: 0.75rem; }
	.page-info { font-size: 0.85rem; color: #6b7280; }
	.page-controls { display: flex; align-items: center; gap: 0.25rem; }
	.page-btn { padding: 0.4rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: white; color: #374151; font-size: 0.85rem; cursor: pointer; transition: all 0.15s; }
	.page-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #9ca3af; }
	.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.page-num { min-width: 36px; text-align: center; padding: 0.4rem 0.5rem; }
	.page-num.active { background: #3b82f6; border-color: #3b82f6; color: white; font-weight: 600; }
	.page-num.active:hover { background: #2563eb; }
	.page-ellipsis { padding: 0.4rem 0.35rem; color: #9ca3af; font-size: 0.85rem; user-select: none; }

	@media (max-width: 768px) {
		header { flex-direction: column; gap: 1rem; }
		.filter-grid { grid-template-columns: 1fr 1fr; }
		.filter-bottom { flex-direction: column; align-items: stretch; }
		.btn-apply { text-align: center; }
		table { font-size: 0.8rem; }
		th, td { padding: 0.5rem 0.6rem; }
		.pagination { flex-direction: column; align-items: flex-start; }
	}
</style>