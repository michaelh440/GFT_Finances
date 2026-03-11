<!-- src/routes/reports/2026/monthly_reporting/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Chart from 'chart.js/auto';

	/** @type {any} */
	export let data;
	export let form;

	let mounted = false;
	/** @type {Record<string, Chart>} */
	let charts = {};
	let generating = false;

	// ---- Report Config ----
	let reportTitle = '';
	let dateStart = '';
	let dateEnd = '';
	let selectedDatasets = ['show', 'class'];
	let selectedCharts = ['revenue_by_source', 'units_sold', 'revenue_split', 'ytd_revenue', 'item_breakdown'];

	const datasetOptions = [
		{ value: 'show', label: 'Shows' },
		{ value: 'class', label: 'Classes' }
	];

	const chartOptions = [
		{ value: 'revenue_by_source', label: 'Total Revenue (stacked bar by source)' },
		{ value: 'units_sold', label: 'Units Sold — Tickets & Registrations' },
		{ value: 'revenue_split', label: 'Revenue by Source (doughnut)' },
		{ value: 'ytd_revenue', label: 'YTD Cumulative Revenue (line)' },
		{ value: 'item_breakdown', label: 'Revenue by Individual Show/Class' }
	];

	// ---- Auto-generate title ----
	$: if (dateStart && dateEnd) {
		const s = new Date(dateStart + '-01T12:00:00');
		const e = new Date(dateEnd + '-01T12:00:00');
		const sf = s.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		const ef = e.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		if (!reportTitle || reportTitle.startsWith('Report:')) {
			reportTitle = `Report: ${sf} – ${ef}`;
		}
	}

	// ---- Filter data ----
	$: filteredData = /** @type {any[]} */ ((data.summaries || []).filter((/** @type {any} */ s) => {
		if (!selectedDatasets.includes(s.source_type)) return false;
		if (dateStart && s.summary_month < dateStart + '-01') return false;
		if (dateEnd && s.summary_month > dateEnd + '-28') return false;
		return true;
	}));

	// ---- Summary stats ----
	$: totalRevenue = filteredData.reduce((/** @type {number} */ sum, /** @type {any} */ s) => sum + s.revenue, 0);
	$: totalUnits = filteredData.reduce((/** @type {number} */ sum, /** @type {any} */ s) => sum + s.unit_count, 0);
	$: showRevenue = filteredData.filter((/** @type {any} */ s) => s.source_type === 'show').reduce((/** @type {number} */ sum, /** @type {any} */ s) => sum + s.revenue, 0);
	$: classRevenue = filteredData.filter((/** @type {any} */ s) => s.source_type === 'class').reduce((/** @type {number} */ sum, /** @type {any} */ s) => sum + s.revenue, 0);
	$: showUnits = filteredData.filter((/** @type {any} */ s) => s.source_type === 'show').reduce((/** @type {number} */ sum, /** @type {any} */ s) => sum + s.unit_count, 0);
	$: classUnits = filteredData.filter((/** @type {any} */ s) => s.source_type === 'class').reduce((/** @type {number} */ sum, /** @type {any} */ s) => sum + s.unit_count, 0);

	// ---- Chart data ----
	const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
	const showColor = '#3b82f6';
	const classColor = '#8b5cf6';
	const yearColors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

	$: selectedYears = [...new Set(filteredData.map((/** @type {any} */ s) => s.summary_year))].sort();

	$: chartDataByYear = (() => {
		/** @type {Record<number, any>} */
		const byYear = {};
		for (const yr of selectedYears) {
			byYear[yr] = { showRevenue: Array(12).fill(0), classRevenue: Array(12).fill(0), showUnits: Array(12).fill(0), classUnits: Array(12).fill(0) };
		}
		for (const s of filteredData) {
			if (!byYear[s.summary_year]) continue;
			const mi = s.summary_month_num - 1;
			if (s.source_type === 'show') {
				byYear[s.summary_year].showRevenue[mi] += s.revenue;
				byYear[s.summary_year].showUnits[mi] += s.unit_count;
			} else {
				byYear[s.summary_year].classRevenue[mi] += s.revenue;
				byYear[s.summary_year].classUnits[mi] += s.unit_count;
			}
		}
		return byYear;
	})();

	// ---- Item breakdown data ----
	$: itemData = (() => {
		/** @type {Record<string, any>} */
		const byItem = {};
		for (const s of filteredData) {
			if (!byItem[s.item_code]) byItem[s.item_code] = { name: s.item_name, source: s.source_type, revenue: 0, units: 0 };
			byItem[s.item_code].revenue += s.revenue;
			byItem[s.item_code].units += s.unit_count;
		}
		return Object.values(byItem).sort((a, b) => b.revenue - a.revenue);
	})();

	// ---- Monthly table ----
	$: monthlyRows = (() => {
		/** @type {Record<string, any>} */
		const byMonth = {};
		for (const s of filteredData) {
			const key = s.summary_month;
			if (!byMonth[key]) byMonth[key] = { month: key, showRevenue: 0, showUnits: 0, classRevenue: 0, classUnits: 0 };
			if (s.source_type === 'show') { byMonth[key].showRevenue += s.revenue; byMonth[key].showUnits += s.unit_count; }
			else { byMonth[key].classRevenue += s.revenue; byMonth[key].classUnits += s.unit_count; }
		}
		return Object.values(byMonth).sort((a, b) => a.month.localeCompare(b.month));
	})();

	// ---- Render charts ----
	function destroyCharts() {
		Object.values(charts).forEach((c) => c.destroy());
		charts = {};
	}

	function renderCharts() {
		if (!browser || !mounted || !dateStart || !dateEnd) return;
		destroyCharts();

		setTimeout(() => {
			const latestYear = selectedYears.length > 0 ? Math.max(...selectedYears) : new Date().getFullYear();
			const yearData = chartDataByYear[latestYear];

			// Chart 1: Revenue by Source
			if (selectedCharts.includes('revenue_by_source') && yearData) {
				const ctx = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-revenue-source'));
				if (ctx) {
					charts['revenue_by_source'] = new Chart(ctx, {
						type: 'bar',
						data: {
							labels: monthLabels,
							datasets: [
								{ label: `Shows ${latestYear}`, data: yearData.showRevenue, backgroundColor: showColor, stack: 's' },
								{ label: `Classes ${latestYear}`, data: yearData.classRevenue, backgroundColor: classColor, stack: 's' }
							]
						},
						options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true, ticks: { callback: (v) => '$' + Number(v).toLocaleString() } } } }
					});
				}
			}

			// Chart 2: Units Sold
			if (selectedCharts.includes('units_sold') && yearData) {
				const ctx = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-units-sold'));
				if (ctx) {
					charts['units_sold'] = new Chart(ctx, {
						type: 'bar',
						data: {
							labels: monthLabels,
							datasets: [
								{ label: `Tickets ${latestYear}`, data: yearData.showUnits, backgroundColor: showColor, stack: 's' },
								{ label: `Registrations ${latestYear}`, data: yearData.classUnits, backgroundColor: classColor, stack: 's' }
							]
						},
						options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } }, scales: { x: { stacked: true }, y: { stacked: true } } }
					});
				}
			}

			// Chart 3: Revenue split doughnut
			if (selectedCharts.includes('revenue_split') && totalRevenue > 0) {
				const ctx = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-revenue-split'));
				if (ctx) {
					charts['revenue_split'] = new Chart(ctx, {
						type: 'doughnut',
						data: {
							labels: ['Shows', 'Classes'],
							datasets: [{ data: [showRevenue, classRevenue], backgroundColor: [showColor, classColor] }]
						},
						options: {
							responsive: true, animation: false,
							plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => { const pct = ((c.parsed / totalRevenue) * 100).toFixed(1); return `${c.label}: $${c.parsed.toLocaleString()} (${pct}%)`; } } } }
						}
					});
				}
			}

			// Chart 4: YTD Cumulative
			if (selectedCharts.includes('ytd_revenue')) {
				const ctx = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-ytd-revenue'));
				if (ctx) {
					const datasets = /** @type {any[]} */ (selectedYears.map((yr, i) => {
						const yd = chartDataByYear[yr];
						if (!yd) return null;
						const total = yd.showRevenue.map((/** @type {number} */ s, /** @type {number} */ mi) => s + yd.classRevenue[mi]);
						const cum = []; let sum = 0;
						for (const v of total) { sum += v; cum.push(sum); }
						return { label: String(yr), data: cum, borderColor: yearColors[i % yearColors.length], backgroundColor: 'transparent', borderWidth: 2, tension: 0.3, pointRadius: 3 };
					}).filter(Boolean));

					charts['ytd_revenue'] = new Chart(ctx, {
						type: 'line',
						data: { labels: monthLabels, datasets },
						options: { responsive: true, animation: false, plugins: { legend: { position: 'top' } }, scales: { y: { ticks: { callback: (v) => '$' + Number(v).toLocaleString() } } } }
					});
				}
			}

			// Chart 5: Item breakdown
			if (selectedCharts.includes('item_breakdown') && itemData.length > 0) {
				const ctx = /** @type {HTMLCanvasElement} */ (document.getElementById('chart-item-breakdown'));
				if (ctx) {
					const top15 = itemData.slice(0, 15);
					charts['item_breakdown'] = new Chart(ctx, {
						type: 'bar',
						data: {
							labels: top15.map((d) => d.name),
							datasets: [{ label: 'Revenue', data: top15.map((d) => d.revenue), backgroundColor: top15.map((d) => d.source === 'show' ? showColor : classColor) }]
						},
						options: { responsive: true, animation: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { ticks: { callback: (v) => '$' + Number(v).toLocaleString() } } } }
					});
				}
			}
		}, 150);
	}

	$: if (mounted && dateStart && dateEnd && selectedCharts && selectedDatasets) {
		renderCharts();
	}

	onMount(() => { mounted = true; });
	onDestroy(() => { destroyCharts(); });

	// ---- PDF Generation (client-side using jsPDF) ----
	async function generateAndSavePDF() {
		generating = true;

		try {
			// Dynamically import jsPDF
			// @ts-ignore - CDN dynamic import
			const { default: jsPDF } = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');

			const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' });
			const pageW = doc.internal.pageSize.getWidth();
			const pageH = doc.internal.pageSize.getHeight();
			const margin = 50;
			const contentW = pageW - margin * 2;
			let y = margin;

			// ---- Title page ----
			doc.setFontSize(22);
			doc.setFont('helvetica', 'bold');
			doc.text(reportTitle, margin, y + 22);
			y += 40;

			doc.setFontSize(11);
			doc.setFont('helvetica', 'normal');
			doc.setTextColor(100);
			const s = new Date(dateStart + '-01T12:00:00');
			const e = new Date(dateEnd + '-01T12:00:00');
			const dateLabel = `${s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`;
			doc.text(dateLabel, margin, y);
			y += 8;
			doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, y);
			doc.setTextColor(0);
			y += 25;

			// Divider
			doc.setDrawColor(200);
			doc.line(margin, y, pageW - margin, y);
			y += 20;

			// ---- Summary stats ----
			doc.setFontSize(14);
			doc.setFont('helvetica', 'bold');
			doc.text('Summary', margin, y);
			y += 20;

			doc.setFontSize(10);
			doc.setFont('helvetica', 'normal');
			const stats = [
				['Total Revenue', '$' + totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })],
				['Show Revenue', '$' + showRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })],
				['Class Revenue', '$' + classRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })],
				['Total Tickets', showUnits.toLocaleString()],
				['Total Registrations', classUnits.toLocaleString()],
				['Datasets', selectedDatasets.map(d => d === 'show' ? 'Shows' : 'Classes').join(', ')]
			];

			for (const [label, value] of stats) {
				doc.setFont('helvetica', 'bold');
				doc.text(label + ':', margin + 10, y);
				doc.setFont('helvetica', 'normal');
				doc.text(value, margin + 140, y);
				y += 15;
			}
			y += 10;

			// ---- Charts ----
			const chartIds = [
				{ key: 'revenue_by_source', id: 'chart-revenue-source', title: 'Monthly Revenue by Source' },
				{ key: 'units_sold', id: 'chart-units-sold', title: 'Monthly Units Sold' },
				{ key: 'revenue_split', id: 'chart-revenue-split', title: 'Revenue Split' },
				{ key: 'ytd_revenue', id: 'chart-ytd-revenue', title: 'YTD Cumulative Revenue' },
				{ key: 'item_breakdown', id: 'chart-item-breakdown', title: 'Revenue by Show/Class' }
			];

			for (const chart of chartIds) {
				if (!selectedCharts.includes(chart.key)) continue;
				const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById(chart.id));
				if (!canvas) continue;

				const imgData = canvas.toDataURL('image/png', 1.0);

				// Check if we need a new page
				const chartH = chart.key === 'revenue_split' ? 250 : 220;
				if (y + chartH + 30 > pageH - margin) {
					doc.addPage();
					y = margin;
				}

				doc.setFontSize(12);
				doc.setFont('helvetica', 'bold');
				doc.text(chart.title, margin, y);
				y += 15;

				const imgW = chart.key === 'revenue_split' ? contentW * 0.6 : contentW;
				const imgX = chart.key === 'revenue_split' ? margin + (contentW - imgW) / 2 : margin;
				doc.addImage(imgData, 'PNG', imgX, y, imgW, chartH);
				y += chartH + 20;
			}

			// ---- Monthly table ----
			if (monthlyRows.length > 0) {
				if (y + 100 > pageH - margin) { doc.addPage(); y = margin; }

				doc.setFontSize(12);
				doc.setFont('helvetica', 'bold');
				doc.text('Monthly Breakdown', margin, y);
				y += 18;

				// Table header
				doc.setFontSize(8);
				doc.setFont('helvetica', 'bold');
				doc.setFillColor(249, 250, 251);
				doc.rect(margin, y - 10, contentW, 14, 'F');
				const cols = [margin, margin + 80, margin + 150, margin + 230, margin + 310, margin + 400];
				const headers = ['Month', 'Show Tickets', 'Show Revenue', 'Class Regs', 'Class Revenue', 'Total Revenue'];
				headers.forEach((h, i) => doc.text(h, cols[i], y));
				y += 8;
				doc.setDrawColor(200);
				doc.line(margin, y, pageW - margin, y);
				y += 10;

				// Table rows
				doc.setFont('helvetica', 'normal');
				for (const row of monthlyRows) {
					if (y + 14 > pageH - margin) { doc.addPage(); y = margin + 15; }
					const mDate = new Date(row.month + 'T12:00:00');
					const mLabel = mDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
					doc.text(mLabel, cols[0], y);
					doc.text(row.showUnits.toLocaleString(), cols[1], y);
					doc.text('$' + row.showRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 }), cols[2], y);
					doc.text(row.classUnits.toLocaleString(), cols[3], y);
					doc.text('$' + row.classRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 }), cols[4], y);
					doc.setFont('helvetica', 'bold');
					doc.text('$' + (row.showRevenue + row.classRevenue).toLocaleString(undefined, { minimumFractionDigits: 2 }), cols[5], y);
					doc.setFont('helvetica', 'normal');
					y += 14;
				}

				// Totals
				y += 2;
				doc.setDrawColor(100);
				doc.line(margin, y, pageW - margin, y);
				y += 12;
				doc.setFont('helvetica', 'bold');
				doc.text('TOTAL', cols[0], y);
				doc.text(showUnits.toLocaleString(), cols[1], y);
				doc.text('$' + showRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 }), cols[2], y);
				doc.text(classUnits.toLocaleString(), cols[3], y);
				doc.text('$' + classRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 }), cols[4], y);
				doc.text('$' + totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 }), cols[5], y);
			}

			// ---- Get PDF as base64 ----
			const pdfBase64 = doc.output('datauristring').split(',')[1];

			// Also trigger download
			doc.save(reportTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf');

			// Submit to server to save
			const formDataObj = new FormData();
			formDataObj.append('report_title', reportTitle);
			formDataObj.append('date_range_start', dateStart);
			formDataObj.append('date_range_end', dateEnd);
			formDataObj.append('datasets', JSON.stringify(selectedDatasets));
			formDataObj.append('charts', JSON.stringify(selectedCharts));
			formDataObj.append('pdf_base64', pdfBase64);
			formDataObj.append('summary_stats', JSON.stringify({ totalRevenue, showRevenue, classRevenue, showUnits, classUnits }));

			const response = await fetch('?/generate_pdf', {
				method: 'POST',
				body: formDataObj
			});

			const result = await response.json();
			// SvelteKit wraps the response
			const actionData = result?.data ? JSON.parse(result.data) : result;

			if (actionData?.[1]?.success || actionData?.success) {
				alert('Report saved successfully!');
				window.location.reload();
			}

		} catch (error) {
			console.error('PDF generation error:', error);
			alert('Error generating PDF: ' + /** @type {Error} */ (error).message);
		} finally {
			generating = false;
		}
	}

	function formatCurrency(/** @type {number} */ amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}

	function formatDate(/** @type {string} */ dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr + (dateStr.includes('T') ? '' : 'T12:00:00'));
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}

	function formatDateTime(/** @type {string} */ dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr);
		if (isNaN(d.getTime())) return '—';
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
	}

	function formatBytes(/** @type {number} */ bytes) {
		if (!bytes) return '—';
		if (bytes < 1024) return bytes + ' B';
		if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
		return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
	}

	function toggleDataset(/** @type {string} */ val) {
		if (selectedDatasets.includes(val)) {
			if (selectedDatasets.length > 1) selectedDatasets = selectedDatasets.filter((d) => d !== val);
		} else {
			selectedDatasets = [...selectedDatasets, val];
		}
	}

	function toggleChart(/** @type {string} */ val) {
		if (selectedCharts.includes(val)) {
			selectedCharts = selectedCharts.filter((c) => c !== val);
		} else {
			selectedCharts = [...selectedCharts, val];
		}
	}

	$: canGenerate = dateStart && dateEnd && selectedDatasets.length > 0 && selectedCharts.length > 0 && filteredData.length > 0;
