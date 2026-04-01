<!-- src/routes/hsi/reports/+page.svelte -->
<script>
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Chart from 'chart.js/auto';

	/**
	 * @typedef {Object} ClassItem
	 * @property {string} class_code
	 * @property {string} class_name
	 * @property {string} class_type
	 * @property {string} student_type
	 * @property {number} standard_price
	 * @property {string} track
	 * @property {string} description
	 * @property {boolean} is_active
	 */

	/**
	 * @typedef {Object} Summary
	 * @property {string} class_code
	 * @property {string} summary_month
	 * @property {number} summary_year
	 * @property {number} registrations
	 * @property {number} revenue
	 */

	/**
	 * @typedef {Object} MonthData
	 * @property {number} registrations
	 * @property {number} revenue
	 */

	/** @type {{ classes: ClassItem[], summaries: Summary[], pastReports: any[], teacherClasses: any[] }} */
	export let data;
	/** @type {any} */
	export let form;

	/** @type {string[]} */
	let selectedClassCodes = [];
	let selectedTrack = 'all';
	let selectedTeacher = 'all';
	/** @type {Record<string, Chart>} */
	let charts = {};
	let mounted = false;
	let generating = false;
	let reportTitle = 'HSI Class Report';

	// PDF section toggles
	let pdfIncludeMonthly = true;
	let pdfInclude4Month = true;
	let pdfIncludeYtd = true;
	let pdfIncludeMoM = true;

	// PDF section notes
	let pdfNotesMonthly = '';
	let pdfNotes4Month = '';
	let pdfNotesYtd = '';
	let pdfNotesMoM = '';
	let pdfIncludeItemRevenue = true;
	let pdfNotesItemRevenue = '';

	// Revenue by class date range
	let itemDateStart = '';
	let itemDateEnd = '';
	/** @type {string[]} */
	let itemClassCodes = [];

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

	// Get unique tracks from data
	$: uniqueTracks = [
		...new Set(data.classes.map((/** @type {ClassItem} */ c) => c.track).filter(Boolean))
	].sort();

	// Get unique teacher names
	$: uniqueTeachers = [
		...new Set((data.teacherClasses || []).map((/** @type {any} */ tc) => tc.instructor))
	].sort();

	// Map teacher → class codes for filtering
	$: teacherClassMap = (() => {
		/** @type {Record<string, string[]>} */
		const m = {};
		for (const tc of (data.teacherClasses || [])) {
			if (!m[tc.instructor]) m[tc.instructor] = [];
			if (!m[tc.instructor].includes(tc.class_code)) m[tc.instructor].push(tc.class_code);
		}
		return m;
	})();

	$: filteredData = getFilteredData(selectedClassCodes, selectedTrack, selectedTeacher, data.summaries);

	// Extract available years from data
	$: {
		if (filteredData && filteredData.length > 0) {
			const years = [
				...new Set(filteredData.map((/** @type {Summary} */ s) => s.summary_year))
			].filter((y) => y >= 2020 && y <= 2030);

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

	// Revenue by class — aggregate filtered data within the selected date range
	$: itemRevenueData = (() => {
		if (!filteredData || !itemDateStart || !itemDateEnd) return [];
		const startDate = itemDateStart + '-01';
		const endDate = itemDateEnd + '-28';
		/** @type {Record<string, { class_name: string, revenue: number, registrations: number }>} */
		const byClass = {};
		for (const s of filteredData) {
			if (s.summary_month < startDate || s.summary_month > endDate) continue;
			if (itemClassCodes.length > 0 && !itemClassCodes.includes(s.class_code)) continue;
			if (!byClass[s.class_code]) {
				byClass[s.class_code] = { class_name: s.class_name || s.class_code, revenue: 0, registrations: 0 };
			}
			byClass[s.class_code].revenue += s.revenue;
			byClass[s.class_code].registrations += s.registrations;
		}
		return Object.values(byClass).filter((d) => d.revenue > 0).sort((a, b) => b.revenue - a.revenue);
	})();

	/**
	 * @param {string[]} classCodes
	 * @param {string} trackId
	 * @param {string} teacher
	 * @param {Summary[]} summaries
	 * @returns {Summary[]}
	 */
	function getFilteredData(classCodes, trackId, teacher, summaries) {
		let filtered = summaries;

		if (classCodes.length > 0) {
			filtered = filtered.filter((s) => classCodes.includes(s.class_code));
		}

		if (trackId !== 'all') {
			const classCodesInTrack = data.classes
				.filter((c) => c.track === trackId)
				.map((c) => c.class_code);
			filtered = filtered.filter((s) => classCodesInTrack.includes(s.class_code));
		}

		if (teacher !== 'all') {
			const classCodes = teacherClassMap[teacher] || [];
			filtered = filtered.filter((s) => classCodes.includes(s.class_code));
		}

		return filtered;
	}

	/**
	 * @param {string} code
	 */
	function toggleClass(code) {
		if (selectedClassCodes.includes(code)) {
			selectedClassCodes = selectedClassCodes.filter((c) => c !== code);
		} else {
			selectedClassCodes = [...selectedClassCodes, code];
		}
	}

	/**
	 * @param {string} code
	 */
	function toggleItemClass(code) {
		if (itemClassCodes.includes(code)) {
			itemClassCodes = itemClassCodes.filter((c) => c !== code);
		} else {
			itemClassCodes = [...itemClassCodes, code];
		}
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
	 * @param {Summary[]} summaries
	 * @param {number[]} yearsFilter
	 * @param {number} momYear
	 * @param {number} month4M
	 * @param {number[]} years4M
	 */
	function processChartData(summaries, yearsFilter, momYear, month4M, years4M) {
		if (!summaries || summaries.length === 0) {
			return {
				monthlyRegistrations: { labels: [], datasets: [] },
				monthlyRevenue: { labels: [], datasets: [] },
				fourMonthRegistrations: { labels: [], datasets: [] },
				fourMonthRevenue: { labels: [], datasets: [] },
				momRegistrations: { labels: [], datasets: [] },
				momRevenue: { labels: [], datasets: [] },
				ytdRegistrations: { labels: [], datasets: [] },
				ytdRevenue: { labels: [], datasets: [] }
			};
		}

		// Group data by year
		/** @type {Record<number, MonthData[]>} */
		const dataByYear = {};
		summaries.forEach((summary) => {
			const year = summary.summary_year;
			const date = new Date(summary.summary_month + 'T12:00:00');
			const month = date.getMonth();

			if (year < 2020 || year > 2030) return;

			if (!dataByYear[year]) {
				dataByYear[year] = Array(12)
					.fill(null)
					.map(() => ({ registrations: 0, revenue: 0 }));
			}

			dataByYear[year][month].registrations += summary.registrations;
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

		// 1. Monthly Registrations by Year
		const monthlyRegistrations = {
			labels: months,
			datasets: filteredYears.map((year, index) => ({
				label: year.toString(),
				data: dataByYear[year].map((/** @type {MonthData} */ d) => d.registrations),
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
				data: dataByYear[year].map((/** @type {MonthData} */ d) => d.revenue),
				backgroundColor: colors[index % colors.length],
				borderColor: colors[index % colors.length],
				borderWidth: 1
			}))
		};

		// 3. 4-Month Rolling Registrations
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

		const fourMonthRegistrations = {
			labels: monthLabels,
			datasets: filteredYears4M.map((year, index) => ({
				label: year.toString(),
				data: monthIndices.map((idx) => dataByYear[year][idx].registrations),
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

		// 5. Month over Month Registrations (including January)
		/** @type {MonthData[]} */
		const momYearData =
			dataByYear[momYear] ||
			Array(12)
				.fill(null)
				.map(() => ({ registrations: 0, revenue: 0 }));
		/** @type {MonthData[]} */
		const prevYearData =
			dataByYear[momYear - 1] ||
			Array(12)
				.fill(null)
				.map(() => ({ registrations: 0, revenue: 0 }));
		const momRegistrationsData = [];

		// January: compare to December of previous year
		const janCurrent = momYearData[0].registrations;
		const decPrevious = prevYearData[11].registrations;
		const janChange = decPrevious > 0 ? ((janCurrent - decPrevious) / decPrevious) * 100 : 0;
		momRegistrationsData.push(janChange);

		// February through December: compare to previous month of same year
		for (let i = 1; i < 12; i++) {
			const current = momYearData[i].registrations;
			const previous = momYearData[i - 1].registrations;
			const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
			momRegistrationsData.push(change);
		}

		const momRegistrations = {
			labels: months,
			datasets: [
				{
					label: 'Month over Month % Change',
					data: momRegistrationsData,
					backgroundColor: momRegistrationsData.map((v) => (v >= 0 ? '#10b981' : '#ef4444'))
				}
			]
		};

		// 6. Month over Month Revenue (including January)
		const momRevenueData = [];

		// January: compare to December of previous year
		const janRevCurrent = momYearData[0].revenue;
		const decRevPrevious = prevYearData[11].revenue;
		const janRevChange =
			decRevPrevious > 0 ? ((janRevCurrent - decRevPrevious) / decRevPrevious) * 100 : 0;
		momRevenueData.push(janRevChange);

		// February through December: compare to previous month of same year
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

		// 7. YTD Registrations - Cumulative totals by month
		const currentYear = new Date().getFullYear();
		/** @type {MonthData[]} */
		const currentYearData =
			dataByYear[currentYear] ||
			Array(12)
				.fill(null)
				.map(() => ({ registrations: 0, revenue: 0 }));
		/** @type {MonthData[]} */
		const lastYearData =
			dataByYear[currentYear - 1] ||
			Array(12)
				.fill(null)
				.map(() => ({ registrations: 0, revenue: 0 }));

		// Calculate cumulative sums for registrations
		const currentYearCumulative = [];
		const lastYearCumulative = [];
		let currentYearSum = 0;
		let lastYearSum = 0;

		for (let i = 0; i < 12; i++) {
			currentYearSum += currentYearData[i].registrations;
			lastYearSum += lastYearData[i].registrations;
			currentYearCumulative.push(currentYearSum);
			lastYearCumulative.push(lastYearSum);
		}

		const ytdRegistrations = {
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

		// 8. YTD Revenue - Cumulative totals by month
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
			monthlyRegistrations,
			monthlyRevenue,
			fourMonthRegistrations,
			fourMonthRevenue,
			momRegistrations,
			momRevenue,
			ytdRegistrations,
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
			const filterDesc = [
				selectedTrack !== 'all' ? `Track: ${selectedTrack}` : null,
				selectedTeacher !== 'all' ? `Teacher: ${selectedTeacher}` : null,
			].filter(Boolean).join(' | ');
			if (filterDesc) {
				doc.text(filterDesc, margin, y);
				y += 14;
			}
			doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, y);
			doc.setTextColor(0);
			y += 20;
			doc.setDrawColor(200);
			doc.line(margin, y, pageW - margin, y);
			y += 20;

			// Sections
			const sections = [
				{ include: pdfIncludeMonthly, title: 'Monthly Analysis', notes: pdfNotesMonthly, charts: [
					{ id: 'monthlyRegistrationsChart' },
					{ id: 'monthlyRevenueChart' },
				]},
				{ include: pdfInclude4Month, title: '4-Month Rolling Window', notes: pdfNotes4Month, charts: [
					{ id: 'fourMonthRegistrationsChart' },
					{ id: 'fourMonthRevenueChart' },
				]},
				{ include: pdfIncludeYtd, title: 'Year-to-Date Comparison', notes: pdfNotesYtd, charts: [
					{ id: 'ytdRegistrationsChart' },
					{ id: 'ytdRevenueChart' },
				]},
				{ include: pdfIncludeMoM, title: 'Month over Month Growth', notes: pdfNotesMoM, charts: [
					{ id: 'momRegistrationsChart' },
					{ id: 'momRevenueChart' },
				]},
				{ include: pdfIncludeItemRevenue, title: `Revenue by Class (${itemDateStart || '?'} – ${itemDateEnd || '?'})`, notes: pdfNotesItemRevenue, charts: [
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

				// Charts side by side
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

				// Section notes below charts
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
			const allMonths = filteredData.map(s => s.summary_month).sort();
			const earliest = allMonths[0]?.slice(0, 7) || `${new Date().getFullYear()}-01`;
			const latest = allMonths[allMonths.length - 1]?.slice(0, 7) || `${new Date().getFullYear()}-12`;

			const fd = new FormData();
			fd.append('report_title', reportTitle);
			fd.append('date_range_start', earliest);
			fd.append('date_range_end', latest);
			fd.append('filters', JSON.stringify({ classes: selectedClassCodes, track: selectedTrack, teacher: selectedTeacher, yearsMonthly: selectedYearsMonthly, yearMoM: selectedYearMoM }));
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
			// Monthly Registrations
			createChart('monthlyRegistrationsChart', {
				type: 'bar',
				data: chartData.monthlyRegistrations,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: 'Monthly Registrations by Year' }
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

			// 4-Month Rolling Registrations
			createChart('fourMonthRegistrationsChart', {
				type: 'bar',
				data: chartData.fourMonthRegistrations,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: '4-Month Rolling Registrations' }
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

			// Month over Month Registrations
			createChart('momRegistrationsChart', {
				type: 'bar',
				data: chartData.momRegistrations,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						title: {
							display: true,
							text: `Month over Month Registration Growth (%) - ${selectedYearMoM}`
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

			// YTD Registrations
			createChart('ytdRegistrationsChart', {
				type: 'bar',
				data: chartData.ytdRegistrations,
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { position: 'top' },
						title: { display: true, text: 'Year-to-Date Cumulative Registrations' }
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

	// Revenue by Class chart
	$: if (browser && mounted && itemRevenueData.length > 0) {
		setTimeout(() => {
			createChart('itemRevenueChart', {
				type: 'bar',
				data: {
					labels: itemRevenueData.map((d) => d.class_name),
					datasets: [{
						label: 'Revenue',
						data: itemRevenueData.map((d) => d.revenue),
						backgroundColor: '#8b5cf6'
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					indexAxis: 'y',
					plugins: {
						legend: { display: false },
						title: { display: true, text: 'Revenue by Class' },
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
	<title>HSI Reports | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<h1>HSI Class Reports</h1>
			<p class="subtitle">Visual analysis of class performance and trends</p>
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
					placeholder="e.g. Q1 2026 Class Performance" class="pdf-title-input" />
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
			<label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeItemRevenue} /> Revenue by Class</label>
		</div>
	</div>

	<!-- Global Filters -->
	<div class="filter-section">
		<div class="filter-group filter-group-wrap" style="margin-bottom: 1rem;">
			<label>Class Filter:</label>
			<div class="multi-select-pills">
				<button
					type="button"
					class="pill-btn"
					class:pill-active={selectedClassCodes.length === 0}
					on:click={() => selectedClassCodes = []}
				>All Classes</button>
				{#each data.classes as classItem (classItem.class_code)}
					<button
						type="button"
						class="pill-btn"
						class:pill-active={selectedClassCodes.includes(classItem.class_code)}
						on:click={() => toggleClass(classItem.class_code)}
					>{classItem.class_name}</button>
				{/each}
			</div>
		</div>

		<div class="filter-row">
			<div class="filter-group">
				<label for="trackSelect">Track Filter:</label>
				<select id="trackSelect" bind:value={selectedTrack} class="filter-select">
					<option value="all">All Tracks</option>
					{#each uniqueTracks as track (track)}
						<option value={track}>{track}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="teacherSelect">Teacher:</label>
				<select id="teacherSelect" bind:value={selectedTeacher} class="filter-select">
					<option value="all">All Teachers</option>
					{#each uniqueTeachers as teacher (teacher)}
						<option value={teacher}>{teacher}</option>
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
					<canvas id="monthlyRegistrationsChart"></canvas>
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
					<canvas id="fourMonthRegistrationsChart"></canvas>
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
					<canvas id="ytdRegistrationsChart"></canvas>
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
					<canvas id="momRegistrationsChart"></canvas>
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

		<!-- Revenue by Class Section -->
		<section class="chart-section">
			<h2 class="section-title">Revenue by Class</h2>

			<div class="filter-section">
				<div class="filter-group filter-group-wrap" style="margin-bottom: 1rem;">
					<label>Classes:</label>
					<div class="multi-select-pills">
						<button
							type="button"
							class="pill-btn"
							class:pill-active={itemClassCodes.length === 0}
							on:click={() => itemClassCodes = []}
						>All Classes</button>
						{#each data.classes as classItem (classItem.class_code)}
							<button
								type="button"
								class="pill-btn"
								class:pill-active={itemClassCodes.includes(classItem.class_code)}
								on:click={() => toggleItemClass(classItem.class_code)}
							>{classItem.class_name}</button>
						{/each}
					</div>
				</div>
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
					<label class="section-notes-label">PDF Notes — Revenue by Class</label>
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
									<a href="/hsi/reports/download/{r.report_id}" class="btn-download" target="_blank">Download</a>
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

	.filter-group-wrap {
		align-items: flex-start;
	}

	.multi-select-pills {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.pill-btn {
		padding: 0.4rem 0.85rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		background: white;
		color: #374151;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.pill-btn:hover {
		background: #f3f4f6;
		border-color: #3b82f6;
	}

	.pill-active {
		background-color: #3b82f6;
		color: white;
		border-color: #3b82f6;
	}

	.pill-active:hover {
		background-color: #2563eb;
		border-color: #2563eb;
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
			align-items: flex-start;
		}
	}
</style>
