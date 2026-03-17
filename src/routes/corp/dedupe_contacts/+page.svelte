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

  // decisions[i] = {
  //   skipped: bool,
  //   fields:  { field_key: chosen_value }  — starts as canonical contact's values
  // }
  // The canonical (kept) contact is ALWAYS contacts[0] (lowest ID).
  /** @type {any[]} */
  let decisions = (data.groups ?? []).map(group => {
    const canonical = group.contacts[0];
    return {
      skipped: false,
      fields:  Object.fromEntries(FIELDS.map(f => [f.key, canonical[f.key] ?? null])),
    };
  });

  /** @param {any} group @param {string} fieldKey */
  function hasConflict(group, fieldKey) {
    const canonical = String(group.contacts[0][fieldKey] ?? '').trim().toLowerCase();
    return group.contacts.slice(1).some(
      /** @param {any} c */ c => String(c[fieldKey] ?? '').trim().toLowerCase() !== canonical
    );
  }

  /** All non-canonical values for a field (unique, non-empty, different from canonical) */
  /** @param {any} group @param {string} fieldKey */
  function otherValues(group, fieldKey) {
    const canonical = String(group.contacts[0][fieldKey] ?? '').trim().toLowerCase();
    const seen = new Set([canonical]);
    /** @type {{ val: any, ids: number[] }[]} */
    const result = [];
    for (const c of group.contacts.slice(1)) {
      const raw = c[fieldKey] ?? null;
      const key = String(raw ?? '').trim().toLowerCase();
      if (!key || seen.has(key)) {
        // Same value or empty — still track which contacts have it
        if (key && key !== canonical) {
          const existing = result.find(r => String(r.val ?? '').trim().toLowerCase() === key);
          if (existing) existing.ids.push(c.corp_contact_id);
        }
        continue;
      }
      seen.add(key);
      result.push({ val: raw, ids: [c.corp_contact_id] });
    }
    return result;
  }

  /** @param {number} i */
  function buildMergePayload(i) {
    const group    = data.groups[i];
    const d        = decisions[i];
    const canonical = group.contacts[0];
    const discard_ids = group.contacts.slice(1).map(/** @param {any} c */ c => c.corp_contact_id);

    // Only include fields where the chosen value differs from what the canonical already has
    /** @type {Record<string,any>} */
    const updates = {};
    for (const f of FIELDS) {
      if (String(d.fields[f.key] ?? '') !== String(canonical[f.key] ?? '')) {
        updates[f.key] = d.fields[f.key];
      }
    }

    return { keep_id: canonical.corp_contact_id, discard_ids, updates };
  }

  /** @type {any[]} */
  let pendingPayload = [];
  function prepareMerge() {
    pendingPayload = decisions
      .map((d, i) => d.skipped ? null : buildMergePayload(i))
      .filter(Boolean);
  }

  $: toMerge  = decisions.filter(d => !d.skipped).length;
  $: toSkip   = decisions.filter(d =>  d.skipped).length;
</script>

<svelte:head><title>Dedupe Corp Contacts | B&C Financial Tracker</title></svelte:head>

