<!-- src/routes/shows/enter_monthly_summary/+page.svelte -->
<script>
  import { enhance } from '$app/forms';

  /**
   * @typedef {Object} ShowItem
   * @property {string} show_code
   * @property {string} show_name
   * @property {string} format
   */

  /**
   * @typedef {Object} Row
   * @property {string} id
   * @property {string} month
   * @property {string} show_code
   * @property {number} tickets_sold
   * @property {number} revenue
   */

  /** @type {{ shows: ShowItem[] }} */
  export let data;
  /** @type {{ success?: boolean, message?: string, error?: string } | null} */
  export let form;

  /** @type {Row[]} */
  let rows = [createRow()];

  /** @returns {Row} */
  function createRow() {
    return {
      id: crypto.randomUUID(),
      month: new Date().toISOString().slice(0, 7),
      show_code: '',
      tickets_sold: 0,
      revenue: 0
    };
  }

  function addRow() {
    const lastMonth = rows[rows.length - 1]?.month || new Date().toISOString().slice(0, 7);
    const newRow = createRow();
    newRow.month = lastMonth;
    rows = [...rows, newRow];
  }

  /**
   * @param {string} id
   */
  function removeRow(id) {
    if (rows.length <= 1) return;
    rows = rows.filter(r => r.id !== id);
  }

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

  // Group shows by format for the dropdown
  /** @type {Record<string, ShowItem[]>} */
  $: showsByFormat = data.shows.reduce((/** @type {Record<string, ShowItem[]>} */ acc, s) => {
    const format = s.format || 'Other';
    if (!acc[format]) acc[format] = [];
    acc[format].push(s);
    return acc;
  }, {});

  $: formats = Object.keys(showsByFormat).sort();

  // Totals
  $: totalTickets = rows.reduce((sum, r) => sum + (Number(r.tickets_sold) || 0), 0);
  $: totalRevenue = rows.reduce((sum, r) => sum + (Number(r.revenue) || 0), 0);
</script>

<svelte:head>
  <title>Enter Show Summary | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <div>
      <h1>Enter Monthly Show Summary</h1>
      <p class="subtitle">Add ticket sales and revenue data by show and month</p>
    </div>
    <a href="/shows" class="btn-secondary">Back to Shows</a>
  </header>

  {#if form?.success}
    <div class="alert alert-success">
      ✓ {form.message}
    </div>
  {/if}

  {#if form?.error}
    <div class="alert alert-error">
      ✗ {form.error}
    </div>
  {/if}

  <form method="POST" use:enhance>
    <input type="hidden" name="row_count" value={rows.length} />

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th class="col-month">Month</th>
            <th class="col-show">Show</th>
            <th class="col-number">Tickets Sold</th>
            <th class="col-number">Revenue ($)</th>
            <th class="col-actions"></th>
          </tr>
        </thead>
        <tbody>
          {#each rows as row, i (row.id)}
            <tr>
              <td>
                <input
                  type="month"
                  name="month_{i}"
                  bind:value={row.month}
                  class="input-month"
                />
              </td>
              <td>
                <select name="show_code_{i}" bind:value={row.show_code} class="input-show">
                  <option value="">Select a show...</option>
                  {#each formats as format}
                    <optgroup label={format}>
                      {#each showsByFormat[format] as s}
                        <option value={s.show_code}>{s.show_name}</option>
                      {/each}
                    </optgroup>
                  {/each}
                </select>
              </td>
              <td>
                <input
                  type="number"
                  name="tickets_sold_{i}"
                  bind:value={row.tickets_sold}
                  min="0"
                  class="input-number"
                  placeholder="0"
                />
              </td>
              <td>
                <input
                  type="number"
                  name="revenue_{i}"
                  bind:value={row.revenue}
                  min="0"
                  step="0.01"
                  class="input-number"
                  placeholder="0.00"
                />
              </td>
              <td>
                <div class="row-actions">
                  {#if i === rows.length - 1}
                    <button type="button" class="btn-add" on:click={addRow} title="Add row">
                      +
                    </button>
                  {/if}
                  {#if rows.length > 1}
                    <button type="button" class="btn-remove" on:click={() => removeRow(row.id)} title="Remove row">
                      ×
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td></td>
            <td class="totals-label">Totals:</td>
            <td class="totals-value">{totalTickets}</td>
            <td class="totals-value">{formatCurrency(totalRevenue)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div class="form-actions">
      <button type="submit" class="btn-primary">
        Save All Entries
      </button>
      <button type="button" class="btn-secondary" on:click={addRow}>
        + Add Another Row
      </button>
    </div>
  </form>
</div>

<style>
  .container {
    max-width: 1200px;
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

  .alert {
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    font-weight: 500;
  }

  .alert-success {
    background-color: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  .alert-error {
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
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
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid #e5e7eb;
  }

  td {
    padding: 0.5rem 1rem;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
  }

  .col-month {
    width: 180px;
  }

  .col-show {
    min-width: 250px;
  }

  .col-number {
    width: 140px;
  }

  .col-actions {
    width: 80px;
  }

  .input-month {
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.9rem;
    width: 100%;
    background-color: white;
  }

  .input-show {
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.9rem;
    width: 100%;
    background-color: white;
  }

  .input-number {
    padding: 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.9rem;
    width: 100%;
    text-align: right;
    background-color: white;
  }

  .input-month:focus,
  .input-show:focus,
  .input-number:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .row-actions {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
  }

  .btn-add {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: none;
    background-color: #3b82f6;
    color: white;
    font-size: 1.25rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
    line-height: 1;
  }

  .btn-add:hover {
    background-color: #2563eb;
  }

  .btn-remove {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    border: none;
    background-color: #ef4444;
    color: white;
    font-size: 1.25rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
    line-height: 1;
  }

  .btn-remove:hover {
    background-color: #dc2626;
  }

  tfoot td {
    border-top: 2px solid #e5e7eb;
    border-bottom: none;
    padding: 0.75rem 1rem;
  }

  .totals-label {
    text-align: right;
    font-weight: 700;
    color: #374151;
  }

  .totals-value {
    text-align: right;
    font-weight: 700;
    color: #1a202c;
  }

  .form-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-primary:hover {
    background-color: #2563eb;
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

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    header {
      flex-direction: column;
      gap: 1rem;
    }

    .col-month {
      width: 150px;
    }

    .col-show {
      min-width: 200px;
    }

    .col-number {
      width: 110px;
    }
  }
</style>