<!-- src/routes/shows/+page.svelte -->
<script>
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

  /** @type {{ shows: ShowItem[] }} */
  export let data;

  $: shows = data.shows;

  // Group shows by format
  /** @type {Record<string, ShowItem[]>} */
  $: showsByFormat = shows.reduce((/** @type {Record<string, ShowItem[]>} */ acc, show) => {
    const format = show.format || 'Uncategorized';
    if (!acc[format]) {
      acc[format] = [];
    }
    acc[format].push(show);
    return acc;
  }, {});

  $: formats = Object.keys(showsByFormat).sort();

  /**
   * @param {number} amount
   * @returns {string}
   */
  function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  }
</script>

<svelte:head>
  <title>Live Shows | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <h1>Live Shows</h1>
    <div class="header-actions">
      <a href="/shows/enter_monthly_summary" class="btn-primary">
        Enter Monthly Summary
      </a>
      <a href="/shows/reports" class="btn-primary">
        View Reports
      </a>
    </div>
  </header>

  <div class="shows-content">
    {#if shows.length === 0}
      <p class="empty-state">No shows found. Add your first show to get started.</p>
    {:else}
      {#each formats as format}
        <div class="format-section">
          <h2 class="format-title">{format}</h2>

          <table>
            <thead>
              <tr>
                <th>Show Code</th>
                <th>Show Name</th>
                <th>Audience</th>
                <th>Day</th>
                <th>Ticket Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each showsByFormat[format] as show}
                <tr class:inactive={!show.is_active}>
                  <td class="show-code">{show.show_code}</td>
                  <td class="show-name">{show.show_name}</td>
                  <td>
                    {#if show.audience_type}
                      <span class="audience-badge">{show.audience_type}</span>
                    {:else}
                      <span class="empty-value">—</span>
                    {/if}
                  </td>
                  <td>{show.day_of_week || '—'}</td>
                  <td>
                    {#if show.standard_ticket_price > 0}
                      {formatCurrency(show.standard_ticket_price)}
                    {:else}
                      <span class="empty-value">—</span>
                    {/if}
                  </td>
                  <td>
                    <span class="status-badge" class:active={show.is_active}>
                      {show.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div class="actions">
                      <a href="/shows/show/{show.show_code}" class="btn-secondary">View</a>
                      <a href="/shows/show/{show.show_code}/edit" class="btn-secondary">Edit</a>
                    </div>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/each}
    {/if}
  </div>
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

  .format-section {
    margin-bottom: 2rem;
  }

  .format-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 0.75rem 0;
    padding-bottom: 0.5rem;
    border-bottom: 2px solid #e5e7eb;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border-radius: 0.5rem;
    overflow: hidden;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    margin-bottom: 1rem;
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
  }

  td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    color: #1a202c;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover {
    background-color: #f9fafb;
  }

  tr.inactive {
    opacity: 0.5;
  }

  .show-code {
    font-family: monospace;
    font-weight: 600;
    color: #6366f1;
    font-size: 0.9rem;
  }

  .show-name {
    font-weight: 500;
  }

  .audience-badge {
    display: inline-block;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 500;
    background-color: #fef3c7;
    color: #92400e;
  }

  .empty-value {
    color: #9ca3af;
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

  .btn-primary {
    background-color: #3b82f6;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    text-decoration: none;
    font-weight: 500;
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
    border: none;
    font-weight: 500;
    font-size: 0.875rem;
    cursor: pointer;
    text-decoration: none;
    transition: background-color 0.2s;
  }

  .btn-secondary:hover {
    background-color: #d1d5db;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
    font-size: 1.125rem;
  }

  @media (max-width: 768px) {
    header {
      flex-direction: column;
      gap: 1rem;
      align-items: flex-start;
    }

    .header-actions {
      flex-wrap: wrap;
    }

    table {
      font-size: 0.875rem;
    }

    th, td {
      padding: 0.5rem 0.75rem;
    }
  }
</style>