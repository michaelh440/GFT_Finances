<!-- src/routes/promotions/[promotion_id]/+page.svelte -->
<script>
	import { base } from '$app/paths';

	export let data;

	$: promo = data.promotion;
	$: showStats = data.showStats || [];
	$: totals = data.totals || {};
	$: discountTotals = data.discountTotals || {};
	$: linkedShows = data.linkedShows || [];
	$: linkedClasses = data.linkedClasses || [];

	const discountTypeLabels = {
		flat: 'Flat Amount Off',
		percentage: 'Percentage Off',
		fixed_price: 'Fixed Price',
		bogo: 'Buy One Get One',
		comp: 'Complimentary',
		other: 'Other'
	};

	function formatDiscount(type, value) {
		if (value == null) return '—';
		if (type === 'flat') return `$${value.toFixed(2)} off`;
		if (type === 'percentage') return `${value}% off`;
		if (type === 'fixed_price') return `$${value.toFixed(2)} flat price`;
		if (type === 'bogo') return 'Buy One Get One';
		if (type === 'comp') return 'Free / Complimentary';
		return `${value}`;
	}

	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr + 'T12:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	function dateStatus() {
		if (!promo) return '';
		if (!promo.start_date && !promo.end_date) return 'ongoing';
		const now = new Date().toISOString().split('T')[0];
		if (promo.end_date && promo.end_date < now) return 'ended';
		if (promo.start_date && promo.start_date > now) return 'upcoming';
		return 'active';
	}
</script>

