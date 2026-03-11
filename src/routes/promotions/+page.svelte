<!-- src/routes/promotions/+page.svelte -->
<script>
	import { resolve } from '$app/paths';

	/** @type {any} */
	export let data;

	let searchQuery = '';
	let sortField = 'promotion_name';
	let sortDirection = 'asc';
	let currentPage = 1;
	let pageSize = 25;
	let showInactive = true;

	/** @param {string} field */
	function toggleSort(field) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
		currentPage = 1;
	}

	/** @param {string} field */
	function sortIndicator(field) {
		if (sortField !== field) return '';
		return sortDirection === 'asc' ? ' ▲' : ' ▼';
	}

	$: filteredPromotions = (data.promotions || []).filter((/** @type {any} */ p) => {
		if (!showInactive && !p.is_active) return false;
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		return (
			(p.promotion_name && p.promotion_name.toLowerCase().includes(q)) ||
			(p.discount_type && p.discount_type.toLowerCase().includes(q))
		);
	});

	$: sortedPromotions = [...filteredPromotions].sort((/** @type {any} */ a, /** @type {any} */ b) => {
		let aVal = a[sortField];
		let bVal = b[sortField];
		if (aVal == null) aVal = '';
		if (bVal == null) bVal = '';
		if (typeof aVal === 'number' && typeof bVal === 'number') {
			return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
		}
		aVal = String(aVal).toLowerCase();
		bVal = String(bVal).toLowerCase();
		return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
	});

	$: totalPages = Math.ceil(sortedPromotions.length / pageSize);
	$: pagedPromotions = sortedPromotions.slice((currentPage - 1) * pageSize, currentPage * pageSize);

	$: { searchQuery; showInactive; currentPage = 1; }

	/** @type {Record<string, string>} */
	const discountTypeLabels = {
		flat: 'Flat $',
		percentage: 'Percentage',
		fixed_price: 'Fixed Price',
		bogo: 'BOGO',
		comp: 'Comp',
		other: 'Other'
	};

	/**
	 * @param {string} type
	 * @param {any} value
	 */
	function formatDiscount(type, value) {
		if (value == null) return '—';
		if (type === 'flat') return `-$${value.toFixed(2)}`;
		if (type === 'percentage') return `-${value}%`;
		if (type === 'fixed_price') return `$${value.toFixed(2)} flat`;
		if (type === 'bogo') return 'BOGO';
		if (type === 'comp') return 'Free';
		return value.toString();
	}

	/** @param {string} dateStr */
	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr + 'T12:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	/** @param {number} amount */
	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	/** @param {any} promo */
	function dateStatus(promo) {
		if (!promo.start_date && !promo.end_date) return 'ongoing';
		const now = new Date().toISOString().split('T')[0];
		if (promo.end_date && promo.end_date < now) return 'ended';
		if (promo.start_date && promo.start_date > now) return 'upcoming';
		return 'active';
	}
</script>

