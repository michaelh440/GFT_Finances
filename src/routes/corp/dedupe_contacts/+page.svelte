<!-- src/routes/corp/dedupe_contacts/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  /** @type {{ groups: any[] }} */
  export let data;
  /** @type {any} */
  export let form;

  const FIELDS = [
    { key: 'company_name',  label: 'Company' },
    { key: 'first_name',    label: 'First Name' },
    { key: 'last_name',     label: 'Last Name' },
    { key: 'email',         label: 'Email' },
    { key: 'phone',         label: 'Phone' },
    { key: 'address_line1', label: 'Address' },
    { key: 'city',          label: 'City' },
    { key: 'state',         label: 'State' },
    { key: 'zip',           label: 'Zip' },
  ];

  // Roles: keep (primary), merge (delete & reassign), previous (save as history), skip
  let currentIdx = 0;

  /** @type {any[]} */
  let decisions = (data.groups ?? []).map((/** @type {any} */ group) => {
    /** @type {Record<number, string>} */
    const roles = {};
    group.contacts.forEach((/** @type {any} */ c, /** @type {number} */ i) => {
      roles[c.corp_contact_id] = i === 0 ? 'keep' : 'merge';
    });
    const primary = group.contacts[0];
    return {
      roles,
      fields: Object.fromEntries(FIELDS.map(f => [f.key, primary[f.key] ?? null])),
    };
  });

  $: groups    = data.groups ?? [];
  $: total     = groups.length;
  $: group     = groups[currentIdx];
  $: decision  = decisions[currentIdx];
  $: remaining = total - currentIdx;
  $: pct       = total > 0 ? Math.round((currentIdx / total) * 100) : 0;

  // Derived from roles
  $: keepContact = group?.contacts.find((/** @type {any} */ c) => decision?.roles[c.corp_contact_id] === 'keep') ?? null;
  $: mergeCos = group?.contacts.filter((/** @type {any} */ c) => decision?.roles[c.corp_contact_id] === 'merge') ?? [];
  $: prevCos = group?.contacts.filter((/** @type {any} */ c) => decision?.roles[c.corp_contact_id] === 'previous') ?? [];
  $: skipCos = group?.contacts.filter((/** @type {any} */ c) => decision?.roles[c.corp_contact_id] === 'skip') ?? [];
  $: hasKeep = !!keepContact;
  $: canApply = hasKeep && (mergeCos.length > 0 || prevCos.length > 0);

  /** @param {number} contactId @param {string} role */
  function setRole(contactId, role) {
    if (!decisions[currentIdx]) return;
    // Only one keep allowed
    if (role === 'keep') {
      for (const id of Object.keys(decisions[currentIdx].roles)) {
        if (decisions[currentIdx].roles[Number(id)] === 'keep') {
          decisions[currentIdx].roles[Number(id)] = 'merge';
        }
      }
      const co = group.contacts.find((/** @type {any} */ c) => c.corp_contact_id === contactId);
      if (co) {
        for (const f of FIELDS) {
          decisions[currentIdx].fields[f.key] = co[f.key] ?? null;
        }
      }
    }
    decisions[currentIdx].roles[contactId] = role;
    decisions = decisions;
  }

  /** @param {string} fieldKey @param {any} value */
  function setFieldValue(fieldKey, value) {
    if (!decisions[currentIdx]) return;
    decisions[currentIdx].fields[fieldKey] = value;
    decisions = decisions;
  }

  function buildPayload() {
    const d = decisions[currentIdx];
    const g = groups[currentIdx];
    if (!d || !g) return null;

    const keep = g.contacts.find((/** @type {any} */ c) => d.roles[c.corp_contact_id] === 'keep');
    if (!keep) return null;

    const mergeIds = g.contacts
      .filter((/** @type {any} */ c) => d.roles[c.corp_contact_id] === 'merge')
      .map((/** @type {any} */ c) => c.corp_contact_id);
    const previousIds = g.contacts
      .filter((/** @type {any} */ c) => d.roles[c.corp_contact_id] === 'previous')
      .map((/** @type {any} */ c) => c.corp_contact_id);

    /** @type {Record<string,any>} */
    const updates = {};
    for (const f of FIELDS) {
      if (String(d.fields[f.key] ?? '') !== String(keep[f.key] ?? '')) {
        updates[f.key] = d.fields[f.key];
      }
    }

    return {
      keep_id: keep.corp_contact_id,
      discard_ids: mergeIds,
      previous_ids: previousIds,
      updates,
    };
  }

  function advance() {
    if (currentIdx < total - 1) currentIdx++;
  }

  /** @type {any} */
  let pendingPayload = null;

  /** @param {number} n */
  function fmt(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(n || 0);
  }
