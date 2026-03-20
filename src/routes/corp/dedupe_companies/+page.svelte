<!-- src/routes/corp/dedupe_companies/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  export let data;
  export let form;

  // ── Shared ────────────────────────────────────────────────────────────
  /** @type {'auto' | 'manual'} */
  let activeTab = 'auto';

  const FIELDS = [
    { key: 'company_name', label: 'Name' },
    { key: 'industry',     label: 'Industry' },
    { key: 'website',      label: 'Website' },
    { key: 'notes',        label: 'Notes' },
  ];

  const fmt = (/** @type {any} */ n) =>
    n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 });

  // ── Auto dedupe state ─────────────────────────────────────────────────
  let currentIdx = 0;
  let resolved   = 0;

  /** @type {any[]} */
  let decisions = (data.groups ?? []).map(group => {
    const canonical = group.companies[0];
    return {
      fields: Object.fromEntries(FIELDS.map(f => [f.key, canonical[f.key] ?? null])),
    };
  });

  $: groups    = data.groups ?? [];
  $: total     = groups.length;
  $: group     = groups[currentIdx];
  $: decision  = decisions[currentIdx];
  $: canonical = group?.companies[0];
  $: dupes     = group?.companies.slice(1) ?? [];
  $: conflicts = group ? FIELDS.filter(f => hasConflict(group, f.key)) : [];
  $: remaining = total - currentIdx;
  $: pct       = total > 0 ? Math.round((currentIdx / total) * 100) : 0;

  /** @param {any} grp @param {string} key */
  function hasConflict(grp, key) {
    const c = String(grp.companies[0][key] ?? '').trim().toLowerCase();
    return grp.companies.slice(1).some(co => String(co[key] ?? '').trim().toLowerCase() !== c);
  }

  /** @param {any} grp @param {string} key */
  function otherValues(grp, key) {
    const base = String(grp.companies[0][key] ?? '').trim().toLowerCase();
    const seen = new Set([base]);
    /** @type {{ val: any, ids: number[] }[]} */
    const result = [];
    for (const co of grp.companies.slice(1)) {
      const raw = co[key] ?? null;
      const k   = String(raw ?? '').trim().toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      result.push({ val: raw, ids: [co.corp_company_id] });
    }
    return result;
  }

  function buildAutoPayload() {
    const d = decision;
    /** @type {Record<string,any>} */
    const updates = {};
    for (const f of FIELDS) {
      if (String(d.fields[f.key] ?? '') !== String(canonical[f.key] ?? '')) {
        updates[f.key] = d.fields[f.key];
      }
    }
    return {
      keep_id:     canonical.corp_company_id,
      discard_ids: dupes.map(/** @param {any} c */ c => c.corp_company_id),
      updates,
    };
  }

  /** @type {any} */
  let autoPendingPayload = null;

  function advance() {
    resolved++;
    currentIdx = Math.min(currentIdx + 1, total);
  }

  // ── Manual merge state ────────────────────────────────────────────────

  // Step 1: search for the company to discard
  let discardQuery  = '';
  /** @type {any[]} */
  let discardResults = [];

  // Step 2: the chosen discard company
  /** @type {any|null} */
  let discardCompany = null;

  // Step 3: search for the company to keep
  let keepQuery  = '';
  /** @type {any[]} */
  let keepResults = [];

  // Step 4: the chosen keep company
  /** @type {any|null} */
  let keepCompany = null;

  // Which field values to use on the kept record (default to keeper's values)
  $: manualFields = Object.fromEntries(
    FIELDS.map(f => [f.key, keepCompany?.[f.key] ?? null])
  );

  // Reset manual state when tab switches
  function switchTab(/** @type {'auto'|'manual'} */ tab) {
    activeTab = tab;
    if (tab === 'manual') {
      discardQuery   = '';
      discardResults = [];
      discardCompany = null;
      keepQuery      = '';
      keepResults    = [];
      keepCompany    = null;
    }
  }

  function selectDiscard(/** @type {any} */ co) {
    discardCompany = co;
    discardResults = [];
    discardQuery   = co.company_name;
    // Clear keep if same company selected
    if (keepCompany?.corp_company_id === co.corp_company_id) {
      keepCompany = null;
      keepQuery   = '';
    }
  }

  function selectKeep(/** @type {any} */ co) {
    keepCompany    = co;
    keepResults    = [];
    keepQuery      = co.company_name;
    // Reset field choices to keeper's values
    for (const f of FIELDS) manualFields[f.key] = co[f.key] ?? null;
    // Clear discard if same company
    if (discardCompany?.corp_company_id === co.corp_company_id) {
      discardCompany = null;
      discardQuery   = '';
    }
  }

  /** @type {any} */
  let manualPendingPayload = null;

  function buildManualPayload() {
    if (!keepCompany || !discardCompany) return null;
    /** @type {Record<string,any>} */
    const updates = {};
    for (const f of FIELDS) {
      if (String(manualFields[f.key] ?? '') !== String(keepCompany[f.key] ?? '')) {
        updates[f.key] = manualFields[f.key];
      }
    }
    return {
      keep_id:     keepCompany.corp_company_id,
      discard_ids: [discardCompany.corp_company_id],
      updates,
    };
  }

  $: manualReady = keepCompany && discardCompany &&
    keepCompany.corp_company_id !== discardCompany.corp_company_id;

  // Pull search results from form action response
  $: if (form?.action === 'search') {
    if (form?.target === 'discard') {
      discardResults = form?.results ?? [];
    } else if (form?.target === 'keep') {
      keepResults = form?.results ?? [];
    }
  }