<svelte:head>
	<title>Promotions | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Promotions</h1>
		<div class="header-actions">
			<a href={resolve('/promotions/new')} class="btn-primary">Add Promotion</a>
		</div>
	</header>

	<div class="toolbar">
		<div class="search-group">
			<input
				type="text"
				placeholder="Search by name or type..."
				bind:value={searchQuery}
				class="search-input"
			/>
		</div>
		<div class="toolbar-right">
			<label class="checkbox-label">
				<input type="checkbox" bind:checked={showInactive} />
				Show inactive
			</label>
			<span class="stat">{filteredPromotions.length} promotion{filteredPromotions.length !== 1 ? 's' : ''}</span>
		</div>
	</div>

	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th class="sortable" on:click={() => toggleSort('promotion_name')}>
						Name{sortIndicator('promotion_name')}
					</th>
					<th class="sortable" on:click={() => toggleSort('discount_type')}>
						Type{sortIndicator('discount_type')}
					</th>
					<th>Discount</th>
					<th class="sortable" on:click={() => toggleSort('start_date')}>
						Dates{sortIndicator('start_date')}
					</th>
					<th class="sortable col-right" on:click={() => toggleSort('transaction_count')}>
						Transactions{sortIndicator('transaction_count')}
					</th>
					<th class="sortable col-right" on:click={() => toggleSort('tickets_sold')}>
						Tickets{sortIndicator('tickets_sold')}
					</th>
					<th class="sortable col-right" on:click={() => toggleSort('total_revenue')}>
						Revenue{sortIndicator('total_revenue')}
					</th>
					<th>Status</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if pagedPromotions.length === 0}
					<tr>
						<td colspan="9" class="empty-state">
							{searchQuery ? 'No promotions match your search.' : 'No promotions found. Add your first promotion to get started.'}
						</td>
					</tr>
				{:else}
					{#each pagedPromotions as promo (promo.promotion_id)}
						{@const ds = dateStatus(promo)}
						<tr class:inactive={!promo.is_active}>
							<td class="promo-name">
								<a href={resolve(`/promotions/${promo.promotion_id}`)} class="name-link">{promo.promotion_name}</a>
							</td>
							<td>
								<span class="type-badge type-{promo.discount_type || 'other'}">
									{discountTypeLabels[promo.discount_type] || promo.discount_type || '—'}
								</span>
							</td>
							<td>{formatDiscount(promo.discount_type, promo.discount_value)}</td>
							<td class="date-cell">
								{#if promo.start_date || promo.end_date}
									{formatDate(promo.start_date)} – {formatDate(promo.end_date)}
								{:else}
									<span class="text-muted">Ongoing</span>
								{/if}
							</td>
							<td class="col-right">{promo.transaction_count}</td>
							<td class="col-right">{promo.tickets_sold}</td>
							<td class="col-right">{formatCurrency(promo.total_revenue)}</td>
							<td>
								<span class="status-badge" class:active={promo.is_active && ds !== 'ended'} class:ended={ds === 'ended'} class:upcoming={ds === 'upcoming'}>
									{#if !promo.is_active}Inactive{:else if ds === 'ended'}Ended{:else if ds === 'upcoming'}Upcoming{:else}Active{/if}
								</span>
							</td>
							<td>
								<div class="actions">
									<a href={resolve(`/promotions/${promo.promotion_id}`)} class="btn-action">View</a>
									<a href={resolve(`/promotions/${promo.promotion_id}/edit`)} class="btn-action">Edit</a>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	{#if totalPages > 1}
		<div class="pagination">
			<button class="page-btn" disabled={currentPage === 1} on:click={() => (currentPage = 1)}>«</button>
			<button class="page-btn" disabled={currentPage === 1} on:click={() => currentPage--}>‹</button>
			<span class="page-info">Page {currentPage} of {totalPages}</span>
			<button class="page-btn" disabled={currentPage === totalPages} on:click={() => currentPage++}>›</button>
			<button class="page-btn" disabled={currentPage === totalPages} on:click={() => (currentPage = totalPages)}>»</button>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	.header-actions { display: flex; gap: 0.75rem; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }

	.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
	.search-group { flex: 1; max-width: 400px; }
	.search-input { width: 100%; padding: 0.625rem 1rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; background-color: white; }
	.search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
	.toolbar-right { display: flex; align-items: center; gap: 1.5rem; }
	.checkbox-label { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: #6b7280; cursor: pointer; }
	.checkbox-label input { cursor: pointer; }
	.stat { color: #6b7280; font-size: 0.9rem; font-weight: 500; }

	.table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow-x: auto; margin-bottom: 1.5rem; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
	th.sortable { cursor: pointer; user-select: none; }
	th.sortable:hover { color: #3b82f6; }
	th.col-right, td.col-right { text-align: right; }
	td { padding: 0.625rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; font-size: 0.9rem; }
	tr:hover { background-color: #f9fafb; }
	tr.inactive { opacity: 0.5; }

	.promo-name { font-weight: 500; }
	.name-link { color: #3b82f6; text-decoration: none; font-weight: 500; }
	.name-link:hover { text-decoration: underline; }
	.text-muted { color: #9ca3af; }
	.date-cell { font-size: 0.8rem; white-space: nowrap; }

	.type-badge { display: inline-block; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; }
	.type-flat { background: #dbeafe; color: #1e40af; }
	.type-percentage { background: #fce7f3; color: #9d174d; }
	.type-fixed_price { background: #e0e7ff; color: #4338ca; }
	.type-bogo { background: #fef3c7; color: #92400e; }
	.type-comp { background: #d1fae5; color: #065f46; }
	.type-other { background: #f3f4f6; color: #374151; }

	.status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }
	.status-badge.ended { background-color: #f3f4f6; color: #6b7280; }
	.status-badge.upcoming { background-color: #dbeafe; color: #1e40af; }

	.actions { display: flex; gap: 0.5rem; }
	.btn-action { background-color: #e5e7eb; color: #374151; padding: 0.375rem 0.75rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 500; text-decoration: none; transition: background-color 0.2s; }
	.btn-action:hover { background-color: #d1d5db; }

	.empty-state { text-align: center; padding: 2rem; color: #6b7280; }

	.pagination { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
	.page-btn { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: white; color: #374151; font-weight: 500; cursor: pointer; }
	.page-btn:hover:not(:disabled) { background-color: #f3f4f6; border-color: #3b82f6; }
	.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.page-info { padding: 0.5rem 1rem; color: #374151; font-weight: 500; font-size: 0.9rem; }

	@media (max-width: 768px) {
		header { flex-direction: column; gap: 1rem; align-items: flex-start; }
		.toolbar { flex-direction: column; align-items: stretch; }
		.search-group { max-width: 100%; }
	}
</style>