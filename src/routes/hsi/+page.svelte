<!-- src/routes/hsi/+page.svelte -->
<script>
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

  /** @type {{ classes: ClassItem[] }} */
  export let data;

  $: classes = data.classes;

  // Group classes by track
  /** @type {Record<string, ClassItem[]>} */
  $: classesByTrack = classes.reduce((/** @type {Record<string, ClassItem[]>} */ acc, classItem) => {
    const track = classItem.track || 'Uncategorized';
    if (!acc[track]) {
      acc[track] = [];
    }
    acc[track].push(classItem);
    return acc;
  }, {});

  $: tracks = Object.keys(classesByTrack).sort();

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
  <title>HSI Classes | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <h1>High School Improv Classes</h1>
    <div class="header-actions">
      <a href="/hsi/enter_monthly_summary" class="btn-primary">
        Enter Monthly Summary
      </a>
      <a href="/hsi/reports" class="btn-primary">
        View Reports
      </a>
    </div>
  </header>
  
  <div class="classes-content">
    {#if classes.length === 0}
      <p class="empty-state">No classes found. Add your first class to get started.</p>
    {:else}
      {#each tracks as track}
        <div class="track-section">
          <h2 class="track-title">{track}</h2>
          
          <table>
            <thead>
              <tr>
                <th>Class Code</th>
                <th>Class Name</th>
                <th>Type</th>
                <th>Student Type</th>
                <th>Standard Price</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {#each classesByTrack[track] as classItem}
                <tr class:inactive={!classItem.is_active}>
                  <td class="class-code">{classItem.class_code}</td>
                  <td class="class-name">{classItem.class_name}</td>
                  <td>{classItem.class_type}</td>
                  <td>{classItem.student_type}</td>
                  <td>{formatCurrency(classItem.standard_price)}</td>
                  <td>
                    <span class="status-badge" class:active={classItem.is_active}>
                      {classItem.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div class="actions">
                      <a href="/hsi/class/{classItem.class_code}" class="btn-secondary">View</a>
                      <a href="/hsi/class/{classItem.class_code}/edit" class="btn-secondary">Edit</a>
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
    text-decoration: none;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }
  
  .btn-secondary:hover {
    background-color: #d1d5db;
  }
  
  .classes-content {
    display: flex;
    flex-direction: column;
    gap: 2rem;
  }
  
  .track-section {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    overflow: hidden;
  }
  
  .track-title {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1a202c;
    padding: 1rem 1.5rem;
    background-color: #f9fafb;
    border-bottom: 2px solid #e5e7eb;
    margin: 0;
  }
  
  table {
    width: 100%;
    border-collapse: collapse;
  }
  
  thead {
    background-color: #f9fafb;
  }
  
  th {
    padding: 1rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 1px solid #e5e7eb;
  }
  
  td {
    padding: 1rem;
    border-top: 1px solid #e5e7eb;
  }
  
  tr.inactive {
    opacity: 0.6;
  }
  
  .class-code {
    font-family: monospace;
    font-weight: 600;
    color: #6b7280;
    background-color: #f3f4f6;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    display: inline-block;
  }
  
  .class-name {
    font-weight: 500;
    color: #1a202c;
  }
  
  .status-badge {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 500;
    background-color: #fef2f2;
    color: #991b1b;
  }
  
  .status-badge.active {
    background-color: #d1fae5;
    color: #065f46;
  }
  
  .actions {
    display: flex;
    gap: 0.5rem;
  }
  
  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
    font-size: 1.125rem;
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
  }
  
  @media (max-width: 1024px) {
    header {
      flex-direction: column;
      align-items: flex-start;
      gap: 1rem;
    }
    
    table {
      font-size: 0.875rem;
    }
    
    th, td {
      padding: 0.75rem;
    }
  }
</style>