<svelte:head>
	<title>{promo ? promo.promotion_name : 'Promotion'} | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	{#if !promo}
		<div class="alert alert-error">Promotion not found.</div>
		<a href="{base}/promotions" class="btn-secondary">Back to Promotions</a>
	{:else}
		<header>
			<div>
				<a href="{base}/promotions" class="breadcrumb">← Promotions</a>
				<h1>{promo.promotion_name}</h1>
				<div class="header-badges">
					<span class="status-badge" class:active={promo.is_active && dateStatus() !== 'ended'} class:ended={dateStatus() === 'ended'}>
						{#if !promo.is_active}Inactive{:else if dateStatus() === 'ended'}Ended{:else if dateStatus() === 'upcoming'}Upcoming{:else}Active{/if}
					</span>
					{#if promo.discount_type}
						<span class="type-badge type-{promo.discount_type}">
							{discountTypeLabels[promo.discount_type] || promo.discount_type}
						</span>
					{/if}
				</div>
			</div>
			<a href="{base}/promotions/{promo.promotion_id}/edit" class="btn-primary">Edit Promotion</a>
		</header>

		<!-- Info Card -->
		<div class="info-card">
			<div class="info-grid">
				<div class="info-item">
					<span class="info-label">Discount</span>
					<span class="info-value">{formatDiscount(promo.discount_type, promo.discount_value)}</span>
				</div>
				{#if promo.start_date || promo.end_date}
					<div class="info-item">
						<span class="info-label">Date Range</span>
						<span class="info-value">{formatDate(promo.start_date)} – {formatDate(promo.end_date)}</span>
					</div>
				{:else}
					<div class="info-item">
						<span class="info-label">Date Range</span>
						<span class="info-value text-muted">No date restrictions</span>
					</div>
				{/if}
				{#if promo.created_at}
					<div class="info-item">
						<span class="info-label">Created</span>
						<span class="info-value">{formatDate(promo.created_at)}</span>
					</div>
				{/if}
			</div>
			{#if promo.description}
				<div class="desc-section">
					<span class="info-label">Description</span>
					<p class="desc-text">{promo.description}</p>
				</div>
			{/if}
			{#if linkedShows.length > 0}
				<div class="desc-section">
					<span class="info-label">Linked Shows ({linkedShows.length})</span>
					<div class="linked-shows">
						{#each linkedShows as ls (ls.show_code)}
							<a href="{base}/shows/{ls.show_code}" class="show-chip">{ls.show_name}</a>
						{/each}
					</div>
				</div>
			{/if}
			{#if linkedClasses.length > 0}
				<div class="desc-section">
					<span class="info-label">Linked Classes ({linkedClasses.length})</span>
					<div class="linked-shows">
						{#each linkedClasses as lc (lc.class_code)}
							<span class="class-chip">{lc.class_name}</span>
						{/each}
					</div>
				</div>
			{/if}
		</div>

		<!-- Stats -->
		<div class="stats-row">
			<div class="stat-card">
				<span class="stat-value">{totals.total_transactions || 0}</span>
				<span class="stat-label">Transactions</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{totals.total_tickets || 0}</span>
				<span class="stat-label">Tickets Sold</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{totals.unique_patrons || 0}</span>
				<span class="stat-label">Unique Patrons</span>
			</div>
			<div class="stat-card">
				<span class="stat-value">{formatCurrency(totals.total_revenue || 0)}</span>
				<span class="stat-label">Revenue</span>
			</div>
			<div class="stat-card">
				<span class="stat-value discount-value">{formatCurrency(discountTotals.total_discount || 0)}</span>
				<span class="stat-label">Est. Discount Given</span>
			</div>
		</div>

		{#if totals.first_use}
			<p class="usage-range">
				Used from {formatDate(totals.first_use)} to {formatDate(totals.last_use)}
			</p>
		{/if}

		<!-- Show Breakdown -->
		<div class="section">
			<h2>Breakdown by Show ({showStats.length})</h2>
			{#if showStats.length === 0}
				<p class="empty-state">No ticket purchases linked to this promotion yet.</p>
			{:else}
				<div class="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Show</th>
								<th>Format</th>
								<th class="col-right">Transactions</th>
								<th class="col-right">Tickets</th>
								<th class="col-right">Revenue</th>
								<th class="col-right">Avg/Ticket</th>
								<th class="col-right">Std Price</th>
								<th>First Use</th>
								<th>Last Use</th>
							</tr>
						</thead>
						<tbody>
							{#each showStats as ss (ss.show_code)}
								{@const avgPerTicket = ss.tickets_sold > 0 ? ss.revenue / ss.tickets_sold : 0}
								<tr>
									<td>
										<a href="{base}/shows/{ss.show_code}" class="link">{ss.show_name}</a>
									</td>
									<td class="text-muted">{ss.format || '—'}</td>
									<td class="col-right">{ss.transaction_count}</td>
									<td class="col-right">{ss.tickets_sold}</td>
									<td class="col-right">{formatCurrency(ss.revenue)}</td>
									<td class="col-right">{formatCurrency(avgPerTicket)}</td>
									<td class="col-right">{formatCurrency(ss.standard_ticket_price)}</td>
									<td>{formatDate(ss.first_use)}</td>
									<td>{formatDate(ss.last_use)}</td>
								</tr>
							{/each}
						</tbody>
						<tfoot>
							<tr>
								<td colspan="2" class="total-label">Total</td>
								<td class="col-right total-value">{totals.total_transactions}</td>
								<td class="col-right total-value">{totals.total_tickets}</td>
								<td class="col-right total-value">{formatCurrency(totals.total_revenue)}</td>
								<td colspan="4"></td>
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
	.header-badges { display: flex; gap: 0.5rem; align-items: center; }

	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; }

	.status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }
	.status-badge.ended { background-color: #f3f4f6; color: #6b7280; }

	.type-badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
	.type-flat { background: #dbeafe; color: #1e40af; }
	.type-percentage { background: #fce7f3; color: #9d174d; }
	.type-fixed_price { background: #e0e7ff; color: #4338ca; }
	.type-bogo { background: #fef3c7; color: #92400e; }
	.type-comp { background: #d1fae5; color: #065f46; }
	.type-other { background: #f3f4f6; color: #374151; }

	.info-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); padding: 1.5rem; margin-bottom: 1.5rem; }
	.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem; }
	.info-item { display: flex; flex-direction: column; gap: 0.2rem; }
	.info-label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
	.info-value { font-size: 0.95rem; color: #1a202c; }
	.text-muted { color: #9ca3af; }
	.desc-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #f3f4f6; }
	.desc-text { color: #374151; font-size: 0.9rem; line-height: 1.6; margin: 0.5rem 0 0 0; }

	.linked-shows { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; }
	.show-chip { display: inline-block; padding: 0.25rem 0.75rem; background: #f3f4f6; border-radius: 9999px; font-size: 0.8rem; color: #3b82f6; text-decoration: none; font-weight: 500; transition: background 0.2s; }
	.show-chip:hover { background: #e5e7eb; }
	.class-chip { display: inline-block; padding: 0.25rem 0.75rem; background: #e0e7ff; border-radius: 9999px; font-size: 0.8rem; color: #4338ca; font-weight: 500; }

	.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1rem; }
	.stat-card { background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); text-align: center; display: flex; flex-direction: column; gap: 0.2rem; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }
	.discount-value { color: #dc2626; }

	.usage-range { font-size: 0.85rem; color: #6b7280; margin: 0 0 1.5rem 0; }

	.section { margin-bottom: 2rem; }
	.table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
	td { padding: 0.6rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; font-size: 0.9rem; }
	tr:hover td { background-color: #f9fafb; }
	.col-right { text-align: right; }
	.link { color: #3b82f6; text-decoration: none; font-weight: 500; }
	.link:hover { text-decoration: underline; }
	tfoot td { border-top: 2px solid #e5e7eb; border-bottom: none; padding-top: 0.75rem; }
	.total-label { text-align: right; font-weight: 600; color: #374151; font-size: 0.85rem; }
	.total-value { font-weight: 700; color: #1a202c; }

	.empty-state { text-align: center; padding: 2rem; color: #6b7280; }
	.alert-error { padding: 1rem 1.5rem; background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 0.5rem; margin-bottom: 1rem; }

	@media (max-width: 768px) {
		header { flex-direction: column; gap: 1rem; }
		.stats-row { grid-template-columns: repeat(2, 1fr); }
	}
</style>