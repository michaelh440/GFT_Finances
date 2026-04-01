<!-- src/routes/corp/reports/+page.svelte -->
<script>
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import Chart from 'chart.js/auto';

  /** @type {{ engagements: any[], companies: any[], industries: string[], pastReports: any[] }} */
  export let data;
  /** @type {any} */
  export let form;

  let mounted = false;
  let generating = false;
  let reportTitle = 'Corp Report';

  // PDF section toggles
  let pdfIncludeRevenue = true;
  let pdfIncludeEngagements = true;
  let pdfIncludeIndustry = true;
  let pdfIncludeCompany = true;

  // PDF section notes
  let pdfNotesRevenue = '';
  let pdfNotesEngagements = '';
  let pdfNotesIndustry = '';
  let pdfNotesCompany = '';
  /** @type {Record<string, any>} */
  let charts = {};

  // ── Filters ───────────────────────────────────────────────────────────
  let dateStart  = '';
  let dateEnd    = '';
  /** @type {number[]} */
  let selectedYears = [];
  let selectedIndustry = '';
  let selectedEngType  = '';
  let showFilterOpen   = false;
  /** @type {string[]} */
  let selectedCompanyCodes = [];

  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const yearColors = ['#3b82f6','#ef4444','#10b981','#f59e0b','#8b5cf6','#ec4899','#14b8a6','#f97316'];

  const ENG_TYPES = [
    { value: 'corporate_training',  label: 'Corporate Training'  },
    { value: 'private_show_gft',    label: 'Private Show @ GFT'  },
    { value: 'roadshow',            label: 'Roadshow'            },
    { value: 'space_rental',        label: 'Space Rental'        },
    { value: 'school_nonprofit',    label: 'School / Nonprofit'  },
    { value: 'other',               label: 'Other'               },
  ];

  // ── Init date range ───────────────────────────────────────────────────
  $: if (!dateStart && !dateEnd && data.engagements?.length > 0) {
    const now = new Date();
    dateStart = `${now.getFullYear()}-01`;
    dateEnd   = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  // ── Available years ───────────────────────────────────────────────────
  $: availableYears = [...new Set(data.engagements.map(e => e.eng_year))]
    .filter(y => y >= 2018 && y <= 2030)
    .sort((a, b) => b - a);

  $: {
    if (selectedYears.length === 0 && availableYears.length > 0) {
      selectedYears = availableYears.slice(0, 2);
    }
  }

  // ── Month slot sequence from date range ───────────────────────────────
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

  $: rangeLabels    = monthSlots.map(s => monthNames[s.month - 1]);
  $: primaryEndYear = monthSlots.length > 0
    ? monthSlots[monthSlots.length - 1].year
    : new Date().getFullYear();

  // ── Company filter ────────────────────────────────────────────────────
  $: allCompanyIds   = data.companies.map(c => c.corp_company_id);
  $: effectiveCompanies = selectedCompanyCodes.length === 0
    ? allCompanyIds : selectedCompanyCodes.map(Number);
  $: companyFilterLabel = selectedCompanyCodes.length === 0
    ? 'All Companies'
    : selectedCompanyCodes.length === 1
      ? data.companies.find(c => String(c.corp_company_id) === selectedCompanyCodes[0])?.company_name ?? '1 company'
      : `${selectedCompanyCodes.length} companies`;

  /** @param {any} id */
  function toggleCompany(id) {
    const s = String(id);
    if (selectedCompanyCodes.includes(s))
      selectedCompanyCodes = selectedCompanyCodes.filter(c => c !== s);
    else
      selectedCompanyCodes = [...selectedCompanyCodes, s];
  }

  // ── Apply all filters (including date range) ─────────────────────────
  $: filteredEngagements = data.engagements.filter((/** @type {any} */ e) => {
    if (selectedIndustry && e.industry !== selectedIndustry) return false;
    if (selectedEngType  && e.engagement_type !== selectedEngType) return false;
    if (effectiveCompanies.length && !effectiveCompanies.includes(e.corp_company_id)) return false;
    // Date range filter
    if (dateStart) {
      const [sy, sm] = dateStart.split('-').map(Number);
      if (e.eng_year < sy || (e.eng_year === sy && e.eng_month < sm)) return false;
    }
    if (dateEnd) {
      const [ey, em] = dateEnd.split('-').map(Number);
      if (e.eng_year > ey || (e.eng_year === ey && e.eng_month > em)) return false;
    }
    return true;
  });

  // ── Year toggle ───────────────────────────────────────────────────────
  /** @param {number} yr */
  function toggleYear(yr) {
    if (selectedYears.includes(yr)) {
      if (selectedYears.length > 1) selectedYears = selectedYears.filter(y => y !== yr);
    } else {
      selectedYears = [...selectedYears, yr].sort((a, b) => b - a);
    }
  }

  // ── Build overlay data by year ────────────────────────────────────────
  /**
   * @param {any[]} engs
   * @returns {Record<number, { revenue: number[], count: number[] }>}
   */
  function buildOverlayData(engs) {
    /** @type {Record<number, { revenue: number[], count: number[] }>} */
    const byYear = {};
    for (const yr of selectedYears) {
      byYear[yr] = {
        revenue: Array(monthSlots.length).fill(0),
        count:   Array(monthSlots.length).fill(0),
      };
    }
    for (const e of engs) {
      for (const yr of selectedYears) {
        const yearOffset = yr - primaryEndYear;
        for (let i = 0; i < monthSlots.length; i++) {
          const slot = monthSlots[i];
          if (e.eng_year === slot.year + yearOffset && e.eng_month === slot.month) {
            byYear[yr].revenue[i] += e.amount_paid ?? 0;
            byYear[yr].count[i]   += 1;
          }
        }
      }
    }
    return byYear;
  }

  /**
   * @param {Record<number, {revenue: number[], count: number[]}>} overlayData
   * @param {'revenue'|'count'} metric
   * @param {'bar'|'line'} [chartType]
   */
  function yearDatasets(overlayData, metric, chartType = 'bar') {
    return selectedYears.map((yr, i) => {
      const d = overlayData[yr]?.[metric] || [];
      if (chartType === 'line') {
        const cum = []; let sum = 0;
        for (const v of d) { sum += v; cum.push(sum); }
        return {
          label: String(yr), data: cum,
          borderColor: yearColors[i % yearColors.length],
          backgroundColor: 'transparent',
          borderWidth: 2, tension: 0.3, pointRadius: 3,
        };
      }
      return {
        label: String(yr), data: d,
        backgroundColor: yearColors[i % yearColors.length],
      };
    });
  }

  // ── Summary stats ─────────────────────────────────────────────────────
  $: totalRevenue    = filteredEngagements.reduce((s, e) => s + (e.amount_paid ?? 0), 0);
  $: totalCount      = filteredEngagements.length;
  $: paidCount       = filteredEngagements.filter(e => e.amount_paid > 0).length;
  $: uniqueCompanies = new Set(filteredEngagements.map(e => e.corp_company_id)).size;

  // ── Revenue by industry ───────────────────────────────────────────────
  $: industryBreakdown = (() => {
    /** @type {Record<string, { revenue: number, count: number }>} */
    const m = {};
    for (const e of filteredEngagements) {
      const k = e.industry || 'Unknown';
      if (!m[k]) m[k] = { revenue: 0, count: 0 };
      m[k].revenue += e.amount_paid ?? 0;
      m[k].count   += 1;
    }
    return Object.entries(m)
      .map(([k, v]) => ({ industry: k, ...v }))
      .filter(d => d.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue);
  })();

  // ── Revenue by company ────────────────────────────────────────────────
  $: companyBreakdown = (() => {
    /** @type {Record<number, { name: string, industry: string, revenue: number, count: number }>} */
    const m = {};
    for (const e of filteredEngagements) {
      if (!m[e.corp_company_id]) {
        m[e.corp_company_id] = {
          name: e.company_name, industry: e.industry || '—',
          revenue: 0, count: 0,
        };
      }
      m[e.corp_company_id].revenue += e.amount_paid ?? 0;
      m[e.corp_company_id].count   += 1;
    }
    return Object.values(m).sort((a, b) => b.revenue - a.revenue);
  })();

  // ── Date range label ──────────────────────────────────────────────────
  $: dateRangeLabel = (() => {
    if (!dateStart || !dateEnd) return '';
    const s = new Date(dateStart + '-01T12:00:00');
    const e = new Date(dateEnd   + '-01T12:00:00');
    return `${s.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })} – ${e.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`;
  })();

  // ── Chart helpers ─────────────────────────────────────────────────────
  function destroyCharts() {
    Object.values(charts).forEach((/** @type {any} */ c) => c.destroy());
    charts = {};
  }

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
  const dollarTick = v => '$' + Number(v).toLocaleString();
  /** @param {number} n */
  const fmtCurrency = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n);

  // ── Render all charts ─────────────────────────────────────────────────
  function renderAllCharts() {
    if (!browser || !mounted || monthSlots.length === 0 || selectedYears.length === 0) return;
    destroyCharts();

    setTimeout(() => {
      const allOverlay = buildOverlayData(filteredEngagements);

      // 1. Monthly Revenue
      rc('chart-revenue', {
        type: 'bar',
        data: { labels: rangeLabels, datasets: yearDatasets(allOverlay, 'revenue') },
        options: {
          responsive: true, animation: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { ticks: { callback: dollarTick } } }
        }
      });

      // 2. Revenue Cumulative
      rc('chart-revenue-ytd', {
        type: 'line',
        data: { labels: rangeLabels, datasets: yearDatasets(allOverlay, 'revenue', 'line') },
        options: {
          responsive: true, animation: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { ticks: { callback: dollarTick } } }
        }
      });

      // 3. Engagement Count
      rc('chart-count', {
        type: 'bar',
        data: { labels: rangeLabels, datasets: yearDatasets(allOverlay, 'count') },
        options: {
          responsive: true, animation: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });

      // 4. Engagement Count Cumulative
      rc('chart-count-ytd', {
        type: 'line',
        data: { labels: rangeLabels, datasets: yearDatasets(allOverlay, 'count', 'line') },
        options: {
          responsive: true, animation: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true, ticks: { precision: 0 } } }
        }
      });

      // 5. Revenue by Industry (horizontal bar)
      if (industryBreakdown.length > 0) {
        rc('chart-industry-revenue', {
          type: 'bar',
          data: {
            labels: industryBreakdown.map(d => d.industry),
            datasets: [{
              label: 'Revenue',
              data: industryBreakdown.map(d => d.revenue),
              backgroundColor: industryBreakdown.map((_, i) => yearColors[i % yearColors.length]),
            }]
          },
          options: {
            responsive: true, animation: false, indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { ticks: { callback: dollarTick } } }
          }
        });
      }

      // 6. Revenue by Company (top 20, horizontal bar)
      if (companyBreakdown.length > 0) {
        const top = companyBreakdown.slice(0, 20);
        rc('chart-company-revenue', {
          type: 'bar',
          data: {
            labels: top.map(d => d.name),
            datasets: [{
              label: 'Revenue',
              data: top.map(d => d.revenue),
              backgroundColor: '#3b82f6',
            }]
          },
          options: {
            responsive: true, animation: false, indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { ticks: { callback: dollarTick } } }
          }
        });

        // 7. Engagement Count by Company (top 20, sorted by count)
        const topByCount = [...companyBreakdown].sort((a, b) => b.count - a.count).slice(0, 20);
        rc('chart-company-count', {
          type: 'bar',
          data: {
            labels: topByCount.map(d => d.name),
            datasets: [{
              label: 'Engagements',
              data: topByCount.map(d => d.count),
              backgroundColor: '#10b981',
            }]
          },
          options: {
            responsive: true, animation: false, indexAxis: 'y',
            plugins: { legend: { display: false } },
            scales: { x: { ticks: { precision: 0 } } }
          }
        });
      }
    }, 150);
  }

  $: if (mounted && monthSlots.length > 0 && selectedYears.length > 0) renderAllCharts();

  onMount(() => { mounted = true; });
  onDestroy(() => { destroyCharts(); });

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
          } catch { /* try next */ }
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
        dateRangeLabel,
        selectedIndustry ? `Industry: ${selectedIndustry}` : null,
        selectedEngType ? `Type: ${ENG_TYPES.find(t => t.value === selectedEngType)?.label || selectedEngType}` : null,
        selectedCompanyCodes.length > 0 ? `${selectedCompanyCodes.length} companies` : null,
      ].filter(Boolean).join(' | ') || 'All Engagements';
      doc.text(filterDesc, margin, y);
      y += 14;
      doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, margin, y);
      doc.setTextColor(0);
      y += 20;
      doc.setDrawColor(200);
      doc.line(margin, y, pageW - margin, y);
      y += 20;

      const sections = [
        { include: pdfIncludeRevenue, title: 'Revenue', notes: pdfNotesRevenue, charts: [
          { id: 'chart-revenue-ytd' }, { id: 'chart-revenue' },
        ]},
        { include: pdfIncludeEngagements, title: 'Engagements', notes: pdfNotesEngagements, charts: [
          { id: 'chart-count-ytd' }, { id: 'chart-count' },
        ]},
        { include: pdfIncludeIndustry, title: 'Revenue by Industry', notes: pdfNotesIndustry, charts: [
          { id: 'chart-industry-revenue' },
        ]},
        { include: pdfIncludeCompany, title: 'Revenue & Engagements by Company', notes: pdfNotesCompany, charts: [
          { id: 'chart-company-revenue' }, { id: 'chart-company-count' },
        ]},
      ];

      for (const section of sections) {
        if (!section.include) continue;

        if (y + 40 > pageH - margin) { doc.addPage(); y = margin; }
        doc.setFontSize(15);
        doc.setFont('helvetica', 'bold');
        doc.text(section.title, margin, y);
        y += 8;
        doc.setDrawColor(180);
        doc.line(margin, y, pageW - margin, y);
        y += 12;

        const chartW = (contentW - 10) / 2;
        const chartH = 180;
        for (let i = 0; i < section.charts.length; i += 2) {
          if (y + chartH + 10 > pageH - margin) { doc.addPage(); y = margin; }
          const cvL = /** @type {HTMLCanvasElement | null} */ (document.getElementById(section.charts[i]?.id));
          const cvR = section.charts[i + 1] ? /** @type {HTMLCanvasElement | null} */ (document.getElementById(section.charts[i + 1].id)) : null;
          if (cvL && cvR) {
            doc.addImage(cvL.toDataURL('image/png', 1.0), 'PNG', margin, y, chartW, chartH);
            doc.addImage(cvR.toDataURL('image/png', 1.0), 'PNG', margin + chartW + 10, y, chartW, chartH);
          } else if (cvL) {
            doc.addImage(cvL.toDataURL('image/png', 1.0), 'PNG', margin, y, contentW, chartH);
          }
          y += chartH + 15;
        }

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
      const pdfBase64 = doc.output('datauristring').split(',')[1];
      doc.save(reportTitle.replace(/[^a-zA-Z0-9]/g, '_') + '.pdf');

      const fd = new FormData();
      fd.append('report_title', reportTitle);
      fd.append('date_range_start', dateStart);
      fd.append('date_range_end', dateEnd);
      fd.append('filters', JSON.stringify({ industry: selectedIndustry, engType: selectedEngType, years: selectedYears }));
      fd.append('charts', JSON.stringify(chartIds));
      fd.append('pdf_base64', pdfBase64);

      const resp = await fetch('?/generate_pdf', {
        method: 'POST', body: fd,
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
  <title>Corp Reports | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <div>
      <a href="/corp/companies" class="back-link">← Back to Companies</a>
      <h1>Corp Reports</h1>
      <p class="subtitle">Revenue and engagement analytics for corporate business</p>
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
          placeholder="e.g. Q1 2026 Corp Performance" class="pdf-title-input" />
      </div>
      <button class="btn-generate" on:click={generateAndSavePDF}
        disabled={generating || !mounted || !filteredEngagements.length || (!pdfIncludeRevenue && !pdfIncludeEngagements && !pdfIncludeIndustry && !pdfIncludeCompany)}>
        {generating ? 'Generating...' : 'Generate & Download PDF'}
      </button>
    </div>
    <div class="pdf-sections">
      <span class="pdf-sections-label">Include in PDF:</span>
      <div class="pdf-section-item">
        <label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeRevenue} /> Revenue</label>
        {#if pdfIncludeRevenue}
          <textarea class="pdf-notes" bind:value={pdfNotesRevenue} placeholder="Add notes for this section..." rows="2"></textarea>
        {/if}
      </div>
      <div class="pdf-section-item">
        <label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeEngagements} /> Engagements</label>
        {#if pdfIncludeEngagements}
          <textarea class="pdf-notes" bind:value={pdfNotesEngagements} placeholder="Add notes for this section..." rows="2"></textarea>
        {/if}
      </div>
      <div class="pdf-section-item">
        <label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeIndustry} /> Industry</label>
        {#if pdfIncludeIndustry}
          <textarea class="pdf-notes" bind:value={pdfNotesIndustry} placeholder="Add notes for this section..." rows="2"></textarea>
        {/if}
      </div>
      <div class="pdf-section-item">
        <label class="pdf-section-toggle"><input type="checkbox" bind:checked={pdfIncludeCompany} /> Company</label>
        {#if pdfIncludeCompany}
          <textarea class="pdf-notes" bind:value={pdfNotesCompany} placeholder="Add notes for this section..." rows="2"></textarea>
        {/if}
      </div>
    </div>
  </div>

  <!-- ── Filters ────────────────────────────────────────────────────── -->
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
      <div class="filter-group">
        <label for="industrySelect">Industry</label>
        <select id="industrySelect" bind:value={selectedIndustry} class="filter-select">
          <option value="">All Industries</option>
          {#each data.industries as ind (ind)}
            <option value={ind}>{ind}</option>
          {/each}
        </select>
      </div>
      <div class="filter-group">
        <label for="engTypeSelect">Engagement Type</label>
        <select id="engTypeSelect" bind:value={selectedEngType} class="filter-select">
          <option value="">All Types</option>
          {#each ENG_TYPES as t (t.value)}
            <option value={t.value}>{t.label}</option>
          {/each}
        </select>
      </div>
      <div class="filter-group filter-co-group">
        <label>Companies</label>
        <button class="co-filter-btn" on:click={() => showFilterOpen = !showFilterOpen}>
          {companyFilterLabel}
          <span class="caret">{showFilterOpen ? '▲' : '▼'}</span>
        </button>
        {#if showFilterOpen}
          <div class="co-filter-dropdown">
            <div class="co-filter-actions">
              <button class="btn-link" on:click={() => { selectedCompanyCodes = []; showFilterOpen = false; }}>All</button>
              <button class="btn-link" on:click={() => { selectedCompanyCodes = []; }}>Clear</button>
            </div>
            {#each data.companies as co (co.corp_company_id)}
              <label class="co-filter-item">
                <input type="checkbox"
                  checked={selectedCompanyCodes.length === 0 || selectedCompanyCodes.includes(String(co.corp_company_id))}
                  on:change={() => {
                    if (selectedCompanyCodes.length === 0)
                      selectedCompanyCodes = allCompanyIds.filter(id => id !== co.corp_company_id).map(String);
                    else toggleCompany(co.corp_company_id);
                  }} />
                {co.company_name}
                {#if co.industry}<span class="co-ind-tag">{co.industry}</span>{/if}
              </label>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <div class="filter-divider"></div>

    <div class="year-checkboxes">
      <span class="year-label">Compare Years:</span>
      {#each availableYears as yr (yr)}
        <label class="year-checkbox">
          <input type="checkbox"
            checked={selectedYears.includes(yr)}
            on:change={() => toggleYear(yr)} />
          {yr}
        </label>
      {/each}
    </div>
  </div>

  {#if filteredEngagements.length > 0 && browser && mounted}

    <!-- ── Stats strip ──────────────────────────────────────────────── -->
    <div class="stats-row">
      <div class="stat-card stat-primary">
        <span class="stat-value">{fmtCurrency(totalRevenue)}</span>
        <span class="stat-label">Revenue</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{totalCount.toLocaleString()}</span>
        <span class="stat-label">Engagements</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{paidCount.toLocaleString()}</span>
        <span class="stat-label">Paid</span>
      </div>
      <div class="stat-card">
        <span class="stat-value">{uniqueCompanies.toLocaleString()}</span>
        <span class="stat-label">Companies</span>
      </div>
    </div>

    <!-- ── Revenue section ─────────────────────────────────────────── -->
    <div class="report-section">
      <div class="section-header">
        <h2>Revenue</h2>
        <span class="section-range">{dateRangeLabel} · {selectedYears.join(', ')}</span>
      </div>
      <div class="charts-grid">
        <div class="chart-card"><h3>Revenue Year-to-Date</h3><canvas id="chart-revenue-ytd"></canvas></div>
        <div class="chart-card"><h3>Monthly Revenue</h3><canvas id="chart-revenue"></canvas></div>
        <div class="chart-card wide"><h3>Revenue by Industry</h3><canvas id="chart-industry-revenue"></canvas></div>
        <div class="chart-card wide"><h3>Revenue by Company (Top 20)</h3><canvas id="chart-company-revenue"></canvas></div>
      </div>
    </div>

    <!-- ── Engagements section ─────────────────────────────────────── -->
    <div class="report-section">
      <div class="section-header">
        <h2>Engagements</h2>
        <span class="section-range">{dateRangeLabel} · {selectedYears.join(', ')}</span>
      </div>
      <div class="charts-grid">
        <div class="chart-card"><h3>Engagements Year-to-Date</h3><canvas id="chart-count-ytd"></canvas></div>
        <div class="chart-card"><h3>Monthly Engagements</h3><canvas id="chart-count"></canvas></div>
        <div class="chart-card wide"><h3>Engagements by Company (Top 20)</h3><canvas id="chart-company-count"></canvas></div>
      </div>
    </div>

    <!-- ── Industry breakdown table ────────────────────────────────── -->
    <div class="report-section">
      <div class="section-header">
        <h2>Industry Breakdown</h2>
        <span class="section-range">{dateRangeLabel}</span>
      </div>
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th>Industry</th>
              <th class="col-right">Engagements</th>
              <th class="col-right">Revenue</th>
              <th class="col-right">Avg per Eng</th>
            </tr>
          </thead>
          <tbody>
            {#each industryBreakdown as row (row.industry)}
              <tr>
                <td>{row.industry}</td>
                <td class="col-right">{row.count}</td>
                <td class="col-right">{fmtCurrency(row.revenue)}</td>
                <td class="col-right">{row.count > 0 ? fmtCurrency(row.revenue / row.count) : '—'}</td>
              </tr>
            {/each}
          </tbody>
          <tfoot>
            <tr>
              <td class="total-label">Total</td>
              <td class="col-right total-value">{totalCount}</td>
              <td class="col-right total-value">{fmtCurrency(totalRevenue)}</td>
              <td class="col-right total-value">{totalCount > 0 ? fmtCurrency(totalRevenue / totalCount) : '—'}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>

    <!-- ── Company breakdown table ─────────────────────────────────── -->
    <div class="report-section">
      <div class="section-header">
        <h2>Company Breakdown</h2>
        <span class="section-range">{dateRangeLabel}</span>
      </div>
      <div class="table-card">
        <table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Industry</th>
              <th class="col-right">Engagements</th>
              <th class="col-right">Revenue</th>
              <th class="col-right">Avg per Eng</th>
            </tr>
          </thead>
          <tbody>
            {#each companyBreakdown as co, i (co.name)}
              <tr>
                <td><span class="rank">#{i+1}</span> {co.name}</td>
                <td class="muted">{co.industry}</td>
                <td class="col-right">{co.count}</td>
                <td class="col-right">{fmtCurrency(co.revenue)}</td>
                <td class="col-right">{co.count > 0 ? fmtCurrency(co.revenue / co.count) : '—'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

  {:else if !dateStart || !dateEnd}
    <div class="empty-state">Select a date range to view reports.</div>
  {:else if selectedYears.length === 0}
    <div class="empty-state">Select at least one year to compare.</div>
  {:else}
    <div class="empty-state">No engagements found for the selected filters.</div>
  {/if}

  {#if data.pastReports && data.pastReports.length > 0}
    <div class="report-section past-reports">
      <div class="section-header">
        <h2>Previously Generated Reports</h2>
      </div>
      <div class="table-card">
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
                  <a href="/corp/reports/download/{r.report_id}" class="btn-download" target="_blank">Download</a>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
  header { margin-bottom: 2rem; }
  .back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
  .back-link:hover { color: #3b82f6; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
  h2 { font-size: 1.15rem; font-weight: 600; color: #1a202c; margin: 0; }
  h3 { font-size: 0.95rem; font-weight: 600; color: #374151; margin: 0 0 0.5rem; }
  .subtitle { color: #6b7280; margin: 0.25rem 0 0; }

  /* ── Filters ─────────────────────────────────────────────────────── */
  .filter-section { background: white; padding: 1.25rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
  .filter-row { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; }
  .filter-group { display: flex; flex-direction: column; gap: 0.25rem; min-width: 130px; }
  .filter-group label { font-size: 0.72rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .filter-group input[type="month"] { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; background: white; }
  .filter-group input[type="month"]:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
  .filter-select { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; background: white; }
  .filter-select:focus { outline: none; border-color: #3b82f6; }

  .filter-co-group { position: relative; }
  .co-filter-btn { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; background: white; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; color: #1a202c; }
  .co-filter-btn:hover { border-color: #9ca3af; }
  .caret { font-size: 0.65rem; color: #9ca3af; }
  .co-filter-dropdown { position: absolute; top: 100%; left: 0; min-width: 280px; max-height: 320px; overflow-y: auto; background: white; border: 1px solid #d1d5db; border-radius: 0.375rem; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 50; padding: 0.5rem 0; margin-top: 0.25rem; }
  .co-filter-actions { display: flex; justify-content: space-between; padding: 0.25rem 0.75rem 0.5rem; border-bottom: 1px solid #f3f4f6; }
  .co-filter-item { display: flex; align-items: center; gap: 0.4rem; padding: 0.3rem 0.75rem; font-size: 0.82rem; color: #374151; cursor: pointer; }
  .co-filter-item:hover { background: #f9fafb; }
  .co-filter-item input { accent-color: #3b82f6; cursor: pointer; }
  .co-ind-tag { font-size: 0.7rem; color: #4338ca; background: #e0e7ff; padding: 0.1rem 0.3rem; border-radius: 0.2rem; margin-left: 0.25rem; }

  .filter-divider { height: 1px; background: #e5e7eb; margin: 1rem 0; }
  .year-checkboxes { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
  .year-label { font-size: 0.72rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .year-checkbox { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; color: #374151; cursor: pointer; }
  .year-checkbox input { cursor: pointer; accent-color: #3b82f6; }
  .btn-link { background: none; border: none; color: #3b82f6; font-size: 0.8rem; cursor: pointer; padding: 0; }
  .btn-link:hover { text-decoration: underline; }

  /* ── Stats ───────────────────────────────────────────────────────── */
  .stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
  .stat-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.25rem; }
  .stat-card.stat-primary { border-top: 3px solid #3b82f6; }
  .stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
  .stat-label { font-size: 0.78rem; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }

  /* ── Report sections ─────────────────────────────────────────────── */
  .report-section { margin-bottom: 2.5rem; }
  .section-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #f9fafb; border-radius: 0.5rem; margin-bottom: 1rem; border-left: 4px solid #3b82f6; }
  .section-range { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

  .charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
  .chart-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); min-height: 280px; }
  .chart-card.wide { grid-column: 1 / -1; min-height: 320px; }

  /* ── Tables ──────────────────────────────────────────────────────── */
  .table-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: #f9fafb; }
  th { padding: 0.625rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
  td { padding: 0.5rem 1rem; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; color: #1a202c; }
  tr:hover td { background: #f9fafb; }
  tfoot td { border-top: 2px solid #e5e7eb; border-bottom: none; padding-top: 0.75rem; }
  .col-right { text-align: right; }
  .total-label { font-weight: 600; color: #374151; text-align: right; }
  .total-value { font-weight: 700; color: #1a202c; }
  .muted { color: #6b7280; font-size: 0.82rem; }
  .rank { font-size: 0.72rem; color: #9ca3af; font-family: monospace; }

  .empty-state { text-align: center; padding: 3rem; color: #6b7280; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

  /* PDF panel */
  .pdf-panel { background: white; padding: 1.25rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
  .pdf-panel-row { display: flex; align-items: flex-end; gap: 1rem; flex-wrap: wrap; }
  .pdf-title-group { display: flex; flex-direction: column; gap: 0.25rem; flex: 1; min-width: 250px; }
  .pdf-title-group label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .pdf-title-input { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.9rem; }
  .pdf-title-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
  .btn-generate { background: #3b82f6; color: white; padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; white-space: nowrap; }
  .btn-generate:hover { background: #2563eb; }
  .btn-generate:disabled { background: #93c5fd; cursor: not-allowed; }
  .pdf-sections { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #f3f4f6; }
  .pdf-sections-label { grid-column: 1 / -1; font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
  .pdf-section-item { display: flex; flex-direction: column; gap: 0.4rem; }
  .pdf-section-toggle { display: flex; align-items: center; gap: 0.35rem; font-size: 0.875rem; color: #374151; cursor: pointer; }
  .pdf-section-toggle input { cursor: pointer; accent-color: #3b82f6; }
  .pdf-notes { width: 100%; padding: 0.4rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.8rem; font-family: inherit; resize: vertical; color: #374151; }
  .pdf-notes:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
  .pdf-notes::placeholder { color: #9ca3af; }

  /* Alerts */
  .alert { padding: 0.875rem 1.25rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
  .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

  /* Past reports */
  .rpt-title { font-weight: 500; }
  .btn-download { display: inline-block; padding: 0.3rem 0.75rem; background: #3b82f6; color: white; border-radius: 0.375rem; text-decoration: none; font-size: 0.8rem; font-weight: 500; }
  .btn-download:hover { background: #2563eb; }

  @media (max-width: 768px) {
    .stats-row { grid-template-columns: repeat(2, 1fr); }
    .charts-grid { grid-template-columns: 1fr; }
    .chart-card.wide { grid-column: 1; }
    .filter-row { flex-direction: column; }
    .section-header { flex-direction: column; align-items: flex-start; gap: 0.25rem; }
  }
</style>