<div class="container">
  <header>
    <div>
      <h1>Deduplicate Corp Contacts</h1>
      <p class="subtitle">
        {data.groups?.length ?? 0} duplicate group{data.groups?.length !== 1 ? 's' : ''} found
        — lowest contact ID is always kept
      </p>
    </div>
    <a href="/corp/contacts" class="btn-secondary">← Back to Contacts</a>
  </header>

  {#if form?.success}
    <div class="alert alert-success">✓ {form.message}</div>
  {/if}
  {#if form?.error}
    <div class="alert alert-error">✗ {form.error}</div>
  {/if}

  {#if !data.groups?.length}
    <div class="empty-state">🎉 No duplicate contacts found.</div>

  {:else}
    <form method="POST" action="?/merge" use:enhance={({ formData }) => {
      prepareMerge();
      formData.set('merges', JSON.stringify(pendingPayload));
      return async ({ result, update }) => {
        if (result.type === 'success') await update();
      };
    }}>
      <input type="hidden" name="merges" value="" />

      <div class="top-actions">
        <button type="submit" class="btn-primary">
          Merge {toMerge} group{toMerge !== 1 ? 's' : ''}
        </button>
        <button type="button" class="btn-secondary"
          on:click={() => { decisions = decisions.map(d => ({ ...d, skipped: true })); }}>
          Skip all
        </button>
        <button type="button" class="btn-link"
          on:click={() => { decisions = decisions.map(d => ({ ...d, skipped: false })); }}>
          Unskip all
        </button>
        {#if toSkip > 0}
          <span class="skip-note">{toSkip} group{toSkip !== 1 ? 's' : ''} will be skipped</span>
        {/if}
      </div>

      <div class="groups">
        {#each data.groups as group, i (group.canonical_id)}
          {@const canonical = group.contacts[0]}
          {@const dupes     = group.contacts.slice(1)}
          {@const conflicts = FIELDS.filter(f => hasConflict(group, f.key))}

          <div class="group-card" class:skipped={decisions[i]?.skipped}>

            <!-- Header -->
            <div class="group-header">
              <div class="group-meta">
                <span class="group-num">Group {i + 1}</span>
                <span class="match-badge badge-{group.match_types?.includes('email') ? 'email' : 'phone'}">
                  {group.match_types === 'email' ? 'email match' : group.match_types === 'name_phone' ? 'name + phone match' : 'email + name/phone'}
                </span>
                <span class="eng-total">
                  {group.contacts.reduce((/** @type {any} */ s, /** @type {any} */ c) => s + (c.engagement_count || 0), 0)} engagements total
                </span>
              </div>
              <button type="button" class="btn-skip"
                on:click={() => { decisions[i].skipped = !decisions[i].skipped; }}>
                {decisions[i]?.skipped ? 'Unskip' : 'Skip'}
              </button>
            </div>

            {#if !decisions[i]?.skipped}

              <!-- Canonical contact (the one being kept) -->
              <div class="canonical-row">
                <div class="canonical-label">
                  <span class="keep-tag">KEEP</span>
                  <span class="canonical-id">ID {canonical.corp_contact_id}</span>
                  <span class="eng-badge">{canonical.engagement_count} eng</span>
                </div>
                <div class="field-summary">
                  {#each FIELDS as f (f.key)}
                    {#if canonical[f.key]}
                      <span class="field-pill" class:conflict-pill={hasConflict(group, f.key)}>
                        <span class="pill-label">{f.label}:</span>
                        <span class="pill-val">
                          {decisions[i]?.fields[f.key] ?? canonical[f.key]}
                          {#if decisions[i]?.fields[f.key] && decisions[i].fields[f.key] !== canonical[f.key]}
                            <span class="override-tag">↑ updated</span>
                          {/if}
                        </span>
                      </span>
                    {/if}
                  {/each}
                </div>
              </div>

              <!-- Duplicate contacts (being merged away) -->
              {#each dupes as dupe (dupe.corp_contact_id)}
                <div class="dupe-row">
                  <div class="dupe-label">
                    <span class="discard-tag">MERGE</span>
                    <span class="dupe-id">ID {dupe.corp_contact_id}</span>
                    <span class="eng-badge">{dupe.engagement_count} eng → moved to ID {canonical.corp_contact_id}</span>
                  </div>
                  <div class="field-summary">
                    {#each FIELDS as f (f.key)}
                      {#if dupe[f.key]}
                        <span class="field-pill" class:conflict-pill={hasConflict(group, f.key)}>
                          <span class="pill-label">{f.label}:</span>
                          <span class="pill-val">{dupe[f.key]}</span>
                        </span>
                      {/if}
                    {/each}
                  </div>
                </div>
              {/each}

              <!-- Conflict resolution -->
              {#if conflicts.length > 0}
                <div class="conflict-section">
                  <div class="conflict-title">
                    {conflicts.length} field{conflicts.length !== 1 ? 's' : ''} differ — choose which value to keep on ID {canonical.corp_contact_id}:
                  </div>
                  <div class="conflict-table">
                    {#each conflicts as f (f.key)}
                      {@const others = otherValues(group, f.key)}
                      <div class="conflict-field-row">
                        <span class="cf-label">{f.label}</span>
                        <div class="cf-options">

                          <!-- Current canonical value -->
                          <label class="cf-option" class:selected={decisions[i]?.fields[f.key] === canonical[f.key]}>
                            <input type="radio"
                              name="cf_{i}_{f.key}"
                              on:change={() => { decisions[i].fields[f.key] = canonical[f.key]; }}
                              checked={decisions[i]?.fields[f.key] === canonical[f.key]}
                            />
                            <span class="cf-val">{canonical[f.key] ?? '(empty)'}</span>
                            <span class="cf-source">current (ID {canonical.corp_contact_id})</span>
                          </label>

                          <!-- Values from duplicates -->
                          {#each others as other (other.val)}
                            <label class="cf-option" class:selected={decisions[i]?.fields[f.key] === other.val}>
                              <input type="radio"
                                name="cf_{i}_{f.key}"
                                on:change={() => { decisions[i].fields[f.key] = other.val; }}
                                checked={decisions[i]?.fields[f.key] === other.val}
                              />
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

            {:else}
              <div class="skipped-msg">Skipped — will not be merged.</div>
            {/if}
          </div>
        {/each}
      </div>

      <div class="bottom-actions">
        <button type="submit" class="btn-primary">
          Merge {toMerge} group{toMerge !== 1 ? 's' : ''}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }

  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0 0 0.25rem; }
  .subtitle { color: #6b7280; margin: 0; font-size: 0.875rem; }

  .alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
  .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .alert-error   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .empty-state { text-align: center; padding: 4rem; color: #6b7280; font-size: 1.1rem; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); }

  .top-actions, .bottom-actions { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap; }
  .bottom-actions { margin-top: 1.5rem; margin-bottom: 0; }
  .skip-note { font-size: 0.875rem; color: #9ca3af; }

  /* Group cards */
  .groups { display: flex; flex-direction: column; gap: 1.25rem; }

  .group-card {
    background: white; border-radius: 0.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,.1);
    border: 1px solid #e5e7eb;
    overflow: hidden;
    transition: opacity 0.2s;
  }
  .group-card.skipped { opacity: 0.4; }

  .group-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.625rem 1rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb;
    flex-wrap: wrap; gap: 0.5rem;
  }
  .group-meta { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .group-num { font-weight: 600; color: #374151; font-size: 0.875rem; }
  .eng-total { font-size: 0.8rem; color: #6b7280; }

  .match-badge { padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.72rem; font-weight: 600; }
  .badge-email { background: #dcfce7; color: #166534; }
  .badge-phone { background: #dbeafe; color: #1e40af; }

  /* Canonical / dupe rows */
  .canonical-row {
    display: flex; align-items: flex-start; gap: 1rem;
    padding: 0.75rem 1rem;
    background: #f0fdf4; border-left: 4px solid #22c55e;
    border-bottom: 1px solid #e5e7eb;
  }
  .dupe-row {
    display: flex; align-items: flex-start; gap: 1rem;
    padding: 0.75rem 1rem;
    background: #fafafa; border-left: 4px solid #d1d5db;
    border-bottom: 1px solid #f3f4f6;
  }

  .canonical-label, .dupe-label {
    display: flex; flex-direction: column; align-items: flex-start;
    gap: 0.25rem; min-width: 110px; flex-shrink: 0;
  }
  .keep-tag    { font-size: 0.7rem; font-weight: 700; background: #22c55e; color: white; padding: 0.15rem 0.4rem; border-radius: 0.2rem; letter-spacing: 0.05em; }
  .discard-tag { font-size: 0.7rem; font-weight: 700; background: #9ca3af; color: white; padding: 0.15rem 0.4rem; border-radius: 0.2rem; letter-spacing: 0.05em; }
  .canonical-id, .dupe-id { font-size: 0.78rem; font-weight: 600; color: #374151; font-family: monospace; }
  .eng-badge { font-size: 0.72rem; color: #6b7280; }

  .field-summary { display: flex; flex-wrap: wrap; gap: 0.4rem; flex: 1; align-content: flex-start; }
  .field-pill {
    display: inline-flex; align-items: baseline; gap: 0.25rem;
    background: #f3f4f6; border-radius: 0.25rem;
    padding: 0.15rem 0.5rem; font-size: 0.8rem;
  }
  .field-pill.conflict-pill { background: #fef9c3; border: 1px solid #fde68a; }
  .pill-label { color: #9ca3af; font-size: 0.72rem; }
  .pill-val   { color: #1a202c; font-weight: 500; }
  .override-tag { font-size: 0.68rem; color: #2563eb; font-weight: 600; margin-left: 0.2rem; }

  /* Conflict section */
  .conflict-section {
    padding: 0.875rem 1rem;
    background: #fffbeb; border-top: 1px solid #fde68a;
  }
  .conflict-title {
    font-size: 0.78rem; font-weight: 600; color: #92400e;
    text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 0.75rem;
  }
  .conflict-table { display: flex; flex-direction: column; gap: 0.5rem; }
  .conflict-field-row { display: flex; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
  .cf-label { font-weight: 600; font-size: 0.85rem; color: #374151; min-width: 75px; padding-top: 0.3rem; flex-shrink: 0; }
  .cf-options { display: flex; gap: 0.5rem; flex-wrap: wrap; }

  .cf-option {
    display: flex; align-items: center; gap: 0.35rem;
    padding: 0.3rem 0.75rem; border-radius: 0.375rem;
    border: 1px solid #e5e7eb; background: white;
    font-size: 0.82rem; cursor: pointer; transition: all 0.15s;
  }
  .cf-option:hover { border-color: #93c5fd; }
  .cf-option.selected { border-color: #3b82f6; background: #eff6ff; }
  .cf-option input { accent-color: #3b82f6; }
  .cf-val    { font-weight: 500; color: #1a202c; }
  .cf-source { font-size: 0.72rem; color: #9ca3af; }

  .no-conflict { padding: 0.625rem 1rem; font-size: 0.82rem; color: #9ca3af; font-style: italic; }
  .skipped-msg { padding: 0.75rem 1rem; font-size: 0.875rem; color: #9ca3af; font-style: italic; }

  /* Buttons */
  .btn-skip { padding: 0.3rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: white; color: #374151; font-size: 0.8rem; cursor: pointer; }
  .btn-skip:hover { background: #f3f4f6; }
  .btn-primary { background: #3b82f6; color: white; padding: 0.625rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
  .btn-primary:hover { background: #2563eb; }
  .btn-secondary { background: #e5e7eb; color: #374151; padding: 0.625rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.95rem; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn-secondary:hover { background: #d1d5db; }
  .btn-link { background: none; border: none; color: #3b82f6; font-size: 0.875rem; cursor: pointer; text-decoration: underline; padding: 0; }

  @media (max-width: 768px) {
    .container { padding: 1rem; }
    header { flex-direction: column; gap: 1rem; }
    .canonical-row, .dupe-row { flex-direction: column; gap: 0.5rem; }
    .canonical-label, .dupe-label { flex-direction: row; align-items: center; min-width: unset; }
    .conflict-field-row { flex-direction: column; gap: 0.3rem; }
  }
</style>