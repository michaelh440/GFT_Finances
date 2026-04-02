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

	/** @type {{ registrations: RegistrationData[], years: number[], monthlyFunnel: MonthlyFunnelData[], pastReports: any[] }} */
	export let data;
	/** @type {any} */
	export let form;

	/** @type {Record<string, string>} */
	const classLabel = {
		CT1: 'Level 1',
		CT2: 'Level 2',
		CT3: 'Level 3',
		AGT1: 'Level 4'
	};

	/** @param {string} code */
	function cl(code) {
		return classLabel[code] || code;
	}

	/** @type {Record<string, Chart>} */
	let charts = {};
	let mounted = false;
	// Monthly breakdown year filter — all checked by default
	/** @type {Record<number, boolean>} */
	let selectedMonthlyYears = {};

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
		return years.sort((a, b) => a - b);
	})();

	// Initialize monthly year checkboxes — all checked by default
	$: {
		if (availableMonthlyYears.length > 0 && Object.keys(selectedMonthlyYears).length === 0) {
			availableMonthlyYears.forEach((y) => { selectedMonthlyYears[y] = true; });
			selectedMonthlyYears = selectedMonthlyYears;
		}
	}

	$: activeMonthlyYears = Object.entries(selectedMonthlyYears)
		.filter(([, v]) => v)
		.map(([k]) => Number(k));

	$: allMonthlyYearsSelected = availableMonthlyYears.length > 0 && availableMonthlyYears.every((y) => selectedMonthlyYears[y]);

	/** @param {number} year */
	function toggleMonthlyYear(year) {
		selectedMonthlyYears[year] = !selectedMonthlyYears[year];
		selectedMonthlyYears = selectedMonthlyYears;
	}

	/** @param {boolean} checked */
	function toggleAllMonthlyYears(checked) {
		availableMonthlyYears.forEach((y) => { selectedMonthlyYears[y] = checked; });
		selectedMonthlyYears = selectedMonthlyYears;
	}

	// Filter monthly data by selected years
	$: filteredMonthly = (() => {
		if (!data.monthlyFunnel) return [];
		if (activeMonthlyYears.length === 0) return [];
		return data.monthlyFunnel.filter((r) => {
			const year = new Date(r.reg_month + 'T12:00:00').getFullYear();
			return activeMonthlyYears.includes(year);
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

			if (activeMonthlyYears.length !== 1) {
				// Multiple years or all — show each month with year label
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
				// Single year — aggregate by month
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
					labels: [`${cl('CT1')} → ${cl('CT2')}`, `${cl('CT2')} → ${cl('CT3')}`, `${cl('CT3')} → ${cl('AGT1')}`],
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
					labels: [`${cl('CT1')} → ${cl('CT2')}`, `${cl('CT2')} → ${cl('CT3')}`, `${cl('CT3')} → ${cl('AGT1')}`],
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
			const yearLabel = activeMonthlyYears.length === availableMonthlyYears.length ? 'All Years' : activeMonthlyYears.join(', ');

			createChart('monthlyCT1Chart', {
				type: 'bar',
				data: {
					labels: monthlyChartData.ct1.labels,
					datasets: [
						{
							label: `Did Not Take ${cl('CT2')}`,
							data: monthlyChartData.ct1.stopped,
							backgroundColor: '#ef4444'
						},
						{
							label: `Continued to ${cl('CT2')}`,
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
						title: { display: true, text: `${cl('CT1')} Students - Continued to ${cl('CT2')} (${yearLabel})` }
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
							label: `Did Not Take ${cl('CT3')}`,
							data: monthlyChartData.ct2.stopped,
							backgroundColor: '#ef4444'
						},
						{
							label: `Continued to ${cl('CT3')}`,
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
						title: { display: true, text: `${cl('CT2')} Students - Continued to ${cl('CT3')} (${yearLabel})` }
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
							label: `Did Not Take ${cl('AGT1')}`,
							data: monthlyChartData.ct3.stopped,
							backgroundColor: '#ef4444'
						},
						{
							label: `Continued to ${cl('AGT1')}`,
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
						title: { display: true, text: `${cl('CT3')} Students - Continued to ${cl('AGT1')} (${yearLabel})` }
					},
					scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } }
				}
			});
		}, 150);
	}

	// PDF generation state
	let reportTitle = 'Registration Funnel Report';
	let generating = false;
	let pdfIncludeOverall = true;
	let pdfIncludeMonthly = true;
	let pdfNotesOverall = '';
	let pdfNotesMonthly = '';

	/** @param {any} d */
	function formatDateTime(d) {
		if (!d) return '—';
		const x = new Date(d);
		return isNaN(x.getTime()) ? '—' : x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
	}
	/** @param {any} b */
	function formatBytes(b) {
		if (!b) return '—';
		if (b < 1024) return b + ' B';
		if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
		return (b / (1024 * 1024)).toFixed(1) + ' MB';
	}

	async function generateAndSavePDF() {
		generating = true;
		try {
			// Load jsPDF on demand
			if (!window.jspdf) {
				const cdns = [
					'https://unpkg.com/jspdf@2.5.2/dist/jspdf.umd.min.js',
					'https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js',
					'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js',
				];
				let loaded = false;
				for (const src of cdns) {
					try {
						await new Promise((resolve, reject) => {
							const s = document.createElement('script');
							s.src = src;
							s.onload = resolve;
							s.onerror = () => reject(new Error(`Failed to load from ${src}`));
							document.head.appendChild(s);
						});
						if (window.jspdf) { loaded = true; break; }
					} catch { /* try next CDN */ }
				}
				if (!loaded) throw new Error('Could not load jsPDF from any CDN.');
			}
			// @ts-ignore
			const { jsPDF } = window.jspdf;
			const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
			const pageW = doc.internal.pageSize.getWidth();
			const pageH = doc.internal.pageSize.getHeight();
			const margin = 50;
			const contentW = pageW - margin * 2;
			let y = margin;

			// Title
			doc.setFontSize(22);
			doc.setFont('helvetica', 'bold');
			doc.text(reportTitle, margin, y + 22);
			y += 40;

			// Metadata
			doc.setFontSize(11);
			doc.setFont('helvetica', 'normal');
			doc.setTextColor(100);
			doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, y);
			doc.setTextColor(0);
			y += 20;
			doc.setDrawColor(200);
			doc.line(margin, y, pageW - margin, y);
			y += 20;

			// Sections
			const sections = [
				{ include: pdfIncludeOverall, title: 'Overall Progression', notes: pdfNotesOverall, charts: [
					{ id: 'funnelChart' },
					{ id: 'conversionChart' },
				]},
				{ include: pdfIncludeMonthly, title: 'Monthly Breakdown', notes: pdfNotesMonthly, charts: [
					{ id: 'monthlyCT1Chart' },
					{ id: 'monthlyCT2Chart' },
					{ id: 'monthlyCT3Chart' },
				]},
			];

			for (const section of sections) {
				if (!section.include) continue;

				// Section header
				if (y + 40 > pageH - margin) { doc.addPage(); y = margin; }
				doc.setFontSize(15);
				doc.setFont('helvetica', 'bold');
				doc.text(section.title, margin, y);
				y += 8;
				doc.setDrawColor(180);
				doc.line(margin, y, pageW - margin, y);
				y += 12;

				// Charts side by side where possible
				const chartW = (contentW - 10) / 2;
				const chartH = 180;
				for (let i = 0; i < section.charts.length; i += 2) {
					if (y + chartH + 10 > pageH - margin) { doc.addPage(); y = margin; }
					const cvL = /** @type {HTMLCanvasElement | null} */ (document.getElementById(section.charts[i]?.id));
					const cvR = section.charts[i + 1] ? /** @type {HTMLCanvasElement | null} */ (document.getElementById(section.charts[i + 1].id)) : null;
					if (cvL) doc.addImage(cvL.toDataURL('image/png', 1.0), 'PNG', margin, y, chartW, chartH);
					if (cvR) doc.addImage(cvR.toDataURL('image/png', 1.0), 'PNG', margin + chartW + 10, y, chartW, chartH);
					y += chartH + 15;
				}

				// Section notes
				if (section.notes.trim()) {
					doc.setFontSize(10);
					doc.setFont('helvetica', 'normal');
					doc.setTextColor(80);
					const noteLines = typeof doc.splitTextToSize === 'function'
						? doc.splitTextToSize(section.notes.trim(), contentW)
						: section.notes.trim().split('\n');
					for (const line of noteLines) {
						if (y + 14 > pageH - margin) { doc.addPage(); y = margin; }
						doc.text(String(line), margin, y);
						y += 14;
					}
					doc.setTextColor(0);
				}

				y += 25;
			}

			const chartIds = sections.filter(s => s.include).flatMap(s => s.charts.map(c => c.id));

			// Download PDF
			const pdfBase64 = doc.output('datauristring').split(',')[1];
			doc.save(reportTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf');

			// Save to server
			const activeYears = Object.entries(selectedOverallYears).filter(([, v]) => v).map(([k]) => k);
			const earliest = activeYears.length > 0 ? Math.min(...activeYears.map(Number)) : new Date().getFullYear();
			const latest = activeYears.length > 0 ? Math.max(...activeYears.map(Number)) : new Date().getFullYear();

			const fd = new FormData();
			fd.append('report_title', reportTitle);
			fd.append('date_range_start', `${earliest}-01-01`);
			fd.append('date_range_end', `${latest}-12-31`);
			fd.append('filters', JSON.stringify({ overallYears: activeYears, monthlyYears: activeMonthlyYears }));
			fd.append('charts', JSON.stringify(chartIds.filter(id => document.getElementById(id))));
			fd.append('pdf_base64', pdfBase64);

			const resp = await fetch('?/generate_pdf', {
				method: 'POST',
				body: fd,
				headers: { 'x-sveltekit-action': 'true' },
			});
			const text = await resp.text();
			if (resp.ok && text.includes('"success"')) {
				alert('Report saved successfully!');
				window.location.reload();
			} else {
				console.warn('Save response:', resp.status, text.slice(0, 500));
				alert('PDF downloaded but may not have saved to database.');
			}
		} catch (/** @type {any} */ err) {
			console.error('PDF error:', err);
			alert('Error generating PDF: ' + (err?.message || err?.toString() || JSON.stringify(err)));
		} finally {
			generating = false;
		}
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

	{#if form?.success}
		<div class="alert alert-success">{form.message}</div>
	{:else if form?.error}
		<div class="alert alert-error">{form.error}</div>
	{/if}

	<!-- PDF Generation -->
	<div class="pdf-panel">
		<div class="pdf-panel-row">
			<div class="pdf-title-group">
				<label for="reportTitle">Report Title</label>
				<input type="text" id="reportTitle" bind:value={reportTitle}
					placeholder="e.g. Q1 2026 Registration Funnel" class="pdf-title-input" />
			</div>
			<button class="btn-generate" on:click={generateAndSavePDF}
				disabled={generating || !mounted || (!pdfIncludeOverall && !pdfIncludeMonthly)}>
				{generating ? 'Generating...' : 'Generate & Download PDF'}
			</button>
		</div>
		<div class="pdf-includes">
			<span class="pdf-sections-label">Include in PDF:</span>
			<label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeOverall} /> Overall Progression</label>
			<label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeMonthly} /> Monthly Breakdown</label>
		</div>
	</div>

	{#if browser && mounted}
		<!-- Summary Cards -->
		{#if funnel}
			<div class="summary-cards">
				<div class="card">
					<div class="card-label">{cl('CT1')} Students</div>
					<div class="card-value">{funnel.ct1_total}</div>
				</div>
				<div class="card">
					<div class="card-label">{cl('CT2')} Students</div>
					<div class="card-value">{funnel.ct2_total}</div>
				</div>
				<div class="card">
					<div class="card-label">{cl('CT3')} Students</div>
					<div class="card-value">{funnel.ct3_total}</div>
				</div>
				<div class="card">
					<div class="card-label">{cl('AGT1')} Students</div>
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

			{#if pdfIncludeOverall}
				<div class="section-notes">
					<label class="section-notes-label">PDF Notes — Overall Progression</label>
					<textarea class="section-notes-input" bind:value={pdfNotesOverall} placeholder="Add notes for this section..." rows="2"></textarea>
				</div>
			{/if}
		</section>

		<!-- Monthly Breakdown Section -->
		<section class="chart-section">
			<h2 class="section-title">Monthly Breakdown</h2>

			<div class="filter-section">
				<div class="filter-group">
					<span class="filter-heading">Years:</span>
					<label class="checkbox-label">
						<input type="checkbox"
							checked={allMonthlyYearsSelected}
							on:change={(e) => toggleAllMonthlyYears(/** @type {HTMLInputElement} */ (e.target).checked)} />
						<span>All</span>
					</label>
					<div class="year-checkboxes">
						{#each availableMonthlyYears as year (year)}
							<label class="checkbox-label">
								<input type="checkbox"
									checked={selectedMonthlyYears[year]}
									on:change={() => toggleMonthlyYear(year)} />
								<span>{year}</span>
							</label>
						{/each}
					</div>
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

			{#if pdfIncludeMonthly}
				<div class="section-notes">
					<label class="section-notes-label">PDF Notes — Monthly Breakdown</label>
					<textarea class="section-notes-input" bind:value={pdfNotesMonthly} placeholder="Add notes for this section..." rows="2"></textarea>
				</div>
			{/if}
		</section>
	{:else}
		<div class="loading">Loading charts...</div>
	{/if}

	{#if data.pastReports && data.pastReports.length > 0}
		<section class="chart-section past-reports">
			<h2 class="section-title">Previously Generated Reports</h2>
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th>Title</th>
							<th>Generated</th>
							<th>By</th>
							<th>Size</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each data.pastReports as report (report.report_id)}
							<tr>
								<td>{report.report_title}</td>
								<td>{formatDateTime(report.created_at)}</td>
								<td>{report.generated_by || '—'}</td>
								<td>{formatBytes(report.file_size_bytes)}</td>
								<td>
									<a href="/hsi/reports/download/{report.report_id}" class="btn-download" target="_blank">Download</a>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		</section>
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

	/* Alerts */
	.alert { padding: 0.875rem 1.25rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
	.alert-success { background-color: #dcfce7; color: #166534; }
	.alert-error { background-color: #fee2e2; color: #991b1b; }

	/* PDF Panel */
	.pdf-panel {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}
	.pdf-panel-row {
		display: flex;
		align-items: flex-end;
		gap: 1.5rem;
	}
	.pdf-title-group {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.pdf-title-group label {
		font-weight: 600;
		font-size: 0.85rem;
		color: #374151;
	}
	.pdf-title-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 1rem;
		width: 100%;
	}
	.pdf-title-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
	.btn-generate {
		padding: 0.6rem 1.5rem;
		background-color: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		white-space: nowrap;
		transition: background-color 0.2s;
	}
	.btn-generate:hover:not(:disabled) { background-color: #2563eb; }
	.btn-generate:disabled { opacity: 0.5; cursor: not-allowed; }

	.pdf-includes {
		display: flex;
		align-items: center;
		gap: 1.25rem;
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid #f3f4f6;
		flex-wrap: wrap;
	}
	.pdf-sections-label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.pdf-section-toggle {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 0.875rem;
		color: #374151;
		cursor: pointer;
	}
	.pdf-section-toggle input { cursor: pointer; accent-color: #3b82f6; }

	/* Section notes */
	.section-notes {
		margin-top: 1.25rem;
		padding-top: 1rem;
		border-top: 1px solid #e5e7eb;
	}
	.section-notes-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin-bottom: 0.4rem;
	}
	.section-notes-input {
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-family: inherit;
		resize: vertical;
		color: #374151;
		box-sizing: border-box;
	}
	.section-notes-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
	.section-notes-input::placeholder { color: #9ca3af; }

	/* Past reports table */
	.past-reports {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
	}
	.table-wrapper { overflow-x: auto; }
	.past-reports table { width: 100%; border-collapse: collapse; }
	.past-reports th {
		padding: 0.75rem 1rem;
		text-align: left;
		font-weight: 600;
		color: #374151;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		border-bottom: 2px solid #e5e7eb;
	}
	.past-reports td {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid #f3f4f6;
		color: #1a202c;
	}
	.past-reports tr:hover { background-color: #f9fafb; }
	.btn-download {
		display: inline-block;
		padding: 0.3rem 0.75rem;
		background-color: #e5e7eb;
		color: #374151;
		border-radius: 0.375rem;
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 500;
		transition: background-color 0.2s;
	}
	.btn-download:hover { background-color: #d1d5db; }
</style>
