<!-- src/routes/corp/companies/+page.svelte -->
<script>
  import { canDataEntry } from '$lib/permissions';

  /** @type {{ companies: any[], stats: any, pagination: any, years: number[], parents: any[], filters: any, user: any }} */
  export let data;

  $: user = data.user;

  $: companies  = data.companies  || [];
  $: stats      = data.stats      || {};
  $: pagination = data.pagination || { currentPage: 1, totalPages: 1, pageSize: 50, totalCount: 0 };

  // ── Filter state ──────────────────────────────────────────────────────
  let search          = '';
  /** @type {string[]} */
  let selectedYears   = [];
  let month           = '';
  let engType         = '';
  let pipelineStatus  = '';
  let contractStatus  = '';
  let hasRevenue      = '';
  let status          = 'active';
  let parentId        = '';

  // Sync from URL on data change
  $: {
    search         = data.filters?.search         || '';
    month          = data.filters?.month          || '';
    engType        = data.filters?.engType        || '';
    pipelineStatus = data.filters?.pipelineStatus || '';
    contractStatus = data.filters?.contractStatus || '';
    hasRevenue     = data.filters?.hasRevenue     || '';
    status         = data.filters?.status         || 'active';
    parentId       = data.filters?.parentId       || '';
    const urlYears  = (data.filters?.yearsParam || '').split(',').filter(Boolean);
    selectedYears  = urlYears;
  }

  $: availableYears = (data.years || []).sort((/** @type {number} */ a, /** @type {number} */ b) => b - a);

  $: hasFilters = search || selectedYears.length > 0 || month || engType ||
                  pipelineStatus || contractStatus || hasRevenue ||
                  status !== 'active' || parentId;

  /** @param {any} y */
  function toggleYear(y) {
    const str = y.toString();
    if (selectedYears.includes(str)) {
      selectedYears = selectedYears.filter(v => v !== str);
    } else {
      selectedYears = [...selectedYears, str];
    }
  }

  function buildParams(/** @type {number} */ page = 1) {
    const p = new URLSearchParams();
    if (search)               p.set('search',          search);
    if (selectedYears.length) p.set('years',           selectedYears.join(','));
    if (month)                p.set('month',           month);
    if (engType)              p.set('eng_type',        engType);
    if (pipelineStatus)       p.set('pipeline_status', pipelineStatus);
    if (contractStatus)       p.set('contract_status', contractStatus);
    if (hasRevenue)           p.set('has_revenue',     hasRevenue);
    if (status && status !== 'active') p.set('status', status);
    if (parentId)             p.set('parent_id',       parentId);
    if (page > 1)             p.set('page',            page.toString());
    return p.toString();
  }

  function applyFilters() {
    const qs = buildParams(1);
    window.location.href = `/corp/companies${qs ? '?' + qs : ''}`;
  }

  function clearFilters() {
    window.location.href = '/corp/companies';
  }

  function applySearch() { applyFilters(); }

  function clearSearch() {
    search = '';
    const qs = buildParams(1);
    window.location.href = `/corp/companies${qs ? '?' + qs : ''}`;
  }

  /** @param {number} page */
  function goToPage(page) {
    const qs = buildParams(page);
    window.location.href = `/corp/companies${qs ? '?' + qs : ''}`;
  }

  // ── Pagination helpers ────────────────────────────────────────────────
  /**
   * @param {number} current
   * @param {number} total
   * @returns {(number|string)[]}
   */
  function pageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    /** @type {(number|string)[]} */
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end   = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
  }

  $: visiblePages = pageNumbers(pagination.currentPage, pagination.totalPages);
  $: rangeStart   = (pagination.currentPage - 1) * pagination.pageSize + 1;
  $: rangeEnd     = Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount);

  // ── Formatters ────────────────────────────────────────────────────────
  const fmtCurrency = (/** @type {number|null} */ n) =>
    n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 });

  /** @param {string|null|undefined} d */
  function formatDate(d) {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US',
      { month: 'short', day: 'numeric', year: 'numeric' });
  }

  const MONTHS = [
    '', 'January','February','March','April','May','June',
    'July','August','September','October','November','December'
  ];

  // Populated from server-loaded workflow
  $: PIPELINE_STATUSES = (data.workflow?.pipeline_statuses ?? []);
  $: CONTRACT_STATUSES = (data.workflow?.contract_statuses ?? []);
  $: ENG_TYPES         = (data.workflow?.engagement_types  ?? []);
</script>

<svelte:head>
  <title>Corp Companies | B&C Financial Tracker</title>
</svelte:head>

