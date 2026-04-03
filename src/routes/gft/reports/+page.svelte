<!-- src/routes/shows/reports/+page.svelte -->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Chart from 'chart.js/auto';

	/**
	 * @typedef {Object} ShowItem
	 * @property {string} show_code
	 * @property {string} show_name
	 * @property {string} format
	 * @property {string} audience_type
	 * @property {string} day_of_week
	 * @property {number} standard_ticket_price
	 * @property {string} description
	 * @property {boolean} is_active
	 */

	/**
	 * @typedef {Object} Summary
	 * @property {string} show_code
	 * @property {string} summary_month
	 * @property {number} summary_year
	 * @property {number} tickets_sold
	 * @property {number} revenue
	 */

	/**
	 * @typedef {Object} MonthData
	 * @property {number} tickets_sold
	 * @property {number} revenue
	 */

	/** @type {{ shows: ShowItem[], summaries: Summary[], pastReports: any[] }} */
	export let data;
	/** @type {any} */
	export let form;

	let selectedShowCode = 'all';
	let selectedFormat = 'all';
	let selectedAudience = 'all';
	let selectedDay = 'all';
	/** @type {Record<string, Chart>} */
	let charts = {};
	let mounted = false;
	let generating = false;
	let reportTitle = 'GFT Show Report';

	// Revenue by item date range
	let itemDateStart = '';
	let itemDateEnd = '';

	// PDF section toggles
	let pdfIncludeMonthly = true;
	let pdfInclude4Month = true;
	let pdfIncludeYtd = true;
	let pdfIncludeMoM = true;
	let pdfIncludeItemRevenue = true;

	// PDF section notes
	let pdfNotesMonthly = '';
	let pdfNotes4Month = '';
	let pdfNotesYtd = '';
	let pdfNotesMoM = '';
	let pdfNotesItemRevenue = '';

	// Year filter states
	/** @type {number[]} */
	let availableYears = [];
	/** @type {number[]} */
	let selectedYearsMonthly = [];
	let selectedYearMoM = new Date().getFullYear();

	// 4-month rolling filter states
	let selectedMonth4M = new Date().getMonth(); // 0-11
	/** @type {number[]} */
	let selectedYears4M = [];

	onMount(() => {
		mounted = true;
	});
	onDestroy(() => {
		Object.values(charts).forEach((c) => c.destroy());
		charts = {};
	});

	// Get unique filter values from data
	$: uniqueFormats = [
		...new Set(data.shows.map((/** @type {ShowItem} */ s) => s.format).filter(Boolean))
	].sort();
	$: uniqueAudiences = [
		...new Set(data.shows.map((/** @type {ShowItem} */ s) => s.audience_type).filter(Boolean))
	].sort();
	$: uniqueDays = [
		...new Set(data.shows.map((/** @type {ShowItem} */ s) => s.day_of_week).filter(Boolean))
	].sort();

	$: filteredData = getFilteredData(
		selectedShowCode,
		selectedFormat,
		selectedAudience,
		selectedDay,
		data.summaries
	);

	// Extract available years from data
	$: {
		if (filteredData && filteredData.length > 0) {
			const years = [
				...new Set(filteredData.map((/** @type {Summary} */ s) => s.summary_year))
			].filter((y) => y >= 2016 && y <= 2030);

			availableYears = years.sort((a, b) => b - a);

			// Initialize selected years if empty
			if (selectedYearsMonthly.length === 0) {
				selectedYearsMonthly = availableYears.slice(0, Math.min(4, availableYears.length));
			} else {
				selectedYearsMonthly = selectedYearsMonthly.filter((y) => availableYears.includes(y));
				if (selectedYearsMonthly.length === 0) {
					selectedYearsMonthly = availableYears.slice(0, Math.min(4, availableYears.length));
				}
			}

			// Initialize 4-month rolling years
			if (selectedYears4M.length === 0) {
				selectedYears4M = availableYears.slice(0, Math.min(3, availableYears.length));
			} else {
				selectedYears4M = selectedYears4M.filter((y) => availableYears.includes(y));
				if (selectedYears4M.length === 0) {
					selectedYears4M = availableYears.slice(0, Math.min(3, availableYears.length));
				}
			}

			// Ensure selectedYearMoM is valid
			if (!availableYears.includes(selectedYearMoM)) {
				selectedYearMoM = availableYears[0] || new Date().getFullYear();
			}
		}
	}

	$: chartData = processChartData(
		filteredData,
		selectedYearsMonthly,
		selectedYearMoM,
		selectedMonth4M,
		selectedYears4M
	);

	// Initialize item date range to current year
	$: if (!itemDateStart && !itemDateEnd && filteredData.length > 0) {
		const now = new Date();
		itemDateStart = `${now.getFullYear()}-01`;
		itemDateEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
	}

	// Revenue by item — aggregate filtered data within the selected date range
	$: itemRevenueData = (() => {
		if (!filteredData || !itemDateStart || !itemDateEnd) return [];
		const startDate = itemDateStart + '-01';
		const endDate = itemDateEnd + '-28';
		/** @type {Record<string, { show_name: string, revenue: number, tickets: number }>} */
		const byShow = {};
		for (const s of filteredData) {
			if (s.summary_month < startDate || s.summary_month > endDate) continue;
			if (!byShow[s.show_code]) {
				byShow[s.show_code] = { show_name: s.show_name || s.show_code, revenue: 0, tickets: 0 };
			}
			byShow[s.show_code].revenue += s.revenue;
			byShow[s.show_code].tickets += s.tickets_sold;
		}
		return Object.values(byShow).filter((d) => d.revenue > 0).sort((a, b) => b.revenue - a.revenue);
	})();

	/**
	 * @param {string} showCode
	 * @param {string} format
	 * @param {string} audience
	 * @param {string} day
	 * @param {Summary[]} summaries
	 * @returns {Summary[]}
	 */
	function getFilteredData(showCode, format, audience, day, summaries) {
		let filtered = summaries;

		if (showCode !== 'all') {
			filtered = filtered.filter((s) => s.show_code === showCode);
		}

		if (format !== 'all') {
			const showCodesInFormat = data.shows
				.filter((s) => s.format === format)
				.map((s) => s.show_code);
			filtered = filtered.filter((s) => showCodesInFormat.includes(s.show_code));
		}

		if (audience !== 'all') {
			const showCodesInAudience = data.shows
				.filter((s) => s.audience_type === audience)
				.map((s) => s.show_code);
			filtered = filtered.filter((s) => showCodesInAudience.includes(s.show_code));
		}

		if (day !== 'all') {
			const showCodesOnDay = data.shows
				.filter((s) => s.day_of_week === day)
				.map((s) => s.show_code);
			filtered = filtered.filter((s) => showCodesOnDay.includes(s.show_code));
		}

		return filtered;
	}

	/**
	 * @param {number} year
	 */
	function toggleYear(year) {
		if (selectedYearsMonthly.includes(year)) {
			selectedYearsMonthly = selectedYearsMonthly.filter((y) => y !== year);
		} else {
			selectedYearsMonthly = [...selectedYearsMonthly, year].sort((a, b) => a - b);
		}
	}

	/**
	 * @param {number} year
	 */
	function toggleYear4M(year) {
		if (selectedYears4M.includes(year)) {
			selectedYears4M = selectedYears4M.filter((y) => y !== year);
		} else {
			selectedYears4M = [...selectedYears4M, year].sort((a, b) => a - b);
		}
	}

	/**
	 * @typedef {Object} ShowMonthData
	 * @property {number} tickets
	 * @property {number} revenue
	 */

	/**
	 * @param {Summary[]} summaries
	 * @param {number[]} yearsFilter
	 * @param {number} momYear
	 * @param {number} month4M
	 * @param {number[]} years4M
	 */
	function processChartData(summaries, yearsFilter, momYear, month4M, years4M) {
		if (!summaries || summaries.length === 0) {
			return {
				monthlyTickets: { labels: [], datasets: [] },
				monthlyRevenue: { labels: [], datasets: [] },
				fourMonthTickets: { labels: [], datasets: [] },
				fourMonthRevenue: { labels: [], datasets: [] },
				momTickets: { labels: [], datasets: [] },
				momRevenue: { labels: [], datasets: [] },
				ytdTickets: { labels: [], datasets: [] },
				ytdRevenue: { labels: [], datasets: [] }
			};
		}

		// Group data by year
		/** @type {Record<number, ShowMonthData[]>} */
		const dataByYear = {};
		summaries.forEach((summary) => {
			const year = summary.summary_year;
			const date = new Date(summary.summary_month + 'T12:00:00');
			const month = date.getMonth();

			if (year < 2016 || year > 2030) return;

			if (!dataByYear[year]) {
				dataByYear[year] = Array(12)
					.fill(null)
					.map(() => ({ tickets: 0, revenue: 0 }));
			}

			dataByYear[year][month].tickets += summary.tickets_sold;
			dataByYear[year][month].revenue += summary.revenue;
		});

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
		const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

		// Filter years for monthly charts
		const filteredYears = yearsFilter.filter((year) => dataByYear[year]).sort((a, b) => a - b);

		// 1. Monthly Tickets by Year
		const monthlyTickets = {
			labels: months,
			datasets: filteredYears.map((year, index) => ({
				label: year.toString(),
				data: dataByYear[year].map((/** @type {ShowMonthData} */ d) => d.tickets),
				backgroundColor: colors[index % colors.length],
				borderColor: colors[index % colors.length],
				borderWidth: 1
			}))
		};

		// 2. Monthly Revenue by Year
		const monthlyRevenue = {
			labels: months,
			datasets: filteredYears.map((year, index) => ({
				label: year.toString(),
				data: dataByYear[year].map((/** @type {ShowMonthData} */ d) => d.revenue),
				backgroundColor: colors[index % colors.length],
				borderColor: colors[index % colors.length],
				borderWidth: 1
			}))
		};

		// 3. 4-Month Rolling Tickets
		const filteredYears4M = years4M.filter((year) => dataByYear[year]).sort((a, b) => a - b);
		/** @type {number[]} */
		const monthIndices = [];
		/** @type {string[]} */
		const monthLabels = [];
		for (let i = 3; i >= 0; i--) {
			const idx = (month4M - i + 12) % 12;
			monthIndices.push(idx);
			monthLabels.push(months[idx]);
		}

		const fourMonthTickets = {
			labels: monthLabels,
			datasets: filteredYears4M.map((year, index) => ({
				label: year.toString(),
				data: monthIndices.map((idx) => dataByYear[year][idx].tickets),
				backgroundColor: colors[index % colors.length],
				borderColor: colors[index % colors.length],
				borderWidth: 1
			}))
		};

		// 4. 4-Month Rolling Revenue
		const fourMonthRevenue = {
			labels: monthLabels,
			datasets: filteredYears4M.map((year, index) => ({
				label: year.toString(),
				data: monthIndices.map((idx) => dataByYear[year][idx].revenue),
				backgroundColor: colors[index % colors.length],
				borderColor: colors[index % colors.length],
				borderWidth: 1
			}))
		};

		// 5. Month over Month Tickets
		/** @type {ShowMonthData[]} */
		const momYearData =
			dataByYear[momYear] ||
			Array(12)
				.fill(null)
				.map(() => ({ tickets: 0, revenue: 0 }));
		/** @type {ShowMonthData[]} */
		const prevYearData =
			dataByYear[momYear - 1] ||
			Array(12)
				.fill(null)
				.map(() => ({ tickets: 0, revenue: 0 }));
		const momTicketsData = [];

		// January: compare to December of previous year
		const janCurrent = momYearData[0].tickets;
		const decPrevious = prevYearData[11].tickets;
		const janChange = decPrevious > 0 ? ((janCurrent - decPrevious) / decPrevious) * 100 : 0;
		momTicketsData.push(janChange);

		// February through December
		for (let i = 1; i < 12; i++) {
			const current = momYearData[i].tickets;
			const previous = momYearData[i - 1].tickets;
			const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
			momTicketsData.push(change);
		}

		const momTickets = {
			labels: months,
			datasets: [
				{
					label: 'Month over Month % Change',
					data: momTicketsData,
					backgroundColor: momTicketsData.map((v) => (v >= 0 ? '#10b981' : '#ef4444'))
				}
			]
		};

		// 6. Month over Month Revenue
		const momRevenueData = [];

		const janRevCurrent = momYearData[0].revenue;
		const decRevPrevious = prevYearData[11].revenue;
		const janRevChange =
			decRevPrevious > 0 ? ((janRevCurrent - decRevPrevious) / decRevPrevious) * 100 : 0;
		momRevenueData.push(janRevChange);

		for (let i = 1; i < 12; i++) {
			const current = momYearData[i].revenue;
			const previous = momYearData[i - 1].revenue;
			const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
			momRevenueData.push(change);
		}

		const momRevenue = {
			labels: months,
			datasets: [
				{
					label: 'Month over Month % Change',
					data: momRevenueData,
					backgroundColor: momRevenueData.map((v) => (v >= 0 ? '#10b981' : '#ef4444'))
				}
			]
		};

		// 7. YTD Tickets
		const currentYear = new Date().getFullYear();
		/** @type {ShowMonthData[]} */
		const currentYearData =
			dataByYear[currentYear] ||
			Array(12)
				.fill(null)
				.map(() => ({ tickets: 0, revenue: 0 }));
		/** @type {ShowMonthData[]} */
		const lastYearData =
			dataByYear[currentYear - 1] ||
			Array(12)
				.fill(null)
				.map(() => ({ tickets: 0, revenue: 0 }));

		const currentYearCumulative = [];
		const lastYearCumulative = [];
		let currentYearSum = 0;
		let lastYearSum = 0;

		for (let i = 0; i < 12; i++) {
			currentYearSum += currentYearData[i].tickets;
			lastYearSum += lastYearData[i].tickets;
			currentYearCumulative.push(currentYearSum);
			lastYearCumulative.push(lastYearSum);
		}

		const ytdTickets = {
			labels: months,
			datasets: [
				{
					label: `${currentYear - 1}`,
					data: lastYearCumulative,
					backgroundColor: '#6b7280',
					borderColor: '#6b7280',
					borderWidth: 1
				},
				{
					label: `${currentYear}`,
					data: currentYearCumulative,
					backgroundColor: '#3b82f6',
					borderColor: '#3b82f6',
					borderWidth: 1
				}
			]
		};

		// 8. YTD Revenue
		const currentYearRevenueCumulative = [];
		const lastYearRevenueCumulative = [];
		let currentYearRevenueSum = 0;
		let lastYearRevenueSum = 0;

		for (let i = 0; i < 12; i++) {
			currentYearRevenueSum += currentYearData[i].revenue;
			lastYearRevenueSum += lastYearData[i].revenue;
			currentYearRevenueCumulative.push(currentYearRevenueSum);
			lastYearRevenueCumulative.push(lastYearRevenueSum);
		}

		const ytdRevenue = {
			labels: months,
			datasets: [
				{
					label: `${currentYear - 1}`,
					data: lastYearRevenueCumulative,
					backgroundColor: '#6b7280',
					borderColor: '#6b7280',
					borderWidth: 1
				},
				{
					label: `${currentYear}`,
					data: currentYearRevenueCumulative,
					backgroundColor: '#10b981',
					borderColor: '#10b981',
					borderWidth: 1
				}
			]
		};

		return {
			monthlyTickets,
			monthlyRevenue,
			fourMonthTickets,
			fourMonthRevenue,
			momTickets,
			momRevenue,
			ytdTickets,
			ytdRevenue
		};
	}

	/**
	 * @param {number} value
	 * @returns {string}
	 */
	function formatCurrency(value) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(value);
	}

	/** @param {any} d */
	function formatDate(d) {
		if (!d) return '—';
		const x = new Date(d + (d.includes('T') ? '' : 'T12:00:00'));
		return isNaN(x.getTime()) ? '—' : x.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
	}
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
				if (!loaded) throw new Error('Could not load jsPDF from any CDN. Check your network/firewall.');
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

			// Subtitle / metadata
			doc.setFontSize(11);
			doc.setFont('helvetica', 'normal');
			doc.setTextColor(100);
			const filterDesc = [
				selectedShowCode !== 'all' ? `Show: ${data.shows.find(s => s.show_code === selectedShowCode)?.show_name || selectedShowCode}` : null,
				selectedFormat !== 'all' ? `Format: ${selectedFormat}` : null,
				selectedAudience !== 'all' ? `Audience: ${selectedAudience}` : null,
				selectedDay !== 'all' ? `Day: ${selectedDay}` : null,
			].filter(Boolean).join(' | ') || 'All Shows';
			doc.text(filterDesc, margin, y);
			y += 14;
			doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, y);
			doc.setTextColor(0);
			y += 20;
			doc.setDrawColor(200);
			doc.line(margin, y, pageW - margin, y);
			y += 20;

			// Sections with their charts and notes
			const sections = [
				{ include: pdfIncludeMonthly, title: 'Monthly Analysis', notes: pdfNotesMonthly, charts: [
					{ id: 'monthlyTicketsChart', title: 'Monthly Tickets Sold by Year' },
					{ id: 'monthlyRevenueChart', title: 'Monthly Revenue by Year' },
				]},
				{ include: pdfInclude4Month, title: '4-Month Rolling Window', notes: pdfNotes4Month, charts: [
					{ id: 'fourMonthTicketsChart', title: '4-Month Rolling Tickets Sold' },
					{ id: 'fourMonthRevenueChart', title: '4-Month Rolling Revenue' },
				]},
				{ include: pdfIncludeYtd, title: 'Year-to-Date Comparison', notes: pdfNotesYtd, charts: [
					{ id: 'ytdTicketsChart', title: 'Year-to-Date Cumulative Tickets' },
					{ id: 'ytdRevenueChart', title: 'Year-to-Date Cumulative Revenue' },
				]},
				{ include: pdfIncludeMoM, title: 'Month over Month Growth', notes: pdfNotesMoM, charts: [
					{ id: 'momTicketsChart', title: `Month over Month Ticket Growth - ${selectedYearMoM}` },
					{ id: 'momRevenueChart', title: `Month over Month Revenue Growth - ${selectedYearMoM}` },
				]},
				{ include: pdfIncludeItemRevenue, title: `Revenue by Show (${itemDateStart || '?'} – ${itemDateEnd || '?'})`, notes: pdfNotesItemRevenue, charts: [
					{ id: 'itemRevenueChart' },
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

				// Charts — render side by side in pairs
				const chartW = (contentW - 10) / 2;
				const chartH = 180;
				for (let i = 0; i < section.charts.length; i += 2) {
					if (y + chartH + 10 > pageH - margin) { doc.addPage(); y = margin; }
					const left = section.charts[i];
					const right = section.charts[i + 1];
					const cvL = left ? /** @type {HTMLCanvasElement | null} */ (document.getElementById(left.id)) : null;
					const cvR = right ? /** @type {HTMLCanvasElement | null} */ (document.getElementById(right.id)) : null;
					if (cvL) doc.addImage(cvL.toDataURL('image/png', 1.0), 'PNG', margin, y, chartW, chartH);
					if (cvR) doc.addImage(cvR.toDataURL('image/png', 1.0), 'PNG', margin + chartW + 10, y, chartW, chartH);
					y += chartH + 15;
				}

				// Section notes (below charts)
				if (section.notes.trim()) {
					doc.setFontSize(10);
					doc.setFont('helvetica', 'normal');
					doc.setTextColor(80);
					const noteText = section.notes.trim();
					const noteLines = typeof doc.splitTextToSize === 'function'
						? doc.splitTextToSize(noteText, contentW)
						: noteText.split('\n');
					for (const line of noteLines) {
						if (y + 14 > pageH - margin) { doc.addPage(); y = margin; }
						doc.text(String(line), margin, y);
						y += 14;
					}
					doc.setTextColor(0);
				}

				// Extra space before next section
				y += 25;
			}

			/** @type {string[]} */
			const chartIds = sections.filter(s => s.include).flatMap(s => s.charts.map(c => c.id));

			// Convert to base64 and trigger download
			const pdfBase64 = doc.output('datauristring').split(',')[1];
			doc.save(reportTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf');

			// Save to server
			const fd = new FormData();
			fd.append('report_title', reportTitle);
			// Derive date range from the actual data
			const allMonths = filteredData.map(s => s.summary_month).sort();
			const earliest = allMonths[0]?.slice(0, 7) || `${new Date().getFullYear()}-01`;
			const latest = allMonths[allMonths.length - 1]?.slice(0, 7) || `${new Date().getFullYear()}-12`;
			fd.append('date_range_start', earliest);
			fd.append('date_range_end', latest);
			fd.append('filters', JSON.stringify({
				show: selectedShowCode, format: selectedFormat,
				audience: selectedAudience, day: selectedDay,
				yearsMonthly: selectedYearsMonthly, yearMoM: selectedYearMoM,
			}));
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

	/**
	 * @param {string} canvasId
	 * @param {import('chart.js').ChartConfiguration} config
	 */
	function createChart(canvasId, config) {
		if (!browser || !mounted) return;

		const ctx = /** @type {HTMLCanvasElement | null} */ (document.getElementById(canvasId));
		if (!ctx) return;

		if (charts[canvasId]) {
			charts[canvasId].destroy();
		}

		charts[canvasId] = new Chart(ctx, config);
	}

	$: if (browser && mounted && chartData) {
		setTimeout(() => {
			// Monthly Tickets
			createChart('monthlyTicketsChart', {
				type: 'bar',
				data: chartData.monthlyTickets,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: 'Monthly Tickets Sold by Year' }
					},
					scales: {
						y: { beginAtZero: true }
					}
				}
			});

			// Monthly Revenue
			createChart('monthlyRevenueChart', {
				type: 'bar',
				data: chartData.monthlyRevenue,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: 'Monthly Revenue by Year' },
						tooltip: {
							callbacks: {
								label: function (/** @type {any} */ context) {
									return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
								}
							}
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							ticks: {
								callback: function (/** @type {any} */ value) {
									return formatCurrency(value);
								}
							}
						}
					}
				}
			});

			// 4-Month Rolling Tickets
			createChart('fourMonthTicketsChart', {
				type: 'bar',
				data: chartData.fourMonthTickets,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: '4-Month Rolling Tickets Sold' }
					},
					scales: {
						y: { beginAtZero: true }
					}
				}
			});

			// 4-Month Rolling Revenue
			createChart('fourMonthRevenueChart', {
				type: 'bar',
				data: chartData.fourMonthRevenue,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: '4-Month Rolling Revenue' },
						tooltip: {
							callbacks: {
								label: function (/** @type {any} */ context) {
									return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
								}
							}
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							ticks: {
								callback: function (/** @type {any} */ value) {
									return formatCurrency(value);
								}
							}
						}
					}
				}
			});

			// Month over Month Tickets
			createChart('momTicketsChart', {
				type: 'bar',
				data: chartData.momTickets,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						title: {
							display: true,
							text: `Month over Month Ticket Growth (%) - ${selectedYearMoM}`
						}
					},
					scales: {
						y: {
							ticks: {
								callback: function (/** @type {any} */ value) {
									return value + '%';
								}
							}
						}
					}
				}
			});

			// Month over Month Revenue
			createChart('momRevenueChart', {
				type: 'bar',
				data: chartData.momRevenue,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						title: {
							display: true,
							text: `Month over Month Revenue Growth (%) - ${selectedYearMoM}`
						}
					},
					scales: {
						y: {
							ticks: {
								callback: function (/** @type {any} */ value) {
									return value + '%';
								}
							}
						}
					}
				}
			});

			// YTD Tickets
			createChart('ytdTicketsChart', {
				type: 'bar',
				data: chartData.ytdTickets,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: 'Year-to-Date Cumulative Tickets Sold' }
					},
					scales: {
						y: { beginAtZero: true }
					}
				}
			});

			// YTD Revenue
			createChart('ytdRevenueChart', {
				type: 'bar',
				data: chartData.ytdRevenue,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: 'Year-to-Date Cumulative Revenue' },
						tooltip: {
							callbacks: {
								label: function (/** @type {any} */ context) {
									return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
								}
							}
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							ticks: {
								callback: function (/** @type {any} */ value) {
									return formatCurrency(value);
								}
							}
						}
					}
				}
			});
		}, 100);
	}

	// Revenue by Item chart — separate reactive block so it updates on date range change
	$: if (browser && mounted && itemRevenueData.length > 0) {
		setTimeout(() => {
			createChart('itemRevenueChart', {
				type: 'bar',
				data: {
					labels: itemRevenueData.map((d) => d.show_name),
					datasets: [{
						label: 'Revenue',
						data: itemRevenueData.map((d) => d.revenue),
						backgroundColor: '#3b82f6'
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					indexAxis: 'y',
					plugins: {
						legend: { display: false },
						title: { display: true, text: 'Revenue by Show' },
						tooltip: {
							callbacks: {
								label: function (/** @type {any} */ context) {
									return formatCurrency(context.parsed.x);
								}
							}
						}
					},
					scales: {
						x: {
							beginAtZero: true,
							ticks: {
								callback: function (/** @type {any} */ value) {
									return formatCurrency(value);
								}
							}
						}
					}
				}
			});
		}, 120);
	}
</script>

<svelte:head>
	<title>Show Reports | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<h1>Live Show Reports</h1>
			<p class="subtitle">Visual analysis of show performance and trends</p>
		</div>
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
					placeholder="e.g. Q1 2026 Show Performance" class="pdf-title-input" />
			</div>
			<button class="btn-generate" on:click={generateAndSavePDF}
				disabled={generating || !mounted || !filteredData.length || (!pdfIncludeMonthly && !pdfInclude4Month && !pdfIncludeYtd && !pdfIncludeMoM && !pdfIncludeItemRevenue)}>
				{generating ? 'Generating...' : 'Generate & Download PDF'}
			</button>
		</div>
		<div class="pdf-includes">
			<span class="pdf-sections-label">Include in PDF:</span>
			<label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeMonthly} /> Monthly</label>
			<label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfInclude4Month} /> 4-Month Rolling</label>
			<label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeYtd} /> Year-to-Date</label>
			<label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeMoM} /> Month over Month</label>
			<label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeItemRevenue} /> Revenue by Show</label>
		</div>
	</div>

	<!-- Global Filters -->
	<div class="filter-section">
		<div class="filter-row">
			<div class="filter-group">
				<label for="showSelect">Show:</label>
				<select id="showSelect" bind:value={selectedShowCode} class="filter-select">
					<option value="all">All Shows</option>
					{#each data.shows as show (show.show_code)}
						<option value={show.show_code}>
							{show.show_name}
						</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="formatSelect">Format:</label>
				<select id="formatSelect" bind:value={selectedFormat} class="filter-select">
					<option value="all">All Formats</option>
					{#each uniqueFormats as format (format)}
						<option value={format}>{format}</option>
					{/each}
				</select>
			</div>
		</div>

		<div class="filter-row" style="margin-top: 1rem;">
			<div class="filter-group">
				<label for="audienceSelect">Audience:</label>
				<select id="audienceSelect" bind:value={selectedAudience} class="filter-select">
					<option value="all">All Audiences</option>
					{#each uniqueAudiences as audience (audience)}
						<option value={audience}>{audience}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="daySelect">Day of Week:</label>
				<select id="daySelect" bind:value={selectedDay} class="filter-select">
					<option value="all">All Days</option>
					{#each uniqueDays as day (day)}
						<option value={day}>{day}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	{#if browser && mounted}
		<!-- Monthly Charts Section -->
		<section class="chart-section">
			<h2 class="section-title">Monthly Analysis</h2>

			<div class="filter-section">
				<div class="filter-group">
					<span class="filter-heading">Years to Display:</span>
					<div class="year-checkboxes">
						{#each availableYears as year (year)}
							<label class="checkbox-label">
								<input
									type="checkbox"
									checked={selectedYearsMonthly.includes(year)}
									on:change={() => toggleYear(year)}
								/>
								<span>{year}</span>
							</label>
						{/each}
					</div>
				</div>
			</div>

			<div class="charts-grid">
				<div class="chart-card">
					<canvas id="monthlyTicketsChart"></canvas>
				</div>
				<div class="chart-card">
					<canvas id="monthlyRevenueChart"></canvas>
				</div>
			</div>

			{#if pdfIncludeMonthly}
				<div class="section-notes">
					<label class="section-notes-label">PDF Notes — Monthly Analysis</label>
					<textarea class="section-notes-input" bind:value={pdfNotesMonthly} placeholder="Add notes for this section..." rows="2"></textarea>
				</div>
			{/if}
		</section>

		<!-- 4-Month Rolling Section -->
		<section class="chart-section">
			<h2 class="section-title">4-Month Rolling Window</h2>

			<div class="filter-section">
				<div class="filter-row">
					<div class="filter-group">
						<label for="monthSelect4M">Ending Month:</label>
						<select id="monthSelect4M" bind:value={selectedMonth4M} class="filter-select">
							<option value={0}>January</option>
							<option value={1}>February</option>
							<option value={2}>March</option>
							<option value={3}>April</option>
							<option value={4}>May</option>
							<option value={5}>June</option>
							<option value={6}>July</option>
							<option value={7}>August</option>
							<option value={8}>September</option>
							<option value={9}>October</option>
							<option value={10}>November</option>
							<option value={11}>December</option>
						</select>
					</div>

					<div class="filter-group">
						<span class="filter-heading">Years to Display:</span>
						<div class="year-checkboxes">
							{#each availableYears as year (year)}
								<label class="checkbox-label">
									<input
										type="checkbox"
										checked={selectedYears4M.includes(year)}
										on:change={() => toggleYear4M(year)}
									/>
									<span>{year}</span>
								</label>
							{/each}
						</div>
					</div>
				</div>
			</div>

			<div class="charts-grid">
				<div class="chart-card">
					<canvas id="fourMonthTicketsChart"></canvas>
				</div>
				<div class="chart-card">
					<canvas id="fourMonthRevenueChart"></canvas>
				</div>
			</div>

			{#if pdfInclude4Month}
				<div class="section-notes">
					<label class="section-notes-label">PDF Notes — 4-Month Rolling</label>
					<textarea class="section-notes-input" bind:value={pdfNotes4Month} placeholder="Add notes for this section..." rows="2"></textarea>
				</div>
			{/if}
		</section>

		<!-- YTD Section -->
		<section class="chart-section">
			<h2 class="section-title">Year-to-Date Comparison</h2>

			<div class="charts-grid">
				<div class="chart-card">
					<canvas id="ytdTicketsChart"></canvas>
				</div>
				<div class="chart-card">
					<canvas id="ytdRevenueChart"></canvas>
				</div>
			</div>

			{#if pdfIncludeYtd}
				<div class="section-notes">
					<label class="section-notes-label">PDF Notes — Year-to-Date</label>
					<textarea class="section-notes-input" bind:value={pdfNotesYtd} placeholder="Add notes for this section..." rows="2"></textarea>
				</div>
			{/if}
		</section>

		<!-- Month over Month Section -->
		<section class="chart-section">
			<h2 class="section-title">Month over Month Growth</h2>

			<div class="filter-section">
				<div class="filter-group">
					<label for="momYearSelect">Year:</label>
					<select id="momYearSelect" bind:value={selectedYearMoM} class="filter-select">
						{#each availableYears as year (year)}
							<option value={year}>{year}</option>
						{/each}
					</select>
				</div>
			</div>

			<div class="charts-grid">
				<div class="chart-card">
					<canvas id="momTicketsChart"></canvas>
				</div>
				<div class="chart-card">
					<canvas id="momRevenueChart"></canvas>
				</div>
			</div>

			{#if pdfIncludeMoM}
				<div class="section-notes">
					<label class="section-notes-label">PDF Notes — Month over Month</label>
					<textarea class="section-notes-input" bind:value={pdfNotesMoM} placeholder="Add notes for this section..." rows="2"></textarea>
				</div>
			{/if}
		</section>

		<!-- Revenue by Item Section -->
		<section class="chart-section">
			<h2 class="section-title">Revenue by Show</h2>

			<div class="filter-section">
				<div class="filter-row">
					<div class="filter-group">
						<label for="itemDateStart">From:</label>
						<input type="month" id="itemDateStart" bind:value={itemDateStart} class="filter-input" />
					</div>
					<div class="filter-group">
						<label for="itemDateEnd">To:</label>
						<input type="month" id="itemDateEnd" bind:value={itemDateEnd} class="filter-input" />
					</div>
				</div>
			</div>

			{#if itemRevenueData.length > 0}
				<div class="chart-card chart-tall">
					<canvas id="itemRevenueChart"></canvas>
				</div>
			{:else}
				<div class="empty-state">No revenue data for the selected date range.</div>
			{/if}

			{#if pdfIncludeItemRevenue}
				<div class="section-notes">
					<label class="section-notes-label">PDF Notes — Revenue by Show</label>
					<textarea class="section-notes-input" bind:value={pdfNotesItemRevenue} placeholder="Add notes for this section..." rows="2"></textarea>
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
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each data.pastReports as r (r.report_id)}
							<tr>
								<td class="rpt-title">{r.report_title}</td>
								<td>{formatDateTime(r.created_at)}</td>
								<td>{r.generated_by || '—'}</td>
								<td>{formatBytes(r.file_size_bytes)}</td>
								<td>
									<a href="/gft/reports/download/{r.report_id}" class="btn-download" target="_blank">Download</a>
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
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.filter-row {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 2rem;
	}

	.filter-group {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.filter-group label,
	.filter-heading {
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
		gap: 1rem;
		flex-wrap: wrap;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-weight: normal;
		padding: 0.5rem 1rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background-color: white;
		transition: all 0.2s;
	}

	.checkbox-label:hover {
		background-color: #f9fafb;
		border-color: #3b82f6;
	}

	.checkbox-label input[type='checkbox'] {
		cursor: pointer;
		width: 1rem;
		height: 1rem;
	}

	.checkbox-label input[type='checkbox']:checked + span {
		color: #3b82f6;
		font-weight: 600;
	}

	.charts-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 2rem;
	}

	.chart-card {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		height: 400px;
	}
	.chart-card.chart-tall {
		height: 600px;
	}

	.filter-input {
		padding: 0.5rem 1rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 1rem;
		background-color: white;
	}
	.filter-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.empty-state {
		text-align: center;
		padding: 2rem;
		color: #6b7280;
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
	}

	canvas {
		max-height: 100%;
	}

	.loading {
		text-align: center;
		padding: 3rem;
		color: #6b7280;
		font-size: 1.125rem;
	}

	/* PDF panel */
	.pdf-panel {
		background: white;
		padding: 1.25rem 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}
	.pdf-panel-row {
		display: flex;
		align-items: flex-end;
		gap: 1rem;
		flex-wrap: wrap;
	}
	.pdf-title-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
		min-width: 250px;
	}
	.pdf-title-group label {
		font-size: 0.75rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}
	.pdf-title-input {
		padding: 0.5rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.9rem;
	}
	.pdf-title-input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}
	.btn-generate {
		background: #3b82f6;
		color: white;
		padding: 0.5rem 1.25rem;
		border-radius: 0.5rem;
		border: none;
		font-weight: 600;
		font-size: 0.9rem;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-generate:hover { background: #2563eb; }
	.btn-generate:disabled { background: #93c5fd; cursor: not-allowed; }
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

	/* Alerts */
	.alert { padding: 0.875rem 1.25rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
	.alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
	.alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

	/* Past reports */
	.past-reports { margin-top: 2rem; }
	.table-wrapper { overflow-x: auto; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	.past-reports table { width: 100%; border-collapse: collapse; }
	.past-reports thead { background: #f9fafb; }
	.past-reports th { padding: 0.625rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e5e7eb; }
	.past-reports td { padding: 0.5rem 1rem; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; }
	.past-reports tr:hover { background: #f9fafb; }
	.rpt-title { font-weight: 500; }
	.btn-download { display: inline-block; padding: 0.3rem 0.75rem; background: #3b82f6; color: white; border-radius: 0.375rem; text-decoration: none; font-size: 0.8rem; font-weight: 500; }
	.btn-download:hover { background: #2563eb; }

	@media (max-width: 1024px) {
		.filter-row {
			grid-template-columns: 1fr;
			gap: 1rem;
		}

		.charts-grid {
			grid-template-columns: 1fr;
		}

		.filter-group {
			flex-direction: column;
			align-items: stretch;
		}

		.filter-select {
			width: 100%;
			min-width: 0;
			box-sizing: border-box;
		}
	}
</style>
