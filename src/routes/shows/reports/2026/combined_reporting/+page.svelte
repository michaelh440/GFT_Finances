<!-- src/routes/reports/2026/combined_reporting/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Chart from 'chart.js/auto';

	/** @type {any} */
	export let data;

	let mounted = false;
	/** @type {Record<string, Chart>} */
	let charts = {};

	// ---- Filters ----
	let selectedSource = 'all'; // 'all', 'show', 'class'
	let selectedItem = 'all';
	let selectedCategory = 'all';
	/** @type {any[]} */
	let selectedYears = [];
	/** @type {any[]} */
	let availableYears = [];

	// ---- Extract available years ----
	$: {
		const yrs = [...new Set((data.summaries || []).map((/** @type {any} */ s) => s.summary_year))].sort((/** @type {any} */ a, /** @type {any} */ b) => b - a);
		availableYears = yrs;
		if (selectedYears.length === 0 && yrs.length > 0) {
			selectedYears = yrs.slice(0, 4);
		}
	}

	// ---- Filter items for dropdown based on source ----
	$: filteredItemOptions = selectedSource === 'show'
		? data.showItems || []
		: selectedSource === 'class'
			? data.classItems || []
			: [...(data.showItems || []), ...(data.classItems || [])];

	// ---- Categories based on source ----
	$: availableCategories = [...new Set(filteredItemOptions.map((/** @type {any} */ i) => i.category).filter(Boolean))].sort();

	// ---- Apply all filters ----
	$: filteredData = (data.summaries || []).filter((/** @type {any} */ s) => {
		if (selectedSource !== 'all' && s.source_type !== selectedSource) return false;
		if (selectedItem !== 'all' && s.item_code !== selectedItem) return false;
		if (selectedCategory !== 'all' && s.category !== selectedCategory) return false;
		if (selectedYears.length > 0 && !selectedYears.includes(s.summary_year)) return false;
		return true;
	});

	// ---- Summary stats ----
	$: totalRevenue = filteredData.reduce((/** @type {any} */ sum, /** @type {any} */ s) => sum + s.revenue, 0);
	$: totalUnits = filteredData.reduce((/** @type {any} */ sum, /** @type {any} */ s) => sum + s.unit_count, 0);
	$: showRevenue = filteredData.filter((/** @type {any} */ s) => s.source_type === 'show').reduce((/** @type {any} */ sum, /** @type {any} */ s) => sum + s.revenue, 0);
	$: classRevenue = filteredData.filter((/** @type {any} */ s) => s.source_type === 'class').reduce((/** @type {any} */ sum, /** @type {any} */ s) => sum + s.revenue, 0);
	$: uniqueMonths = [...new Set(filteredData.map((/** @type {any} */ s) => s.summary_month?.toString().slice(0, 7)))].length;

	// ---- Monthly aggregation for table ----
	$: monthlyRows = (() => {
		/** @type {Record<string, { month: string, showRevenue: number, showUnits: number, classRevenue: number, classUnits: number }>} */
		const byMonth = {};
		for (const s of filteredData) {
			const key = s.summary_month?.toString().slice(0, 10) || '';
			if (!byMonth[key]) {
				byMonth[key] = { month: key, showRevenue: 0, showUnits: 0, classRevenue: 0, classUnits: 0 };
			}
			if (s.source_type === 'show') {
				byMonth[key].showRevenue += s.revenue;
				byMonth[key].showUnits += s.unit_count;
			} else {
				byMonth[key].classRevenue += s.revenue;
				byMonth[key].classUnits += s.unit_count;
			}
		}
		return Object.values(byMonth).sort((a, b) => b.month.localeCompare(a.month));
	})();

	// ---- Chart data ----
	const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	$: chartDataByYear = (() => {
		/** @type {Record<number, { showRevenue: number[], classRevenue: number[], showUnits: number[], classUnits: number[] }>} */
		const byYear = {};
		for (const yr of selectedYears) {
			byYear[yr] = {
				showRevenue: Array(12).fill(0),
				classRevenue: Array(12).fill(0),
				showUnits: Array(12).fill(0),
				classUnits: Array(12).fill(0)
			};
		}
		for (const s of filteredData) {
			const yr = s.summary_year;
			if (!byYear[yr]) continue;
			const mi = s.summary_month_num - 1;
			if (s.source_type === 'show') {
				byYear[yr].showRevenue[mi] += s.revenue;
				byYear[yr].showUnits[mi] += s.unit_count;
			} else {
				byYear[yr].classRevenue[mi] += s.revenue;
				byYear[yr].classUnits[mi] += s.unit_count;
			}
		}
		return byYear;
	})();

	// ---- Chart colors ----
	const showColor = '#3b82f6';
	const classColor = '#8b5cf6';
	const _showColorLight = '#93c5fd';
	const _classColorLight = '#c4b5fd';

	// ---- Year colors for multi-year charts ----
	const yearColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

	// ---- Render charts ----
	function destroyCharts() {
		Object.values(charts).forEach((c) => c.destroy());
		charts = {};
	}

	function renderCharts() {
		if (!browser || !mounted) return;
		destroyCharts();

		setTimeout(() => {
			// Chart 1: Monthly Revenue by Source (stacked bar for most recent selected year)
			const latestYear = Math.max(...selectedYears);
			const yearData = chartDataByYear[latestYear];
			if (yearData) {
				const ctx1 = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-revenue-by-source'));
				if (ctx1) {
					charts['revenueBySource'] = new Chart(ctx1, {
						type: 'bar',
						data: {
							labels: monthLabels,
							datasets: [
								{
									label: `Shows ${latestYear}`,
									data: yearData.showRevenue,
									backgroundColor: showColor,
									stack: 'stack0'
								},
								{
									label: `Classes ${latestYear}`,
									data: yearData.classRevenue,
									backgroundColor: classColor,
									stack: 'stack0'
								}
							]
						},
						options: {
							responsive: true,
							plugins: { legend: { position: 'top' } },
							scales: {
								x: { stacked: true },
								y: { stacked: true, ticks: { callback: (/** @type {any} */ v) => '$' + Number(v).toLocaleString() } }
							}
						}
					});
				}
			}

			// Chart 2: Monthly Units by Source (stacked)
			if (yearData) {
				const ctx2 = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-units-by-source'));
				if (ctx2) {
					charts['unitsBySource'] = new Chart(ctx2, {
						type: 'bar',
						data: {
							labels: monthLabels,
							datasets: [
								{
									label: `Tickets ${latestYear}`,
									data: yearData.showUnits,
									backgroundColor: showColor,
									stack: 'stack0'
								},
								{
									label: `Registrations ${latestYear}`,
									data: yearData.classUnits,
									backgroundColor: classColor,
									stack: 'stack0'
								}
							]
						},
						options: {
							responsive: true,
							plugins: { legend: { position: 'top' } },
							scales: {
								x: { stacked: true },
								y: { stacked: true }
							}
						}
					});
				}
			}

			// Chart 3: Total Revenue by Year (grouped bar — shows vs classes)
			const ctx3 = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-revenue-by-year'));
			if (ctx3) {
				const sortedYears = [...selectedYears].sort();
				const showTotals = sortedYears.map((yr) => {
					const yd = chartDataByYear[yr];
					return yd ? yd.showRevenue.reduce((a, b) => a + b, 0) : 0;
				});
				const classTotals = sortedYears.map((yr) => {
					const yd = chartDataByYear[yr];
					return yd ? yd.classRevenue.reduce((a, b) => a + b, 0) : 0;
				});

				charts['revenueByYear'] = new Chart(ctx3, {
					type: 'bar',
					data: {
						labels: sortedYears.map(String),
						datasets: [
							{ label: 'Shows', data: showTotals, backgroundColor: showColor },
							{ label: 'Classes', data: classTotals, backgroundColor: classColor }
						]
					},
					options: {
						responsive: true,
						plugins: { legend: { position: 'top' } },
						scales: { y: { ticks: { callback: (/** @type {any} */ v) => '$' + Number(v).toLocaleString() } } }
					}
				});
			}

			// Chart 4: YTD Cumulative Revenue Comparison
			const ctx4 = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-ytd-revenue'));
			if (ctx4) {
				const sortedYears = [...selectedYears].sort();
				/** @type {any[]} */
				const datasets = sortedYears.map((yr, i) => {
					const yd = chartDataByYear[yr];
					if (!yd) return null;
					const totalByMonth = yd.showRevenue.map((/** @type {number} */ s, /** @type {number} */ mi) => s + yd.classRevenue[mi]);
					/** @type {number[]} */
					const cumulative = [];
					let sum = 0;
					for (const v of totalByMonth) {
						sum += v;
						cumulative.push(sum);
					}
					return {
						label: String(yr),
						data: cumulative,
						borderColor: yearColors[i % yearColors.length],
						backgroundColor: 'transparent',
						borderWidth: 2,
						tension: 0.3,
						pointRadius: 3
					};
				}).filter(Boolean);

				charts['ytdRevenue'] = new Chart(ctx4, {
					type: 'line',
					data: { labels: monthLabels, datasets },
					options: {
						responsive: true,
						plugins: { legend: { position: 'top' } },
						scales: { y: { ticks: { callback: (/** @type {any} */ v) => '$' + Number(v).toLocaleString() } } }
					}
				});
			}

			// Chart 5: Revenue split pie (shows vs classes for all filtered data)
			const ctx5 = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-revenue-split'));
			if (ctx5 && totalRevenue > 0) {
				charts['revenueSplit'] = new Chart(ctx5, {
					type: 'doughnut',
					data: {
						labels: ['Shows', 'Classes'],
						datasets: [{
							data: [showRevenue, classRevenue],
							backgroundColor: [showColor, classColor]
						}]
					},
					options: {
						responsive: true,
						plugins: {
							legend: { position: 'bottom' },
							tooltip: {
								callbacks: {
									label: (/** @type {any} */ ctx) => {
										const val = ctx.parsed;
										const pct = ((val / totalRevenue) * 100).toFixed(1);
										return `${ctx.label}: $${val.toLocaleString()} (${pct}%)`;
									}
								}
							}
						}
					}
				});
			}
		}, 100);
	}

	// Re-render on data changes
	$: if (mounted && filteredData) {
		renderCharts();
	}

	onMount(() => {
		mounted = true;
		renderCharts();
	});

	onDestroy(() => {
		destroyCharts();
	});

	// ---- Helpers ----
	/** @param {any} amount */
	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	/** @param {any} dateStr */
	function formatMonth(dateStr) {
		if (!dateStr) return '—';
		const str = typeof dateStr === 'string' ? dateStr : dateStr.toISOString().split('T')[0];
		const d = new Date(str + 'T12:00:00');
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	/** @param {any} yr */
	function toggleYear(yr) {
		if (selectedYears.includes(yr)) {
			selectedYears = selectedYears.filter((y) => y !== yr);
		} else {
			selectedYears = [...selectedYears, yr];
		}
	}

	function resetFilters() {
		selectedSource = 'all';
		selectedItem = 'all';
		selectedCategory = 'all';
		selectedYears = availableYears.slice(0, 4);
	}
</script>

<svelte:head>
	<title>Combined Reporting | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve(/** @type {any} */ ('/reports/2026'))} class="back-link">← Back to Reports</a>
			<h1>Combined Financial Report</h1>
			<p class="subtitle">Shows + Classes combined monthly performance</p>
		</div>
	</header>

	<!-- Filters -->
	<div class="filter-section">
		<div class="filter-row">
			<div class="filter-group">
				<label for="source-filter">Source</label>
				<select id="source-filter" bind:value={selectedSource} on:change={() => { selectedItem = 'all'; selectedCategory = 'all'; }}>
					<option value="all">All Sources</option>
					<option value="show">Shows Only</option>
					<option value="class">Classes Only</option>
				</select>
			</div>
			<div class="filter-group">
				<label for="category-filter">
					{selectedSource === 'class' ? 'Track' : selectedSource === 'show' ? 'Format' : 'Category'}
				</label>
				<select id="category-filter" bind:value={selectedCategory}>
					<option value="all">All</option>
					{#each availableCategories as cat (cat)}
						<option value={cat}>{cat}</option>
					{/each}
				</select>
			</div>
			<div class="filter-group">
				<label for="item-filter">
					{selectedSource === 'class' ? 'Class' : selectedSource === 'show' ? 'Show' : 'Item'}
				</label>
				<select id="item-filter" bind:value={selectedItem}>
					<option value="all">All</option>
					{#each filteredItemOptions as item (item.item_code)}
						<option value={item.item_code}>{item.item_name}</option>
					{/each}
				</select>
			</div>
			<button class="btn-reset" on:click={resetFilters}>Reset</button>
		</div>

		<div class="filter-divider"></div>

		<div class="year-checkboxes">
			<span class="year-label">Years:</span>
			{#each availableYears as yr (yr)}
				<label class="year-checkbox">
					<input type="checkbox" checked={selectedYears.includes(yr)} on:change={() => toggleYear(yr)} />
					{yr}
				</label>
			{/each}
		</div>
	</div>

	<!-- Summary Stats -->
	<div class="stats-row">
		<div class="stat-card">
			<span class="stat-value">{formatCurrency(totalRevenue)}</span>
			<span class="stat-label">Total Revenue</span>
		</div>
		<div class="stat-card stat-show">
			<span class="stat-value">{formatCurrency(showRevenue)}</span>
			<span class="stat-label">Show Revenue</span>
		</div>
		<div class="stat-card stat-class">
			<span class="stat-value">{formatCurrency(classRevenue)}</span>
			<span class="stat-label">Class Revenue</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{totalUnits.toLocaleString()}</span>
			<span class="stat-label">Tickets + Registrations</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{uniqueMonths}</span>
			<span class="stat-label">Months of Data</span>
		</div>
	</div>

	<!-- Charts -->
	{#if browser && mounted}
		<div class="charts-grid">
			<div class="chart-card wide">
				<h3>Monthly Revenue by Source ({Math.max(...selectedYears)})</h3>
				<canvas id="chart-revenue-by-source"></canvas>
			</div>
			<div class="chart-card wide">
				<h3>Monthly Tickets & Registrations ({Math.max(...selectedYears)})</h3>
				<canvas id="chart-units-by-source"></canvas>
			</div>
			<div class="chart-card">
				<h3>Annual Revenue by Source</h3>
				<canvas id="chart-revenue-by-year"></canvas>
			</div>
			<div class="chart-card">
				<h3>Revenue Split</h3>
				<canvas id="chart-revenue-split"></canvas>
			</div>
			<div class="chart-card wide">
				<h3>YTD Cumulative Revenue</h3>
				<canvas id="chart-ytd-revenue"></canvas>
			</div>
		</div>
	{/if}

	<!-- Monthly Detail Table -->
	<div class="section">
		<h2>Monthly Breakdown</h2>
		{#if monthlyRows.length === 0}
			<p class="empty-state">No data for the selected filters.</p>
		{:else}
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th>Month</th>
							<th class="col-right">Show Tickets</th>
							<th class="col-right">Show Revenue</th>
							<th class="col-right">Class Regs</th>
							<th class="col-right">Class Revenue</th>
							<th class="col-right">Total Revenue</th>
						</tr>
					</thead>
					<tbody>
						{#each monthlyRows as row (row.month)}
							<tr>
								<td>{formatMonth(row.month)}</td>
								<td class="col-right">{row.showUnits.toLocaleString()}</td>
								<td class="col-right">{formatCurrency(row.showRevenue)}</td>
								<td class="col-right">{row.classUnits.toLocaleString()}</td>
								<td class="col-right">{formatCurrency(row.classRevenue)}</td>
								<td class="col-right total-cell">{formatCurrency(row.showRevenue + row.classRevenue)}</td>
							</tr>
						{/each}
					</tbody>
					<tfoot>
						<tr>
							<td class="total-label">Total</td>
							<td class="col-right total-value">{filteredData.filter((/** @type {any} */ s) => s.source_type === 'show').reduce((/** @type {any} */ sum, /** @type {any} */ s) => sum + s.unit_count, 0).toLocaleString()}</td>
							<td class="col-right total-value">{formatCurrency(showRevenue)}</td>
							<td class="col-right total-value">{filteredData.filter((/** @type {any} */ s) => s.source_type === 'class').reduce((/** @type {any} */ sum, /** @type {any} */ s) => sum + s.unit_count, 0).toLocaleString()}</td>
							<td class="col-right total-value">{formatCurrency(classRevenue)}</td>
							<td class="col-right total-value">{formatCurrency(totalRevenue)}</td>
						</tr>
					</tfoot>
				</table>
			</div>
		{/if}
	</div>
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }

	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1.25rem; font-weight: 600; color: #1a202c; margin: 0 0 1rem 0; }
	h3 { font-size: 1rem; font-weight: 600; color: #374151; margin: 0 0 0.75rem 0; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; }

	/* Filters */
	.filter-section {
		background: white;
		padding: 1.25rem 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
		margin-bottom: 1.5rem;
	}
	.filter-row {
		display: flex;
		gap: 1rem;
		align-items: flex-end;
		flex-wrap: wrap;
	}
	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		min-width: 160px;
	}
	.filter-group label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.filter-group select {
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.9rem;
		background: white;
	}
	.filter-group select:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
	}
	.btn-reset {
		padding: 0.5rem 1rem;
		background: #f3f4f6;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.85rem;
		color: #6b7280;
		cursor: pointer;
		transition: background 0.2s;
	}
	.btn-reset:hover { background: #e5e7eb; }
	.filter-divider {
		height: 1px;
		background: #e5e7eb;
		margin: 1rem 0;
	}
	.year-checkboxes {
		display: flex;
		gap: 1rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.year-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.year-checkbox {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.9rem;
		color: #374151;
		cursor: pointer;
	}
	.year-checkbox input { cursor: pointer; }

	/* Stats */
	.stats-row {
		display: grid;
		grid-template-columns: repeat(5, 1fr);
		gap: 1rem;
		margin-bottom: 2rem;
	}
	.stat-card {
		background: white;
		padding: 1.25rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
		text-align: center;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.stat-card.stat-show { border-top: 3px solid #3b82f6; }
	.stat-card.stat-class { border-top: 3px solid #8b5cf6; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	/* Charts */
	.charts-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
		margin-bottom: 2rem;
	}
	.chart-card {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
	}
	.chart-card.wide {
		grid-column: 1 / -1;
	}

	/* Table */
	.section {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0,0,0,0.1);
	}
	.table-wrapper { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
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
		padding: 0.6rem 1rem;
		border-bottom: 1px solid #f3f4f6;
		color: #1a202c;
		font-size: 0.9rem;
	}
	tr:last-child td { border-bottom: none; }
	tr:hover { background-color: #f9fafb; }
	.col-right { text-align: right; }
	.total-cell { font-weight: 600; }
	tfoot td {
		border-top: 2px solid #e5e7eb;
		border-bottom: none;
		padding-top: 0.75rem;
	}
	.total-label { font-weight: 600; color: #374151; }
	.total-value { font-weight: 700; color: #1a202c; }
	.empty-state { text-align: center; padding: 2rem; color: #6b7280; }

	@media (max-width: 768px) {
		.stats-row { grid-template-columns: repeat(2, 1fr); }
		.charts-grid { grid-template-columns: 1fr; }
		.chart-card.wide { grid-column: 1; }
		.filter-row { flex-direction: column; }
		.filter-group { min-width: 100%; }
	}
</style>