<div class="container" data-sveltekit-reload>
  <header>
    <h1>Corp Companies</h1>
    <div class="header-actions">
      {#if canDataEntry(user, 'corp')}
        <a href="/corp/dedupe_companies" class="btn-secondary">Dedupe</a>
        <a href="/corp/companies/new"    class="btn-primary">+ New Company</a>
      {/if}
    </div>
  </header>

  <!-- ── Filters ────────────────────────────────────────────────────── -->
  <div class="filter-section">
    <div class="filter-row">

      <div class="filter-group">
        <label for="statusSelect">Status</label>
        <select id="statusSelect" bind:value={status} class="filter-select">
          <option value="active">Active</option>
          <option value="merged">Merged</option>
          <option value="deactivated">Deactivated</option>
          <option value="all">All</option>
        </select>
      </div>

      <div class="filter-group">
        <label for="engTypeSelect">Engagement Type</label>
        <select id="engTypeSelect" bind:value={engType} class="filter-select">
          <option value="">All Types</option>
          {#each ENG_TYPES as t (t.value)}
            <option value={t.value}>{t.label}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="monthSelect">Month</label>
        <select id="monthSelect" bind:value={month} class="filter-select">
          <option value="">All Months</option>
          {#each MONTHS.slice(1) as m, i (i)}
            <option value={String(i + 1)}>{m}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="parentSelect">Parent Company</label>
        <select id="parentSelect" bind:value={parentId} class="filter-select">
          <option value="">All Companies</option>
          {#each data.parents || [] as p (p.corp_company_id)}
            <option value={String(p.corp_company_id)}>{p.company_name}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="pipelineSelect">Pipeline Status</label>
        <select id="pipelineSelect" bind:value={pipelineStatus} class="filter-select">
          <option value="">All Pipelines</option>
          {#each PIPELINE_STATUSES as s (s.value)}
            <option value={s.value}>{s.label}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="contractSelect">Contract Status</label>
        <select id="contractSelect" bind:value={contractStatus} class="filter-select">
          <option value="">All Contracts</option>
          {#each CONTRACT_STATUSES as s (s.value)}
            <option value={s.value}>{s.label}</option>
          {/each}
        </select>
      </div>

      <div class="filter-group">
        <label for="revenueSelect">Revenue</label>
        <select id="revenueSelect" bind:value={hasRevenue} class="filter-select">
          <option value="">Any</option>
          <option value="yes">Has Revenue</option>
          <option value="no">No Revenue</option>
        </select>
      </div>

    </div>
  </div>

  <!-- ── Year checkboxes ────────────────────────────────────────────── -->
  {#if availableYears.length > 0}
    <div class="filter-section">
      <div class="filter-row">
        <div class="filter-group">
          <span class="filter-heading">Years to Include</span>
          <div class="year-checkboxes">
            {#each availableYears as y (y)}
              <label class="checkbox-label">
                <input type="checkbox"
                  checked={selectedYears.includes(y.toString())}
                  on:change={() => toggleYear(y)} />
                <span>{y}</span>
              </label>
            {/each}
          </div>
        </div>
        <div class="filter-actions">
          <button class="btn-apply" on:click={applyFilters}>Apply Filters</button>
          {#if hasFilters}
            <button class="btn-clear-all" on:click={clearFilters}>Clear All</button>
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div class="filter-section">
      <div class="filter-row">
        <div class="filter-actions">
          <button class="btn-apply" on:click={applyFilters}>Apply Filters</button>
          {#if hasFilters}
            <button class="btn-clear-all" on:click={clearFilters}>Clear All</button>
          {/if}
        </div>
      </div>
    </div>
  {/if}

  <!-- ── Stats strip ─────────────────────────────────────────────────── -->
  <div class="stats-row">
    <div class="stat-card">
      <span class="stat-value">{stats.company_count?.toLocaleString() ?? 0}</span>
      <span class="stat-label">Companies</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{stats.contact_count?.toLocaleString() ?? 0}</span>
      <span class="stat-label">Contacts</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{stats.engagement_count?.toLocaleString() ?? 0}</span>
      <span class="stat-label">Engagements</span>
    </div>
    <div class="stat-card">
      <span class="stat-value">{fmtCurrency(stats.total_revenue)}</span>
      <span class="stat-label">Total Revenue</span>
    </div>
  </div>

  <!-- ── Search ──────────────────────────────────────────────────────── -->
  <div class="toolbar">
    <div class="search-row">
      <input
        type="text"
        placeholder="Search by company name…"
        bind:value={search}
        class="search-input"
        on:keydown={(e) => e.key === 'Enter' && applySearch()}
      />
      {#if search}
        <button class="btn-search" on:click={applySearch}>Search</button>
        <button class="btn-clear-search" on:click={clearSearch}>✕</button>
      {/if}
    </div>
    <span class="result-count">
      {pagination.totalCount} compan{pagination.totalCount !== 1 ? 'ies' : 'y'}
    </span>
  </div>

  <!-- ── Table ───────────────────────────────────────────────────────── -->
  <div class="table-wrapper">
    {#if companies.length === 0}
      <p class="empty-state">
        {hasFilters ? 'No companies match the selected filters.' : 'No companies found.'}
      </p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Industry</th>
            <th>Parent</th>
            <th>Status</th>
            <th class="col-center">Active</th>
            <th class="col-center">Former</th>
            <th class="col-center">Engagements</th>
            <th class="col-right">Revenue</th>
            <th>Last Engagement</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each companies as co (co.corp_company_id)}
            <tr class:merged={co.status === 'merged'} class:deactivated={co.status === 'deactivated'}>
              <td class="company-name-cell">
                <a href="/corp/companies/{co.corp_company_id}" class="row-link">
                  {co.company_name}
                </a>
              </td>
              <td class="industry-cell">{co.industry || '—'}</td>
              <td class="parent-cell">
                {#if co.parent_company_id}
                  <a href="/corp/companies/{co.parent_company_id}" class="parent-link">
                    {co.parent_company_name}
                  </a>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td>
                {#if co.status === 'merged'}
                  <span class="status-badge merged">Merged</span>
                {:else if co.status === 'deactivated'}
                  <span class="status-badge deactivated">Deactivated</span>
                {:else}
                  <span class="status-badge active">Active</span>
                {/if}
              </td>
              <td class="col-center">
                {#if co.active_contacts > 0}
                  <span class="count-badge green">{co.active_contacts}</span>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td class="col-center">
                {#if co.prev_contacts > 0}
                  <span class="count-badge gray">{co.prev_contacts}</span>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td class="col-center">
                {#if co.engagement_count > 0}
                  <span class="count-badge indigo">{co.engagement_count}</span>
                {:else}
                  <span class="muted">—</span>
                {/if}
              </td>
              <td class="col-right revenue-cell">{fmtCurrency(co.total_revenue)}</td>
              <td class="date-cell">{formatDate(co.last_engagement_date)}</td>
              <td>
                <a href="/corp/companies/{co.corp_company_id}" class="btn-action">View</a>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  <!-- ── Pagination ──────────────────────────────────────────────────── -->
  {#if pagination.totalPages > 1}
    <div class="pagination">
      <span class="page-info">
        Showing {rangeStart.toLocaleString()}–{rangeEnd.toLocaleString()}
        of {pagination.totalCount.toLocaleString()}
      </span>
      <div class="page-controls">
        <button class="page-btn" disabled={pagination.currentPage <= 1}
          on:click={() => goToPage(pagination.currentPage - 1)}>← Prev</button>
        {#each visiblePages as pg (typeof pg === 'number' ? pg : `e-${pg}-${Math.random()}`)}
          {#if typeof pg === 'number'}
            <button class="page-btn page-num"
              class:active={pg === pagination.currentPage}
              on:click={() => goToPage(pg)}>{pg}</button>
          {:else}
            <span class="page-ellipsis">…</span>
          {/if}
        {/each}
        <button class="page-btn" disabled={pagination.currentPage >= pagination.totalPages}
          on:click={() => goToPage(pagination.currentPage + 1)}>Next →</button>
      </div>
    </div>
  {/if}
</div>

<style>
  .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }

  header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
  .header-actions { display: flex; gap: 0.75rem; }

  /* ── Filters ─────────────────────────────────────────────────────── */
  .filter-section { background: white; padding: 1.25rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1rem; }
  .filter-row { display: flex; gap: 2rem; align-items: flex-end; flex-wrap: wrap; }
  .filter-group { display: flex; flex-direction: column; gap: 0.35rem; }
  .filter-group label, .filter-heading { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
  .filter-select { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; color: #1a202c; background: white; min-width: 160px; }
  .filter-select:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.1); }

  .year-checkboxes { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .checkbox-label { display: flex; align-items: center; gap: 0.3rem; font-size: 0.85rem; color: #374151; cursor: pointer; white-space: nowrap; }
  .checkbox-label input[type="checkbox"] { accent-color: #6366f1; cursor: pointer; }

  .filter-actions { display: flex; gap: 0.75rem; align-items: center; margin-left: auto; }
  .btn-apply { padding: 0.5rem 1.5rem; background: #6366f1; color: white; border: none; border-radius: 0.375rem; font-size: 0.9rem; font-weight: 600; cursor: pointer; }
  .btn-apply:hover { background: #4f46e5; }
  .btn-clear-all { background: none; border: none; color: #6366f1; font-size: 0.85rem; cursor: pointer; font-weight: 500; }
  .btn-clear-all:hover { text-decoration: underline; }

  /* ── Stats ───────────────────────────────────────────────────────── */
  .stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card { background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.2rem; }
  .stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
  .stat-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }

  /* ── Toolbar ─────────────────────────────────────────────────────── */
  .toolbar { display: flex; align-items: center; gap: 1rem; margin-bottom: 1rem; }
  .search-row { display: flex; align-items: center; gap: 0.35rem; }
  .search-input { padding: 0.6rem 1rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; width: 300px; }
  .search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
  .btn-search { padding: 0.6rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; font-size: 0.85rem; font-weight: 500; cursor: pointer; }
  .btn-search:hover { background: #2563eb; }
  .btn-clear-search { padding: 0.6rem 0.75rem; background: #f3f4f6; color: #6b7280; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; cursor: pointer; }
  .btn-clear-search:hover { background: #e5e7eb; }
  .result-count { font-size: 0.85rem; color: #6b7280; }

  /* ── Table ───────────────────────────────────────────────────────── */
  .table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); overflow-x: auto; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; }
  thead { background-color: #f9fafb; }
  th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
  td { padding: 0.625rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; font-size: 0.875rem; }
  tr:hover td { background-color: #f9fafb; }
  tr.merged td, tr.deactivated td { opacity: 0.6; }

  th.col-center, td.col-center { text-align: center; }
  th.col-right,  td.col-right  { text-align: right; }

  .company-name-cell { font-weight: 500; }
  .row-link { color: #3b82f6; text-decoration: none; }
  .row-link:hover { text-decoration: underline; }
  .industry-cell { color: #6b7280; font-size: 0.82rem; }
  .parent-cell { font-size: 0.82rem; }
  .parent-link { color: #f59e0b; text-decoration: none; font-weight: 500; }
  .parent-link:hover { text-decoration: underline; }
  .date-cell { white-space: nowrap; color: #6b7280; font-size: 0.82rem; }
  .revenue-cell { font-weight: 500; color: #166534; }
  .muted { color: #d1d5db; }

  .status-badge { padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  .status-badge.active      { background: #dcfce7; color: #166534; }
  .status-badge.merged      { background: #fef3c7; color: #92400e; }
  .status-badge.deactivated { background: #fee2e2; color: #991b1b; }

  .count-badge { display: inline-block; min-width: 1.5rem; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; text-align: center; }
  .count-badge.green  { background: #dcfce7; color: #166534; }
  .count-badge.gray   { background: #f1f5f9; color: #64748b; }
  .count-badge.indigo { background: #e0e7ff; color: #4338ca; }

  .btn-action { background: #e5e7eb; color: #374151; padding: 0.375rem 0.75rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 500; text-decoration: none; }
  .btn-action:hover { background: #d1d5db; }

  .empty-state { text-align: center; padding: 3rem; color: #6b7280; }

  /* ── Pagination ──────────────────────────────────────────────────── */
  .pagination { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; }
  .page-info { font-size: 0.85rem; color: #6b7280; }
  .page-controls { display: flex; align-items: center; gap: 0.25rem; }
  .page-btn { padding: 0.4rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: white; color: #374151; font-size: 0.85rem; cursor: pointer; }
  .page-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #9ca3af; }
  .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .page-num { min-width: 36px; text-align: center; }
  .page-num.active { background: #3b82f6; border-color: #3b82f6; color: white; font-weight: 600; }
  .page-ellipsis { padding: 0.4rem 0.35rem; color: #9ca3af; font-size: 0.85rem; }

  /* ── Buttons ─────────────────────────────────────────────────────── */
  .btn-primary { background: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; text-decoration: none; }
  .btn-primary:hover { background: #2563eb; }
  .btn-secondary { background: #e5e7eb; color: #374151; padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; text-decoration: none; }
  .btn-secondary:hover { background: #d1d5db; }

  @media (max-width: 768px) {
    header { flex-direction: column; gap: 1rem; align-items: flex-start; }
    .filter-row { flex-direction: column; gap: 1rem; }
    .filter-select { min-width: 100%; }
    .toolbar { flex-direction: column; align-items: flex-start; }
    .search-input { width: 100%; }
    .pagination { flex-direction: column; align-items: flex-start; }
  }
</style>