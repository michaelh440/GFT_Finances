<!-- src/routes/hsi/reports/student_geo_analytics/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Chart from 'chart.js/auto';

	export let data;

	let mounted = false;
	let charts = {};

	// Global filters
	let selectedClassCode = 'all';
	let selectedTrack = 'all';

	// Monthly filters (year checkboxes)
	let availableYears = [];
	let selectedYears = [];

	// Chart view
	let activeView = 'zip';
	let showAllZip = false;
	let showAllCity = false;
	let sortBy = 'students';

	// Get unique tracks
	$: uniqueTracks = [...new Set((data.classes || []).map(c => c.track).filter(Boolean))].sort();

	// Group classes by track for optgroup display
	$: classesByTrack = (data.classes || []).reduce((acc, c) => {
		const t = c.track || 'Other';
		if (!acc[t]) acc[t] = [];
		acc[t].push(c);
		return acc;
	}, {});
	$: trackList = Object.keys(classesByTrack).sort();

	// Extract available years from data
	$: {
		const yrs = (data.years || []).map(y => typeof y === 'number' ? y : parseInt(y)).filter(y => !isNaN(y));
		availableYears = yrs.sort((a, b) => b - a);
		// Initialize: if URL had years, use those; otherwise select all
		if (selectedYears.length === 0 && availableYears.length > 0) {
			const urlYears = (data.filters?.years || '').split(',').filter(Boolean);
			if (urlYears.length > 0) {
				selectedYears = urlYears;
			}
			// If no years selected, don't filter (show all)
		}
	}

	// Sorted + filtered display data (server already filtered, just sort here)
	$: knownZips = (data.zipData || []).filter(z => z.zip_code !== 'Unknown')
		.sort((a, b) => sortBy === 'registrations' ? b.registration_count - a.registration_count : b.student_count - a.student_count);
	$: displayZips = showAllZip ? knownZips : knownZips.slice(0, 20);
	$: knownCities = (data.cityData || []).filter(c => c.city !== 'Unknown')
		.sort((a, b) => sortBy === 'registrations' ? b.registration_count - a.registration_count : b.student_count - a.student_count);
	$: displayCities = showAllCity ? knownCities : knownCities.slice(0, 15);
	$: knownStates = (data.stateData || []).filter(s => s.state !== 'Unknown')
		.sort((a, b) => sortBy === 'registrations' ? b.registration_count - a.registration_count : b.student_count - a.student_count);

	// Stats
	$: totalStudents = data.stats?.total_students || 0;
	$: totalRevenue = (data.zipData || []).reduce((s, z) => s + z.revenue, 0);
	$: totalRegs = (data.zipData || []).reduce((s, z) => s + z.registration_count, 0);

	onMount(() => { mounted = true; });
	onDestroy(() => { Object.values(charts).forEach(c => { if (c) c.destroy(); }); });

	// Chart rendering
	$: if (browser && mounted && activeView === 'zip') {
		setTimeout(() => renderZipChart(displayZips), 150);
	}
	$: if (browser && mounted && activeView === 'city') {
		setTimeout(() => renderCityChart(displayCities), 150);
	}
	$: if (browser && mounted && activeView === 'state') {
		setTimeout(() => renderStateChart(knownStates), 150);
	}

	function createChart(canvasId, config) {
		if (charts[canvasId]) charts[canvasId].destroy();
		const canvas = document.getElementById(canvasId);
		if (!canvas) return null;
		const chart = new Chart(canvas, config);
		charts[canvasId] = chart;
		return chart;
	}

	function renderZipChart(zips) {
		if (!zips || zips.length === 0) return;
		const container = document.getElementById('zipChartContainer');
		if (container) container.style.height = Math.max(400, zips.length * 28) + 'px';

		createChart('zipChart', {
			type: 'bar',
			data: {
				labels: zips.map(z => z.city ? `${z.zip_code} (${z.city})` : z.zip_code),
				datasets: [
					{ label: 'Students', data: zips.map(z => z.student_count), backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 3 },
					{ label: 'Registrations', data: zips.map(z => z.registration_count), backgroundColor: 'rgba(16, 185, 129, 0.6)', borderRadius: 3 }
				]
			},
			options: {
				indexAxis: 'y', responsive: true, maintainAspectRatio: false,
				plugins: {
					legend: { position: 'top' },
					tooltip: {
						callbacks: {
							afterBody: function(ctx) {
								const z = zips[ctx[0].dataIndex];
								return 'Revenue: ' + formatCurrency(z.revenue);
							}
						}
					}
				},
				scales: {
					x: { beginAtZero: true, ticks: { precision: 0 } },
					y: { ticks: { font: { size: 11 } } }
				}
			}
		});
	}

	function renderCityChart(cities) {
		if (!cities || cities.length === 0) return;
		const container = document.getElementById('cityChartContainer');
		if (container) container.style.height = Math.max(350, cities.length * 32) + 'px';

		createChart('cityChart', {
			type: 'bar',
			data: {
				labels: cities.map(c => c.state ? `${c.city}, ${c.state}` : c.city),
				datasets: [
					{ label: 'Students', data: cities.map(c => c.student_count), backgroundColor: 'rgba(99, 102, 241, 0.8)', borderRadius: 3 },
					{ label: 'Registrations', data: cities.map(c => c.registration_count), backgroundColor: 'rgba(16, 185, 129, 0.6)', borderRadius: 3 }
				]
			},
			options: {
				indexAxis: 'y', responsive: true, maintainAspectRatio: false,
				plugins: { legend: { position: 'top' } },
				scales: {
					x: { beginAtZero: true, ticks: { precision: 0 } },
					y: { ticks: { font: { size: 11 } } }
				}
			}
		});
	}

	function renderStateChart(states) {
		if (!states || states.length === 0) return;

		createChart('stateChart', {
			type: 'doughnut',
			data: {
				labels: states.map(s => s.state),
				datasets: [{
					data: states.map(s => s.student_count),
					backgroundColor: [
						'#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
						'#06b6d4', '#ec4899', '#14b8a6', '#f97316', '#84cc16',
						'#a855f7', '#22d3ee', '#fb923c', '#4ade80', '#facc15'
					]
				}]
			},
			options: {
				responsive: true, maintainAspectRatio: true,
				plugins: {
					legend: { position: 'right', labels: { font: { size: 12 } } },
					tooltip: {
						callbacks: {
							label: function(ctx) {
								const s = states[ctx.dataIndex];
								return s.state + ': ' + s.student_count + ' students, ' + s.city_count + ' cities';
							}
						}
					}
				}
			}
		});
	}

	function toggleYear(y) {
		const str = y.toString();
		if (selectedYears.includes(str)) {
			selectedYears = selectedYears.filter(v => v !== str);
		} else {
			selectedYears = [...selectedYears, str];
		}
	}

	function applyFilters() {
		const params = new URLSearchParams();
		if (selectedClassCode !== 'all') params.set('class', selectedClassCode);
		if (selectedTrack !== 'all') params.set('track', selectedTrack);
		if (selectedYears.length > 0) params.set('years', selectedYears.join(','));
		const qs = params.toString();
		window.location.href = `${base}/hsi/reports/student_geo_analytics${qs ? '?' + qs : ''}`;
	}

	function clearFilters() {
		selectedClassCode = 'all';
		selectedTrack = 'all';
		selectedYears = [];
		window.location.href = `${base}/hsi/reports/student_geo_analytics`;
	}

	function switchTab(tab) {
		activeView = tab;
	}

	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	// Init filters from URL
	$: {
		if (data.filters?.classCode) selectedClassCode = data.filters.classCode;
		if (data.filters?.track) selectedTrack = data.filters.track;
	}

	$: hasFilters = selectedClassCode !== 'all' || selectedTrack !== 'all' || selectedYears.length > 0;
