<!-- src/routes/shows/patrons/zip_analytics/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import { SvelteURLSearchParams } from 'svelte/reactivity';
	import Chart from 'chart.js/auto';

	/** @type {any} */
	export let data;

	let showCode = '';
	let year = '';
	/** @type {any} */
	let chart;
	let mounted = false;
	let showAll = false;

	// Keep filter values in sync with data (re-runs on SvelteKit navigation)
	$: showCode = data.filters?.showCode || '';
	$: year = data.filters?.year || '';

	$: hasFilters = data.filters?.showCode || data.filters?.year;

	// Group shows by format
	$: showsByFormat = (data.shows || []).reduce((/** @type {Record<string, any[]>} */ acc, /** @type {any} */ s) => {
		const fmt = s.format || 'Other';
		if (!acc[fmt]) acc[fmt] = [];
		acc[fmt].push(s);
		return acc;
	}, /** @type {Record<string, any[]>} */ ({}));
	$: formats = Object.keys(showsByFormat).sort();

	// Chart data: top N zip codes by patron count
	$: chartZips = (data.zipData || []).filter((/** @type {any} */ z) => z.zip_code !== 'Unknown');
	$: displayZips = showAll ? chartZips : chartZips.slice(0, 25);
	$: _unknownEntry = (data.zipData || []).find((/** @type {any} */ z) => z.zip_code === 'Unknown');

	// Totals
	$: totalPatrons = (data.zipData || []).reduce((/** @type {number} */ sum, /** @type {any} */ z) => sum + z.patron_count, 0);
	$: totalTickets = (data.zipData || []).reduce((/** @type {number} */ sum, /** @type {any} */ z) => sum + z.tickets_sold, 0);
	$: totalRevenue = (data.zipData || []).reduce((/** @type {number} */ sum, /** @type {any} */ z) => sum + z.revenue, 0);
	$: totalTransactions = (data.zipData || []).reduce((/** @type {number} */ sum, /** @type {any} */ z) => sum + z.transaction_count, 0);

	onMount(() => { mounted = true; });
	onDestroy(() => { if (chart) chart.destroy(); });

	// Re-render chart when data changes
	$: if (browser && mounted && displayZips.length > 0) {
		renderChart(displayZips);
	}

	/** @param {any[]} zips */
	function renderChart(zips) {
		// Wait for canvas to exist
		setTimeout(() => {
			const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('zip-chart'));
			if (!canvas) return;

			if (chart) chart.destroy();

			const labels = zips.map((/** @type {any} */ z) => {
				const loc = z.city ? `${z.zip_code} (${z.city})` : z.zip_code;
				return loc;
			});
			const patronCounts = zips.map((/** @type {any} */ z) => z.patron_count);
			const ticketCounts = zips.map((/** @type {any} */ z) => z.tickets_sold);

			const canvasHeight = Math.max(400, zips.length * 28);
			if (canvas.parentElement) canvas.parentElement.style.height = canvasHeight + 'px';

			chart = new Chart(canvas, {
				type: 'bar',
				data: {
					labels,
					datasets: [
						{
							label: 'Unique Patrons',
							data: patronCounts,
							backgroundColor: 'rgba(59, 130, 246, 0.8)',
							borderRadius: 3
						},
						{
							label: 'Tickets Sold',
							data: ticketCounts,
							backgroundColor: 'rgba(16, 185, 129, 0.6)',
							borderRadius: 3
						}
					]
				},
				options: {
					indexAxis: 'y',
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						tooltip: {
							callbacks: {
								afterBody: function (/** @type {any} */ context) {
									const idx = context[0].dataIndex;
									const z = zips[idx];
									return `Revenue: $${z.revenue.toLocaleString()}`;
								}
							}
						}
					},
					scales: {
						x: {
							beginAtZero: true,
							title: { display: true, text: 'Count' },
							ticks: { precision: 0 }
						},
						y: {
							ticks: { font: { size: 11 } }
						}
					}
				}
			});
		}, 100);
	}

	function applyFilters() {
		const params = new SvelteURLSearchParams();
		if (showCode) params.set('show', showCode);
		if (year) params.set('year', year);
		const qs = params.toString();
		goto(resolve(`/shows/patrons/zip_analytics${qs ? '?' + qs : ''}`), { invalidateAll: true });
	}

	function clearFilters() {
		goto(resolve('/shows/patrons/zip_analytics'), { invalidateAll: true });
	}

	/** @param {number} amount */
	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}
</script>

