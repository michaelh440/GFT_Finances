<!-- src/routes/hsi/reports/classes/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Chart from 'chart.js/auto';

	export let data;

	let mounted = false;
	let charts = {};

	// ---- Filters ----
	// dateStart/dateEnd define the month range (e.g. "2025-11" to "2026-02")
	// selectedYears overlay that same month pattern onto other years for comparison
	let dateStart = '';
	let dateEnd = '';
	let availableYears = [];
	let selectedYears = [];
	let selectedClasses = [];
	let classFilterOpen = false;

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
		const yrs = [...new Set((data.summaries || []).map((s) => s.summary_year))].sort((a, b) => b - a);
		availableYears = yrs;
		if (selectedYears.length === 0 && yrs.length > 0) {
			// Default: select the years that overlap with the date range
			const startYr = dateStart ? parseInt(dateStart.split('-')[0]) : yrs[0];
			selectedYears = yrs.filter((y) => y >= startYr - 1 && y <= startYr).slice(0, 3);
			if (selectedYears.length === 0) selectedYears = yrs.slice(0, 2);
		}
	}

	// ---- Build the month slot sequence from date range ----
	// e.g. "2025-11" to "2026-02" → [{year:2025,month:11}, {year:2025,month:12}, {year:2026,month:1}, {year:2026,month:2}]
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

	// Month-only positions for chart labels (just month numbers, no year)
	$: slotMonthNums = monthSlots.map((s) => s.month);

	// Labels for charts: "Nov", "Dec", "Jan", "Feb" etc.
	$: rangeLabels = monthSlots.map((s) => monthNames[s.month - 1]);

	// For year overlays: the base year offset
	// The date range defines the "primary" pattern. Each selected year shifts that pattern.
	// e.g. if date range is Nov 2025 – Feb 2026, primary year is "ending 2026"
	// Year 2026 = actual months, Year 2025 = Nov 2024 – Feb 2025
	$: primaryEndYear = monthSlots.length > 0 ? monthSlots[monthSlots.length - 1].year : new Date().getFullYear();

	// ---- Class filter ----
	$: classesByTrack = (data.classes || []).reduce((acc, c) => {
		const track = c.track || 'Other';
		if (!acc[track]) acc[track] = [];
		acc[track].push(c);
		return acc;
	}, {});
	$: tracks = Object.keys(classesByTrack).sort();
	$: allClassCodes = (data.classes || []).map((c) => c.class_code);
	$: effectiveClasses = selectedClasses.length === 0 ? allClassCodes : selectedClasses;

	$: classFilterLabel = selectedClasses.length === 0
		? 'All Classes'
		: selectedClasses.length === 1
			? (data.classes || []).find((c) => c.class_code === selectedClasses[0])?.class_name || '1 class'
			: `${selectedClasses.length} classes`;

	function toggleClass(code) {
		if (selectedClasses.includes(code)) selectedClasses = selectedClasses.filter((c) => c !== code);
		else selectedClasses = [...selectedClasses, code];
	}
	function selectAllClasses() { selectedClasses = []; }
	function clearAllClasses() { selectedClasses = [allClassCodes[0] || '']; }

	// ---- Filter data: match month slots for each selected year ----
	// For each selected year Y, compute the year offset from primary and match data
	$: filteredData = (() => {
		if (monthSlots.length === 0) return [];
		const result = [];
		for (const s of (data.summaries || [])) {
			if (!effectiveClasses.includes(s.class_code)) continue;
			// Check if this summary falls into any selected year's version of the month range
			for (const yr of selectedYears) {
				const yearOffset = yr - primaryEndYear;
				// For each slot, check if this summary matches the shifted slot
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

	// ---- Summary Stats (all filtered data) ----
	$: totalRevenue = filteredData.reduce((sum, s) => sum + s.revenue, 0);
	$: totalRegistrations = filteredData.reduce((sum, s) => sum + s.unit_count, 0);
	$: uniqueClassCount = [...new Set(filteredData.map((s) => s.class_code))].length;
	$: uniqueMonths = [...new Set(filteredData.map((s) => s.summary_month))].length;

	// ---- Build overlay year data for charts ----
	function buildOverlayData(dataSlice) {
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

	// ---- Per-class totals ----
	$: classBreakdown = (() => {
		const byClass = {};
		for (const s of filteredData) {
			if (!byClass[s.class_code]) byClass[s.class_code] = { code: s.class_code, name: s.class_name, track: s.track, revenue: 0, units: 0 };
			byClass[s.class_code].revenue += s.revenue;
			byClass[s.class_code].units += s.unit_count;
		}
		return Object.values(byClass).sort((a, b) => b.revenue - a.revenue);
	})();

	$: perClassOverlayData = (() => {
		const result = {};
		for (const cls of classBreakdown) {
			result[cls.code] = buildOverlayData(filteredData.filter((s) => s.class_code === cls.code));
		}
		return result;
	})();

	// ---- Chart rendering ----
	function destroyCharts() { Object.values(charts).forEach((c) => c.destroy()); charts = {}; }
	function rc(id, config) {
		const ctx = document.getElementById(id);
		if (!ctx) return;
		if (charts[id]) charts[id].destroy();
		charts[id] = new Chart(ctx, config);
	}
	function dollarTick(v) { return '$' + Number(v).toLocaleString(); }

	function yearDatasets(overlayData, metric, chartType = 'bar') {
		return selectedYears.map((yr, i) => {
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

			// 3. Revenue by Class
			if (classBreakdown.length > 0) {
				const top = classBreakdown.slice(0, 20);
				rc('chart-revenue-by-class', {
					type: 'bar', data: { labels: top.map((c) => c.name), datasets: [{ label: 'Revenue', data: top.map((c) => c.revenue), backgroundColor: '#8b5cf6' }] },
					options: { responsive: true, animation: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: dollarTick } } } }
				});
			}

			// 4. Registrations
			rc('chart-registrations', {
				type: 'bar', data: { labels: rangeLabels, datasets: yearDatasets(allOverlay, 'units') },
				options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } } }
			});

			// 5. Registrations Yearly Tracking
			rc('chart-registrations-ytd', {
				type: 'line', data: { labels: rangeLabels, datasets: yearDatasets(allOverlay, 'units', 'line') },
				options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } } }
			});

			// 6. Registrations by Class
			if (classBreakdown.length > 0) {
				const top = classBreakdown.slice(0, 20);
				rc('chart-registrations-by-class', {
					type: 'bar', data: { labels: top.map((c) => c.name), datasets: [{ label: 'Registrations', data: top.map((c) => c.units), backgroundColor: '#3b82f6' }] },
					options: { responsive: true, animation: false, indexAxis: 'y', plugins: { legend: { display: false } } }
				});
			}

			// 7 & 8. Per-class charts
			for (const cls of classBreakdown) {
				const od = perClassOverlayData[cls.code];
				if (!od) continue;
				rc(`class-revenue-${cls.code}`, {
					type: 'bar', data: { labels: rangeLabels, datasets: yearDatasets(od, 'revenue') },
					options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: dollarTick } } } }
				});
				rc(`class-regs-${cls.code}`, {
					type: 'bar', data: { labels: rangeLabels, datasets: yearDatasets(od, 'units') },
					options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } } }
				});
			}
		}, 150);
	}

	$: if (mounted && monthSlots.length > 0 && selectedYears.length > 0 && effectiveClasses) renderAllCharts();
	onMount(() => { mounted = true; });
	onDestroy(() => { destroyCharts(); });

	function toggleYear(yr) {
		if (selectedYears.includes(yr)) {
			if (selectedYears.length > 1) selectedYears = selectedYears.filter((y) => y !== yr);
		} else selectedYears = [...selectedYears, yr].sort((a, b) => b - a);
	}

	function formatCurrency(a) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(a); }

	$: dateRangeLabel = (() => {
		if (!dateStart || !dateEnd) return '';
		const s = new Date(dateStart + '-01T12:00:00');
		const e = new Date(dateEnd + '-01T12:00:00');
		return `${s.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
	})();
</script>

<svelte:head>
	<title>Class Reports | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href="{base}/hsi" class="back-link">← Back to HSI</a>
			<h1>Class Reports</h1>
			<p class="subtitle">Revenue and registration analytics for HSI classes</p>
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
			<div class="filter-group filter-class-group">
				<label>Classes</label>
				<button class="class-filter-btn" on:click={() => classFilterOpen = !classFilterOpen}>
					{classFilterLabel}
					<span class="caret">{classFilterOpen ? '▲' : '▼'}</span>
				</button>
				{#if classFilterOpen}
					<div class="class-filter-dropdown">
						<div class="class-filter-actions">
							<button class="btn-link" on:click={selectAllClasses}>All Classes</button>
							<button class="btn-link" on:click={clearAllClasses}>Clear</button>
						</div>
						{#each tracks as track}
							<div class="class-filter-track">{track}</div>
							{#each classesByTrack[track] as cls}
								<label class="class-filter-item">
									<input type="checkbox"
										checked={selectedClasses.length === 0 || selectedClasses.includes(cls.class_code)}
										on:change={() => { if (selectedClasses.length === 0) selectedClasses = allClassCodes.filter(c => c !== cls.class_code); else toggleClass(cls.class_code); }} />
									<span class="class-code-tag">{cls.class_code}</span>
									{cls.class_name}
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
			<div class="stat-card"><span class="stat-value">{totalRegistrations.toLocaleString()}</span><span class="stat-label">Registrations</span></div>
			<div class="stat-card"><span class="stat-value">{uniqueClassCount}</span><span class="stat-label">Unique Classes</span></div>
			<div class="stat-card"><span class="stat-value">{uniqueMonths}</span><span class="stat-label">Months of Data</span></div>
		</div>

		<div class="report-section">
			<div class="section-header"><h2>Revenue</h2><span class="section-range">{dateRangeLabel} · {selectedYears.join(', ')}</span></div>
			<div class="charts-grid">
				<div class="chart-card"><h3>Monthly Revenue</h3><canvas id="chart-revenue"></canvas></div>
				<div class="chart-card"><h3>Revenue Yearly Tracking (Cumulative)</h3><canvas id="chart-revenue-ytd"></canvas></div>
				<div class="chart-card wide"><h3>Revenue by Class</h3><canvas id="chart-revenue-by-class"></canvas></div>
			</div>
		</div>

		<div class="report-section">
			<div class="section-header"><h2>Registrations</h2><span class="section-range">{dateRangeLabel} · {selectedYears.join(', ')}</span></div>
			<div class="charts-grid">
				<div class="chart-card"><h3>Monthly Registrations</h3><canvas id="chart-registrations"></canvas></div>
				<div class="chart-card"><h3>Registrations Yearly Tracking (Cumulative)</h3><canvas id="chart-registrations-ytd"></canvas></div>
				<div class="chart-card wide"><h3>Registrations by Class</h3><canvas id="chart-registrations-by-class"></canvas></div>
			</div>
		</div>

		<div class="report-section">
			<div class="section-header"><h2>Individual Class Breakdown</h2><span class="section-range">{dateRangeLabel} · {selectedYears.join(', ')}</span></div>
			{#each classBreakdown as cls}
				<div class="class-section">
					<div class="class-header">
						<div><h3>{cls.name}</h3>{#if cls.track}<span class="class-track">{cls.track}</span>{/if}</div>
						<div class="class-stats">
							<span class="class-stat">{formatCurrency(cls.revenue)} revenue</span>
							<span class="class-stat-sep">·</span>
							<span class="class-stat">{cls.units.toLocaleString()} registrations</span>
						</div>
					</div>
					<div class="class-charts">
						<div class="chart-card-sm"><h4>Revenue</h4><canvas id="class-revenue-{cls.code}"></canvas></div>
						<div class="chart-card-sm"><h4>Registrations</h4><canvas id="class-regs-{cls.code}"></canvas></div>
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
	.filter-class-group { position: relative; }
	.class-filter-btn { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.9rem; background: white; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; width: 100%; justify-content: space-between; color: #1a202c; }
	.class-filter-btn:hover { border-color: #9ca3af; }
	.caret { font-size: 0.65rem; color: #9ca3af; }
	.class-filter-dropdown { position: absolute; top: 100%; left: 0; right: 0; min-width: 280px; max-height: 350px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 50; padding: 0.5rem 0; margin-top: 0.25rem; }
	.class-filter-actions { display: flex; justify-content: space-between; padding: 0.25rem 0.75rem 0.5rem; border-bottom: 1px solid #f3f4f6; }
	.btn-link { background: none; border: none; color: #3b82f6; font-size: 0.8rem; cursor: pointer; padding: 0; }
	.btn-link:hover { text-decoration: underline; }
	.class-filter-track { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; padding: 0.5rem 0.75rem 0.2rem; }
	.class-filter-item { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.75rem; font-size: 0.85rem; color: #374151; cursor: pointer; }
	.class-filter-item:hover { background: #f9fafb; }
	.class-filter-item input { accent-color: #3b82f6; cursor: pointer; }
	.class-code-tag { font-family: monospace; font-size: 0.75rem; color: #6366f1; background: #eef2ff; padding: 0.1rem 0.3rem; border-radius: 0.2rem; }
	.filter-divider { height: 1px; background: #e5e7eb; margin: 1rem 0; }
	.year-checkboxes { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
	.year-label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
	.year-checkbox { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; color: #374151; cursor: pointer; }
	.year-checkbox input { cursor: pointer; accent-color: #3b82f6; }

	.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
	.stat-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.25rem; }
	.stat-card.stat-primary { border-top: 3px solid #8b5cf6; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	.report-section { margin-bottom: 2.5rem; }
	.section-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #f9fafb; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #8b5cf6; }
	.section-range { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
	.chart-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	.chart-card.wide { grid-column: 1 / -1; }

	.class-section { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.25rem; overflow: hidden; }
	.class-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: #faf5ff; border-bottom: 1px solid #f3e8ff; flex-wrap: wrap; gap: 0.5rem; }
	.class-track { font-size: 0.75rem; color: #7c3aed; background: #ede9fe; padding: 0.15rem 0.5rem; border-radius: 0.25rem; margin-left: 0.5rem; }
	.class-stats { display: flex; gap: 0.25rem; align-items: center; font-size: 0.85rem; color: #6b7280; }
	.class-stat-sep { color: #d1d5db; }
	.class-charts { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; padding: 1.25rem; }
	.chart-card-sm { min-height: 200px; }

	.empty-state { text-align: center; padding: 3rem; color: #6b7280; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

	@media (max-width: 768px) {
		.stats-row { grid-template-columns: repeat(2, 1fr); }
		.charts-grid { grid-template-columns: 1fr; }
		.chart-card.wide { grid-column: 1; }
		.class-charts { grid-template-columns: 1fr; }
		.filter-row { flex-direction: column; }
		.section-header { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
	}
</style>