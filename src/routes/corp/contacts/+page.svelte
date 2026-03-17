<!-- src/routes/corp/contacts/+page.svelte -->
<script>
  /**
   * @typedef {Object} Contact
   * @property {number} corp_contact_id
   * @property {string} company_name
   * @property {string} first_name
   * @property {string} last_name
   * @property {string} email
   * @property {string} phone
   * @property {string} city
   * @property {string} state
   * @property {number} engagement_count
   * @property {number|null} total_revenue
   * @property {string|null} last_engagement_date
   */

  /** @type {{ contacts: Contact[] }} */
  export let data;

  let searchQuery = '';
  /** @type {keyof Contact} */
  let sortField = 'company_name';
  /** @type {'asc' | 'desc'} */
  let sortDirection = 'asc';
  let currentPage = 1;
  let pageSize = 25;

  /** @param {keyof Contact} field */
  function toggleSort(field) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
    currentPage = 1;
  }

  /** @param {keyof Contact} field */
  function sortIndicator(field) {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  }

  $: filteredContacts = data.contacts.filter(c => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (c.company_name && c.company_name.toLowerCase().includes(q)) ||
      (c.first_name   && c.first_name.toLowerCase().includes(q))   ||
      (c.last_name    && c.last_name.toLowerCase().includes(q))    ||
      (c.email        && c.email.toLowerCase().includes(q))        ||
      (c.phone        && c.phone.includes(q))
    );
  });

  $: sortedContacts = [...filteredContacts].sort((a, b) => {
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

  $: totalPages    = Math.ceil(sortedContacts.length / pageSize);
  $: pagedContacts = sortedContacts.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  $: { searchQuery; currentPage = 1; }

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
</script>

<svelte:head>
  <title>Corp Contacts | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <h1>Corp Contacts</h1>
    <div class="header-actions">
      <a href="/corp/import_contacts" class="btn-secondary">Import CSV</a>
      <a href="/corp/contacts/new" class="btn-primary">+ New Contact</a>
    </div>
  </header>

  <div class="toolbar">
    <div class="search-group">
      <input
        type="text"
        placeholder="Search by company, name, email, or phone…"
        bind:value={searchQuery}
        class="search-input"
      />
    </div>
    <div class="stats">
      <span class="stat">{filteredContacts.length} contact{filteredContacts.length !== 1 ? 's' : ''}</span>
    </div>
  </div>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th class="sortable" on:click={() => toggleSort('company_name')}>Company{sortIndicator('company_name')}</th>
          <th class="sortable" on:click={() => toggleSort('last_name')}>Contact{sortIndicator('last_name')}</th>
          <th class="sortable" on:click={() => toggleSort('email')}>Email{sortIndicator('email')}</th>
          <th>Phone</th>
          <th>Location</th>
          <th class="sortable col-center" on:click={() => toggleSort('engagement_count')}>Engagements{sortIndicator('engagement_count')}</th>
          <th class="sortable col-right" on:click={() => toggleSort('total_revenue')}>Revenue{sortIndicator('total_revenue')}</th>
          <th class="sortable" on:click={() => toggleSort('last_engagement_date')}>Last Engagement{sortIndicator('last_engagement_date')}</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#if pagedContacts.length === 0}
          <tr>
            <td colspan="9" class="empty-state">
              {searchQuery ? 'No contacts match your search.' : 'No contacts found.'}
            </td>
          </tr>
        {:else}
          {#each pagedContacts as c (c.corp_contact_id)}
            <tr>
              <td class="company-name">
                <a href="/corp/contacts/{c.corp_contact_id}" class="row-link">
                  {c.company_name || '—'}
                </a>
              </td>
              <td>{[c.first_name, c.last_name].filter(Boolean).join(' ') || '—'}</td>
              <td class="email-cell">{c.email || '—'}</td>
              <td>{c.phone || '—'}</td>
              <td>{[c.city, c.state].filter(Boolean).join(', ') || '—'}</td>
              <td class="col-center">
                <span class="count-badge">{c.engagement_count}</span>
              </td>
              <td class="col-right">{formatRevenue(c.total_revenue)}</td>
              <td>{formatDate(c.last_engagement_date)}</td>
              <td>
                <div class="actions">
                  <a href="/corp/contacts/{c.corp_contact_id}" class="btn-action">View</a>
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
    margin-bottom: 1.5rem;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .search-group {
    flex: 1;
    max-width: 400px;
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.95rem;
    background-color: white;
  }

  .search-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .stats {
    color: #6b7280;
    font-size: 0.9rem;
  }

  .stat {
    font-weight: 500;
  }

  .table-wrapper {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    overflow-x: auto;
    margin-bottom: 1.5rem;
  }

  table {
    width: 100%;
    border-collapse: collapse;
  }

  thead {
    background-color: #f9fafb;
  }

  th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
    border-bottom: 2px solid #e5e7eb;
    white-space: nowrap;
  }

  th.sortable {
    cursor: pointer;
    user-select: none;
  }

  th.sortable:hover {
    color: #3b82f6;
  }

  th.col-center, td.col-center { text-align: center; }
  th.col-right,  td.col-right  { text-align: right; }

  td {
    padding: 0.625rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    color: #1a202c;
    font-size: 0.9rem;
  }

  tr:hover {
    background-color: #f9fafb;
  }

  .company-name {
    font-weight: 500;
  }

  .row-link {
    color: #3b82f6;
    text-decoration: none;
  }

  .row-link:hover {
    text-decoration: underline;
  }

  .email-cell {
    color: #6b7280;
    font-size: 0.85rem;
  }

  .count-badge {
    display: inline-block;
    min-width: 1.5rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.8rem;
    font-weight: 600;
    text-align: center;
    background-color: #e0e7ff;
    color: #4338ca;
  }

  .actions {
    display: flex;
    gap: 0.5rem;
  }

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

  .btn-action:hover {
    background-color: #d1d5db;
  }

  .empty-state {
    text-align: center;
    padding: 2rem;
    color: #6b7280;
  }

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

  .page-btn:hover:not(:disabled) {
    background-color: #f3f4f6;
    border-color: #3b82f6;
  }

  .page-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .page-info {
    padding: 0.5rem 1rem;
    color: #374151;
    font-weight: 500;
    font-size: 0.9rem;
  }

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

  .btn-primary:hover {
    background-color: #2563eb;
  }

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

  .btn-secondary:hover {
    background-color: #d1d5db;
  }

  @media (max-width: 768px) {
    .container { padding: 1rem; }
    header { flex-direction: column; gap: 1rem; align-items: flex-start; }
    .toolbar { flex-direction: column; align-items: stretch; }
    .search-group { max-width: 100%; }
    th, td { padding: 0.5rem 0.75rem; }
  }
</style>