<svelte:head>
	<title>Zip Code Analytics | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/shows/patrons')} class="breadcrumb">← Back to Patrons</a>
			<h1>Zip Code Analytics</h1>
			<p class="subtitle">Where your ticket buyers come from</p>
		</div>
		<div class="header-actions">
			<a href={resolve('/shows/patrons/update_patrons')} class="btn-secondary-link">Update Patron Data</a>
		</div>
	</header>

	<!-- Stats -->
	<div class="stats-row">
		<div class="stat-card">
			<span class="stat-value">{data.stats.total_patrons.toLocaleString()}</span>
			<span class="stat-label">Patrons</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{data.stats.patrons_with_zip.toLocaleString()}</span>
			<span class="stat-label">With Zip Code</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{data.stats.unique_zips}</span>
			<span class="stat-label">Unique Zip Codes</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{totalTickets.toLocaleString()}</span>
			<span class="stat-label">Tickets Sold</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{formatCurrency(totalRevenue)}</span>
			<span class="stat-label">Revenue</span>
		</div>
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
				<select id="filterShow" bind:value={showCode} on:change={applyFilters}>
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
				<select id="filterYear" bind:value={year} on:change={applyFilters}>
					<option value="">All Years</option>
					{#each data.years as y (y)}
						<option value={y.toString()}>{y}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	{#if (data.zipData || []).length === 0}
		<div class="card">
			<p class="empty-state">
				No zip code data available yet. <a href={resolve('/shows/patrons/update_patrons')}>Upload patron address data</a> to see analytics.
			</p>
		</div>
	{:else}
		<!-- Chart -->
		<div class="card">
			<div class="card-header">
				<h2>Patrons & Tickets by Zip Code{showAll ? '' : ' (Top 25)'}</h2>
				{#if chartZips.length > 25}
					<button class="btn-toggle" on:click={() => { showAll = !showAll; }}>
						{showAll ? 'Show Top 25' : `Show All ${chartZips.length}`}
					</button>
				{/if}
			</div>
			<div class="chart-container">
				<canvas id="zip-chart"></canvas>
			</div>
		</div>

		<!-- Data Table -->
		<div class="card">
			<h2>Zip Code Breakdown</h2>
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th>Zip Code</th>
							<th>City</th>
							<th>State</th>
							<th class="col-right">Patrons</th>
							<th class="col-right">Transactions</th>
							<th class="col-right">Tickets</th>
							<th class="col-right">Revenue</th>
							<th class="col-right">Avg/Patron</th>
						</tr>
					</thead>
					<tbody>
						{#each (data.zipData || []) as z, i (z.zip_code + z.city)}
							<tr class:unknown={z.zip_code === 'Unknown'}>
								<td class="zip-cell">
									{z.zip_code}
									{#if z.zip_code !== 'Unknown'}
										<span class="rank">#{i + 1}</span>
									{/if}
								</td>
								<td>{z.city || '—'}</td>
								<td>{z.state || '—'}</td>
								<td class="col-right">{z.patron_count}</td>
								<td class="col-right">{z.transaction_count}</td>
								<td class="col-right">{z.tickets_sold}</td>
								<td class="col-right">{formatCurrency(z.revenue)}</td>
								<td class="col-right">{z.patron_count > 0 ? formatCurrency(z.revenue / z.patron_count) : '—'}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td colspan="3" class="total-label">Total</td>
							<td class="col-right total-value">{totalPatrons}</td>
							<td class="col-right total-value">{totalTransactions}</td>
							<td class="col-right total-value">{totalTickets}</td>
							<td class="col-right total-value">{formatCurrency(totalRevenue)}</td>
							<td></td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
	.breadcrumb { color: #3b82f6; text-decoration: none; font-size: 0.85rem; }
	.breadcrumb:hover { text-decoration: underline; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0.5rem 0 0 0; }
	h2 { font-size: 1.1rem; font-weight: 600; color: #374151; margin: 0; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; font-size: 0.9rem; }
	.header-actions { padding-top: 1.5rem; }

	.btn-secondary-link { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; }
	.btn-secondary-link:hover { background-color: #d1d5db; }

	.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
	.stat-card { background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.2rem; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }

	.filter-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
	.filter-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
	.btn-clear { background: none; border: none; color: #3b82f6; font-size: 0.85rem; cursor: pointer; }
	.btn-clear:hover { text-decoration: underline; }
	.filter-grid { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
	.filter-group { display: flex; flex-direction: column; gap: 0.3rem; min-width: 180px; }
	.filter-group label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
	.filter-group select { padding: 0.5rem 0.6rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; color: #1a202c; background: white; }
	.filter-group select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

	.card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
	.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
	.btn-toggle { background: none; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.35rem 0.75rem; font-size: 0.8rem; color: #3b82f6; cursor: pointer; }
	.btn-toggle:hover { background: #f3f4f6; }

	.chart-container { position: relative; height: 600px; }

	.table-wrapper { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.6rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
	td { padding: 0.5rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; font-size: 0.85rem; }
	tr:hover td { background-color: #f9fafb; }
	tr.unknown td { color: #9ca3af; font-style: italic; }
	.col-right { text-align: right; }

	.zip-cell { font-weight: 600; font-family: monospace; }
	.rank { font-size: 0.7rem; color: #9ca3af; font-weight: 400; margin-left: 0.35rem; font-family: sans-serif; }

	tfoot td { border-top: 2px solid #e5e7eb; border-bottom: none; padding-top: 0.75rem; }
	.total-label { text-align: right; font-weight: 600; color: #374151; font-size: 0.85rem; }
	.total-value { font-weight: 700; color: #1a202c; font-size: 0.85rem; }

	.empty-state { text-align: center; color: #6b7280; padding: 2rem; }
	.empty-state a { color: #3b82f6; }

	@media (max-width: 768px) {
		header { flex-direction: column; gap: 1rem; }
		.filter-grid { flex-direction: column; }
		.filter-group { min-width: 100%; }
	}
</style>