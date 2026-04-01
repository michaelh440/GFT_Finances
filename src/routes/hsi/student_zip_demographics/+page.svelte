<script>
    import { enhance } from '$app/forms';
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { onMount } from 'svelte';
    import Chart from 'chart.js/auto';

    export let data;
    export let form;

    $: ({ studentZips, demographics, summary, genderBreakdown, ageBreakdown, filterOptions, activeFilters } = data);

    let refreshing = false;
    let activeTab = 'overview';

    // Filter state — initialised from URL params via activeFilters
    let selYears    = [];
    let selClasses  = [];
    let selTracks   = [];
    let selTeachers = [];

    $: if (activeFilters) {
        selYears    = activeFilters.years.map(String);
        selClasses  = activeFilters.classes;
        selTracks   = activeFilters.tracks;
        selTeachers = activeFilters.teachers.map(String);
    }

    $: hasActiveFilters = selYears.length || selClasses.length || selTracks.length || selTeachers.length;

    function toggleItem(arr, val) {
        return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
    }

    function applyFilters() {
        const params = new URLSearchParams();
        selYears.forEach(y    => params.append('year',    y));
        selClasses.forEach(c  => params.append('class',   c));
        selTracks.forEach(t   => params.append('track',   t));
        selTeachers.forEach(t => params.append('teacher', t));
        goto('?' + params.toString(), { invalidateAll: true });
    }

    function clearFilters() {
        selYears = []; selClasses = []; selTracks = []; selTeachers = [];
        goto('?', { invalidateAll: true });
    }

    // Chart instances
    let ageChartEl, incomeChartEl, educationChartEl, genderChartEl, studentAgeChartEl;
    let ageChart, incomeChart, educationChart, genderChart, studentAgeChart;

    // Weighted averages across all student ZIPs (weighted by student count)
    $: weightedAge = computeWeighted('pct_age_under_18','pct_age_18_24','pct_age_25_34','pct_age_35_44','pct_age_45_54','pct_age_55_64','pct_age_65_plus');
    $: weightedIncome = computeWeighted('pct_income_under_25k','pct_income_25k_50k','pct_income_50k_75k','pct_income_75k_100k','pct_income_100k_150k','pct_income_150k_plus');
    $: weightedEdu = computeWeighted('pct_edu_high_school','pct_edu_some_college','pct_edu_bachelors','pct_edu_graduate');

    function computeWeighted(...fields) {
        if (!demographics.length) return {};
        const totalStudents = demographics.reduce((s, d) => s + Number(d.student_count), 0);
        const result = {};
        for (const field of fields) {
            result[field] = demographics.reduce((s, d) => {
                return s + (Number(d[field] || 0) * Number(d.student_count));
            }, 0) / totalStudents;
        }
        return result;
    }

    function fmt(val, prefix = '', suffix = '') {
        if (val == null || isNaN(val)) return '—';
        return prefix + Number(val).toLocaleString() + suffix;
    }

    function fmtPct(val) {
        if (val == null || isNaN(val)) return '—';
        return Number(val).toFixed(1) + '%';
    }

    // Build only the chart(s) relevant to the current tab
    function buildTabCharts(tab) {
        if (!demographics.length) return;
        const COLORS = {
            blue: '#3b82f6', green: '#22c55e', purple: '#a855f7',
            orange: '#f97316', pink: '#ec4899', teal: '#14b8a6', yellow: '#eab308',
        };
        const colorArr = Object.values(COLORS);

        if (tab === 'overview') {
            if (genderChartEl && genderBreakdown.length) {
                genderChart?.destroy();
                genderChart = new Chart(genderChartEl, {
                    type: 'doughnut',
                    data: {
                        labels: genderBreakdown.map(r => r.gender),
                        datasets: [{ data: genderBreakdown.map(r => r.count), backgroundColor: colorArr, borderWidth: 2 }]
                    },
                    options: { responsive: true, plugins: { title: { display: true, text: 'Student Gender (self-reported)' } } }
                });
            }
            if (studentAgeChartEl && ageBreakdown.length) {
                studentAgeChart?.destroy();
                studentAgeChart = new Chart(studentAgeChartEl, {
                    type: 'bar',
                    data: {
                        labels: ageBreakdown.map(r => r.age_bracket),
                        datasets: [{ label: 'Students', data: ageBreakdown.map(r => r.count), backgroundColor: COLORS.purple + 'cc', borderColor: COLORS.purple, borderWidth: 1 }]
                    },
                    options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Student Age Distribution (actual)' } }, scales: { y: { title: { display: true, text: 'Students' } } } }
                });
            }
        }

        if (tab === 'age') {
            if (ageChartEl) {
                ageChart?.destroy();
                ageChart = new Chart(ageChartEl, {
                    type: 'bar',
                    data: {
                        labels: ['Under 18','18–24','25–34','35–44','45–54','55–64','65+'],
                        datasets: [{ label: 'Neighborhood Age % (weighted)', data: ['pct_age_under_18','pct_age_18_24','pct_age_25_34','pct_age_35_44','pct_age_45_54','pct_age_55_64','pct_age_65_plus'].map(k => weightedAge[k]?.toFixed(1)), backgroundColor: COLORS.blue + 'cc', borderColor: COLORS.blue, borderWidth: 1 }]
                    },
                    options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Neighborhood Age Distribution (ZIP-weighted)' } }, scales: { y: { title: { display: true, text: '% of Population' } } } }
                });
            }
        }

        if (tab === 'income') {
            if (incomeChartEl) {
                incomeChart?.destroy();
                incomeChart = new Chart(incomeChartEl, {
                    type: 'doughnut',
                    data: {
                        labels: ['< $25k','$25k–$50k','$50k–$75k','$75k–$100k','$100k–$150k','$150k+'],
                        datasets: [{ data: ['pct_income_under_25k','pct_income_25k_50k','pct_income_50k_75k','pct_income_75k_100k','pct_income_100k_150k','pct_income_150k_plus'].map(k => weightedIncome[k]?.toFixed(1)), backgroundColor: colorArr, borderWidth: 2 }]
                    },
                    options: { responsive: true, plugins: { title: { display: true, text: 'Household Income Distribution (ZIP-weighted)' } } }
                });
            }
        }

        if (tab === 'education') {
            if (educationChartEl) {
                educationChart?.destroy();
                educationChart = new Chart(educationChartEl, {
                    type: 'bar',
                    data: {
                        labels: ['High School / GED','Some College / Assoc.','Bachelors','Graduate / Prof.'],
                        datasets: [{ label: '% of Adults 25+', data: ['pct_edu_high_school','pct_edu_some_college','pct_edu_bachelors','pct_edu_graduate'].map(k => weightedEdu[k]?.toFixed(1)), backgroundColor: COLORS.teal + 'cc', borderColor: COLORS.teal, borderWidth: 1 }]
                    },
                    options: { responsive: true, plugins: { legend: { display: false }, title: { display: true, text: 'Educational Attainment (ZIP-weighted)' } }, scales: { y: { title: { display: true, text: '% of Adults 25+' } } } }
                });
            }
        }
    }

    // Remove old buildCharts function from the page (charts now split by tab)
    function buildCharts() { buildTabCharts(activeTab); }

    onMount(() => { if (demographics.length) setTimeout(() => buildTabCharts(activeTab), 50); });

    // Rebuild chart whenever tab changes or data changes
    $: if (activeTab) setTimeout(() => buildTabCharts(activeTab), 50);
    $: if (demographics) setTimeout(() => buildTabCharts(activeTab), 50);

    // Coverage status
    $: coveredZips = new Set(demographics.map(d => d.zip_code));
    $: missingZips = studentZips.filter(z => !coveredZips.has(z.zip_code));
