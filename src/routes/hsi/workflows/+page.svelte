<!-- src/routes/hsi/workflows/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  export let data;
  export let form;

  const CATEGORIES = [
    { key: 'class_type', label: 'Class Types' },
    { key: 'student_type', label: 'Student Types' },
    { key: 'duration_unit', label: 'Duration Units' },
  ];

  $: grouped = data.grouped ?? {};

  let addCategory  = 'class_type';
  let addValue     = '';
  let addLabel     = '';
  let addSortOrder = '';
  let showAddForm  = false;

  /** @type {number|null} */
  let editingId = null;
  /** @type {Record<number, { label: string, sort_order: number, is_active: boolean }>} */
  let editValues = {};

  /** @param {any} row */
  function startEdit(row) {
    editingId = row.workflow_id;
    editValues[row.workflow_id] = {
      label:      row.label,
      sort_order: row.sort_order,
      is_active:  row.is_active,
    };
  }

  function cancelEdit() { editingId = null; }

  $: if (addLabel && !addValue) {
    addValue = addLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
</script>

<svelte:head>
  <title>HSI Workflow Settings | StageLedger</title>
</svelte:head>

<div class="container">
  <header>
    <div>
      <a href="/hsi/classes" class="back">← Back to Classes</a>
      <h1>HSI Workflow Settings</h1>
      <p class="subtitle">Manage class types, student types, and duration units</p>
    </div>
    <button class="btn-primary" on:click={() => showAddForm = !showAddForm}>
      {showAddForm ? 'Cancel' : '+ Add Value'}
    </button>
  </header>

  {#if form?.success}
    <div class="alert alert-success">Saved successfully.</div>
  {/if}
  {#if form?.error}
    <div class="alert alert-error">{form.error}</div>
  {/if}

  {#if showAddForm}
    <div class="add-card">
      <h2>Add New Value</h2>
      <form method="POST" action="?/add" use:enhance={() => {
        return async ({ result, update }) => {
          await update();
          if (result.type === 'success' && /** @type {any} */ (result.data)?.success) {
            showAddForm = false;
            addValue = ''; addLabel = ''; addSortOrder = '';
          }
        };
      }}>
        <div class="add-grid">
          <label>Category
            <select name="category" bind:value={addCategory}>
              {#each CATEGORIES as cat (cat.key)}
                <option value={cat.key}>{cat.label}</option>
              {/each}
            </select>
          </label>
          <label>Label <span class="hint">(shown in UI)</span>
            <input name="label" bind:value={addLabel} placeholder="e.g. Weekend Workshop" />
          </label>
          <label>Value <span class="hint">(stored in DB)</span>
            <input name="value" bind:value={addValue} placeholder="e.g. weekend_workshop" />
          </label>
          <label>Sort Order
            <input name="sort_order" type="number" bind:value={addSortOrder} placeholder="0" />
          </label>
        </div>
        <button type="submit" class="btn-primary">Add Value</button>
      </form>
    </div>
  {/if}

  {#each CATEGORIES as cat (cat.key)}
    {@const rows = grouped[cat.key] ?? []}
    <div class="category-section">
      <div class="category-header">
        <h2>{cat.label}</h2>
        <span class="count-pill">{rows.length}</span>
      </div>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Label</th>
              <th>Value</th>
              <th class="col-center">Sort</th>
              <th class="col-center">Active</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {#if rows.length === 0}
              <tr><td colspan="5" class="empty">No values defined.</td></tr>
            {:else}
              {#each rows as row (row.workflow_id)}
                <tr class:inactive={!row.is_active}>
                  <td>
                    {#if editingId === row.workflow_id}
                      <input class="inline-input" bind:value={editValues[row.workflow_id].label} placeholder="Label" />
                    {:else}
                      <span class="label-text">{row.label}</span>
                      {#if !row.is_active}<span class="inactive-badge">Inactive</span>{/if}
                    {/if}
                  </td>
                  <td><code class="value-code">{row.value}</code></td>
                  <td class="col-center">
                    {#if editingId === row.workflow_id}
                      <input class="inline-input sort-input" type="number" bind:value={editValues[row.workflow_id].sort_order} />
                    {:else}
                      {row.sort_order}
                    {/if}
                  </td>
                  <td class="col-center">
                    {#if editingId === row.workflow_id}
                      <input type="checkbox" bind:checked={editValues[row.workflow_id].is_active} class="checkbox" />
                    {:else}
                      <span class:active-dot={row.is_active} class:inactive-dot={!row.is_active}>
                        {row.is_active ? '●' : '○'}
                      </span>
                    {/if}
                  </td>
                  <td>
                    {#if editingId === row.workflow_id}
                      <form method="POST" action="?/update" use:enhance={() => {
                        return async ({ result, update }) => {
                          await update();
                          if (result.type === 'success' && /** @type {any} */ (result.data)?.success) cancelEdit();
                        };
                      }} class="inline-form">
                        <input type="hidden" name="workflow_id" value={row.workflow_id} />
                        <input type="hidden" name="label" value={editValues[row.workflow_id].label} />
                        <input type="hidden" name="sort_order" value={editValues[row.workflow_id].sort_order} />
                        <input type="hidden" name="is_active" value={String(editValues[row.workflow_id].is_active)} />
                        <button type="submit" class="btn-save">Save</button>
                        <button type="button" class="btn-cancel" on:click={cancelEdit}>Cancel</button>
                      </form>
                    {:else}
                      <div class="row-actions">
                        <button class="btn-edit" on:click={() => startEdit(row)}>Edit</button>
                        <form method="POST" action="?/delete" use:enhance class="inline-form">
                          <input type="hidden" name="workflow_id" value={row.workflow_id} />
                          <button type="submit" class="btn-delete"
                            on:click={(e) => { if (!confirm(`Delete "${row.label}"?`)) e.preventDefault(); }}>
                            Delete
                          </button>
                        </form>
                      </div>
                    {/if}
                  </td>
                </tr>
              {/each}
            {/if}
          </tbody>
        </table>
      </div>
    </div>
  {/each}
</div>

<style>
  .container { max-width: 900px; margin: 0 auto; padding: 2rem; }
  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
  .back { font-size: 0.85rem; color: #6b7280; text-decoration: none; display: block; margin-bottom: 0.25rem; }
  .back:hover { text-decoration: underline; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0 0 0.25rem; }
  .subtitle { color: #6b7280; margin: 0; font-size: 0.875rem; }

  .alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
  .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .alert-error   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

  .add-card { background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .add-card h2 { font-size: 1rem; font-weight: 600; color: #1a202c; margin: 0 0 1rem; }
  .add-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1.5rem; margin-bottom: 1rem; }
  .add-grid label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.82rem; font-weight: 500; color: #374151; }
  .hint { font-weight: 400; color: #9ca3af; font-size: 0.75rem; }
  .add-grid input, .add-grid select { padding: 0.4rem 0.6rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; background: white; }
  .add-grid input:focus, .add-grid select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }

  .category-section { margin-bottom: 2rem; }
  .category-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.75rem; }
  h2 { font-size: 1.05rem; font-weight: 600; color: #1a202c; margin: 0; }
  .count-pill { background: #e0e7ff; color: #4338ca; padding: 0.15rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }

  .table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); overflow: hidden; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: #f9fafb; }
  th { padding: 0.625rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e5e7eb; }
  th.col-center, td.col-center { text-align: center; }
  td { padding: 0.5rem 1rem; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; color: #1a202c; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f9fafb; }
  tr.inactive td { opacity: 0.5; }

  .label-text { font-weight: 500; }
  .value-code { font-family: monospace; font-size: 0.8rem; background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 0.25rem; color: #374151; }
  .inactive-badge { font-size: 0.7rem; background: #fee2e2; color: #991b1b; padding: 0.1rem 0.4rem; border-radius: 9999px; margin-left: 0.4rem; font-weight: 600; }
  .active-dot   { color: #22c55e; font-size: 0.9rem; }
  .inactive-dot { color: #d1d5db; font-size: 0.9rem; }
  .checkbox { accent-color: #3b82f6; width: 1rem; height: 1rem; cursor: pointer; }
  .empty { text-align: center; color: #9ca3af; font-style: italic; padding: 1.5rem; }

  .inline-input { padding: 0.3rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; width: 100%; }
  .sort-input { width: 4rem; text-align: center; }
  .inline-form { display: inline-flex; gap: 0.35rem; }
  .row-actions { display: flex; gap: 0.35rem; }

  .btn-primary { background: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; border: none; cursor: pointer; }
  .btn-primary:hover { background: #2563eb; }
  .btn-edit   { padding: 0.3rem 0.65rem; background: #e5e7eb; color: #374151; border: none; border-radius: 0.375rem; font-size: 0.8rem; cursor: pointer; }
  .btn-edit:hover { background: #d1d5db; }
  .btn-save   { padding: 0.3rem 0.65rem; background: #22c55e; color: white; border: none; border-radius: 0.375rem; font-size: 0.8rem; cursor: pointer; }
  .btn-save:hover { background: #16a34a; }
  .btn-cancel { padding: 0.3rem 0.65rem; background: #f3f4f6; color: #374151; border: 1px solid #e5e7eb; border-radius: 0.375rem; font-size: 0.8rem; cursor: pointer; }
  .btn-delete { padding: 0.3rem 0.65rem; background: white; color: #dc2626; border: 1px solid #fecaca; border-radius: 0.375rem; font-size: 0.8rem; cursor: pointer; }
  .btn-delete:hover { background: #fef2f2; }

  @media (max-width: 640px) {
    header { flex-direction: column; gap: 1rem; }
    .add-grid { grid-template-columns: 1fr; }
    .table-wrapper { overflow-x: auto; overflow-y: visible; }
    table { display: table; min-width: 600px; }
    th, td { white-space: nowrap; }
  }
</style>
