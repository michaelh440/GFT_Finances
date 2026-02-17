<!-- src/routes/hsi/students/+page.svelte -->
<script>
  /**
   * @typedef {Object} Student
   * @property {string} student_id
   * @property {string} first_name
   * @property {string} last_name
   * @property {string} email
   * @property {string} phone
   * @property {number} registration_count
   * @property {string} account_date
   * @property {string} last_class_date
   * @property {boolean} is_active
   */

  /** @type {{ students: Student[] }} */
  export let data;

  let searchQuery = '';
  /** @type {keyof Student} */
  let sortField = 'last_name';
  /** @type {'asc' | 'desc'} */
  let sortDirection = 'asc';
  let currentPage = 1;
  let pageSize = 25;

  /**
   * @param {keyof Student} field
   */
  function toggleSort(field) {
    if (sortField === field) {
      sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      sortField = field;
      sortDirection = 'asc';
    }
    currentPage = 1;
  }

  /**
   * @param {keyof Student} field
   * @returns {string}
   */
  function sortIndicator(field) {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  }

  $: filteredStudents = data.students.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (s.first_name && s.first_name.toLowerCase().includes(q)) ||
      (s.last_name && s.last_name.toLowerCase().includes(q)) ||
      (s.email && s.email.toLowerCase().includes(q)) ||
      (s.phone && s.phone.includes(q))
    );
  });

  $: sortedStudents = [...filteredStudents].sort((a, b) => {
    let aVal = /** @type {any} */ (a[sortField]);
    let bVal = /** @type {any} */ (b[sortField]);

    if (aVal == null) aVal = '';
    if (bVal == null) bVal = '';

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
    }

    aVal = String(aVal).toLowerCase();
    bVal = String(bVal).toLowerCase();

    if (sortDirection === 'asc') {
      return aVal.localeCompare(bVal);
    }
    return bVal.localeCompare(aVal);
  });

  $: totalPages = Math.ceil(sortedStudents.length / pageSize);
  $: pagedStudents = sortedStudents.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  $: {
    // Reset to page 1 when search changes
    searchQuery;
    currentPage = 1;
  }

  /**
   * @param {string | null | undefined} dateStr
   * @returns {string}
   */
  function formatDate(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
</script>

<svelte:head>
  <title>Students | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <h1>Students</h1>
    <div class="header-actions">
      <!--a href="/hsi" class="btn-secondary">Back to Classes</a-->
    </div>
  </header>

  <!-- Search and stats -->
  <div class="toolbar">
    <div class="search-group">
      <input
        type="text"
        placeholder="Search by name, email, or phone..."
        bind:value={searchQuery}
        class="search-input"
      />
    </div>
    <div class="stats">
      <span class="stat">{filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''}</span>
    </div>
  </div>

  <div class="table-wrapper">
    <table>
      <thead>
        <tr>
          <th class="sortable" on:click={() => toggleSort('last_name')}>
            Name{sortIndicator('last_name')}
          </th>
          <th class="sortable" on:click={() => toggleSort('email')}>
            Email{sortIndicator('email')}
          </th>
          <th>Phone</th>
          <th class="sortable col-center" on:click={() => toggleSort('registration_count')}>
            Classes{sortIndicator('registration_count')}
          </th>
          <th class="sortable" on:click={() => toggleSort('account_date')}>
            Account Date{sortIndicator('account_date')}
          </th>
          <th class="sortable" on:click={() => toggleSort('last_class_date')}>
            Last Class{sortIndicator('last_class_date')}
          </th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {#if pagedStudents.length === 0}
          <tr>
            <td colspan="8" class="empty-state">
              {searchQuery ? 'No students match your search.' : 'No students found.'}
            </td>
          </tr>
        {:else}
          {#each pagedStudents as student}
            <tr class:inactive={!student.is_active}>
              <td class="student-name">
                {student.first_name || ''} {student.last_name || ''}
              </td>
              <td class="student-email">{student.email || '—'}</td>
              <td>{student.phone || '—'}</td>
              <td class="col-center">
                <span class="count-badge">{student.registration_count}</span>
              </td>
              <td>{formatDate(student.account_date)}</td>
              <td>{formatDate(student.last_class_date)}</td>
              <td>
                <span class="status-badge" class:active={student.is_active}>
                  {student.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td>
                <div class="actions">
                  <a href="/hsi/students/{student.student_id}" class="btn-action">View</a>
                </div>
              </td>
            </tr>
          {/each}
        {/if}
      </tbody>
    </table>
  </div>

  <!-- Pagination -->
  {#if totalPages > 1}
    <div class="pagination">
      <button
        class="page-btn"
        disabled={currentPage === 1}
        on:click={() => currentPage = 1}
      >
        «
      </button>
      <button
        class="page-btn"
        disabled={currentPage === 1}
        on:click={() => currentPage--}
      >
        ‹
      </button>

      <span class="page-info">
        Page {currentPage} of {totalPages}
      </span>

      <button
        class="page-btn"
        disabled={currentPage === totalPages}
        on:click={() => currentPage++}
      >
        ›
      </button>
      <button
        class="page-btn"
        disabled={currentPage === totalPages}
        on:click={() => currentPage = totalPages}
      >
        »
      </button>

      <select bind:value={pageSize} on:change={() => currentPage = 1} class="page-size-select">
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

  th.col-center,
  td.col-center {
    text-align: center;
  }

  td {
    padding: 0.625rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    color: #1a202c;
    font-size: 0.9rem;
  }

  tr:hover {
    background-color: #f9fafb;
  }

  tr.inactive {
    opacity: 0.5;
  }

  .student-name {
    font-weight: 500;
  }

  .student-email {
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

  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
    background-color: #fee2e2;
    color: #991b1b;
  }

  .status-badge.active {
    background-color: #dcfce7;
    color: #166534;
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

  .btn-secondary {
    background-color: #e5e7eb;
    color: #374151;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    font-weight: 500;
    font-size: 1rem;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    transition: background-color 0.2s;
  }

  .btn-secondary:hover {
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

  @media (max-width: 768px) {
    header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .toolbar {
      flex-direction: column;
      align-items: stretch;
    }

    .search-group {
      max-width: 100%;
    }

    th, td {
      padding: 0.5rem 0.75rem;
    }
  }
</style>