</script>

<svelte:head>
    <title>Student ZIP Demographics | HSI</title>
</svelte:head>

<div class="page-wrapper">
    <div class="page-header">
        <div>
            <h1>Student ZIP Demographics</h1>
            <p class="subtitle">Census ACS data enriched by ZIP code · {summary?.students_with_zip ?? 0} students with ZIP codes</p>
        </div>
        <form method="POST" action="?/refresh" use:enhance={() => {
            refreshing = true;
            return async ({ update }) => {
                await update();
                refreshing = false;
            };
        }}>
            <button type="submit" class="btn btn-primary" disabled={refreshing}>
                {#if refreshing}
                    <span class="spinner"></span> Refreshing Census data…
                {:else}
                    ↺ Refresh Census Data
                {/if}
            </button>
        </form>
        <form method="POST" action="?/diagnose" use:enhance>
            <button type="submit" class="btn btn-secondary">🔍 Diagnose ZIPs</button>
        </form>
        <a href={resolve('/hsi')} class="btn btn-secondary">Back to HSI Dashboard</a>
    </div>

    <!-- Filter Panel -->
    {#if filterOptions}
    <div class="filter-panel">
        <div class="filter-row">
            <div class="filter-group">
                <label>Year (last class)</label>
                <div class="chip-group">
                    {#each filterOptions.years as y}
                        <button
                            class="chip {selYears.includes(String(y.year)) ? 'active' : ''}"
                            on:click={() => { selYears = toggleItem(selYears, String(y.year)); }}
                        >{y.year}</button>
                    {/each}
                </div>
            </div>
            <div class="filter-group">
                <label>Track</label>
                <div class="chip-group">
                    {#each filterOptions.tracks as t}
                        <button
                            class="chip {selTracks.includes(t.track) ? 'active' : ''}"
                            on:click={() => { selTracks = toggleItem(selTracks, t.track); }}
                        >{t.track}</button>
                    {/each}
                </div>
            </div>
        </div>
        <div class="filter-row">
            <div class="filter-group">
                <label>Class</label>
                <div class="chip-group">
                    {#each filterOptions.classes as c}
                        <button
                            class="chip {selClasses.includes(c.class_code) ? 'active' : ''}"
                            on:click={() => { selClasses = toggleItem(selClasses, c.class_code); }}
                            title={c.class_name}
                        >{c.class_code}</button>
                    {/each}
                </div>
            </div>
            <div class="filter-group">
                <label>Teacher</label>
                <div class="chip-group">
                    {#each filterOptions.teachers as t}
                        <button
                            class="chip {selTeachers.includes(String(t.teacher_id)) ? 'active' : ''}"
                            on:click={() => { selTeachers = toggleItem(selTeachers, String(t.teacher_id)); }}
                        >{t.name}</button>
                    {/each}
                </div>
            </div>
        </div>
        <div class="filter-actions">
            <button class="btn btn-primary" on:click={applyFilters}>Apply Filters</button>
            {#if hasActiveFilters}
                <button class="btn btn-ghost" on:click={clearFilters}>✕ Clear filters</button>
                <span class="filter-badge">Filtered view</span>
            {/if}
        </div>
    </div>
    {/if}

    <!-- Refresh result banner -->
    {#if form?.refreshResult}
        {@const r = form.refreshResult}
        <div class="alert {r.failed === 0 ? 'alert-success' : r.success === 0 ? 'alert-error' : 'alert-warning'}">
            <strong>Census refresh complete:</strong>
            {r.success} ZIP{r.success !== 1 ? 's' : ''} updated successfully
            {#if r.failed > 0}, {r.failed} failed{/if}.
            {#if r.errors.length}
                <details class="error-details">
                    <summary>View errors</summary>
                    <ul>{#each r.errors as e}<li>{e}</li>{/each}</ul>
                </details>
            {/if}
        </div>
    {/if}

    <!-- Diagnose result banner -->
    {#if form?.diagnoseResult}
        {@const d = form.diagnoseResult}
        <div class="alert alert-warning">
            <strong>ZIP Diagnostic Results (check server terminal for full output)</strong>
            <details open>
                <summary>ZIP lengths in DB ({d.byLength.length} distinct lengths)</summary>
                <ul>
                    {#each d.byLength as r}
                        <li>Length {r.len}: {r.count} students — example: "{r.example}"</li>
                    {/each}
                </ul>
            </details>
            <details>
                <summary>First 20 raw ZIP values</summary>
                <ul>
                    {#each d.samples as r}
                        <li>"{r.zip_code}" (len={r.len}, first_ascii={r.first_char_ascii}, last_ascii={r.last_char_ascii})</li>
                    {/each}
                </ul>
            </details>
        </div>
    {/if}

    <!-- Coverage notice -->
    {#if missingZips.length > 0}
        <div class="alert alert-warning">
            <strong>{missingZips.length} ZIP code{missingZips.length !== 1 ? 's' : ''} missing Census data.</strong>
            Click "Refresh Census Data" to fetch them.
            <span class="zip-list">{missingZips.slice(0,8).map(z => z.zip_code).join(', ')}{missingZips.length > 8 ? ` +${missingZips.length - 8} more` : ''}</span>
        </div>
    {/if}

    <!-- Summary Stats -->
    <div class="stats-grid">
        <div class="stat-card">
            <div class="stat-value">{summary?.students_with_zip ?? '—'}</div>
            <div class="stat-label">Students with ZIP</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{summary?.unique_zips ?? '—'}</div>
            <div class="stat-label">Unique ZIP Codes</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{summary?.zips_with_census_data ?? '—'}</div>
            <div class="stat-label">ZIPs with Census Data</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{fmt(summary?.avg_median_income, '$')}</div>
            <div class="stat-label">Avg Median HH Income</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{summary?.avg_median_age ?? '—'}</div>
            <div class="stat-label">Avg Neighborhood Age</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">{summary?.avg_pct_college_degree ? summary.avg_pct_college_degree + '%' : '—'}</div>
            <div class="stat-label">Avg w/ College Degree</div>
        </div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
        {#each ['overview','age','income','education','zip-table'] as tab}
            <button
                class="tab-btn {activeTab === tab ? 'active' : ''}"
                on:click={() => activeTab = tab}
            >
                {tab === 'zip-table' ? 'ZIP Breakdown' : tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
        {/each}
    </div>

    <!-- Overview Tab -->
    {#if activeTab === 'overview'}
        <div class="charts-grid-2">
            <div class="chart-card">
                <canvas bind:this={genderChartEl}></canvas>
                {#if !genderBreakdown.length}<p class="no-data">No gender data in student records.</p>{/if}
            </div>
            <div class="chart-card">
                <canvas bind:this={studentAgeChartEl}></canvas>
                {#if !ageBreakdown.length}<p class="no-data">No age data in student records.</p>{/if}
            </div>
        </div>

    <!-- Age Tab -->
    {:else if activeTab === 'age'}
        <div class="charts-grid-1">
            <div class="chart-card">
                <canvas bind:this={ageChartEl}></canvas>
                {#if !demographics.length}<p class="no-data">No Census data yet. Click "Refresh Census Data" to fetch.</p>{/if}
            </div>
        </div>
        <div class="insight-box">
            <h3>Neighborhood Age Insights</h3>
            <p>
                Students' ZIP codes have a weighted-average neighborhood age of
                <strong>{summary?.avg_median_age ?? '—'}</strong> years.
                The strongest age cohort in student neighborhoods is
                <strong>
                    {#if demographics.length}
                        {(() => {
                            const brackets = ['Under 18','18–24','25–34','35–44','45–54','55–64','65+'];
                            const keys = ['pct_age_under_18','pct_age_18_24','pct_age_25_34','pct_age_35_44','pct_age_45_54','pct_age_55_64','pct_age_65_plus'];
                            const vals = keys.map(k => weightedAge[k] || 0);
                            const max = Math.max(...vals);
                            return brackets[vals.indexOf(max)];
                        })()}
                    {:else}—{/if}
                </strong>.
            </p>
        </div>

    <!-- Income Tab -->
    {:else if activeTab === 'income'}
        <div class="charts-grid-1">
            <div class="chart-card">
                <canvas bind:this={incomeChartEl}></canvas>
                {#if !demographics.length}<p class="no-data">No Census data yet. Click "Refresh Census Data" to fetch.</p>{/if}
            </div>
        </div>
        <div class="insight-box">
            <h3>Income Insights</h3>
            <p>
                The average median household income across student ZIP codes is
                <strong>{fmt(summary?.avg_median_income, '$')}</strong>.
            </p>
        </div>

    <!-- Education Tab -->
    {:else if activeTab === 'education'}
        <div class="charts-grid-1">
            <div class="chart-card">
                <canvas bind:this={educationChartEl}></canvas>
                {#if !demographics.length}<p class="no-data">No Census data yet. Click "Refresh Census Data" to fetch.</p>{/if}
            </div>
        </div>
        <div class="insight-box">
            <h3>Education Insights</h3>
            <p>
                An estimated <strong>{summary?.avg_pct_college_degree ? summary.avg_pct_college_degree + '%' : '—'}</strong>
                of adults 25+ in student neighborhoods hold a bachelor's degree or higher.
            </p>
        </div>

    <!-- ZIP Table Tab -->
    {:else if activeTab === 'zip-table'}
        <div class="table-wrapper">
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ZIP</th>
                        <th>Students</th>
                        <th>Median Age</th>
                        <th>Median HH Income</th>
                        <th>% w/ Degree</th>
                        <th>% Owner-Occ.</th>
                        <th>ACS Year</th>
                        <th>Last Updated</th>
                    </tr>
                </thead>
                <tbody>
                    {#each demographics as d}
                        <tr>
                            <td><strong>{d.zip_code}</strong></td>
                            <td>{d.student_count}</td>
                            <td>{d.median_age ?? '—'}</td>
                            <td>{fmt(d.median_household_income, '$')}</td>
                            <td>{d.pct_edu_bachelors != null && d.pct_edu_graduate != null
                                ? fmtPct(Number(d.pct_edu_bachelors) + Number(d.pct_edu_graduate))
                                : '—'}</td>
                            <td>{fmtPct(d.pct_owner_occupied)}</td>
                            <td>{d.acs_year ?? '—'}</td>
                            <td>{d.last_updated ? new Date(d.last_updated).toLocaleDateString() : '—'}</td>
                        </tr>
                    {:else}
                        <tr><td colspan="8" class="no-data">No Census data loaded yet. Click "Refresh Census Data".</td></tr>
                    {/each}
                    {#each missingZips as z}
                        <tr class="missing-row">
                            <td><strong>{z.zip_code}</strong></td>
                            <td>{z.student_count}</td>
                            <td colspan="6" class="missing-label">Census data not yet fetched</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
    {/if}
</div>

<style>
    .page-wrapper { max-width: 1200px; margin: 0 auto; padding: 2rem; }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 1.5rem;
        gap: 1rem;
        flex-wrap: wrap;
    }
    h1 { margin: 0 0 0.25rem; font-size: 1.75rem; }
    .subtitle { color: #6b7280; margin: 0; font-size: 0.9rem; }

    .btn { padding: 0.5rem 1.25rem; border-radius: 6px; border: none; cursor: pointer; font-size: 0.9rem; font-weight: 500; }
    .btn-primary { background: #3b82f6; color: white; }
    .btn-secondary { background: #6b7280; color: white; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .spinner {
        display: inline-block;
        width: 0.85em; height: 0.85em;
        border: 2px solid rgba(255,255,255,0.4);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.7s linear infinite;
        vertical-align: middle;
        margin-right: 4px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    .alert {
        padding: 0.75rem 1rem;
        border-radius: 6px;
        margin-bottom: 1rem;
        font-size: 0.9rem;
    }
    .alert-success { background: #dcfce7; border: 1px solid #86efac; color: #166534; }
    .alert-warning { background: #fef9c3; border: 1px solid #fde047; color: #854d0e; }
    .alert-error   { background: #fee2e2; border: 1px solid #fca5a5; color: #991b1b; }
    .zip-list { font-family: monospace; margin-left: 0.5rem; }
    .error-details { margin-top: 0.5rem; }
    .error-details ul { margin: 0.25rem 0 0 1rem; }

    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 1rem;
        margin-bottom: 1.5rem;
    }
    .stat-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem;
        text-align: center;
    }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: #1e3a5f; }
    .stat-label { font-size: 0.78rem; color: #6b7280; margin-top: 0.25rem; }

    .tabs { display: flex; gap: 0.25rem; margin-bottom: 1.25rem; border-bottom: 2px solid #e5e7eb; }
    .tab-btn {
        padding: 0.5rem 1rem;
        border: none;
        background: none;
        cursor: pointer;
        font-size: 0.9rem;
        color: #6b7280;
        border-bottom: 2px solid transparent;
        margin-bottom: -2px;
    }
    .tab-btn.active { color: #3b82f6; border-bottom-color: #3b82f6; font-weight: 600; }

    .charts-grid-1 { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
    .charts-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
    @media (max-width: 768px) { .charts-grid-2 { grid-template-columns: 1fr; } }

    .chart-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1.25rem;
    }

    .insight-box {
        background: #f0f9ff;
        border: 1px solid #bae6fd;
        border-radius: 8px;
        padding: 1rem 1.25rem;
        margin-top: 1rem;
    }
    .insight-box h3 { margin: 0 0 0.5rem; font-size: 1rem; color: #0c4a6e; }
    .insight-box p { margin: 0; color: #374151; }

    .table-wrapper { overflow-x: auto; }
    .data-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.875rem;
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
    }
    .data-table th {
        background: #f9fafb;
        padding: 0.65rem 1rem;
        text-align: left;
        font-weight: 600;
        color: #374151;
        border-bottom: 1px solid #e5e7eb;
        white-space: nowrap;
    }
    .data-table td {
        padding: 0.6rem 1rem;
        border-bottom: 1px solid #f3f4f6;
        color: #374151;
    }
    .data-table tbody tr:last-child td { border-bottom: none; }
    .data-table tbody tr:hover td { background: #f9fafb; }

    .missing-row td { color: #9ca3af; font-style: italic; }
    .missing-label { color: #d1d5db; }

    .no-data { color: #9ca3af; text-align: center; padding: 2rem; font-style: italic; }

    /* Filters */
    .filter-panel {
        background: #f9fafb;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1rem 1.25rem;
        margin-bottom: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }
    .filter-row { display: flex; gap: 1.5rem; flex-wrap: wrap; }
    .filter-group { display: flex; flex-direction: column; gap: 0.4rem; min-width: 180px; flex: 1; }
    .filter-group label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; color: #6b7280; letter-spacing: 0.05em; }
    .chip-group { display: flex; flex-wrap: wrap; gap: 0.35rem; }
    .chip {
        padding: 0.25rem 0.65rem;
        border-radius: 999px;
        border: 1px solid #d1d5db;
        background: white;
        font-size: 0.8rem;
        cursor: pointer;
        color: #374151;
        transition: all 0.15s;
        white-space: nowrap;
    }
    .chip:hover { border-color: #3b82f6; color: #3b82f6; }
    .chip.active { background: #3b82f6; border-color: #3b82f6; color: white; }
    .filter-actions { display: flex; align-items: center; gap: 0.75rem; padding-top: 0.25rem; }
    .btn-ghost { background: none; border: 1px solid #d1d5db; color: #6b7280; }
    .btn-ghost:hover { border-color: #9ca3af; color: #374151; }
    .filter-badge {
        font-size: 0.78rem;
        background: #fef3c7;
        color: #92400e;
        border: 1px solid #fde68a;
        border-radius: 999px;
        padding: 0.2rem 0.6rem;
    }
</style>