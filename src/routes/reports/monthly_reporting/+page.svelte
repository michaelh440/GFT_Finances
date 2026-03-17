<!-- src/routes/reports/2026/monthly_reporting/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { onMount, onDestroy } from 'svelte';
	import { browser } from '$app/environment';
	import Chart from 'chart.js/auto';

	/** @type {{ summaries: any[], showItems: any[], classItems: any[], pastReports: any[] }} */
	export let data;
	/** @type {any} */
	export let form;

	let mounted = false;
	/** @type {Record<string, any>} */
	let charts = {};
	let generating = false;

	// ---- Report Config ----
	let reportTitle = '';
	let dateStart = '';
	let dateEnd = '';
	let includeCombined = true;
	let selectedSources = ['show', 'class'];
	let selectedCharts = ['revenue_by_source', 'units_sold', 'revenue_split', 'ytd_revenue', 'item_breakdown'];

	const sourceOptions = [
		{ value: 'show', label: 'Shows', color: '#3b82f6', unitLabel: 'Tickets' },
		{ value: 'class', label: 'Classes', color: '#8b5cf6', unitLabel: 'Registrations' }
	];

	const chartOptions = [
		{ value: 'revenue_by_source', label: 'Total Revenue (stacked bar by source)', combinedOnly: true },
		{ value: 'revenue_split', label: 'Revenue by Source (doughnut)', combinedOnly: true },
		{ value: 'units_sold', label: 'Units Sold' },
		{ value: 'ytd_revenue', label: 'YTD Cumulative Revenue (line)' },
		{ value: 'item_breakdown', label: 'Revenue by Individual Item' }
	];

	$: if (dateStart && dateEnd) {
		const s = new Date(dateStart + '-01T12:00:00');
		const e = new Date(dateEnd + '-01T12:00:00');
		const sf = s.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		const ef = e.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
		if (!reportTitle || reportTitle.startsWith('Report:')) reportTitle = `Report: ${sf} – ${ef}`;
	}

	$: filteredData = (data.summaries || []).filter((/** @type {any} */ s) => {
		if (!selectedSources.includes(s.source_type)) return false;
		if (dateStart && s.summary_month < dateStart + '-01') return false;
		if (dateEnd && s.summary_month > dateEnd + '-28') return false;
		return true;
	});

	$: sourceData = (() => {
		/** @type {Record<string, any>} */
		const r = {};
		for (const src of sourceOptions) r[src.value] = filteredData.filter((/** @type {any} */ s) => s.source_type === src.value);
		return r;
	})();

	$: totalRevenue = filteredData.reduce((/** @type {number} */ sum, /** @type {any} */ s) => sum + s.revenue, 0);
	$: totalUnits = filteredData.reduce((/** @type {number} */ sum, /** @type {any} */ s) => sum + s.unit_count, 0);
	$: sourceStats = (() => {
		/** @type {Record<string, any>} */
		const r = {};
		for (const src of sourceOptions) {
			const d = sourceData[src.value] || [];
			r[src.value] = { revenue: d.reduce((/** @type {number} */ sum, /** @type {any} */ s) => sum + s.revenue, 0), units: d.reduce((/** @type {number} */ sum, /** @type {any} */ s) => sum + s.unit_count, 0) };
		}
		return r;
	})();

	const monthLabels = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	const yearColors = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899'];
	$: selectedYears = [...new Set(filteredData.map((/** @type {any} */ s) => s.summary_year))].sort();

	/** @param {any[]} slice */
	function buildYearData(slice) {
		/** @type {Record<string, any>} */
		const byYear = {}; const years = [...new Set(slice.map((/** @type {any} */ s) => s.summary_year))].sort();
		for (const yr of years) byYear[yr] = { revenue: Array(12).fill(0), units: Array(12).fill(0) };
		for (const s of slice) { if (!byYear[s.summary_year]) continue; byYear[s.summary_year].revenue[s.summary_month_num-1] += s.revenue; byYear[s.summary_year].units[s.summary_month_num-1] += s.unit_count; }
		return { byYear, years };
	}
	/** @param {any[]} slice */
	function buildItemData(slice) {
		/** @type {Record<string, any>} */
		const m = {};
		for (const s of slice) { if (!m[s.item_code]) m[s.item_code] = { name: s.item_name, source: s.source_type, revenue: 0, units: 0 }; m[s.item_code].revenue += s.revenue; m[s.item_code].units += s.unit_count; }
		return Object.values(m).sort((/** @type {any} */ a, /** @type {any} */ b) => b.revenue - a.revenue);
	}
	/** @param {any[]} slice */
	function buildMonthlyRows(slice) {
		/** @type {Record<string, any>} */
		const m = {};
		for (const s of slice) { const k = s.summary_month; if (!m[k]) m[k] = { month: k, revenue: 0, units: 0 }; m[k].revenue += s.revenue; m[k].units += s.unit_count; }
		return Object.values(m).sort((/** @type {any} */ a, /** @type {any} */ b) => a.month.localeCompare(b.month));
	}

	$: combinedMonthlyRows = (() => {
		/** @type {Record<string, any>} */
		const m = {};
		for (const s of filteredData) {
			const k = s.summary_month;
			if (!m[k]) { m[k] = { month: k }; for (const src of sourceOptions) { m[k][src.value+'_revenue'] = 0; m[k][src.value+'_units'] = 0; } }
			m[k][s.source_type+'_revenue'] += s.revenue; m[k][s.source_type+'_units'] += s.unit_count;
		}
		return Object.values(m).sort((/** @type {any} */ a, /** @type {any} */ b) => a.month.localeCompare(b.month));
	})();

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

	function renderAllCharts() {
		if (!browser || !mounted || !dateStart || !dateEnd) return;
		destroyCharts();
		setTimeout(() => {
			const active = sourceOptions.filter((/** @type {any} */ s) => selectedSources.includes(s.value));
			const latestYr = selectedYears.length > 0 ? Math.max(...selectedYears) : new Date().getFullYear();
			const srcColor = Object.fromEntries(sourceOptions.map((/** @type {any} */ s) => [s.value, s.color]));

			// COMBINED
			if (includeCombined && active.length > 1) {
				if (selectedCharts.includes('revenue_by_source')) {
					const ds = [];
					for (const src of active) { const { byYear } = buildYearData(sourceData[src.value]||[]); const yd = byYear[latestYr]; if (yd) ds.push({ label: `${src.label} ${latestYr}`, data: yd.revenue, backgroundColor: src.color, stack: 's' }); }
					if (ds.length) rc('combined-revenue-source', { type:'bar', data:{ labels:monthLabels, datasets:ds }, options:{ responsive:true, animation:false, plugins:{legend:{position:'top'}}, scales:{x:{stacked:true},y:{stacked:true, ticks:{callback:(/** @type {any} */ v)=>'$'+Number(v).toLocaleString()}}} } });
				}
				if (selectedCharts.includes('units_sold')) {
					const ds = [];
					for (const src of active) { const { byYear } = buildYearData(sourceData[src.value]||[]); const yd = byYear[latestYr]; if (yd) ds.push({ label: `${src.unitLabel} ${latestYr}`, data: yd.units, backgroundColor: src.color, stack: 's' }); }
					if (ds.length) rc('combined-units-sold', { type:'bar', data:{ labels:monthLabels, datasets:ds }, options:{ responsive:true, animation:false, plugins:{legend:{position:'top'}}, scales:{x:{stacked:true},y:{stacked:true}} } });
				}
				if (selectedCharts.includes('revenue_split') && totalRevenue > 0) {
					rc('combined-revenue-split', { type:'doughnut', data:{ labels:active.map((/** @type {any} */ s)=>s.label), datasets:[{ data:active.map((/** @type {any} */ s)=>sourceStats[s.value].revenue), backgroundColor:active.map((/** @type {any} */ s)=>s.color) }] }, options:{ responsive:true, animation:false, plugins:{legend:{position:'bottom'}, tooltip:{callbacks:{label:(/** @type {any} */ c)=>{ const p=((c.parsed/totalRevenue)*100).toFixed(1); return `${c.label}: $${c.parsed.toLocaleString()} (${p}%)`; }}}} } });
				}
				if (selectedCharts.includes('ytd_revenue')) {
					const { byYear, years } = buildYearData(filteredData);
					const ds = years.map((/** @type {any} */ yr,/** @type {number} */ i)=>{ const yd=byYear[yr]; if(!yd) return null; const cum=/** @type {number[]} */([]); let sum=0; for(const v of yd.revenue){sum+=v; cum.push(sum);} return { label:String(yr), data:cum, borderColor:yearColors[i%yearColors.length], backgroundColor:'transparent', borderWidth:2, tension:0.3, pointRadius:3 }; }).filter(Boolean);
					rc('combined-ytd-revenue', { type:'line', data:{labels:monthLabels, datasets:ds}, options:{responsive:true, animation:false, plugins:{legend:{position:'top'}}, scales:{y:{ticks:{callback:(/** @type {any} */ v)=>'$'+Number(v).toLocaleString()}}}} });
				}
				if (selectedCharts.includes('item_breakdown')) {
					const items = buildItemData(filteredData).slice(0,15);
					if (items.length) rc('combined-item-breakdown', { type:'bar', data:{labels:items.map((/** @type {any} */ d)=>d.name), datasets:[{label:'Revenue', data:items.map((/** @type {any} */ d)=>d.revenue), backgroundColor:items.map((/** @type {any} */ d)=>srcColor[d.source]||'#6b7280')}]}, options:{responsive:true, animation:false, indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{callback:(/** @type {any} */ v)=>'$'+Number(v).toLocaleString()}}}} });
				}
			}

			// INDIVIDUAL SOURCES
			for (const src of active) {
				const sd = sourceData[src.value]||[];
				if (!sd.length) continue;
				const pfx = src.value;
				if (selectedCharts.includes('revenue_by_source')||selectedCharts.includes('units_sold')) {
					const { byYear } = buildYearData(sd); const yd = byYear[latestYr];
					if (yd && (selectedCharts.includes('revenue_by_source'))) rc(`${pfx}-revenue`, { type:'bar', data:{labels:monthLabels, datasets:[{label:`Revenue ${latestYr}`, data:yd.revenue, backgroundColor:src.color}]}, options:{responsive:true, animation:false, plugins:{legend:{position:'top'}}, scales:{y:{ticks:{callback:(/** @type {any} */ v)=>'$'+Number(v).toLocaleString()}}}} });
					if (yd && selectedCharts.includes('units_sold')) rc(`${pfx}-units-sold`, { type:'bar', data:{labels:monthLabels, datasets:[{label:`${src.unitLabel} ${latestYr}`, data:yd.units, backgroundColor:src.color}]}, options:{responsive:true, animation:false, plugins:{legend:{position:'top'}}} });
				}
				if (selectedCharts.includes('ytd_revenue')) {
					const { byYear, years } = buildYearData(sd);
					const ds = years.map((/** @type {any} */ yr,/** @type {number} */ i)=>{ const yd=byYear[yr]; if(!yd) return null; const cum=/** @type {number[]} */([]); let sum=0; for(const v of yd.revenue){sum+=v; cum.push(sum);} return { label:String(yr), data:cum, borderColor:yearColors[i%yearColors.length], backgroundColor:'transparent', borderWidth:2, tension:0.3, pointRadius:3 }; }).filter(Boolean);
					rc(`${pfx}-ytd-revenue`, { type:'line', data:{labels:monthLabels, datasets:ds}, options:{responsive:true, animation:false, plugins:{legend:{position:'top'}}, scales:{y:{ticks:{callback:(/** @type {any} */ v)=>'$'+Number(v).toLocaleString()}}}} });
				}
				if (selectedCharts.includes('item_breakdown')) {
					const items = buildItemData(sd).slice(0,15);
					if (items.length) rc(`${pfx}-item-breakdown`, { type:'bar', data:{labels:items.map((/** @type {any} */ d)=>d.name), datasets:[{label:'Revenue', data:items.map((/** @type {any} */ d)=>d.revenue), backgroundColor:src.color}]}, options:{responsive:true, animation:false, indexAxis:'y', plugins:{legend:{display:false}}, scales:{x:{ticks:{callback:(/** @type {any} */ v)=>'$'+Number(v).toLocaleString()}}}} });
				}
			}
		}, 150);
	}

	$: if (mounted && dateStart && dateEnd && selectedCharts && selectedSources && includeCombined !== undefined) renderAllCharts();
	onMount(() => { mounted = true; });
	onDestroy(() => { destroyCharts(); });

	async function generateAndSavePDF() {
		generating = true;
		try {
			// @ts-ignore - CDN dynamic import
			const { default: jsPDF } = await import('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js');
			const doc = new jsPDF({ orientation:'portrait', unit:'pt', format:'letter' });
			const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight(), margin = 50, contentW = pageW - margin*2;
			let y = margin;

			doc.setFontSize(22); doc.setFont('helvetica','bold'); doc.text(reportTitle, margin, y+22); y += 40;
			doc.setFontSize(11); doc.setFont('helvetica','normal'); doc.setTextColor(100);
			const sd = new Date(dateStart+'-01T12:00:00'), ed = new Date(dateEnd+'-01T12:00:00');
			doc.text(`${sd.toLocaleDateString('en-US',{month:'long',year:'numeric'})} – ${ed.toLocaleDateString('en-US',{month:'long',year:'numeric'})}`, margin, y); y+=8;
			doc.text(`Generated: ${new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'})}`, margin, y);
			doc.setTextColor(0); y+=25; doc.setDrawColor(200); doc.line(margin, y, pageW-margin, y); y+=20;

			/**
			 * @param {string} canvasId
			 * @param {string} title
			 * @param {number} [h=220]
			 */
			function addChart(canvasId, title, h=220) {
				const cv = /** @type {HTMLCanvasElement} */ (document.getElementById(canvasId)); if(!cv) return;
				const img = cv.toDataURL('image/png',1.0);
				const ch = title.includes('Split') ? 250 : h;
				if (y+ch+30 > pageH-margin) { doc.addPage(); y=margin; }
				doc.setFontSize(12); doc.setFont('helvetica','bold'); doc.text(title, margin, y); y+=15;
				const w = title.includes('Split') ? contentW*0.6 : contentW;
				const x = title.includes('Split') ? margin+(contentW-w)/2 : margin;
				doc.addImage(img,'PNG',x,y,w,ch); y+=ch+20;
			}
			/** @param {string} title */
			function addHeader(title) {
				if(y+40>pageH-margin){doc.addPage();y=margin;}
				doc.setFontSize(16);doc.setFont('helvetica','bold');doc.text(title,margin,y);y+=8;
				doc.setDrawColor(180);doc.line(margin,y,pageW-margin,y);y+=15;
			}

			const active = sourceOptions.filter((/** @type {any} */ s)=>selectedSources.includes(s.value));

			if (includeCombined && active.length > 1) {
				addHeader('Combined Report');
				doc.setFontSize(10); doc.setFont('helvetica','normal');
				doc.text(`Total Revenue: $${totalRevenue.toLocaleString(undefined,{minimumFractionDigits:2})}`, margin+10, y); y+=14;
				for (const src of active) { doc.text(`${src.label}: $${sourceStats[src.value].revenue.toLocaleString(undefined,{minimumFractionDigits:2})} | ${src.unitLabel}: ${sourceStats[src.value].units.toLocaleString()}`, margin+10, y); y+=14; }
				y+=10;
				if(selectedCharts.includes('revenue_by_source')) addChart('combined-revenue-source','Monthly Revenue by Source');
				if(selectedCharts.includes('units_sold')) addChart('combined-units-sold','Monthly Units Sold');
				if(selectedCharts.includes('revenue_split')) addChart('combined-revenue-split','Revenue Split');
				if(selectedCharts.includes('ytd_revenue')) addChart('combined-ytd-revenue','YTD Cumulative Revenue');
				if(selectedCharts.includes('item_breakdown')) addChart('combined-item-breakdown','Revenue by Item');
			}

			for (const src of active) {
				if(!(sourceData[src.value]||[]).length) continue;
				doc.addPage(); y=margin;
				addHeader(`${src.label} Report`);
				doc.setFontSize(10);doc.setFont('helvetica','normal');
				doc.text(`Revenue: $${sourceStats[src.value].revenue.toLocaleString(undefined,{minimumFractionDigits:2})} | ${src.unitLabel}: ${sourceStats[src.value].units.toLocaleString()}`, margin+10, y); y+=20;
				if(selectedCharts.includes('revenue_by_source')) addChart(`${src.value}-revenue`,`Monthly Revenue`);
				if(selectedCharts.includes('units_sold')) addChart(`${src.value}-units-sold`,`Monthly ${src.unitLabel}`);
				if(selectedCharts.includes('ytd_revenue')) addChart(`${src.value}-ytd-revenue`,'YTD Cumulative Revenue');
				if(selectedCharts.includes('item_breakdown')) addChart(`${src.value}-item-breakdown`,`Revenue by ${src.label==='Shows'?'Show':'Class'}`);
			}

			const pdfBase64 = doc.output('datauristring').split(',')[1];
			doc.save(reportTitle.replace(/[^a-zA-Z0-9]/g,'_')+'.pdf');

			const fd = new FormData();
			fd.append('report_title',reportTitle); fd.append('date_range_start',dateStart); fd.append('date_range_end',dateEnd);
			fd.append('datasets',JSON.stringify({combined:includeCombined, sources:selectedSources}));
			fd.append('charts',JSON.stringify(selectedCharts)); fd.append('pdf_base64',pdfBase64);
			fd.append('summary_stats',JSON.stringify({totalRevenue,sourceStats}));
			const resp = await fetch('?/generate_pdf',{method:'POST',body:fd});
			const result = await resp.json();
			const ad = result?.data ? JSON.parse(result.data) : result;
			if(ad?.[1]?.success||ad?.success){ alert('Report saved successfully!'); window.location.reload(); }
		} catch(/** @type {any} */ err) { console.error('PDF error:',err); alert('Error: '+err.message); }
		finally { generating = false; }
	}

	/** @param {any} a */
	function formatCurrency(a){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(a);}
	/** @param {any} d */
	function formatDate(d){if(!d)return'—';const x=new Date(d+(d.includes('T')?'':'T12:00:00'));return isNaN(x.getTime())?'—':x.toLocaleDateString('en-US',{month:'short',year:'numeric'});}
	/** @param {any} d */
	function formatDateTime(d){if(!d)return'—';const x=new Date(d);return isNaN(x.getTime())?'—':x.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit'});}
	/** @param {any} b */
	function formatBytes(b){if(!b)return'—';if(b<1024)return b+' B';if(b<1024*1024)return(b/1024).toFixed(1)+' KB';return(b/(1024*1024)).toFixed(1)+' MB';}
	/** @param {any} v */
	function toggleSource(v){if(selectedSources.includes(v)){if(selectedSources.length>1)selectedSources=selectedSources.filter((/** @type {any} */ d)=>d!==v);}else selectedSources=[...selectedSources,v];}
	/** @param {any} v */
	function toggleChart(v){if(selectedCharts.includes(v))selectedCharts=selectedCharts.filter((/** @type {any} */ c)=>c!==v);else selectedCharts=[...selectedCharts,v];}

	$: activeSources = sourceOptions.filter((/** @type {any} */ s)=>selectedSources.includes(s.value));
	$: canGenerate = dateStart && dateEnd && selectedSources.length > 0 && selectedCharts.length > 0 && filteredData.length > 0;
</script>

<svelte:head>
	<title>Monthly Report Generator | B&C Financial Tracker</title>
	<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js"></script>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href="{base}/reports" class="back-link">← Back to Reports</a>
			<h1>Monthly Report Generator</h1>
			<p class="subtitle">Configure, preview, and generate PDF reports</p>
		</div>
	</header>

	<div class="config-panel">
		<div class="config-grid">
			<div class="config-section">
				<h3>Date Range</h3>
				<div class="date-inputs">
					<div class="form-group"><label for="ds">From</label><input type="month" id="ds" bind:value={dateStart} /></div>
					<div class="form-group"><label for="de">To</label><input type="month" id="de" bind:value={dateEnd} /></div>
				</div>
			</div>
			<div class="config-section">
				<h3>Data Sources</h3>
				<div class="checkbox-group">
					<label class="check-label check-combined"><input type="checkbox" bind:checked={includeCombined} /> Combined</label>
					<div class="source-indent">
						{#each sourceOptions as opt}
							<label class="check-label"><input type="checkbox" checked={selectedSources.includes(opt.value)} on:change={()=>toggleSource(opt.value)} /><span class="source-dot" style="background-color:{opt.color}"></span>{opt.label}</label>
						{/each}
					</div>
				</div>
			</div>
			<div class="config-section">
				<h3>Charts to Include</h3>
				<div class="checkbox-group">
					{#each chartOptions as opt}
						<label class="check-label"><input type="checkbox" checked={selectedCharts.includes(opt.value)} on:change={()=>toggleChart(opt.value)} />{opt.label}</label>
					{/each}
				</div>
			</div>
			<div class="config-section">
				<h3>Report Title</h3>
				<input type="text" bind:value={reportTitle} placeholder="e.g. Q1 2026 Financial Summary" class="title-input" />
			</div>
		</div>
		<div class="config-actions">
			<button class="btn-primary" on:click={generateAndSavePDF} disabled={!canGenerate||generating}>{generating?'Generating PDF...':'📄 Generate & Download PDF'}</button>
			{#if !dateStart||!dateEnd}<span class="config-hint">Select a date range to preview</span>{:else if filteredData.length===0}<span class="config-hint">No data for selected range</span>{/if}
		</div>
	</div>

	{#if dateStart && dateEnd && filteredData.length > 0 && browser && mounted}

		{#if includeCombined && activeSources.length > 1}
			<div class="report-section">
				<div class="section-header combined-header"><h2>Combined Report</h2></div>
				<div class="stats-row">
					<div class="stat-card"><span class="stat-value">{formatCurrency(totalRevenue)}</span><span class="stat-label">Total Revenue</span></div>
					{#each activeSources as src}<div class="stat-card" style="border-top:3px solid {src.color}"><span class="stat-value">{formatCurrency(sourceStats[src.value].revenue)}</span><span class="stat-label">{src.label} Revenue</span></div>{/each}
					<div class="stat-card"><span class="stat-value">{totalUnits.toLocaleString()}</span><span class="stat-label">Total Units</span></div>
				</div>
				<div class="charts-grid">
					{#if selectedCharts.includes('revenue_by_source')}<div class="chart-card wide"><h3>Monthly Revenue by Source</h3><canvas id="combined-revenue-source"></canvas></div>{/if}
					{#if selectedCharts.includes('units_sold')}<div class="chart-card wide"><h3>Monthly Units Sold</h3><canvas id="combined-units-sold"></canvas></div>{/if}
					{#if selectedCharts.includes('revenue_split')}<div class="chart-card"><h3>Revenue Split</h3><canvas id="combined-revenue-split"></canvas></div>{/if}
					{#if selectedCharts.includes('ytd_revenue')}<div class="chart-card"><h3>YTD Cumulative Revenue</h3><canvas id="combined-ytd-revenue"></canvas></div>{/if}
					{#if selectedCharts.includes('item_breakdown')}<div class="chart-card wide"><h3>Revenue by Item</h3><canvas id="combined-item-breakdown"></canvas></div>{/if}
				</div>
				{#if combinedMonthlyRows.length > 0}
					<div class="section"><h3>Monthly Breakdown</h3>
						<div class="table-wrapper"><table>
							<thead><tr><th>Month</th>{#each activeSources as src}<th class="col-right">{src.unitLabel}</th><th class="col-right">{src.label} Rev</th>{/each}<th class="col-right">Total Revenue</th></tr></thead>
							<tbody>{#each combinedMonthlyRows as row}<tr><td>{formatDate(row.month)}</td>{#each activeSources as src}<td class="col-right">{(row[src.value+'_units']||0).toLocaleString()}</td><td class="col-right">{formatCurrency(row[src.value+'_revenue']||0)}</td>{/each}<td class="col-right total-cell">{formatCurrency(activeSources.reduce((/** @type {number} */ s,/** @type {any} */ src)=>s+(row[src.value+'_revenue']||0),0))}</td></tr>{/each}</tbody>
							<tfoot><tr><td class="total-label">Total</td>{#each activeSources as src}<td class="col-right total-value">{sourceStats[src.value].units.toLocaleString()}</td><td class="col-right total-value">{formatCurrency(sourceStats[src.value].revenue)}</td>{/each}<td class="col-right total-value">{formatCurrency(totalRevenue)}</td></tr></tfoot>
						</table></div>
					</div>
				{/if}
			</div>
		{/if}

		{#each activeSources as src}
			{@const srcD = sourceData[src.value]||[]}
			{@const srcRows = buildMonthlyRows(srcD)}
			{@const srcItems = buildItemData(srcD)}
			{#if srcD.length > 0}
				<div class="report-section">
					<div class="section-header" style="border-left:4px solid {src.color}"><h2>{src.label} Report</h2></div>
					<div class="stats-row">
						<div class="stat-card" style="border-top:3px solid {src.color}"><span class="stat-value">{formatCurrency(sourceStats[src.value].revenue)}</span><span class="stat-label">Revenue</span></div>
						<div class="stat-card"><span class="stat-value">{sourceStats[src.value].units.toLocaleString()}</span><span class="stat-label">{src.unitLabel}</span></div>
						<div class="stat-card"><span class="stat-value">{srcItems.length}</span><span class="stat-label">Unique {src.label}</span></div>
						<div class="stat-card"><span class="stat-value">{srcRows.length}</span><span class="stat-label">Months</span></div>
					</div>
					<div class="charts-grid">
						{#if selectedCharts.includes('revenue_by_source')}<div class="chart-card"><h3>Monthly Revenue</h3><canvas id="{src.value}-revenue"></canvas></div>{/if}
						{#if selectedCharts.includes('units_sold')}<div class="chart-card"><h3>Monthly {src.unitLabel}</h3><canvas id="{src.value}-units-sold"></canvas></div>{/if}
						{#if selectedCharts.includes('ytd_revenue')}<div class="chart-card wide"><h3>YTD Cumulative Revenue</h3><canvas id="{src.value}-ytd-revenue"></canvas></div>{/if}
						{#if selectedCharts.includes('item_breakdown')}<div class="chart-card wide"><h3>Revenue by {src.label==='Shows'?'Show':'Class'}</h3><canvas id="{src.value}-item-breakdown"></canvas></div>{/if}
					</div>
					{#if srcRows.length > 0}
						<div class="section"><h3>Monthly Breakdown</h3>
							<div class="table-wrapper"><table>
								<thead><tr><th>Month</th><th class="col-right">{src.unitLabel}</th><th class="col-right">Revenue</th></tr></thead>
								<tbody>{#each srcRows as row}<tr><td>{formatDate(row.month)}</td><td class="col-right">{row.units.toLocaleString()}</td><td class="col-right">{formatCurrency(row.revenue)}</td></tr>{/each}</tbody>
								<tfoot><tr><td class="total-label">Total</td><td class="col-right total-value">{sourceStats[src.value].units.toLocaleString()}</td><td class="col-right total-value">{formatCurrency(sourceStats[src.value].revenue)}</td></tr></tfoot>
							</table></div>
						</div>
					{/if}
				</div>
			{/if}
		{/each}
	{/if}

	{#if data.pastReports && data.pastReports.length > 0}
		<div class="section past-reports"><h2>Previously Generated Reports</h2>
			<table><thead><tr><th>Title</th><th>Date Range</th><th>Generated</th><th>Size</th><th></th></tr></thead>
				<tbody>{#each data.pastReports as r}<tr><td class="rpt-title">{r.report_title}</td><td>{formatDate(r.date_range_start)} – {formatDate(r.date_range_end)}</td><td>{formatDateTime(r.created_at)}</td><td>{formatBytes(r.file_size_bytes)}</td><td><a href="{base}/reports/monthly_reporting/download/{r.report_id}" class="btn-download" target="_blank">Download</a></td></tr>{/each}</tbody>
			</table>
		</div>
	{/if}
</div>

<style>
	.container{max-width:1200px;margin:0 auto;padding:2rem}
	header{margin-bottom:2rem}
	.back-link{color:#6b7280;text-decoration:none;font-size:.875rem;display:inline-block;margin-bottom:.5rem}.back-link:hover{color:#3b82f6}
	h1{font-size:2rem;font-weight:700;color:#1a202c;margin:0}h2{font-size:1.25rem;font-weight:600;color:#1a202c;margin:0}h3{font-size:1rem;font-weight:600;color:#374151;margin:0 0 .5rem 0}.subtitle{color:#6b7280;margin:.25rem 0 0 0}
	.config-panel{background:#fff;padding:1.5rem;border-radius:.5rem;box-shadow:0 1px 3px rgba(0,0,0,.1);margin-bottom:2rem}
	.config-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem}.config-section{display:flex;flex-direction:column;gap:.5rem}
	.date-inputs{display:flex;gap:1rem}.form-group{display:flex;flex-direction:column;gap:.25rem;flex:1}.form-group label{font-size:.75rem;font-weight:600;color:#6b7280;text-transform:uppercase}
	.form-group input[type="month"]{padding:.5rem;border:1px solid #d1d5db;border-radius:.375rem;font-size:.9rem}.form-group input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1)}
	.checkbox-group{display:flex;flex-direction:column;gap:.35rem}.check-label{display:flex;align-items:center;gap:.5rem;font-size:.9rem;color:#374151;cursor:pointer}.check-label input{cursor:pointer;accent-color:#3b82f6}
	.check-combined{font-weight:600}.source-indent{margin-left:1.5rem;display:flex;flex-direction:column;gap:.35rem}.source-dot{display:inline-block;width:10px;height:10px;border-radius:50%}
	.title-input{padding:.5rem .75rem;border:1px solid #d1d5db;border-radius:.375rem;font-size:.9rem;width:100%}.title-input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 3px rgba(59,130,246,.1)}
	.config-actions{display:flex;align-items:center;gap:1rem;padding-top:1rem;border-top:1px solid #f3f4f6}.config-hint{font-size:.85rem;color:#9ca3af}
	.report-section{margin-bottom:2.5rem}.section-header{padding:.75rem 1rem;background:#f9fafb;border-radius:.5rem;margin-bottom:1rem}
	.section-header.combined-header{background:linear-gradient(135deg,#eff6ff 0%,#f5f3ff 100%);border-left:4px solid #6366f1}
	.stats-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:1rem;margin-bottom:1.5rem}
	.stat-card{background:#fff;padding:1.25rem;border-radius:.5rem;box-shadow:0 1px 3px rgba(0,0,0,.1);text-align:center;display:flex;flex-direction:column;gap:.25rem}
	.stat-value{font-size:1.4rem;font-weight:700;color:#1a202c}.stat-label{font-size:.8rem;color:#6b7280;font-weight:500}
	.charts-grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem}.chart-card{background:#fff;padding:1.5rem;border-radius:.5rem;box-shadow:0 1px 3px rgba(0,0,0,.1)}.chart-card.wide{grid-column:1/-1}
	.section{background:#fff;padding:1.5rem;border-radius:.5rem;box-shadow:0 1px 3px rgba(0,0,0,.1);margin-bottom:1.5rem}.table-wrapper{overflow-x:auto}
	table{width:100%;border-collapse:collapse}thead{background-color:#f9fafb}
	th{padding:.6rem .75rem;text-align:left;font-weight:600;color:#374151;font-size:.8rem;text-transform:uppercase;letter-spacing:.03em;border-bottom:2px solid #e5e7eb}
	td{padding:.5rem .75rem;border-bottom:1px solid #f3f4f6;font-size:.9rem}tr:hover{background-color:#f9fafb}
	.col-right{text-align:right}.total-cell{font-weight:600}tfoot td{border-top:2px solid #e5e7eb;border-bottom:none}.total-label{font-weight:600;color:#374151}.total-value{font-weight:700;color:#1a202c}
	.past-reports{margin-top:2rem}.rpt-title{font-weight:500}
	.btn-download{display:inline-block;padding:.3rem .75rem;background:#3b82f6;color:#fff;border-radius:.375rem;text-decoration:none;font-size:.8rem;font-weight:500}.btn-download:hover{background:#2563eb}
	.btn-primary{background-color:#3b82f6;color:#fff;padding:.6rem 1.5rem;border-radius:.5rem;border:none;font-weight:600;font-size:.95rem;cursor:pointer}.btn-primary:hover{background-color:#2563eb}.btn-primary:disabled{background-color:#93c5fd;cursor:not-allowed}
	@media(max-width:768px){.config-grid{grid-template-columns:1fr}.stats-row{grid-template-columns:repeat(2,1fr)}.charts-grid{grid-template-columns:1fr}.chart-card.wide{grid-column:1}.date-inputs{flex-direction:column}}
</style>