</script>

<svelte:head><title>Dedupe Corp Contacts | StageLedger</title></svelte:head>

<div class="container" data-sveltekit-reload>
  <header>
    <div>
      <h1>Deduplicate Corp Contacts</h1>
      <p class="subtitle">
        {total} duplicate group{total !== 1 ? 's' : ''} found — review one at a time
      </p>
    </div>
    <a href="/corp/contacts" class="btn-secondary">← Back to Contacts</a>
  </header>

  {#if form?.success}
    <div class="alert alert-success">{form.message}</div>
  {/if}
  {#if form?.error}
    <div class="alert alert-error">{form.error}</div>
  {/if}

  {#if !total}
    <div class="empty-state">No duplicate contacts found.</div>

  {:else if currentIdx >= total}
    <div class="empty-state">All {total} groups reviewed. Reload to check for new duplicates.</div>

  {:else if group}
    <!-- Progress bar -->
    <div class="progress-strip">
      <div class="progress-bar" style="width:{pct}%"></div>
      <span class="progress-text">Group {currentIdx + 1} of {total} — {remaining} remaining</span>
    </div>

    <div class="group-card">
      <!-- Header -->
      <div class="group-header">
        <div class="group-meta">
          <span class="match-badge badge-{group.match_types?.includes('email') ? 'email' : 'phone'}">
            {group.match_types === 'email' ? 'email match' : group.match_types === 'name_phone' ? 'name + phone' : 'email + name/phone'}
          </span>
          <span class="eng-total">
            {group.contacts.reduce((/** @type {number} */ s, /** @type {any} */ c) => s + (c.engagement_count || 0), 0)} total engagements
          </span>
        </div>
      </div>

      <!-- Side-by-side comparison table -->
      <div class="compare-table-wrap">
        <table class="compare-table">
          <thead>
            <tr>
              <th class="compare-field-col">Field</th>
              {#each group.contacts as co (co.corp_contact_id)}
                {@const role = decision?.roles[co.corp_contact_id] ?? 'skip'}
                <th class:compare-keep={role === 'keep'} class:compare-skip={role === 'skip'}>
                  <div class="compare-co-header">
                    <span class="compare-co-name">{co.first_name} {co.last_name}</span>
                    <span class="compare-co-id">ID {co.corp_contact_id}</span>
                    <select class="role-select role-{role}"
                      value={role}
                      on:change={(e) => setRole(co.corp_contact_id, /** @type {HTMLSelectElement} */ (e.target).value)}>
                      <option value="keep">Keep (Primary)</option>
                      <option value="merge">Merge (Delete)</option>
                      <option value="previous">Previous (History)</option>
                      <option value="skip">Skip</option>
                    </select>
                  </div>
                </th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each FIELDS as f (f.key)}
              <tr>
                <td class="compare-field-label">{f.label}</td>
                {#each group.contacts as co (co.corp_contact_id)}
                  {@const val = co[f.key] ?? ''}
                  {@const role = decision?.roles[co.corp_contact_id] ?? 'skip'}
                  {@const isSelected = decision?.fields[f.key] === val && val !== ''}
                  <td class="compare-cell"
                    class:compare-keep={role === 'keep'}
                    class:compare-skip={role === 'skip'}
                    class:compare-selected={isSelected}
                    on:click={() => { if (val) setFieldValue(f.key, val); }}
                    style={val ? 'cursor:pointer' : ''}>
                    {#if val}
                      <div class="compare-val" class:compare-val-chosen={isSelected}>
                        {#if isSelected}<span class="check-mark">✓</span>{/if}
                        {val}
                      </div>
                    {:else}
                      <span class="muted small">—</span>
                    {/if}
                  </td>
                {/each}
              </tr>
            {/each}
            <!-- Stats rows -->
            <tr class="stats-row-sep">
              <td class="compare-field-label">Engagements</td>
              {#each group.contacts as co (co.corp_contact_id)}
                <td class:compare-keep={decision?.roles[co.corp_contact_id] === 'keep'}>
                  <span class="stat-pill">{co.engagement_count}</span>
                </td>
              {/each}
            </tr>
            <tr>
              <td class="compare-field-label">Last Engagement</td>
              {#each group.contacts as co (co.corp_contact_id)}
                <td class:compare-keep={decision?.roles[co.corp_contact_id] === 'keep'}>
                  <span class="stat-pill">{co.last_engagement || '—'}</span>
                </td>
              {/each}
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Action summary -->
      <div class="action-summary">
        {#if hasKeep}
          <span class="action-summary-item">Keep: <strong>{keepContact.first_name} {keepContact.last_name}</strong> (ID {keepContact.corp_contact_id})</span>
        {/if}
        {#if mergeCos.length > 0}
          <span class="action-summary-item">Merge & delete: {mergeCos.map(c => `ID ${c.corp_contact_id}`).join(', ')}</span>
        {/if}
        {#if prevCos.length > 0}
          <span class="action-summary-item">Save as history: {prevCos.map(c => `ID ${c.corp_contact_id}`).join(', ')}</span>
        {/if}
        {#if skipCos.length > 0}
          <span class="action-summary-item muted">Skip: {skipCos.map(c => `ID ${c.corp_contact_id}`).join(', ')}</span>
        {/if}
      </div>

      <!-- Action buttons -->
      <div class="action-bar">
        {#if canApply}
          <form method="POST" action="?/merge" use:enhance={({ formData }) => {
            pendingPayload = buildPayload();
            formData.set('merges', JSON.stringify([pendingPayload]));
            return async ({ result, update }) => {
              await update();
              if (result.type === 'success' && /** @type {any} */ (result.data)?.success) {
                advance();
              }
            };
          }}>
            <input type="hidden" name="merges" value="" />
            <button type="submit" class="btn-merge">
              ✓ Apply
              {#if mergeCos.length > 0}(merge {mergeCos.length}){/if}
              {#if prevCos.length > 0}(save {prevCos.length} as history){/if}
            </button>
          </form>
        {:else if !hasKeep}
          <span class="action-hint">Select one contact as Keep to proceed</span>
        {/if}

        <button type="button" class="btn-skip-action" on:click={advance}>
          → Skip
        </button>

        {#if currentIdx > 0}
          <button type="button" class="btn-back" on:click={() => { currentIdx--; }}>
            ← Back
          </button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0 0 0.25rem; }
  .subtitle { color: #6b7280; margin: 0; font-size: 0.875rem; }
  .muted { color: #9ca3af; }
  .small { font-size: 0.8rem; }

  .alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
  .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .alert-error   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .empty-state { text-align: center; padding: 4rem; color: #6b7280; font-size: 1.1rem; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); }

  /* Progress */
  .progress-strip { position: relative; background: #e5e7eb; border-radius: 0.5rem; height: 1.5rem; margin-bottom: 1.5rem; overflow: hidden; }
  .progress-bar { position: absolute; top: 0; left: 0; height: 100%; background: #3b82f6; border-radius: 0.5rem; transition: width 0.3s; }
  .progress-text { position: relative; z-index: 1; display: flex; align-items: center; justify-content: center; height: 100%; font-size: 0.75rem; font-weight: 600; color: #1a202c; }

  /* Group card */
  .group-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); border: 1px solid #e5e7eb; overflow: hidden; }
  .group-header { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 1rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; gap: 0.5rem; }
  .group-meta { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .eng-total { font-size: 0.8rem; color: #6b7280; }
  .match-badge { padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.72rem; font-weight: 600; }
  .badge-email { background: #dcfce7; color: #166534; }
  .badge-phone { background: #dbeafe; color: #1e40af; }

  /* Comparison table */
  .compare-table-wrap { overflow-x: auto; }
  .compare-table { width: 100%; border-collapse: collapse; }
  .compare-table thead th { padding: 0.6rem 0.75rem; text-align: left; font-size: 0.8rem; border-bottom: 2px solid #e5e7eb; background: #f9fafb; vertical-align: top; }
  .compare-table thead th.compare-keep { background: #f0fdf4; border-bottom-color: #22c55e; }
  .compare-table thead th.compare-skip { background: #fafafa; opacity: 0.6; }
  .compare-field-col { width: 90px; min-width: 90px; }
  .compare-co-header { display: flex; flex-direction: column; gap: 0.25rem; }
  .compare-co-name { font-weight: 600; color: #1a202c; font-size: 0.85rem; }
  .compare-co-id { font-size: 0.7rem; color: #9ca3af; font-family: monospace; }
  .role-select { padding: 0.25rem 0.4rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; cursor: pointer; margin-top: 0.2rem; width: 100%; }
  .role-select.role-keep { background: #dcfce7; color: #166534; border-color: #86efac; }
  .role-select.role-merge { background: #fef9c3; color: #92400e; border-color: #fde68a; }
  .role-select.role-previous { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }
  .role-select.role-skip { background: #f3f4f6; color: #6b7280; border-color: #d1d5db; }
  .compare-field-label { font-weight: 600; font-size: 0.78rem; color: #6b7280; padding: 0.5rem 0.75rem; vertical-align: top; white-space: nowrap; border-right: 1px solid #f3f4f6; }
  .compare-cell { padding: 0.45rem 0.75rem; border-bottom: 1px solid #f3f4f6; vertical-align: top; font-size: 0.85rem; transition: background 0.1s; }
  .compare-cell:hover { background: #f0f9ff; }
  .compare-cell.compare-keep { background: #fafff9; }
  .compare-cell.compare-skip { opacity: 0.4; }
  .compare-cell.compare-selected { background: #eff6ff; }
  .compare-val { color: #1a202c; line-height: 1.4; }
  .compare-val-chosen { font-weight: 600; color: #1e40af; }
  .check-mark { color: #22c55e; font-weight: 700; margin-right: 0.25rem; }
  .stat-pill { font-size: 0.8rem; color: #374151; font-weight: 500; }
  .stats-row-sep td { border-top: 2px solid #e5e7eb; }

  /* Action summary */
  .action-summary { padding: 0.625rem 1rem; background: #f9fafb; border-top: 1px solid #e5e7eb; display: flex; gap: 1.5rem; flex-wrap: wrap; font-size: 0.82rem; color: #374151; }
  .action-summary-item { display: flex; gap: 0.25rem; }

  /* Action bar */
  .action-bar { display: flex; align-items: center; gap: 0.75rem; padding: 0.875rem 1rem; border-top: 1px solid #e5e7eb; flex-wrap: wrap; }
  .btn-merge { background: #22c55e; color: white; padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; }
  .btn-merge:hover { background: #16a34a; }
  .btn-skip-action { padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem; background: white; color: #374151; font-weight: 500; font-size: 0.85rem; cursor: pointer; }
  .btn-skip-action:hover { background: #f3f4f6; }
  .btn-back { padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.5rem; background: white; color: #6b7280; font-size: 0.85rem; cursor: pointer; }
  .btn-back:hover { background: #f3f4f6; }
  .action-hint { font-size: 0.85rem; color: #9ca3af; }

  .btn-secondary { background: #e5e7eb; color: #374151; padding: 0.625rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.95rem; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn-secondary:hover { background: #d1d5db; }

  @media (max-width: 768px) {
    .container { padding: 1rem; }
    header { flex-direction: column; gap: 1rem; }
  }
</style>
