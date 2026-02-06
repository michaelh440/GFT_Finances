<!-- src/routes/hsi/enter_monthly_summary/+page.svelte -->
<script>
  import { enhance } from '$app/forms';

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
   * @typedef {Object} SummaryEntry
   * @property {string} id
   * @property {string} class_code
   * @property {string} month
   * @property {number} registrations
   * @property {number} revenue
   */

  /** @type {{ classes: ClassItem[], existingSummaries: Array<{class_code: string, summary_month: string, summary_year: number, registrations: number, revenue: number}> }} */
  export let data;
  /** @type {{ success?: boolean, error?: string } | null} */
  export let form;

  // Initialize entries with existing summaries or empty array
  /** @type {SummaryEntry[]} */
  let entries = [];

  $: {
    if (data.existingSummaries && data.existingSummaries.length > 0) {
      entries = data.existingSummaries.map(summary => ({
        id: crypto.randomUUID(),
        class_code: summary.class_code,
        month: summary.summary_month.slice(0, 7), // Format as YYYY-MM
        registrations: summary.registrations,
        revenue: summary.revenue
      }));
    } else if (entries.length === 0) {
      // Start with one empty row
      addEntry();
    }
  }

  function addEntry() {
    entries = [...entries, {
      id: crypto.randomUUID(),
      class_code: '',
      month: new Date().toISOString().slice(0, 7),
      registrations: 0,
      revenue: 0
    }];
  }

  /**
   * @param {string} id
   */
  function removeEntry(id) {
    entries = entries.filter(e => e.id !== id);
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

  /**
   * @param {string} classCode
   * @returns {ClassItem | undefined}
   */
  function getClassByCode(classCode) {
    return data.classes.find(c => c.class_code === classCode);
  }

  // Calculate total revenue
  $: totalRevenue = entries.reduce((sum, entry) => {
    const revenue = parseFloat(String(entry.revenue)) || 0;
    return sum + revenue;
  }, 0);

  // Calculate total registrations
  $: totalRegistrations = entries.reduce((sum, entry) => {
    const registrations = parseInt(String(entry.registrations)) || 0;
    return sum + registrations;
  }, 0);
</script>

<svelte:head>
  <title>Enter Monthly Summary | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <div>
      <h1>Enter Monthly Class Summary</h1>
      <p class="subtitle">Add registrations and revenue data for each class by month</p>
    </div>
    <a href="/hsi" class="btn-secondary">Back to Classes</a>
  </header>
  
  {#if form?.success}
    <div class="alert alert-success">
      ✓ Monthly summaries saved successfully!
    </div>
  {/if}
  
  {#if form?.error}
    <div class="alert alert-error">
      ✗ Error: {form.error}
    </div>
  {/if}
  
  <form method="POST" use:enhance>
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Month/Year</th>
            <th>Class</th>
            <th>Registrations</th>
            <th>Revenue</th>
            <th>Avg per Student</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {#each entries as entry, index (entry.id)}
            <tr>
              <td>
                <input
                  type="month"
                  name="month_{index}"
                  bind:value={entry.month}
                  required
                  class="month-input"
                />
              </td>
              <td>
                <select
                  name="class_code_{index}"
                  bind:value={entry.class_code}
                  required
                  class="class-select"
                >
                  <option value="">Select a class...</option>
                  {#each data.classes as classItem}
                    <option value={classItem.class_code}>
                      {classItem.class_name}
                    </option>
                  {/each}
                </select>
                {#if entry.class_code}
                  {@const selectedClass = getClassByCode(entry.class_code)}
                  {#if selectedClass}
                    <span class="class-info">
                      {selectedClass.track} • {selectedClass.class_type} • {formatCurrency(selectedClass.standard_price)}
                    </span>
                  {/if}
                {/if}
              </td>
              <td>
                <input
                  type="number"
                  name="registrations_{index}"
                  bind:value={entry.registrations}
                  required
                  class="number-input"
                  placeholder="0"
                />
              </td>
              <td>
                <input
                  type="number"
                  name="revenue_{index}"
                  bind:value={entry.revenue}
                  step="0.01"
                  required
                  class="number-input currency-input"
                  placeholder="0.00"
                />
              </td>
              <td class="calculated">
                {#if entry.registrations > 0 && entry.revenue > 0}
                  {formatCurrency(entry.revenue / entry.registrations)}
                {:else if entry.registrations < 0 && entry.revenue < 0}
                  {formatCurrency(entry.revenue / entry.registrations)}
                {:else}
                  -
                {/if}
              </td>
              <td>
                <button
                  type="button"
                  class="btn-icon btn-remove"
                  on:click={() => removeEntry(entry.id)}
                  aria-label="Remove entry"
                >
                  ✕
                </button>
              </td>
            </tr>
          {/each}
          
          <!-- Totals row -->
          {#if entries.length > 1}
            <tr class="totals-row">
              <td colspan="2" class="totals-label">Totals</td>
              <td class="totals-value">{totalRegistrations}</td>
              <td class="totals-value">{formatCurrency(totalRevenue)}</td>
              <td class="totals-value">
                {#if totalRegistrations > 0}
                  {formatCurrency(totalRevenue / totalRegistrations)}
                {:else}
                  -
                {/if}
              </td>
              <td></td>
            </tr>
          {/if}
        </tbody>
      </table>
    </div>
    
    <div class="form-actions">
      <button type="button" class="btn-secondary" on:click={addEntry}>
        + Add Another Entry
      </button>
      <div class="right-actions">
        <button type="reset" class="btn-secondary">Reset</button>
        <button type="submit" class="btn-primary">Save All Entries</button>
      </div>
    </div>
    
    <!-- Hidden input to track number of entries -->
    <input type="hidden" name="entry_count" value={entries.length} />
  </form>
</div>

<!-- Styles remain the same as before -->
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
  
  .alert {
    padding: 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    font-weight: 500;
  }
  
  .alert-success {
    background-color: #d1fae5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }
  
  .alert-error {
    background-color: #fee2e2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }
  
  .table-container {
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
    border-bottom: 2px solid #e5e7eb;
  }
  
  th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  td {
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
    vertical-align: top;
  }
  
  .month-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    width: 160px;
  }
  
  .class-select {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    width: 100%;
    min-width: 250px;
    background-color: white;
  }
  
  .class-info {
    display: block;
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }
  
  .number-input {
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
    width: 120px;
  }
  
  .currency-input {
    font-family: monospace;
  }
  
  input:focus, select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .calculated {
    color: #6b7280;
    font-weight: 500;
    font-family: monospace;
  }
  
  .btn-icon {
    padding: 0.25rem 0.5rem;
    border: none;
    background: none;
    cursor: pointer;
    color: #6b7280;
    font-size: 1.25rem;
    line-height: 1;
    transition: color 0.2s;
  }
  
  .btn-remove:hover {
    color: #ef4444;
  }
  
  .totals-row {
    background-color: #f9fafb;
    font-weight: 600;
    border-top: 2px solid #e5e7eb;
  }
  
  .totals-label {
    text-align: right;
    color: #374151;
    text-transform: uppercase;
    font-size: 0.875rem;
    letter-spacing: 0.05em;
  }
  
  .totals-value {
    color: #1a202c;
    font-family: monospace;
  }
  
  .form-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .right-actions {
    display: flex;
    gap: 1rem;
  }
  
  .btn-primary {
    background-color: #3b82f6;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    font-weight: 500;
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
</style>