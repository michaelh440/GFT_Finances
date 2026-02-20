<!-- src/routes/hsi/registrations/+page.svelte -->
<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import Chart from 'chart.js/auto';

	/**
	 * @typedef {Object} RegistrationData
	 * @property {number} student_id
	 * @property {string} class_code
	 * @property {number} reg_year
	 */

	/**
	 * @typedef {Object} MonthlyFunnelData
	 * @property {string} reg_month
	 * @property {string} class_code
	 * @property {number} total_students
	 * @property {number} did_not_continue
	 * @property {number} continued
	 */

	/** @type {{ registrations: RegistrationData[], years: number[], monthlyFunnel: MonthlyFunnelData[] }} */
	export let data;

	/** @type {Record<string, Chart>} */
	let charts = {};
	let mounted = false;
	/** @type {string|number} */
	let selectedMonthlyYear = 'all';

	// Year filter for overall progression - all checked by default
	/** @type {Record<number, boolean>} */
	let selectedOverallYears = {};
	$: {
		if (data.years && Object.keys(selectedOverallYears).length === 0) {
			data.years.forEach((y) => {
				selectedOverallYears[y] = true;
			});
		}
	}

	onMount(() => {
		mounted = true;
	});

	// Compute funnel based on selected years
	$: funnel = (() => {
		if (!data.registrations || data.registrations.length === 0) return null;

		const activeYears = Object.entries(selectedOverallYears)
			.filter(([, v]) => v)
			.map(([k]) => Number(k));

		if (activeYears.length === 0) return null;

		// Filter registrations to selected years
		const filtered = data.registrations.filter((r) => activeYears.includes(r.reg_year));

		// Get unique students per class
		const ct1 = new Set(filtered.filter((r) => r.class_code === 'CT1').map((r) => r.student_id));
		const ct2 = new Set(filtered.filter((r) => r.class_code === 'CT2').map((r) => r.student_id));
		const ct3 = new Set(filtered.filter((r) => r.class_code === 'CT3').map((r) => r.student_id));
		const agt1 = new Set(filtered.filter((r) => r.class_code === 'AGT1').map((r) => r.student_id));

		let ct1_to_ct2 = 0,
			ct1_not_ct2 = 0;
		ct1.forEach((id) => {
			if (ct2.has(id)) ct1_to_ct2++;
			else ct1_not_ct2++;
		});

		let ct2_to_ct3 = 0,
			ct2_not_ct3 = 0;
		ct2.forEach((id) => {
			if (ct3.has(id)) ct2_to_ct3++;
			else ct2_not_ct3++;
		});

		let ct3_to_agt1 = 0,
			ct3_not_agt1 = 0;
		ct3.forEach((id) => {
			if (agt1.has(id)) ct3_to_agt1++;
			else ct3_not_agt1++;
		});

		return {
			ct1_total: ct1.size,
			ct2_total: ct2.size,
			ct3_total: ct3.size,
			agt1_total: agt1.size,
			ct1_to_ct2,
			ct1_not_ct2,
			ct2_to_ct3,
			ct2_not_ct3,
			ct3_to_agt1,
			ct3_not_agt1
		};
	})();

	// Available years from monthly data
	$: availableMonthlyYears = (() => {
		if (!data.monthlyFunnel || data.monthlyFunnel.length === 0) return [];
		const years = [
			...new Set(
				data.monthlyFunnel.map((r) => {
					return new Date(r.reg_month + 'T12:00:00').getFullYear();
				})
			)
		].filter((y) => y >= 2012 && y <= 2027);
		return years.sort((a, b) => b - a);
	})();

	// Filter monthly data by year
	$: filteredMonthly = (() => {
		if (!data.monthlyFunnel) return [];
		if (selectedMonthlyYear === 'all') return data.monthlyFunnel;
		return data.monthlyFunnel.filter((r) => {
			const year = new Date(r.reg_month + 'T12:00:00').getFullYear();
			return year === selectedMonthlyYear;
		});
	})();

	// Process monthly data for charts
	$: monthlyChartData = (() => {
		if (!filteredMonthly || filteredMonthly.length === 0) {
			return {
				ct1: { labels: [], stopped: [], continued: [] },
				ct2: { labels: [], stopped: [], continued: [] },
				ct3: { labels: [], stopped: [], continued: [] }
			};
		}

		const months = [
			'Jan',
			'Feb',
			'Mar',
			'Apr',
			'May',
			'Jun',
			'Jul',
			'Aug',
			'Sep',
			'Oct',
			'Nov',
			'Dec'
		];

		/** @param {string} classCode */
		function buildMonthlyData(classCode) {
			const classData = filteredMonthly.filter((r) => r.class_code === classCode);

			if (selectedMonthlyYear === 'all') {
				const sorted = classData.sort((a, b) => a.reg_month.localeCompare(b.reg_month));
				return {
					labels: sorted.map((r) => {
						const d = new Date(r.reg_month + 'T12:00:00');
						return months[d.getMonth()] + ' ' + d.getFullYear();
					}),
					stopped: sorted.map((r) => r.did_not_continue),
					continued: sorted.map((r) => r.continued)
				};
			} else {
				const byMonth = Array(12)
					.fill(null)
					.map(() => ({ stopped: 0, continued: 0 }));
				classData.forEach((r) => {
					const month = new Date(r.reg_month + 'T12:00:00').getMonth();
					byMonth[month].stopped += r.did_not_continue;
					byMonth[month].continued += r.continued;
				});
				return {
					labels: months,
					stopped: byMonth.map((m) => m.stopped),
					continued: byMonth.map((m) => m.continued)
				};
			}
		}

		return {
			ct1: buildMonthlyData('CT1'),
			ct2: buildMonthlyData('CT2'),
			ct3: buildMonthlyData('CT3')
		};
	})();

	/**
	 * @param {string} canvasId
	 * @param {any} config
	 */
	function createChart(canvasId, config) {
		if (!browser || !mounted) return;
		const ctx = /** @type {HTMLCanvasElement|null} */ (document.getElementById(canvasId));
		if (!ctx) return;
		if (charts[canvasId]) {
			charts[canvasId].destroy();
		}
		charts[canvasId] = new Chart(ctx, config);
	}

	/** @param {boolean} checked */
	function toggleAllYears(checked) {
		data.years.forEach((y) => {
			selectedOverallYears[y] = checked;
		});
		selectedOverallYears = selectedOverallYears;
	}

	$: allYearsSelected = data.years && data.years.every((y) => selectedOverallYears[y]);

	// Overall funnel charts - reactive to year filter
	$: if (browser && mounted && funnel) {
		setTimeout(() => {
			const yearLabel = (() => {
				const active = Object.entries(selectedOverallYears)
					.filter(([, v]) => v)
					.map(([k]) => k);
				if (active.length === data.years.length) return 'All Years';
				if (active.length <= 3) return active.join(', ');
				return `${active.length} years selected`;
			})();

			createChart('funnelChart', {
				type: 'bar',
				data: {
					labels: ['CT1 → CT2', 'CT2 → CT3', 'CT3 → AGT1'],
					datasets: [
						{
							label: 'Did Not Continue',
							data: [funnel.ct1_not_ct2, funnel.ct2_not_ct3, funnel.ct3_not_agt1],
							backgroundColor: '#ef4444'
						},
						{
							label: 'Continued',
							data: [funnel.ct1_to_ct2, funnel.ct2_to_ct3, funnel.ct3_to_agt1],
							backgroundColor: '#10b981'
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: `Student Progression Funnel (${yearLabel})` }
					},
					scales: {
						x: { stacked: true },
						y: { stacked: true, beginAtZero: true }
					}
				}
			});

			const ct1Rate = funnel.ct1_total > 0 ? (funnel.ct1_to_ct2 / funnel.ct1_total) * 100 : 0;
			const ct2Rate = funnel.ct2_total > 0 ? (funnel.ct2_to_ct3 / funnel.ct2_total) * 100 : 0;
			const ct3Rate = funnel.ct3_total > 0 ? (funnel.ct3_to_agt1 / funnel.ct3_total) * 100 : 0;

			createChart('conversionChart', {
				type: 'bar',
				data: {
					labels: ['CT1 → CT2', 'CT2 → CT3', 'CT3 → AGT1'],
					datasets: [
						{
							label: 'Conversion Rate',
							data: [ct1Rate, ct2Rate, ct3Rate],
							backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b']
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						title: { display: true, text: `Conversion Rate Between Levels (${yearLabel})` },
						tooltip: {
							callbacks: {
								label: function (/** @type {any} */ context) {
									return context.parsed.y.toFixed(1) + '%';
								}
							}
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							max: 100,
							ticks: {
								callback: function (/** @type {any} */ value) {
									return value + '%';
								}
							}
						}
					}
				}
			});
		}, 100);
	}

	// Monthly charts - reactive to year filter
	$: if (browser && mounted && monthlyChartData) {
		setTimeout(() => {
			const yearLabel = selectedMonthlyYear === 'all' ? 'All Time' : selectedMonthlyYear;

			createChart('monthlyCT1Chart', {
				type: 'bar',
				data: {
					labels: monthlyChartData.ct1.labels,
					datasets: [
						{
							label: 'Did Not Take CT2',
							data: monthlyChartData.ct1.stopped,
							backgroundColor: '#ef4444'
						},
						{
							label: 'Continued to CT2',
							data: monthlyChartData.ct1.continued,
							backgroundColor: '#10b981'
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: `CT1 Students - Continued to CT2 (${yearLabel})` }
					},
					scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
				}
			});

			createChart('monthlyCT2Chart', {
				type: 'bar',
				data: {
					labels: monthlyChartData.ct2.labels,
					datasets: [
						{
							label: 'Did Not Take CT3',
							data: monthlyChartData.ct2.stopped,
							backgroundColor: '#ef4444'
						},
						{
							label: 'Continued to CT3',
							data: monthlyChartData.ct2.continued,
							backgroundColor: '#10b981'
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: `CT2 Students - Continued to CT3 (${yearLabel})` }
					},
					scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
				}
			});

			createChart('monthlyCT3Chart', {
				type: 'bar',
				data: {
					labels: monthlyChartData.ct3.labels,
					datasets: [
						{
							label: 'Did Not Take AGT1',
							data: monthlyChartData.ct3.stopped,
							backgroundColor: '#ef4444'
						},
						{
							label: 'Continued to AGT1',
							data: monthlyChartData.ct3.continued,
							backgroundColor: '#10b981'
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: `CT3 Students - Continued to AGT1 (${yearLabel})` }
					},
					scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
				}
			});
		}, 150);
	}
</script>

<svelte:head>
	<title>Registration Funnel | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<h1>Registration Funnel</h1>
			<p class="subtitle">Student progression through class levels</p>
		</div>
		<!--a href="/hsi/classes" class="btn-secondary">Back to Classes</a-->
	</header>

	{#if browser && mounted}
		<!-- Summary Cards -->
		{#if funnel}
			<div class="summary-cards">
				<div class="card">
					<div class="card-label">CT1 Students</div>
					<div class="card-value">{funnel.ct1_total}</div>
				</div>
				<div class="card">
					<div class="card-label">CT2 Students</div>
					<div class="card-value">{funnel.ct2_total}</div>
				</div>
				<div class="card">
					<div class="card-label">CT3 Students</div>
					<div class="card-value">{funnel.ct3_total}</div>
				</div>
				<div class="card">
					<div class="card-label">AGT1 Students</div>
					<div class="card-value">{funnel.agt1_total}</div>
				</div>
			</div>
		{/if}

		<!-- Overall Funnel Section -->
		<section class="chart-section">
			<h2 class="section-title">Overall Progression</h2>

			<div class="filter-section">
				<div class="filter-group">
					<span class="filter-label">Include Years:</span>
					<div class="year-checkboxes">
						<label class="checkbox-label">
							<input
								type="checkbox"
								checked={allYearsSelected}
								on:change={(e) =>
									toggleAllYears(/** @type {HTMLInputElement} */ (e.target).checked)}
							/>
							<span>All</span>
						</label>
						{#each data.years as year (year)}
							<label class="checkbox-label">
								<input type="checkbox" bind:checked={selectedOverallYears[year]} />
								<span>{year}</span>
							</label>
						{/each}
					</div>
				</div>
			</div>

			{#if funnel}
				<div class="charts-grid">
					<div class="chart-card">
						<canvas id="funnelChart"></canvas>
					</div>
					<div class="chart-card">
						<canvas id="conversionChart"></canvas>
					</div>
				</div>
			{:else}
				<div class="empty-state">Select at least one year to see data.</div>
			{/if}
		</section>

		<!-- Monthly Breakdown Section -->
		<section class="chart-section">
			<h2 class="section-title">Monthly Breakdown</h2>

			<div class="filter-section">
				<div class="filter-group">
					<label for="monthlyYearSelect">Year:</label>
					<select id="monthlyYearSelect" bind:value={selectedMonthlyYear} class="filter-select">
						<option value="all">All Years</option>
						{#each availableMonthlyYears as year (year)}
							<option value={year}>{year}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="charts-grid-single">
				<div class="chart-card chart-wide">
					<canvas id="monthlyCT1Chart"></canvas>
				</div>
				<div class="chart-card chart-wide">
					<canvas id="monthlyCT2Chart"></canvas>
				</div>
				<div class="chart-card chart-wide">
					<canvas id="monthlyCT3Chart"></canvas>
				</div>
			</div>
		</section>
	{:else}
		<div class="loading">Loading charts...</div>
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
		align-items: flex-start;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		color: #1a202c;
		margin: 0 0 0.5rem 0;
	}

	.subtitle {
		color: #6b7280;
		margin: 0;
	}

	.summary-cards {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1.5rem;
		margin-bottom: 2rem;
	}

	.card {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		text-align: center;
	}

	.card-label {
		font-size: 0.875rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.5rem;
	}

	.card-value {
		font-size: 2rem;
		font-weight: 700;
		color: #1a202c;
	}

	.chart-section {
		margin-bottom: 3rem;
	}

	.section-title {
		font-size: 1.5rem;
		font-weight: 600;
		color: #1a202c;
		margin: 0 0 1rem 0;
	}

	.filter-section {
		background: white;
		padding: 1rem 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 1rem;
	}

	.filter-label {
		font-weight: 600;
		color: #374151;
		white-space: nowrap;
		font-size: 0.9rem;
	}

	.filter-group label:not(.checkbox-label) {
		font-weight: 600;
		color: #374151;
		white-space: nowrap;
	}

	.filter-select {
		padding: 0.5rem 1rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 1rem;
		min-width: 200px;
		background-color: white;
	}

	.filter-select:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.year-checkboxes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.35rem 0.75rem;
		background-color: #f3f4f6;
		border-radius: 0.375rem;
		cursor: pointer;
		font-size: 0.85rem;
		font-weight: 500;
		color: #374151;
		transition: background-color 0.15s;
		user-select: none;
	}

	.checkbox-label:hover {
		background-color: #e5e7eb;
	}

	.checkbox-label input[type='checkbox'] {
		accent-color: #3b82f6;
		width: 1rem;
		height: 1rem;
		cursor: pointer;
	}

	.charts-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 2rem;
	}

	.charts-grid-single {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
	}

	.chart-card {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		height: 400px;
	}

	.chart-wide {
		height: 350px;
	}

	canvas {
		max-height: 100%;
	}

	.loading,
	.empty-state {
		text-align: center;
		padding: 3rem;
		color: #6b7280;
		font-size: 1.125rem;
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
	}

	@media (max-width: 1024px) {
		.summary-cards {
			grid-template-columns: repeat(2, 1fr);
		}

		.charts-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 768px) {
		.summary-cards {
			grid-template-columns: 1fr;
		}

		.year-checkboxes {
			gap: 0.375rem;
		}
	}
</style>
