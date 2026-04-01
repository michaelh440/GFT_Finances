<!-- src/routes/corp/engagements/+page.svelte -->
<script>
  /**
   * @typedef {Object} Engagement
   * @property {number} corp_engagement_id
   * @property {string} title
   * @property {string} engagement_type
   * @property {string} pipeline_status
   * @property {string} contract_status
   * @property {string|null} engagement_date
   * @property {number|null} audience_size_min
   * @property {number|null} audience_size_max
   * @property {number|null} amount_paid
   * @property {boolean} is_archived
   * @property {string} company_name
   * @property {number} corp_contact_id
   * @property {number|null} corp_company_id
   */

  import { goto } from '$app/navigation';
  import { canDataEntry } from '$lib/permissions';
  export let data;

  $: user = data.user;

  $: TYPES     = [['', 'All Types'],     ...(data.workflow?.engagement_types  ?? []).map(r => [r.value, r.label])];
  $: PIPELINES = [['', 'All Pipeline'], ...(data.workflow?.pipeline_statuses ?? []).map(r => [r.value, r.label])];
  $: CONTRACTS = [['', 'All Contracts'],...(data.workflow?.contract_statuses ?? []).map(r => [r.value, r.label])];

  let { filters } = data;
  let fType     = filters.type     ?? '';
  let fPipeline = filters.pipeline ?? '';
  let fContract = filters.contract ?? '';
  let fArchived = filters.archived ?? true;  // default true — all imported records are archived
  let fRevenue  = filters.hasRevenue ?? '';

  let searchQuery = '';
  /** @type {keyof Engagement} */
  let sortField = 'engagement_date';
  /** @type {'asc' | 'desc'} */
  let sortDirection = 'desc';
  let currentPage = 1;
  let pageSize = 25;

  function applyFilters() {
    const p = new URLSearchParams();
    if (fType)      p.set('type',     fType);
    if (fPipeline)  p.set('pipeline', fPipeline);
    if (fContract)  p.set('contract', fContract);
    if (!fArchived) p.set('archived', '0');  // only add param when hiding archived
    if (fRevenue)   p.set('has_revenue', fRevenue);
    goto(`/corp/engagements?${p.toString()}`, { invalidateAll: true });
  }

  /** @param {keyof Engagement} field */
  function toggleSort(field) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = field === 'engagement_date' ? 'desc' : 'asc';
    }
    currentPage = 1;
  }

  /** @param {keyof Engagement} field */
  function sortIndicator(field) {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  }

  $: filteredEngagements = data.engagements.filter(e => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (e.title        && e.title.toLowerCase().includes(q))        ||
      (e.company_name && e.company_name.toLowerCase().includes(q)) ||
      (e.engagement_type && e.engagement_type.toLowerCase().includes(q))
    );
  });

  $: sortedEngagements = [...filteredEngagements].sort((a, b) => {
    let aVal = /** @type {any} */ (a[sortField]);
    let bVal = /** @type {any} */ (b[sortField]);
    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';
    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }
    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();
    return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  $: totalPages       = Math.ceil(sortedEngagements.length / pageSize);
  $: pagedEngagements = sortedEngagements.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  $: { searchQuery; currentPage = 1; }

  $: totalRevenue = filteredEngagements.reduce((s, e) => s + (e.amount_paid ?? 0), 0);

  /** @param {string|null|undefined} dateStr */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  /** @param {number|null} n */
  function formatRevenue(n) {
    if (n == null) return '—';
    return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 });
  }

  /** @param {Engagement} e */
  function audienceStr(e) {
    if (e.audience_size_min == null) return '—';
    if (e.audience_size_min === e.audience_size_max) return String(e.audience_size_min);
    return `${e.audience_size_min}–${e.audience_size_max}`;
  }

  /** @param {string|null} s */
  function labelify(s) {
    if (!s || s === 'none') return '—';
    return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
</script>

<svelte:head>
  <title>Corp Engagements | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <h1>Corp Engagements</h1>
    <div class="header-actions">
      {#if canDataEntry(user, 'corp')}
        <a href="/corp/import_engagements" class="btn-secondary">Import CSV</a>
        <a href="/corp/engagements/new" class="btn-primary">+ New Engagement</a>
      {/if}
    </div>
  </header>

  <div class="toolbar">
    <div class="filter-group">
      <select bind:value={fType}     on:change={applyFilters} class="filter-select">
        {#each TYPES     as [v, l]}<option value={v}>{l}</option>{/each}
      </select>
      <select bind:value={fPipeline} on:change={applyFilters} class="filter-select">
        {#each PIPELINES as [v, l]}<option value={v}>{l}</option>{/each}
      </select>
      <select bind:value={fContract} on:change={applyFilters} class="filter-select">
        {#each CONTRACTS as [v, l]}<option value={v}>{l}</option>{/each}
      </select>
      <select bind:value={fRevenue} on:change={applyFilters} class="filter-select">
        <option value="">Any Revenue</option>
        <option value="yes">Has Revenue</option>
        <option value="no">No Revenue</option>
      </select>
      <label class="archived-toggle">
        <input type="checkbox" bind:checked={fArchived} on:change={applyFilters} />
        Include archived
      </label>
    </div>
    <div class="stats">
      <span class="stat">{filteredEngagements.length} result{filteredEngagements.length !== 1 ? 's' : ''}</span>
      <span class="stat-divider">·</span>
      <span class="stat revenue-stat">{totalRevenue > 0 ? formatRevenue(totalRevenue) : '—'} revenue</span>
    </div>
  </div>

  <div class="search-row">
    <input
      type="text"
      placeholder="Search by title, company, or type…"
      bind:value={searchQuery}
      class="search-input"
    />
  </div>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th class="sortable" on:click={() => toggleSort('engagement_date')}>Date{sortIndicator('engagement_date')}</th>
          <th class="sortable" on:click={() => toggleSort('title')}>Title{sortIndicator('title')}</th>
          <th class="sortable" on:click={() => toggleSort('company_name')}>Company{sortIndicator('company_name')}</th>
          <th class="sortable" on:click={() => toggleSort('engagement_type')}>Type{sortIndicator('engagement_type')}</th>
          <th class="sortable" on:click={() => toggleSort('pipeline_status')}>Pipeline{sortIndicator('pipeline_status')}</th>
          <th class="sortable" on:click={() => toggleSort('contract_status')}>Contract{sortIndicator('contract_status')}</th>
          <th class="col-center">Audience</th>
          <th class="sortable col-right" on:click={() => toggleSort('amount_paid')}>Revenue{sortIndicator('amount_paid')}</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#if pagedEngagements.length === 0}
          <tr>
            <td colspan="9" class="empty-state">
              {searchQuery ? 'No engagements match your search.' : 'No engagements found.'}
            </td>
          </tr>
        {:else}
          {#each pagedEngagements as e (e.corp_engagement_id)}
            <tr class:archived={e.is_archived}>
              <td class="date-cell">{formatDate(e.engagement_date)}</td>
              <td class="title-cell">
                <a href="/corp/engagements/{e.corp_engagement_id}" class="row-link">
                  {e.title || '(untitled)'}
                </a>
              </td>
              <td>
                {#if e.corp_company_id}
                  <a href="/corp/companies/{e.corp_company_id}" class="company-link">{e.company_name || '—'}</a>
                {:else if e.corp_contact_id}
                  <a href="/corp/contacts/{e.corp_contact_id}" class="company-link">{e.company_name || '—'}</a>
                {:else}
                  {e.company_name || '—'}
                {/if}
              </td>
              <td>
                <span class="type-badge type-{e.engagement_type}">{labelify(e.engagement_type)}</span>
              </td>
              <td>{labelify(e.pipeline_status)}</td>
              <td>{labelify(e.contract_status)}</td>
              <td class="col-center">{audienceStr(e)}</td>
              <td class="col-right">{formatRevenue(e.amount_paid)}</td>
              <td>
                <div class="actions">
                  <a href="/corp/engagements/{e.corp_engagement_id}" class="btn-action">View</a>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  {#if totalPages > 1}
    <div class="pagination">
      <button class="page-btn" disabled={currentPage === 1} on:click={() => (currentPage = 1)}>«</button>
      <button class="page-btn" disabled={currentPage === 1} on:click={() => currentPage--}>‹</button>
      <span class="page-info">Page {currentPage} of {totalPages}</span>
      <button class="page-btn" disabled={currentPage === totalPages} on:click={() => currentPage++}>›</button>
      <button class="page-btn" disabled={currentPage === totalPages} on:click={() => (currentPage = totalPages)}>»</button>
      <select bind:value={pageSize} on:change={() => (currentPage = 1)} class="page-size-select">
        <option value={25}>25 per page</option>
        <option value={50}>50 per page</option>
        <option value={100}>100 per page</option>
      </select>
    </div>
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
    align-items: center;
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1a202c;
  }

  .header-actions {
    display: flex;
    gap: 1rem;
  }

  .toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .filter-select {
    padding: 0.5rem 0.6rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    background-color: white;
  }

  .archived-toggle {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.875rem;
    color: #374151;
    cursor: pointer;
  }

  .stats {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #6b7280;
    font-size: 0.9rem;
    white-space: nowrap;
  }

  .stat { font-weight: 500; }
  .stat-divider { color: #d1d5db; }
  .revenue-stat { color: #166534; }

  .search-row {
    margin-bottom: 1.5rem;
  }

  .search-input {
    padding: 0.625rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.95rem;
    background-color: white;
    width: 100%;
    max-width: 400px;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .table-wrapper {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    overflow-x: auto;
    margin-bottom: 1.5rem;
  }

  table { width: 100%; border-collapse: collapse; }
  thead { background-color: #f9fafb; }

  th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
    border-bottom: 2px solid #e5e7eb;
    white-space: nowrap;
  }

  th.sortable { cursor: pointer; user-select: none; }
  th.sortable:hover { color: #3b82f6; }
  th.col-center, td.col-center { text-align: center; }
  th.col-right,  td.col-right  { text-align: right; }

  td {
    padding: 0.625rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    color: #1a202c;
    font-size: 0.9rem;
  }

  tr:hover { background-color: #f9fafb; }
  tr.archived td { color: #9ca3af; }

  .date-cell { white-space: nowrap; color: #6b7280; font-size: 0.85rem; }
  .title-cell { font-weight: 500; max-width: 240px; }

  .row-link { color: #3b82f6; text-decoration: none; }
  .row-link:hover { text-decoration: underline; }
  .company-link { color: #374151; text-decoration: none; }
  .company-link:hover { color: #3b82f6; text-decoration: underline; }

  .type-badge {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    background-color: #f3f4f6;
    color: #374151;
    white-space: nowrap;
  }
  .type-badge.type-corporate_training { background-color: #dbeafe; color: #1e40af; }
  .type-badge.type-private_show_gft   { background-color: #fce7f3; color: #9d174d; }
  .type-badge.type-roadshow           { background-color: #d1fae5; color: #065f46; }
  .type-badge.type-space_rental       { background-color: #fef3c7; color: #92400e; }
  .type-badge.type-school_nonprofit   { background-color: #ede9fe; color: #5b21b6; }

  .actions { display: flex; gap: 0.5rem; }
  .btn-action {
    background-color: #e5e7eb;
    color: #374151;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.8rem;
    font-weight: 500;
    text-decoration: none;
    transition: background-color 0.2s;
  }
  .btn-action:hover { background-color: #d1d5db; }

  .empty-state { text-align: center; padding: 2rem; color: #6b7280; }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .page-btn {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background-color: white;
    color: #374151;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }
  .page-btn:hover:not(:disabled) { background-color: #f3f4f6; border-color: #3b82f6; }
  .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  .page-info { padding: 0.5rem 1rem; color: #374151; font-weight: 500; font-size: 0.9rem; }

  .page-size-select {
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.85rem;
    background-color: white;
    margin-left: 1rem;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: background-color 0.2s;
  }
  .btn-primary:hover { background-color: #2563eb; }

  .btn-secondary {
    background-color: #e5e7eb;
    color: #374151;
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    transition: background-color 0.2s;
  }
  .btn-secondary:hover { background-color: #d1d5db; }

  @media (max-width: 768px) {
    .container { padding: 1rem; }
    header { flex-direction: column; gap: 1rem; align-items: flex-start; }
    .toolbar { flex-direction: column; align-items: stretch; }
    .filter-group { flex-direction: column; align-items: stretch; }
    th, td { padding: 0.5rem 0.75rem; }
  }
</style>