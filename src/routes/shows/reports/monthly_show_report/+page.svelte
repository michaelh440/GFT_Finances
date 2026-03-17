<!-- src/routes/shows/reports/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Chart from 'chart.js/auto';

	/** @type {{ summaries: any[], shows: any[] }} */
	export let data;

	let mounted = false;
	/** @type {Record<string, any>} */
	let charts = {};

	// ---- Filters ----
	let dateStart = '';
	let dateEnd = '';
	/** @type {any[]} */
	let availableYears = [];
	/** @type {any[]} */
	let selectedYears = [];
	/** @type {any[]} */
	let selectedShows = [];
	let showFilterOpen = false;

	const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	const yearColors = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316'];

	// Default date range: Jan of current year to current month
	$: if (!dateStart && !dateEnd && data.summaries?.length > 0) {
		const now = new Date();
		dateStart = `${now.getFullYear()}-01`;
		dateEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	}

	// Extract available years
	$: {
		const yrs = [...new Set((data.summaries || []).map((/** @type {any} */ s) => s.summary_year))].sort((/** @type {any} */ a, /** @type {any} */ b) => b - a);
		availableYears = yrs;
		if (selectedYears.length === 0 && yrs.length > 0) {
			const startYr = dateStart ? parseInt(dateStart.split('-')[0]) : yrs[0];
			selectedYears = yrs.filter((y) => y >= startYr - 1 && y <= startYr).slice(0, 3);
			if (selectedYears.length === 0) selectedYears = yrs.slice(0, 2);
		}
	}

	// ---- Month slot sequence from date range ----
	$: monthSlots = (() => {
		if (!dateStart || !dateEnd) return [];
		const [sy, sm] = dateStart.split('-').map(Number);
		const [ey, em] = dateEnd.split('-').map(Number);
		const slots = [];
		let y = sy, m = sm;
		while (y < ey || (y === ey && m <= em)) {
			slots.push({ year: y, month: m });
			m++;
			if (m > 12) { m = 1; y++; }
		}
		return slots;
	})();

	$: rangeLabels = monthSlots.map((s) => monthNames[s.month - 1]);
	$: primaryEndYear = monthSlots.length > 0 ? monthSlots[monthSlots.length - 1].year : new Date().getFullYear();

	// ---- Show filter ----
	$: showsByFormat = (data.shows || []).reduce((acc, s) => {
		const fmt = s.format || 'Other';
		if (!acc[fmt]) acc[fmt] = [];
		acc[fmt].push(s);
		return acc;
	}, {});
	$: formats = Object.keys(showsByFormat).sort();
	$: allShowCodes = (data.shows || []).map((s) => s.show_code);
	$: effectiveShows = selectedShows.length === 0 ? allShowCodes : selectedShows;

	$: showFilterLabel = selectedShows.length === 0
		? 'All Shows'
		: selectedShows.length === 1
			? (data.shows || []).find((s) => s.show_code === selectedShows[0])?.show_name || '1 show'
			: `${selectedShows.length} shows`;

	/** @param {any} code */
	function toggleShow(code) {
		if (selectedShows.includes(code)) selectedShows = selectedShows.filter((c) => c !== code);
		else selectedShows = [...selectedShows, code];
	}
	function selectAllShows() { selectedShows = []; }
	function clearAllShows() { selectedShows = [allShowCodes[0] || '']; }

	// ---- Filter data with year overlay ----
	$: filteredData = (() => {
		if (monthSlots.length === 0) return [];
		const result = [];
		for (const s of (data.summaries || [])) {
			if (!effectiveShows.includes(s.show_code)) continue;
			for (const yr of selectedYears) {
				const yearOffset = yr - primaryEndYear;
				for (let i = 0; i < monthSlots.length; i++) {
					const slot = monthSlots[i];
					const shiftedYear = slot.year + yearOffset;
					if (s.summary_year === shiftedYear && s.summary_month_num === slot.month) {
						result.push({ ...s, _overlayYear: yr, _slotIndex: i });
					}
				}
			}
		}
		return result;
	})();

	// ---- Summary Stats ----
	$: totalRevenue = filteredData.reduce((sum, s) => sum + s.revenue, 0);
	$: totalTickets = filteredData.reduce((sum, s) => sum + s.unit_count, 0);
	$: uniqueShowCount = [...new Set(filteredData.map((s) => s.show_code))].length;
	$: uniqueMonths = [...new Set(filteredData.map((s) => s.summary_month))].length;

	// ---- Build overlay year data ----
	/** @param {any} dataSlice */
	function buildOverlayData(dataSlice) {
		/** @type {Record<string, any>} */
		const byYear = {};
		for (const yr of selectedYears) {
			byYear[yr] = { revenue: Array(monthSlots.length).fill(0), units: Array(monthSlots.length).fill(0) };
		}
		for (const s of dataSlice) {
			if (!byYear[s._overlayYear]) continue;
			byYear[s._overlayYear].revenue[s._slotIndex] += s.revenue;
			byYear[s._overlayYear].units[s._slotIndex] += s.unit_count;
		}
		return byYear;
	}

	// ---- Per-show totals ----
	$: showBreakdown = (() => {
		/** @type {Record<string, any>} */
		const byShow = {};
		for (const s of filteredData) {
			if (!byShow[s.show_code]) byShow[s.show_code] = { code: s.show_code, name: s.show_name, format: s.format, revenue: 0, units: 0 };
			byShow[s.show_code].revenue += s.revenue;
			byShow[s.show_code].units += s.unit_count;
		}
		return Object.values(byShow).sort((a, b) => b.revenue - a.revenue);
	})();

	$: perShowOverlayData = (() => {
		/** @type {Record<string, any>} */
		const result = {};
		for (const show of showBreakdown) {
			result[show.code] = buildOverlayData(filteredData.filter((s) => s.show_code === show.code));
		}
		return result;
	})();

	// ---- Chart rendering ----
	function destroyCharts() { Object.values(charts).forEach((/** @type {any} */ c) => c.destroy()); charts = {}; }
	/**
	 * @param {string} id
	 * @param {any} config
	 */
	function rc(id, config) {
		const ctx = /** @type {HTMLCanvasElement} */ (document.getElementById(id));
		if (!ctx) return;
		if (charts[id]) charts[id].destroy();
		charts[id] = new Chart(ctx, config);
	}
	/** @param {any} v */
	function dollarTick(v) { return '$' + Number(v).toLocaleString(); }

	/**
	 * @param {any} overlayData
	 * @param {any} metric
	 * @param {string} [chartType]
	 */
	function yearDatasets(overlayData, metric, chartType = 'bar') {
		return selectedYears.map((/** @type {any} */ yr, /** @type {number} */ i) => {
			const d = overlayData[yr]?.[metric] || [];
			if (chartType === 'line') {
				const cum = []; let sum = 0;
				for (const v of d) { sum += v; cum.push(sum); }
				return { label: String(yr), data: cum, borderColor: yearColors[i % yearColors.length], backgroundColor: 'transparent', borderWidth: 2, tension: 0.3, pointRadius: 3 };
			}
			return { label: String(yr), data: d, backgroundColor: yearColors[i % yearColors.length] };
		});
	}

	function renderAllCharts() {
		if (!browser || !mounted || monthSlots.length === 0 || selectedYears.length === 0) return;
		destroyCharts();

		setTimeout(() => {
			const allOverlay = buildOverlayData(filteredData);

			// 1. Revenue
			rc('chart-revenue', {
				type: 'bar', data: { labels: rangeLabels, datasets: yearDatasets(allOverlay, 'revenue') },
				options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: dollarTick } } } }
			});

			// 2. Revenue Yearly Tracking (cumulative)
			rc('chart-revenue-ytd', {
				type: 'line', data: { labels: rangeLabels, datasets: yearDatasets(allOverlay, 'revenue', 'line') },
				options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: dollarTick } } } }
			});

			// 3. Revenue by Show
			if (showBreakdown.length > 0) {
				const top = showBreakdown.slice(0, 20);
				rc('chart-revenue-by-show', {
					type: 'bar', data: { labels: top.map((s) => s.name), datasets: [{ label: 'Revenue', data: top.map((s) => s.revenue), backgroundColor: '#3b82f6' }] },
					options: { responsive: true, animation: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: dollarTick } } } }
				});
			}

			// 4. Tickets Sold
			rc('chart-tickets', {
				type: 'bar', data: { labels: rangeLabels, datasets: yearDatasets(allOverlay, 'units') },
				options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } } }
			});

			// 5. Tickets Yearly Tracking (cumulative)
			rc('chart-tickets-ytd', {
				type: 'line', data: { labels: rangeLabels, datasets: yearDatasets(allOverlay, 'units', 'line') },
				options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } } }
			});

			// 6. Tickets by Show
			if (showBreakdown.length > 0) {
				const top = showBreakdown.slice(0, 20);
				rc('chart-tickets-by-show', {
					type: 'bar', data: { labels: top.map((s) => s.name), datasets: [{ label: 'Tickets Sold', data: top.map((s) => s.units), backgroundColor: '#10b981' }] },
					options: { responsive: true, animation: false, indexAxis: 'y', plugins: { legend: { display: false } } }
				});
			}

			// 7 & 8. Per-show charts
			for (const show of showBreakdown) {
				const od = perShowOverlayData[show.code];
				if (!od) continue;
				rc(`show-revenue-${show.code}`, {
					type: 'bar', data: { labels: rangeLabels, datasets: yearDatasets(od, 'revenue') },
					options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: dollarTick } } } }
				});
				rc(`show-tickets-${show.code}`, {
					type: 'bar', data: { labels: rangeLabels, datasets: yearDatasets(od, 'units') },
					options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } } }
				});
			}
		}, 150);
	}

	$: if (mounted && monthSlots.length > 0 && selectedYears.length > 0 && effectiveShows) renderAllCharts();
	onMount(() => { mounted = true; });
	onDestroy(() => { destroyCharts(); });

	/** @param {any} yr */
	function toggleYear(yr) {
		if (selectedYears.includes(yr)) {
			if (selectedYears.length > 1) selectedYears = selectedYears.filter((y) => y !== yr);
		} else selectedYears = [...selectedYears, yr].sort((a, b) => b - a);
	}

	/** @param {any} a */
	function formatCurrency(a) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(a); }

	$: dateRangeLabel = (() => {
		if (!dateStart || !dateEnd) return '';
		const s = new Date(dateStart + '-01T12:00:00');
		const e = new Date(dateEnd + '-01T12:00:00');
		return `${s.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
	})();
</script>

<svelte:head>
	<title>Show Reports | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href="{base}/shows" class="back-link">← Back to Shows</a>
			<h1>Show Reports</h1>
			<p class="subtitle">Revenue and ticket sales analytics for live shows</p>
		</div>
	</header>

	<!-- Filters -->
	<div class="filter-section">
		<div class="filter-row">
			<div class="filter-group">
				<label for="ds">From</label>
				<input type="month" id="ds" bind:value={dateStart} />
			</div>
			<div class="filter-group">
				<label for="de">To</label>
				<input type="month" id="de" bind:value={dateEnd} />
			</div>
			<div class="filter-group filter-show-group">
				<label>Shows</label>
				<button class="show-filter-btn" on:click={() => showFilterOpen = !showFilterOpen}>
					{showFilterLabel}
					<span class="caret">{showFilterOpen ? '▲' : '▼'}</span>
				</button>
				{#if showFilterOpen}
					<div class="show-filter-dropdown">
						<div class="show-filter-actions">
							<button class="btn-link" on:click={selectAllShows}>All Shows</button>
							<button class="btn-link" on:click={clearAllShows}>Clear</button>
						</div>
						{#each formats as fmt}
							<div class="show-filter-format">{fmt}</div>
							{#each showsByFormat[fmt] as show}
								<label class="show-filter-item">
									<input type="checkbox"
										checked={selectedShows.length === 0 || selectedShows.includes(show.show_code)}
										on:change={() => { if (selectedShows.length === 0) selectedShows = allShowCodes.filter(c => c !== show.show_code); else toggleShow(show.show_code); }} />
									<span class="show-code-tag">{show.show_code}</span>
									{show.show_name}
								</label>
							{/each}
						{/each}
					</div>
				{/if}
			</div>
		</div>
		<div class="filter-divider"></div>
		<div class="year-checkboxes">
			<span class="year-label">Compare Years:</span>
			{#each availableYears as yr}
				<label class="year-checkbox">
					<input type="checkbox" checked={selectedYears.includes(yr)} on:change={() => toggleYear(yr)} />
					{yr}
				</label>
			{/each}
		</div>
	</div>

	{#if filteredData.length > 0 && browser && mounted}
		<div class="stats-row">
			<div class="stat-card stat-primary"><span class="stat-value">{formatCurrency(totalRevenue)}</span><span class="stat-label">Revenue</span></div>
			<div class="stat-card"><span class="stat-value">{totalTickets.toLocaleString()}</span><span class="stat-label">Tickets Sold</span></div>
			<div class="stat-card"><span class="stat-value">{uniqueShowCount}</span><span class="stat-label">Unique Shows</span></div>
			<div class="stat-card"><span class="stat-value">{uniqueMonths}</span><span class="stat-label">Months of Data</span></div>
		</div>

		<!-- ============ REVENUE SECTION ============ -->
		<div class="report-section">
			<div class="section-header"><h2>Revenue</h2><span class="section-range">{dateRangeLabel} · {selectedYears.join(', ')}</span></div>
			<div class="charts-grid">
				<div class="chart-card"><h3>Monthly Revenue</h3><canvas id="chart-revenue"></canvas></div>
				<div class="chart-card"><h3>Revenue Yearly Tracking (Cumulative)</h3><canvas id="chart-revenue-ytd"></canvas></div>
				<div class="chart-card wide"><h3>Revenue by Show</h3><canvas id="chart-revenue-by-show"></canvas></div>
			</div>
		</div>

		<!-- ============ TICKETS SECTION ============ -->
		<div class="report-section">
			<div class="section-header"><h2>Tickets Sold</h2><span class="section-range">{dateRangeLabel} · {selectedYears.join(', ')}</span></div>
			<div class="charts-grid">
				<div class="chart-card"><h3>Monthly Tickets Sold</h3><canvas id="chart-tickets"></canvas></div>
				<div class="chart-card"><h3>Tickets Yearly Tracking (Cumulative)</h3><canvas id="chart-tickets-ytd"></canvas></div>
				<div class="chart-card wide"><h3>Tickets by Show</h3><canvas id="chart-tickets-by-show"></canvas></div>
			</div>
		</div>

		<!-- ============ INDIVIDUAL SHOW SECTIONS ============ -->
		<div class="report-section">
			<div class="section-header"><h2>Individual Show Breakdown</h2><span class="section-range">{dateRangeLabel} · {selectedYears.join(', ')}</span></div>
			{#each showBreakdown as show}
				<div class="show-section">
					<div class="show-header">
						<div><h3>{show.name}</h3>{#if show.format}<span class="show-format-tag">{show.format}</span>{/if}</div>
						<div class="show-stats">
							<span class="show-stat">{formatCurrency(show.revenue)} revenue</span>
							<span class="show-stat-sep">·</span>
							<span class="show-stat">{show.units.toLocaleString()} tickets</span>
						</div>
					</div>
					<div class="show-charts">
						<div class="chart-card-sm"><h4>Revenue</h4><canvas id="show-revenue-{show.code}"></canvas></div>
						<div class="chart-card-sm"><h4>Tickets Sold</h4><canvas id="show-tickets-{show.code}"></canvas></div>
					</div>
				</div>
			{/each}
		</div>
	{:else if !dateStart || !dateEnd}
		<div class="empty-state">Select a date range to view reports.</div>
	{:else if selectedYears.length === 0}
		<div class="empty-state">Select at least one year to compare.</div>
	{:else}
		<div class="empty-state">No data for the selected filters.</div>
	{/if}
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1.15rem; font-weight: 600; color: #1a202c; margin: 0; }
	h3 { font-size: 1rem; font-weight: 600; color: #374151; margin: 0 0 0.5rem 0; }
	h4 { font-size: 0.85rem; font-weight: 600; color: #6b7280; margin: 0 0 0.4rem 0; text-transform: uppercase; letter-spacing: 0.03em; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; }

	.filter-section { background: white; padding: 1.25rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
	.filter-row { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
	.filter-group { display: flex; flex-direction: column; gap: 0.25rem; min-width: 140px; }
	.filter-group label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
	.filter-group input[type="month"] { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.9rem; background: white; }
	.filter-group input[type="month"]:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
	.filter-show-group { position: relative; }
	.show-filter-btn { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.9rem; background: white; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: space-between; color: #1a202c; }
	.show-filter-btn:hover { border-color: #9ca3af; }
	.caret { font-size: 0.65rem; color: #9ca3af; }
	.show-filter-dropdown { position: absolute; top: 100%; left: 0; right: 0; min-width: 280px; max-height: 350px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 50; padding: 0.5rem 0; margin-top: 0.25rem; }
	.show-filter-actions { display: flex; justify-content: space-between; padding: 0.25rem 0.75rem 0.5rem; border-bottom: 1px solid #f3f4f6; }
	.btn-link { background: none; border: none; color: #3b82f6; font-size: 0.8rem; cursor: pointer; padding: 0; }
	.btn-link:hover { text-decoration: underline; }
	.show-filter-format { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.5rem 0.75rem 0.2rem; }
	.show-filter-item { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.75rem; font-size: 0.85rem; color: #374151; cursor: pointer; }
	.show-filter-item:hover { background: #f9fafb; }
	.show-filter-item input { accent-color: #3b82f6; cursor: pointer; }
	.show-code-tag { font-family: monospace; font-size: 0.75rem; color: #2563eb; background: #dbeafe; padding: 0.1rem 0.3rem; border-radius: 0.2rem; }
	.filter-divider { height: 1px; background: #e5e7eb; margin: 1rem 0; }
	.year-checkboxes { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
	.year-label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
	.year-checkbox { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; color: #374151; cursor: pointer; }
	.year-checkbox input { cursor: pointer; accent-color: #3b82f6; }

	.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
	.stat-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.25rem; }
	.stat-card.stat-primary { border-top: 3px solid #3b82f6; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	.report-section { margin-bottom: 2.5rem; }
	.section-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #f9fafb; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #3b82f6; }
	.section-range { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
	.chart-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	.chart-card.wide { grid-column: 1 / -1; }

	.show-section { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.25rem; overflow: hidden; }
	.show-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: #eff6ff; border-bottom: 1px solid #dbeafe; flex-wrap: wrap; gap: 0.5rem; }
	.show-format-tag { font-size: 0.75rem; color: #1d4ed8; background: #dbeafe; padding: 0.15rem 0.5rem; border-radius: 0.25rem; margin-left: 0.5rem; }
	.show-stats { display: flex; gap: 0.25rem; align-items: center; font-size: 0.85rem; color: #6b7280; }
	.show-stat-sep { color: #d1d5db; }
	.show-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1.25rem; }
	.chart-card-sm { min-height: 200px; }

	.empty-state { text-align: center; padding: 3rem; color: #6b7280; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

	@media (max-width: 768px) {
		.stats-row { grid-template-columns: repeat(2, 1fr); }
		.charts-grid { grid-template-columns: 1fr; }
		.chart-card.wide { grid-column: 1; }
		.show-charts { grid-template-columns: 1fr; }
		.filter-row { flex-direction: column; }
		.section-header { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
	}
</style>