</script>

<svelte:head><title>Dedupe Corp Companies | B&C Financial Tracker</title></svelte:head>

<div class="container">
  <header>
    <div>
      <h1>Deduplicate Corp Companies</h1>
      <p class="subtitle">Auto-detect duplicates or manually merge any two companies</p>
    </div>
    <a href="/corp/companies" class="btn-secondary">← Back to Companies</a>
  </header>

  <!-- ── Tabs ─────────────────────────────────────────────────────────── -->
  <div class="tabs">
    <button class="tab-btn" class:active={activeTab === 'auto'}
      on:click={() => switchTab('auto')}>
      Auto Dedupe
      {#if total > 0}<span class="tab-badge">{total}</span>{/if}
    </button>
    <button class="tab-btn" class:active={activeTab === 'manual'}
      on:click={() => switchTab('manual')}>
      Manual Merge
    </button>
  </div>

  <!-- ── Alert ─────────────────────────────────────────────────────────── -->
  {#if form?.success && form?.action !== 'search'}
    <div class="alert alert-success">✓ {form.message}</div>
  {/if}
  {#if form?.error}
    <div class="alert alert-error">✗ {form.error}</div>
  {/if}

  <!-- ════════════════════════════════════════════════════════════════════ -->
  <!-- AUTO DEDUPE TAB                                                      -->
  <!-- ════════════════════════════════════════════════════════════════════ -->
  {#if activeTab === 'auto'}

    {#if total === 0}
      <div class="empty-state">🎉 No duplicate companies found.</div>

    {:else if currentIdx >= total}
      <div class="done-card">
        <div class="done-icon">✓</div>
        <h2>All groups reviewed</h2>
        <p>{resolved} group{resolved !== 1 ? 's' : ''} resolved this session.</p>
        <a href="/corp/companies" class="btn-primary">Back to Companies</a>
        <button type="button" class="btn-secondary"
          on:click={() => { currentIdx = 0; resolved = 0; }}>
          Start over
        </button>
      </div>

    {:else}
      <div class="progress-wrap">
        <div class="progress-label">
          <span>Group <strong>{currentIdx + 1}</strong> of <strong>{total}</strong></span>
          <span class="progress-right">{remaining - 1} remaining after this</span>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: {pct}%"></div>
        </div>
      </div>

      {#if group}
        {@const matchIsDivision = group.match_type === 'parent_division'}

        <div class="group-card">
          <div class="card-header">
            {#if matchIsDivision}
              <span class="match-badge badge-division">Parent / Division</span>
            {:else}
              <span class="match-badge badge-similar">Similar names</span>
            {/if}
            <span class="totals">
              {group.total_contacts} contacts ·
              {group.total_engagements} engagements
              {#if group.total_revenue > 0}· {fmt(group.total_revenue)} revenue{/if}
            </span>
          </div>

          {#each group.companies as co (co.corp_company_id)}
            {@const isKeep = co.corp_company_id === canonical.corp_company_id}
            <div class="company-row" class:is-keep={isKeep}>
              <div class="row-label">
                <span class:keep-tag={isKeep} class:merge-tag={!isKeep}>
                  {isKeep ? 'KEEP' : 'MERGE'}
                </span>
                <span class="co-id">ID {co.corp_company_id}</span>
              </div>
              <div class="row-fields">
                {#each FIELDS as f (f.key)}
                  {#if co[f.key]}
                    <span class="field-pill" class:conflict-pill={hasConflict(group, f.key)}>
                      <span class="pill-label">{f.label}:</span>
                      {co[f.key]}
                    </span>
                  {/if}
                {/each}
                <span class="stat-pill">{co.contact_count} contact{co.contact_count !== 1 ? 's' : ''}</span>
                {#if co.history_count > 0}
                  <span class="stat-pill">{co.history_count} history</span>
                {/if}
                <span class="stat-pill">{co.engagement_count} eng</span>
                {#if co.total_revenue}
                  <span class="stat-pill revenue">{fmt(co.total_revenue)}</span>
                {/if}
              </div>
            </div>
          {/each}

          {#if conflicts.length > 0}
            <div class="conflict-section">
              <div class="conflict-title">
                {conflicts.length} field{conflicts.length !== 1 ? 's' : ''} differ — choose which value to keep on ID {canonical.corp_company_id}:
              </div>
              <div class="conflict-table">
                {#each conflicts as f (f.key)}
                  {@const others = otherValues(group, f.key)}
                  <div class="conflict-row">
                    <span class="cf-label">{f.label}</span>
                    <div class="cf-options">
                      <label class="cf-option" class:selected={decision?.fields[f.key] === canonical[f.key]}>
                        <input type="radio" name="cf_{f.key}"
                          on:change={() => { decisions[currentIdx].fields[f.key] = canonical[f.key]; }}
                          checked={decision?.fields[f.key] === canonical[f.key]} />
                        <span class="cf-val">{canonical[f.key] ?? '(empty)'}</span>
                        <span class="cf-source">current (ID {canonical.corp_company_id})</span>
                      </label>
                      {#each others as other (other.val)}
                        <label class="cf-option" class:selected={decision?.fields[f.key] === other.val}>
                          <input type="radio" name="cf_{f.key}"
                            on:change={() => { decisions[currentIdx].fields[f.key] = other.val; }}
                            checked={decision?.fields[f.key] === other.val} />
                          <span class="cf-val">{other.val ?? '(empty)'}</span>
                          <span class="cf-source">from ID {other.ids.join(', ')}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          {:else}
            <div class="no-conflict">No field conflicts — all data matches.</div>
          {/if}

          <div class="action-bar">
            <form method="POST" action="?/merge" use:enhance={({ formData }) => {
              autoPendingPayload = buildAutoPayload();
              formData.set('merges', JSON.stringify([autoPendingPayload]));
              return async ({ result, update }) => {
                await update();
                if (result.type === 'success' && /** @type {any} */ (result.data)?.success) {
                  advance();
                }
              };
            }}>
              <input type="hidden" name="merges" value="" />
              <button type="submit" class="btn-merge">
                ✓ Merge into ID {canonical.corp_company_id}
              </button>
            </form>

            <button type="button" class="btn-skip-action" on:click={advance}>
              → Skip
            </button>

            {#if currentIdx > 0}
              <button type="button" class="btn-back"
                on:click={() => { currentIdx--; }}>
                ← Back
              </button>
            {/if}

            <span class="action-hint">
              {#if matchIsDivision}
                ⚠ Parent/division match — consider skipping if these are separate entities
              {:else}
                Merging will reassign all contacts and history to ID {canonical.corp_company_id}
              {/if}
            </span>
          </div>
        </div>

        <div class="jump-row">
          <label class="jump-label">Jump to group:
            <input type="number" min="1" max={total} value={currentIdx + 1}
              class="jump-input"
              on:change={(e) => {
                const v = parseInt(/** @type {any} */ (e.target).value);
                if (v >= 1 && v <= total) currentIdx = v - 1;
              }} />
            / {total}
          </label>
        </div>
      {/if}
    {/if}

  <!-- ════════════════════════════════════════════════════════════════════ -->
  <!-- MANUAL MERGE TAB                                                     -->
  <!-- ════════════════════════════════════════════════════════════════════ -->
  {:else}
    <div class="manual-layout">

      <!-- ── Step 1: Find company to MERGE (discard) ─────────────────── -->
      <div class="manual-panel discard-panel">
        <div class="panel-title discard-title">
          <span class="panel-num">1</span>
          Company to <strong>Merge Away</strong>
          <span class="panel-hint">(will be marked merged)</span>
        </div>

        <form method="POST" action="?/search" use:enhance={({ formData }) => {
          formData.set('target', 'discard');
          return async ({ result, update }) => {
            await update();
            if (result.type === 'success') {
              discardResults = /** @type {any} */ (result.data)?.results ?? [];
            }
          };
        }} class="search-form">
          <input type="hidden" name="target" value="discard" />
          <div class="search-row">
            <input
              name="query"
              bind:value={discardQuery}
              placeholder="Search by name or ID…"
              class="search-input"
              autocomplete="off"
            />
            <button type="submit" class="btn-search">Search</button>
          </div>
        </form>

        {#if discardResults.length > 0}
          <div class="results-list">
            {#each discardResults as co (co.corp_company_id)}
              <button type="button"
                class="result-row"
                class:result-selected={discardCompany?.corp_company_id === co.corp_company_id}
                class:result-inactive={co.status !== 'active'}
                on:click={() => selectDiscard(co)}>
                <div class="result-main">
                  <span class="result-name">{co.company_name}</span>
                  <span class="result-id">ID {co.corp_company_id}</span>
                  {#if co.status !== 'active'}
                    <span class="status-badge {co.status}">{co.status}</span>
                  {/if}
                </div>
                <div class="result-meta">
                  {#if co.industry}<span>{co.industry}</span>{/if}
                  <span>{co.contact_count} contacts</span>
                  <span>{co.engagement_count} eng</span>
                  {#if co.total_revenue}<span>{fmt(co.total_revenue)}</span>{/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}

        {#if discardCompany}
          <div class="selected-card discard-selected">
            <div class="selected-label">Selected to merge away:</div>
            <div class="selected-name">{discardCompany.company_name}</div>
            <div class="selected-meta">
              ID {discardCompany.corp_company_id}
              · {discardCompany.contact_count} contacts
              · {discardCompany.engagement_count} engagements
              {#if discardCompany.total_revenue}· {fmt(discardCompany.total_revenue)}{/if}
            </div>
            <button type="button" class="btn-clear"
              on:click={() => { discardCompany = null; discardQuery = ''; }}>
              ✕ Clear
            </button>
          </div>
        {/if}
      </div>

      <!-- ── Arrow ────────────────────────────────────────────────────── -->
      <div class="merge-arrow">→</div>

      <!-- ── Step 2: Find company to KEEP ────────────────────────────── -->
      <div class="manual-panel keep-panel">
        <div class="panel-title keep-title">
          <span class="panel-num">2</span>
          Company to <strong>Keep</strong>
          <span class="panel-hint">(canonical record)</span>
        </div>

        <form method="POST" action="?/search" use:enhance={({ formData }) => {
          formData.set('target', 'keep');
          return async ({ result, update }) => {
            await update();
            if (result.type === 'success') {
              keepResults = /** @type {any} */ (result.data)?.results ?? [];
            }
          };
        }} class="search-form">
          <input type="hidden" name="target" value="keep" />
          <div class="search-row">
            <input
              name="query"
              bind:value={keepQuery}
              placeholder="Search by name or ID…"
              class="search-input"
              autocomplete="off"
            />
            <button type="submit" class="btn-search">Search</button>
          </div>
        </form>

        {#if keepResults.length > 0}
          <div class="results-list">
            {#each keepResults as co (co.corp_company_id)}
              <button type="button"
                class="result-row"
                class:result-selected={keepCompany?.corp_company_id === co.corp_company_id}
                class:result-inactive={co.status !== 'active'}
                on:click={() => selectKeep(co)}>
                <div class="result-main">
                  <span class="result-name">{co.company_name}</span>
                  <span class="result-id">ID {co.corp_company_id}</span>
                  {#if co.status !== 'active'}
                    <span class="status-badge {co.status}">{co.status}</span>
                  {/if}
                </div>
                <div class="result-meta">
                  {#if co.industry}<span>{co.industry}</span>{/if}
                  <span>{co.contact_count} contacts</span>
                  <span>{co.engagement_count} eng</span>
                  {#if co.total_revenue}<span>{fmt(co.total_revenue)}</span>{/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}

        {#if keepCompany}
          <div class="selected-card keep-selected">
            <div class="selected-label">Selected to keep:</div>
            <div class="selected-name">{keepCompany.company_name}</div>
            <div class="selected-meta">
              ID {keepCompany.corp_company_id}
              · {keepCompany.contact_count} contacts
              · {keepCompany.engagement_count} engagements
              {#if keepCompany.total_revenue}· {fmt(keepCompany.total_revenue)}{/if}
            </div>
            <button type="button" class="btn-clear"
              on:click={() => { keepCompany = null; keepQuery = ''; }}>
              ✕ Clear
            </button>
          </div>
        {/if}
      </div>
    </div>

    <!-- ── Field conflict resolution ─────────────────────────────────── -->
    {#if manualReady}
      {@const manualConflicts = FIELDS.filter(f =>
        String(discardCompany[f.key] ?? '') !== String(keepCompany[f.key] ?? '') &&
        (discardCompany[f.key] || keepCompany[f.key])
      )}

      {#if manualConflicts.length > 0}
        <div class="conflict-section manual-conflicts">
          <div class="conflict-title">
            Field conflicts — choose which value to keep on "{keepCompany.company_name}":
          </div>
          <div class="conflict-table">
            {#each manualConflicts as f (f.key)}
              <div class="conflict-row">
                <span class="cf-label">{f.label}</span>
                <div class="cf-options">
                  {#if keepCompany[f.key]}
                    <label class="cf-option" class:selected={manualFields[f.key] === keepCompany[f.key]}>
                      <input type="radio" name="mcf_{f.key}"
                        on:change={() => { manualFields[f.key] = keepCompany[f.key]; }}
                        checked={manualFields[f.key] === keepCompany[f.key]} />
                      <span class="cf-val">{keepCompany[f.key]}</span>
                      <span class="cf-source">from {keepCompany.company_name} (ID {keepCompany.corp_company_id})</span>
                    </label>
                  {/if}
                  {#if discardCompany[f.key]}
                    <label class="cf-option" class:selected={manualFields[f.key] === discardCompany[f.key]}>
                      <input type="radio" name="mcf_{f.key}"
                        on:change={() => { manualFields[f.key] = discardCompany[f.key]; }}
                        checked={manualFields[f.key] === discardCompany[f.key]} />
                      <span class="cf-val">{discardCompany[f.key]}</span>
                      <span class="cf-source">from {discardCompany.company_name} (ID {discardCompany.corp_company_id})</span>
                    </label>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <!-- ── Confirm merge ─────────────────────────────────────────────── -->
      <div class="manual-confirm">
        <div class="confirm-summary">
          Merging <strong>"{discardCompany.company_name}"</strong> (ID {discardCompany.corp_company_id})
          into <strong>"{keepCompany.company_name}"</strong> (ID {keepCompany.corp_company_id}).
          All contacts and history will be reassigned to the kept company.
        </div>
        <form method="POST" action="?/merge" use:enhance={({ formData }) => {
          manualPendingPayload = buildManualPayload();
          formData.set('merges', JSON.stringify([manualPendingPayload]));
          return async ({ result, update }) => {
            await update();
            if (result.type === 'success' && /** @type {any} */ (result.data)?.success) {
              // Reset for next merge
              discardCompany = null; discardQuery = '';
              keepCompany    = null; keepQuery    = '';
              discardResults = []; keepResults   = [];
            }
          };
        }}>
          <input type="hidden" name="merges" value="" />
          <button type="submit" class="btn-merge">
            ✓ Confirm Merge
          </button>
        </form>
      </div>
    {:else if discardCompany || keepCompany}
      <div class="manual-hint">
        {#if !discardCompany}Select the company to merge away.
        {:else if !keepCompany}Now search for the company to keep.
        {:else}Cannot merge a company into itself.{/if}
      </div>
    {/if}

  {/if}
</div>

<style>
  .container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0 0 0.25rem; }
  .subtitle { color: #6b7280; margin: 0; font-size: 0.875rem; }

  /* ── Tabs ───────────────────────────────────────────────────────────── */
  .tabs { display: flex; gap: 0; border-bottom: 2px solid #e5e7eb; margin-bottom: 1.5rem; }
  .tab-btn { padding: 0.625rem 1.25rem; border: none; background: none; font-size: 0.95rem; font-weight: 500; color: #6b7280; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; display: flex; align-items: center; gap: 0.5rem; transition: all 0.15s; }
  .tab-btn:hover { color: #374151; }
  .tab-btn.active { color: #3b82f6; border-bottom-color: #3b82f6; }
  .tab-badge { background: #e0e7ff; color: #4338ca; border-radius: 9999px; padding: 0.1rem 0.45rem; font-size: 0.72rem; font-weight: 700; }

  /* ── Alerts ─────────────────────────────────────────────────────────── */
  .alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
  .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .alert-error   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .empty-state { text-align: center; padding: 4rem; color: #6b7280; font-size: 1.1rem; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); }

  /* ── Auto dedupe ────────────────────────────────────────────────────── */
  .done-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 3rem; text-align: center; }
  .done-icon { font-size: 2.5rem; color: #22c55e; margin-bottom: 1rem; }
  .done-card h2 { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem; }
  .done-card p  { color: #6b7280; margin: 0 0 1.5rem; }
  .done-card .btn-primary, .done-card .btn-secondary { margin: 0 0.5rem; }

  .progress-wrap { margin-bottom: 1.5rem; }
  .progress-label { display: flex; justify-content: space-between; font-size: 0.875rem; color: #374151; margin-bottom: 0.4rem; }
  .progress-right { color: #9ca3af; }
  .progress-track { height: 6px; background: #e5e7eb; border-radius: 9999px; overflow: hidden; }
  .progress-fill  { height: 100%; background: #3b82f6; border-radius: 9999px; transition: width 0.3s ease; }

  .group-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); border: 1px solid #e5e7eb; overflow: hidden; margin-bottom: 1rem; }
  .card-header { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem 1rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
  .totals { font-size: 0.82rem; color: #9ca3af; }
  .match-badge { padding: 0.2rem 0.6rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; }
  .badge-similar  { background: #dbeafe; color: #1e40af; }
  .badge-division { background: #fef3c7; color: #92400e; }

  .company-row { display: flex; align-items: flex-start; gap: 1rem; padding: 0.75rem 1rem; border-bottom: 1px solid #f3f4f6; }
  .company-row.is-keep     { background: #f0fdf4; border-left: 4px solid #22c55e; }
  .company-row:not(.is-keep) { background: #fafafa; border-left: 4px solid #d1d5db; }
  .row-label { display: flex; flex-direction: column; gap: 0.25rem; min-width: 85px; flex-shrink: 0; }
  .keep-tag  { font-size: 0.68rem; font-weight: 700; background: #22c55e; color: white; padding: 0.15rem 0.4rem; border-radius: 0.2rem; display: inline-block; }
  .merge-tag { font-size: 0.68rem; font-weight: 700; background: #9ca3af; color: white; padding: 0.15rem 0.4rem; border-radius: 0.2rem; display: inline-block; }
  .co-id { font-size: 0.73rem; color: #9ca3af; font-family: monospace; }
  .row-fields { display: flex; flex-wrap: wrap; gap: 0.4rem; flex: 1; }
  .field-pill { display: inline-flex; align-items: baseline; gap: 0.25rem; background: #f3f4f6; border-radius: 0.25rem; padding: 0.15rem 0.5rem; font-size: 0.82rem; }
  .field-pill.conflict-pill { background: #fef9c3; border: 1px solid #fde68a; }
  .pill-label { color: #9ca3af; font-size: 0.7rem; }
  .stat-pill { font-size: 0.73rem; background: #e0e7ff; color: #4338ca; padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 500; }
  .stat-pill.revenue { background: #dcfce7; color: #166534; }

  .no-conflict { padding: 0.625rem 1rem; font-size: 0.82rem; color: #9ca3af; font-style: italic; }

  .action-bar { display: flex; align-items: center; gap: 0.75rem; padding: 1rem; background: #f9fafb; border-top: 1px solid #e5e7eb; flex-wrap: wrap; }
  .action-hint { font-size: 0.78rem; color: #9ca3af; margin-left: auto; font-style: italic; }

  .jump-row { display: flex; justify-content: center; margin-top: 0.75rem; }
  .jump-label { font-size: 0.875rem; color: #6b7280; display: flex; align-items: center; gap: 0.5rem; }
  .jump-input { width: 4rem; padding: 0.3rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; text-align: center; }

  /* ── Conflict ───────────────────────────────────────────────────────── */
  .conflict-section { padding: 0.875rem 1rem; background: #fffbeb; border-top: 1px solid #fde68a; }
  .manual-conflicts { border-radius: 0.5rem; border: 1px solid #fde68a; margin-bottom: 1rem; }
  .conflict-title { font-size: 0.75rem; font-weight: 600; color: #92400e; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.75rem; }
  .conflict-table { display: flex; flex-direction: column; gap: 0.5rem; }
  .conflict-row { display: flex; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .cf-label { font-weight: 600; font-size: 0.85rem; color: #374151; min-width: 70px; padding-top: 0.3rem; flex-shrink: 0; }
  .cf-options { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .cf-option { display: flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; border-radius: 0.375rem; border: 1px solid #e5e7eb; background: white; font-size: 0.82rem; cursor: pointer; transition: all 0.15s; }
  .cf-option:hover { border-color: #93c5fd; }
  .cf-option.selected { border-color: #3b82f6; background: #eff6ff; }
  .cf-option input { accent-color: #3b82f6; }
  .cf-val    { font-weight: 500; color: #1a202c; }
  .cf-source { font-size: 0.7rem; color: #9ca3af; }

  /* ── Manual merge ───────────────────────────────────────────────────── */
  .manual-layout { display: grid; grid-template-columns: 1fr auto 1fr; gap: 1rem; align-items: start; margin-bottom: 1.5rem; }
  .merge-arrow { font-size: 1.75rem; color: #9ca3af; padding-top: 3rem; align-self: start; }

  .manual-panel { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); border: 1px solid #e5e7eb; overflow: hidden; }
  .panel-title { display: flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1rem; font-size: 0.875rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
  .discard-title { border-left: 3px solid #9ca3af; }
  .keep-title    { border-left: 3px solid #22c55e; }
  .panel-num { display: inline-flex; align-items: center; justify-content: center; width: 1.4rem; height: 1.4rem; background: #e5e7eb; color: #374151; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; }
  .panel-hint { font-size: 0.75rem; color: #9ca3af; margin-left: auto; }

  .search-form { padding: 0.75rem; border-bottom: 1px solid #f3f4f6; }
  .search-row { display: flex; gap: 0.5rem; }
  .search-input { flex: 1; padding: 0.4rem 0.65rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; }
  .search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
  .btn-search { padding: 0.4rem 0.875rem; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; cursor: pointer; white-space: nowrap; }
  .btn-search:hover { background: #e5e7eb; }

  .results-list { max-height: 240px; overflow-y: auto; border-bottom: 1px solid #f3f4f6; }
  .result-row { width: 100%; text-align: left; padding: 0.6rem 0.875rem; border: none; background: white; cursor: pointer; border-bottom: 1px solid #f9fafb; transition: background 0.1s; display: block; }
  .result-row:hover { background: #f9fafb; }
  .result-row.result-selected { background: #eff6ff; border-left: 3px solid #3b82f6; }
  .result-row.result-inactive { opacity: 0.6; }
  .result-main { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.2rem; }
  .result-name { font-weight: 500; color: #1a202c; font-size: 0.875rem; }
  .result-id   { font-size: 0.72rem; color: #9ca3af; font-family: monospace; }
  .result-meta { display: flex; gap: 0.75rem; font-size: 0.75rem; color: #6b7280; flex-wrap: wrap; }

  .selected-card { padding: 0.75rem 1rem; }
  .discard-selected { background: #f9fafb; border-top: 1px solid #e5e7eb; }
  .keep-selected    { background: #f0fdf4; border-top: 1px solid #bbf7d0; }
  .selected-label { font-size: 0.72rem; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.2rem; }
  .selected-name  { font-weight: 600; color: #1a202c; font-size: 0.95rem; }
  .selected-meta  { font-size: 0.78rem; color: #6b7280; margin-top: 0.2rem; }
  .btn-clear { margin-top: 0.5rem; padding: 0.2rem 0.6rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: white; font-size: 0.75rem; color: #6b7280; cursor: pointer; }
  .btn-clear:hover { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }

  .status-badge { padding: 0.1rem 0.4rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 600; }
  .status-badge.merged      { background: #fef3c7; color: #92400e; }
  .status-badge.deactivated { background: #fee2e2; color: #991b1b; }

  .manual-confirm { background: white; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; box-shadow: 0 1px 3px rgba(0,0,0,.08); }
  .confirm-summary { font-size: 0.875rem; color: #374151; line-height: 1.5; flex: 1; }
  .manual-hint { text-align: center; color: #9ca3af; font-size: 0.875rem; font-style: italic; padding: 1rem; }

  /* ── Buttons ────────────────────────────────────────────────────────── */
  .btn-merge { background: #22c55e; color: white; padding: 0.625rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.95rem; cursor: pointer; white-space: nowrap; }
  .btn-merge:hover { background: #16a34a; }
  .btn-skip-action { background: #f3f4f6; color: #374151; padding: 0.625rem 1.25rem; border-radius: 0.5rem; border: 1px solid #d1d5db; font-weight: 500; font-size: 0.95rem; cursor: pointer; }
  .btn-skip-action:hover { background: #e5e7eb; }
  .btn-back { background: none; color: #6b7280; padding: 0.625rem 1rem; border-radius: 0.5rem; border: 1px solid #e5e7eb; font-size: 0.875rem; cursor: pointer; }
  .btn-back:hover { background: #f3f4f6; }
  .btn-primary { background: #3b82f6; color: white; padding: 0.625rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.95rem; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn-primary:hover { background: #2563eb; }
  .btn-secondary { background: #e5e7eb; color: #374151; padding: 0.625rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.95rem; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn-secondary:hover { background: #d1d5db; }

  @media (max-width: 768px) {
    .container { padding: 1rem; }
    header { flex-direction: column; gap: 1rem; }
    .manual-layout { grid-template-columns: 1fr; }
    .merge-arrow { display: none; }
    .action-bar { flex-direction: column; align-items: stretch; }
    .action-hint { margin-left: 0; }
  }
</style>