</script>

<svelte:head>
	<title>Student Geographic Analytics | HSI</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href="{base}/hsi/reports" class="breadcrumb">← HSI Reports</a>
			<h1>Student Geographic Analytics</h1>
			<p class="subtitle">Where your students come from</p>
		</div>
	</header>

	<!-- Filter Section — matches shows reports layout -->
	<div class="filter-section">
		<div class="filter-row">
			<div class="filter-group">
				<label for="classSelect">Class Filter:</label>
				<select id="classSelect" bind:value={selectedClassCode} class="filter-select">
					<option value="all">All Classes</option>
					{#each trackList as t}
						<optgroup label={t}>
							{#each classesByTrack[t] as c}
								<option value={c.class_code}>{c.class_name}</option>
							{/each}
						</optgroup>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="trackSelect">Track Filter:</label>
				<select id="trackSelect" bind:value={selectedTrack} class="filter-select">
					<option value="all">All Tracks</option>
					{#each uniqueTracks as t}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</div>
			<div class="filter-group">
				<label>Rank By:</label>
				<div class="rank-toggle">
					<button class="rank-btn" class:active={sortBy === 'students'} on:click={() => { sortBy = 'students'; }}>Students</button>
					<button class="rank-btn" class:active={sortBy === 'registrations'} on:click={() => { sortBy = 'registrations'; }}>Registrations</button>
				</div>
			</div>
		</div>
	</div>

	
	<h1 class="section-title">Years To Include in Analysis</h1>
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

	<!-- Stats Summary -->
	<div class="stats-row">
		<div class="stat-card">
			<span class="stat-value">{(data.stats?.total_students || 0).toLocaleString()}</span>
			<span class="stat-label">Students</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{(data.stats?.with_zip || 0).toLocaleString()}</span>
			<span class="stat-label">With Zip</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{totalStudents > 0 ? Math.round(((data.stats?.with_zip || 0) / totalStudents) * 100) : 0}%</span>
			<span class="stat-label">Coverage</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{data.stats?.unique_zips || 0}</span>
			<span class="stat-label">Zip Codes</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{data.stats?.unique_cities || 0}</span>
			<span class="stat-label">Cities</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{formatCurrency(totalRevenue)}</span>
			<span class="stat-label">Revenue</span>
		</div>
	</div>

	{#if (data.zipData || []).length === 0 && (data.cityData || []).length === 0}
		<div class="card"><p class="empty-state">No geographic data available. Upload student address data via class registration imports.</p></div>
	{:else}
		<!-- View tabs -->
		<div class="view-tabs">
			<button class="view-tab" class:active={activeView === 'zip'} on:click={() => switchTab('zip')}>Zip Codes</button>
			<button class="view-tab" class:active={activeView === 'city'} on:click={() => switchTab('city')}>Cities</button>
			<button class="view-tab" class:active={activeView === 'state'} on:click={() => switchTab('state')}>States</button>
		</div>

		{#if browser && mounted}
			<!-- ZIP VIEW -->
			<div style="display: {activeView === 'zip' ? 'block' : 'none'}">
				<div class="chart-card">
					<div class="card-header">
						<h2>Students by Zip Code{showAllZip ? '' : ' (Top 20)'}</h2>
						{#if knownZips.length > 20}
							<button class="btn-toggle" on:click={() => { showAllZip = !showAllZip; }}>
								{showAllZip ? 'Top 20' : `All ${knownZips.length}`}
							</button>
						{/if}
					</div>
					<div class="chart-container" id="zipChartContainer"><canvas id="zipChart"></canvas></div>
				</div>

				<div class="card">
					<h2>Zip Code Detail</h2>
					<div class="table-wrapper">
						<table>
							<thead>
								<tr>
									<th>#</th><th>Zip Code</th><th>City</th><th>State</th>
									<th class="col-right">Students</th><th class="col-right">Registrations</th>
									<th class="col-right">Revenue</th><th class="col-right">Avg/Student</th>
								</tr>
							</thead>
							<tbody>
								{#each data.zipData || [] as z, i}
									<tr class:unknown={z.zip_code === 'Unknown'}>
										<td class="rank">{z.zip_code !== 'Unknown' ? i + 1 : ''}</td>
										<td class="zip-cell">{z.zip_code}</td>
										<td>{z.city || '—'}</td>
										<td>{z.state || '—'}</td>
										<td class="col-right">{z.student_count}</td>
										<td class="col-right">{z.registration_count}</td>
										<td class="col-right">{formatCurrency(z.revenue)}</td>
										<td class="col-right">{z.student_count > 0 ? formatCurrency(z.revenue / z.student_count) : '—'}</td>
									</tr>
								{/each}
							</tbody>
							<tfoot>
								<tr>
									<td></td><td colspan="3" class="total-label">Total</td>
									<td class="col-right total-value">{totalStudents}</td>
									<td class="col-right total-value">{totalRegs}</td>
									<td class="col-right total-value">{formatCurrency(totalRevenue)}</td>
									<td></td>
								</tr>
							</tfoot>
						</table>
					</div>
				</div>
			</div>

			<!-- CITY VIEW -->
			<div style="display: {activeView === 'city' ? 'block' : 'none'}">
				<div class="chart-card">
					<div class="card-header">
						<h2>Students by City{showAllCity ? '' : ' (Top 15)'}</h2>
						{#if knownCities.length > 15}
							<button class="btn-toggle" on:click={() => { showAllCity = !showAllCity; }}>
								{showAllCity ? 'Top 15' : `All ${knownCities.length}`}
							</button>
						{/if}
					</div>
					<div class="chart-container" id="cityChartContainer"><canvas id="cityChart"></canvas></div>
				</div>

				<div class="card">
					<h2>City Detail</h2>
					<div class="table-wrapper">
						<table>
							<thead>
								<tr>
									<th>#</th><th>City</th><th>State</th>
									<th class="col-right">Students</th><th class="col-right">Zip Codes</th>
									<th class="col-right">Registrations</th><th class="col-right">Revenue</th>
								</tr>
							</thead>
							<tbody>
								{#each data.cityData || [] as c, i}
									<tr class:unknown={c.city === 'Unknown'}>
										<td class="rank">{c.city !== 'Unknown' ? i + 1 : ''}</td>
										<td><strong>{c.city}</strong></td>
										<td>{c.state || '—'}</td>
										<td class="col-right">{c.student_count}</td>
										<td class="col-right">{c.zip_count}</td>
										<td class="col-right">{c.registration_count}</td>
										<td class="col-right">{formatCurrency(c.revenue)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<!-- STATE VIEW -->
			<div style="display: {activeView === 'state' ? 'block' : 'none'}">
				<div class="chart-card">
					<h2>Students by State</h2>
					<div class="chart-container-donut"><canvas id="stateChart"></canvas></div>
				</div>

				<div class="card">
					<h2>State Detail</h2>
					<div class="table-wrapper">
						<table>
							<thead>
								<tr>
									<th>#</th><th>State</th>
									<th class="col-right">Students</th><th class="col-right">Cities</th>
									<th class="col-right">Registrations</th><th class="col-right">Revenue</th>
									<th class="col-right">% of Students</th>
								</tr>
							</thead>
							<tbody>
								{#each data.stateData || [] as s, i}
									<tr class:unknown={s.state === 'Unknown'}>
										<td class="rank">{s.state !== 'Unknown' ? i + 1 : ''}</td>
										<td><strong>{s.state}</strong></td>
										<td class="col-right">{s.student_count}</td>
										<td class="col-right">{s.city_count}</td>
										<td class="col-right">{s.registration_count}</td>
										<td class="col-right">{formatCurrency(s.revenue)}</td>
										<td class="col-right">{totalStudents > 0 ? (s.student_count / totalStudents * 100).toFixed(1) + '%' : '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{:else}
			<div class="loading">Loading charts...</div>
		{/if}
	{/if}
</div>

<style>
	.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 1.5rem; }
	.breadcrumb { color: #6366f1; text-decoration: none; font-size: 0.85rem; }
	.breadcrumb:hover { text-decoration: underline; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0.5rem 0 0 0; }
	h2 { font-size: 1.1rem; font-weight: 600; color: #374151; margin: 0; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; font-size: 0.9rem; }

	/* Filter Section — matches shows reports */
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
	.filter-group label {
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
		min-width: 200px;
	}
	.filter-select:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }
	.filter-divider {
		height: 1px;
		background-color: #e5e7eb;
		margin: 1rem 0;
	}
	.year-checkboxes { display: flex; gap: 0.75rem; flex-wrap: wrap; }
	.checkbox-label { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: #374151; cursor: pointer; white-space: nowrap; }
	.checkbox-label input[type="checkbox"] { accent-color: #6366f1; cursor: pointer; }
	.rank-toggle { display: flex; border: 1px solid #d1d5db; border-radius: 0.375rem; overflow: hidden; }
	.rank-btn { padding: 0.45rem 0.85rem; border: none; background: white; font-size: 0.85rem; color: #6b7280; cursor: pointer; transition: all 0.15s; }
	.rank-btn:not(:last-child) { border-right: 1px solid #d1d5db; }
	.rank-btn.active { background: #6366f1; color: white; }
	.rank-btn:hover:not(.active) { background: #f3f4f6; }
	.filter-actions {
		display: flex;
		gap: 0.75rem;
		align-items: center;
		justify-content: flex-end;
		margin-top: 1rem;
		padding-top: 1rem;
		border-top: 1px solid #f3f4f6;
	}
	.btn-apply { padding: 0.5rem 1.5rem; background-color: #6366f1; color: white; border: none; border-radius: 0.375rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
	.btn-apply:hover { background-color: #4f46e5; }
	.btn-clear { background: none; border: none; color: #6366f1; font-size: 0.85rem; cursor: pointer; font-weight: 500; }
	.btn-clear:hover { text-decoration: underline; }

	/* Stats */
	.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
	.stat-card { background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.2rem; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }

	/* Tabs */
	.view-tabs { display: flex; gap: 0; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb; }
	.view-tab { padding: 0.65rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; font-size: 0.95rem; font-weight: 500; color: #6b7280; cursor: pointer; transition: all 0.15s; }
	.view-tab:hover { color: #1a202c; }
	.view-tab.active { color: #6366f1; border-bottom-color: #6366f1; font-weight: 600; }

	/* Cards & Charts */
	.card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
	.chart-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
	.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
	.btn-toggle { background: none; border: 1px solid #d1d5db; border-radius: 0.375rem; padding: 0.35rem 0.75rem; font-size: 0.8rem; color: #6366f1; cursor: pointer; }
	.btn-toggle:hover { background: #f3f4f6; }

	.chart-container { position: relative; height: 500px; }
	.chart-container-donut { position: relative; height: 400px; max-width: 600px; margin: 0 auto; }

	/* Tables */
	.table-wrapper { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.6rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
	td { padding: 0.5rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; font-size: 0.85rem; }
	tr:hover td { background-color: #f9fafb; }
	tr.unknown td { color: #9ca3af; font-style: italic; }
	.col-right { text-align: right; }
	.rank { color: #9ca3af; font-size: 0.8rem; width: 2rem; }
	.zip-cell { font-weight: 600; font-family: monospace; }
	tfoot td { border-top: 2px solid #e5e7eb; border-bottom: none; padding-top: 0.75rem; }
	.total-label { text-align: right; font-weight: 600; color: #374151; font-size: 0.85rem; }
	.total-value { font-weight: 700; color: #1a202c; font-size: 0.85rem; }
	.empty-state { text-align: center; color: #6b7280; padding: 2rem; }
	.loading { text-align: center; color: #6b7280; padding: 3rem; font-size: 0.95rem; }

	@media (max-width: 768px) {
		.filter-row { flex-direction: column; gap: 1rem; }
		.filter-select { min-width: 100%; }
		.chart-container-donut { max-width: 100%; }
	}
</style>