</script>

<svelte:head>
	<title>Monthly Report Generator | B&C Financial Tracker</title>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js"></script>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve(/** @type {any} */ ('/reports/2026'))} class="back-link">← Back to Reports</a>
			<h1>Monthly Report Generator</h1>
			<p class="subtitle">Configure, preview, and generate PDF reports</p>
		</div>
	</header>

	<!-- Config Panel -->
	<div class="config-panel">
		<div class="config-grid">
			<!-- Date Range -->
			<div class="config-section">
				<h3>Date Range</h3>
				<div class="date-inputs">
					<div class="form-group">
						<label for="date-start">From</label>
						<input type="month" id="date-start" bind:value={dateStart} />
					</div>
					<div class="form-group">
						<label for="date-end">To</label>
						<input type="month" id="date-end" bind:value={dateEnd} />
					</div>
				</div>
			</div>

			<!-- Datasets -->
			<div class="config-section">
				<h3>Data Sources</h3>
				<div class="checkbox-group">
					{#each datasetOptions as opt (opt.value)}
						<label class="check-label">
							<input type="checkbox" checked={selectedDatasets.includes(opt.value)} on:change={() => toggleDataset(opt.value)} />
							{opt.label}
						</label>
					{/each}
				</div>
			</div>

			<!-- Charts -->
			<div class="config-section">
				<h3>Charts to Include</h3>
				<div class="checkbox-group">
					{#each chartOptions as opt (opt.value)}
						<label class="check-label">
							<input type="checkbox" checked={selectedCharts.includes(opt.value)} on:change={() => toggleChart(opt.value)} />
							{opt.label}
						</label>
					{/each}
				</div>
			</div>

			<!-- Title -->
			<div class="config-section">
				<h3>Report Title</h3>
				<input type="text" bind:value={reportTitle} placeholder="e.g. Q1 2026 Financial Summary" class="title-input" />
			</div>
		</div>

		<div class="config-actions">
			<button class="btn-primary" on:click={generateAndSavePDF} disabled={!canGenerate || generating}>
				{generating ? 'Generating PDF...' : '📄 Generate & Download PDF'}
			</button>
			{#if !dateStart || !dateEnd}
				<span class="config-hint">Select a date range to preview</span>
			{:else if filteredData.length === 0}
				<span class="config-hint">No data for selected range and sources</span>
			{/if}
		</div>
	</div>

	<!-- Preview -->
	{#if dateStart && dateEnd && filteredData.length > 0}
		<div class="preview-section">
			<h2>Preview</h2>

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
			</div>

			<!-- Charts -->
			{#if browser && mounted}
				<div class="charts-grid">
					{#if selectedCharts.includes('revenue_by_source')}
						<div class="chart-card wide">
							<h3>Monthly Revenue by Source</h3>
							<canvas id="chart-revenue-source"></canvas>
						</div>
					{/if}
					{#if selectedCharts.includes('units_sold')}
						<div class="chart-card wide">
							<h3>Monthly Units Sold</h3>
							<canvas id="chart-units-sold"></canvas>
						</div>
					{/if}
					{#if selectedCharts.includes('revenue_split')}
						<div class="chart-card">
							<h3>Revenue Split</h3>
							<canvas id="chart-revenue-split"></canvas>
						</div>
					{/if}
					{#if selectedCharts.includes('ytd_revenue')}
						<div class="chart-card">
							<h3>YTD Cumulative Revenue</h3>
							<canvas id="chart-ytd-revenue"></canvas>
						</div>
					{/if}
					{#if selectedCharts.includes('item_breakdown')}
						<div class="chart-card wide">
							<h3>Revenue by Show/Class</h3>
							<canvas id="chart-item-breakdown"></canvas>
						</div>
					{/if}
				</div>
			{/if}

			<!-- Monthly Table -->
			{#if monthlyRows.length > 0}
				<div class="section">
					<h3>Monthly Breakdown</h3>
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
										<td>{formatDate(row.month)}</td>
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
									<td class="col-right total-value">{showUnits.toLocaleString()}</td>
									<td class="col-right total-value">{formatCurrency(showRevenue)}</td>
									<td class="col-right total-value">{classUnits.toLocaleString()}</td>
									<td class="col-right total-value">{formatCurrency(classRevenue)}</td>
									<td class="col-right total-value">{formatCurrency(totalRevenue)}</td>
								</tr>
							</tfoot>
						</table>
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Past Reports -->
	{#if data.pastReports && data.pastReports.length > 0}
		<div class="section past-reports">
			<h2>Previously Generated Reports</h2>
			<table>
				<thead>
					<tr>
						<th>Title</th>
						<th>Date Range</th>
						<th>Generated</th>
						<th>Size</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each data.pastReports as report (report.report_id)}
						<tr>
							<td class="report-title">{report.report_title}</td>
							<td>{formatDate(report.date_range_start)} – {formatDate(report.date_range_end)}</td>
							<td>{formatDateTime(report.created_at)}</td>
							<td>{formatBytes(report.file_size_bytes)}</td>
							<td>
								<a href={resolve(/** @type {any} */ (`/reports/2026/monthly_reporting/download/${report.report_id}`))} class="btn-download" target="_blank">Download</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1.25rem; font-weight: 600; color: #1a202c; margin: 0 0 1rem 0; }
	h3 { font-size: 1rem; font-weight: 600; color: #374151; margin: 0 0 0.5rem 0; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; }

	/* Config Panel */
	.config-panel { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
	.config-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
	.config-section { display: flex; flex-direction: column; gap: 0.5rem; }
	.date-inputs { display: flex; gap: 1rem; }
	.form-group { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; }
	.form-group label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
	.form-group input[type="month"] { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.9rem; }
	.form-group input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
	.checkbox-group { display: flex; flex-direction: column; gap: 0.35rem; }
	.check-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: #374151; cursor: pointer; }
	.check-label input { cursor: pointer; accent-color: #3b82f6; }
	.title-input { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.9rem; width: 100%; }
	.title-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
	.config-actions { display: flex; align-items: center; gap: 1rem; padding-top: 1rem; border-top: 1px solid #f3f4f6; }
	.config-hint { font-size: 0.85rem; color: #9ca3af; }

	/* Stats */
	.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
	.stat-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.25rem; }
	.stat-card.stat-show { border-top: 3px solid #3b82f6; }
	.stat-card.stat-class { border-top: 3px solid #8b5cf6; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	/* Preview */
	.preview-section { margin-bottom: 2rem; }

	/* Charts */
	.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
	.chart-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	.chart-card.wide { grid-column: 1 / -1; }

	/* Table */
	.section { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 2rem; }
	.table-wrapper { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.6rem 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; }
	td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f3f4f6; font-size: 0.9rem; }
	tr:hover { background-color: #f9fafb; }
	.col-right { text-align: right; }
	.total-cell { font-weight: 600; }
	tfoot td { border-top: 2px solid #e5e7eb; border-bottom: none; }
	.total-label { font-weight: 600; color: #374151; }
	.total-value { font-weight: 700; color: #1a202c; }

	/* Past Reports */
	.past-reports { margin-top: 2rem; }
	.report-title { font-weight: 500; }
	.btn-download { display: inline-block; padding: 0.3rem 0.75rem; background: #3b82f6; color: white; border-radius: 0.375rem; text-decoration: none; font-size: 0.8rem; font-weight: 500; }
	.btn-download:hover { background: #2563eb; }

	/* Buttons */
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-primary:disabled { background-color: #93c5fd; cursor: not-allowed; }

	@media (max-width: 768px) {
		.config-grid { grid-template-columns: 1fr; }
		.stats-row { grid-template-columns: repeat(2, 1fr); }
		.charts-grid { grid-template-columns: 1fr; }
		.chart-card.wide { grid-column: 1; }
		.date-inputs { flex-direction: column; }
	}
</style>