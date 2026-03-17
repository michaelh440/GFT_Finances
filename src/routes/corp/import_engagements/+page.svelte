<!-- src/routes/corp/import_engagements/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  /** @type {{ contacts: any[] }} */
  export let data;
  /** @type {any} */
  export let form;

  const TYPES = [
    ['corporate_training', 'Corporate Training'],
    ['private_show_gft',   'Private Show @ GFT'],
    ['roadshow',           'Roadshow'],
    ['space_rental',       'Space Rental'],
    ['school_nonprofit',   'School / Nonprofit'],
    ['other',              'Other'],
  ];
  const PIPELINES = [
    ['none',                 'None'],
    ['lm_emailed',           'LM / Emailed'],
    ['proposal_in_progress', 'Proposal In Progress'],
    ['active_due',           'Active & Due'],
    ['benji_follow_up',      'Benji Follow Up'],
    ['paid_2026',            'Paid 2026'],
  ];
  const CONTRACTS = [
    ['',              '— None —'],
    ['needs_sending', 'Needs Sending'],
    ['sent',          'Sent'],
    ['viewed',        'Viewed'],
    ['signed',        'Signed'],
  ];

  // ── State ────────────────────────────────────────────────────────────────
  /** @type {any[]} */
  let csvParsed  = [];
  let csvPreview = false;
  let reviewMode = false;
  /** @type {any[]} */
  let matchResults = [];
  /** @type {any[]} */
  let decisions    = [];

  // ── CSV Parsing ──────────────────────────────────────────────────────────

  /** @param {any} event */
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (/** @type {any} */ e) => parseCSV(e.target.result);
    reader.readAsText(file);
  }

  /** @param {string} text */
  function parseCSV(text) {
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const rawLines = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch === '"') { inQuotes = !inQuotes; current += ch; }
      else if (ch === '\n' && !inQuotes) { if (current.trim()) rawLines.push(current); current = ''; }
      else { current += ch; }
    }
    if (current.trim()) rawLines.push(current);
    if (rawLines.length < 2) { csvParsed = []; return; }

    const header = parseCSVLine(rawLines[0]).map(h => h.replace(/["'\r\n]+/g, '').trim().toLowerCase());

    const col = (/** @type {string[]} */ names) => {
      for (const n of names) { const i = header.indexOf(n); if (i !== -1) return i; }
      for (const n of names) { const i = header.findIndex(h => h.includes(n)); if (i !== -1) return i; }
      return -1;
    };

    const colMap = {
      title:            col(['title', 'project title', 'project name', 'engagement name']),
      company_name:     col(['company name', 'company', 'organization', 'client company']),
      email:            col(['email', 'email address', 'client email']),
      engagement_type:  col(['engagement type', 'type']),
      pipeline_status:  col(['pipeline status', 'pipeline', 'project status']),
      contract_status:  col(['contract status', 'contract']),
      engagement_date:  col(['engagement date', 'start date', 'date']),
      end_date:         col(['end date']),
      audience_size_min:col(['audience size min', 'audience min', 'audience']),
      audience_size_max:col(['audience size max', 'audience max']),
      audience_size_approx: col(['audience approx', 'approximate']),
      amount_paid:      col(['amount paid', 'primary invoice paid', 'revenue', 'paid', 'amount']),
      notes:            col(['notes', 'note']),
      is_archived:      col(['archived', 'is archived']),
      dubsado_project_title: col(['dubsado project title', 'dubsado title']),
    };

    const parsed = [];
    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseCSVLine(rawLines[i]);
      if (cols.length < 2) continue;
      const g = (/** @type {number} */ idx) => idx === -1 ? '' : cleanVal(cols[idx]);
      const row = {
        title:            g(colMap.title),
        company_name:     g(colMap.company_name),
        email:            g(colMap.email).toLowerCase(),
        engagement_type:  g(colMap.engagement_type) || 'other',
        pipeline_status:  g(colMap.pipeline_status) || 'none',
        contract_status:  g(colMap.contract_status) || '',
        engagement_date:  cleanDate(g(colMap.engagement_date)),
        end_date:         cleanDate(g(colMap.end_date)),
        audience_size_min: g(colMap.audience_size_min),
        audience_size_max: g(colMap.audience_size_max),
        audience_size_approx: g(colMap.audience_size_approx) === 'true' || g(colMap.audience_size_approx) === '1',
        amount_paid:      cleanAmount(g(colMap.amount_paid)),
        notes:            g(colMap.notes),
        is_archived:      g(colMap.is_archived) === 'true' || g(colMap.is_archived) === '1' || g(colMap.is_archived).toLowerCase() === 'yes',
        dubsado_project_title: g(colMap.dubsado_project_title),
      };
      if (!row.title && !row.company_name && !row.engagement_date) continue;
      parsed.push(row);
    }
    csvParsed = parsed;
    csvPreview = true;
  }

  /** @param {string} line */
  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQuotes = !inQuotes; }
      else if (ch === ',' && !inQuotes) { result.push(current); current = ''; }
      else { current += ch; }
    }
    result.push(current);
    return result;
  }

  /** @param {any} val */
  function cleanVal(val) {
    if (!val) return '';
    return val.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  }

  /** @param {any} val */
  function cleanAmount(val) {
    if (!val) return '';
    const n = parseFloat(val.replace(/[^0-9.-]/g, ''));
    return isNaN(n) ? '' : n;
  }

  /** @param {any} val */
  function cleanDate(val) {
    if (!val) return '';
    const m = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
    // Handle ISO dates that may have time component
    if (val.match(/^\d{4}-\d{2}-\d{2}/)) return val.slice(0, 10);
    return val;
  }

  /** @param {number} index */
  function removeRow(index) {
    csvParsed = csvParsed.filter((_, i) => i !== index);
  }

  const fmt = (/** @type {any} */ n) => n == null || n === '' ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 });

  // ── Computed summaries ───────────────────────────────────────────────────
  $: newCount       = matchResults.filter(m => m.engMatchType === 'new').length;
  $: dupCount       = matchResults.filter(m => m.engMatchType === 'duplicate').length;
  $: sameDateCount  = matchResults.filter(m => m.engMatchType === 'same_date').length;
  $: noContactCount = matchResults.filter(m => m.contactMatchType === 'none').length;

  $: skipCount   = decisions.filter(d => d?.action === 'skip').length;
  $: createCount = decisions.filter(d => d?.action === 'create').length;
  $: updateCount = decisions.filter(d => d?.action === 'update').length;
</script>

<svelte:head><title>Import Corp Engagements</title></svelte:head>

<div class="container">
  <header>
    <div>
      <h1>Import Corp Engagements</h1>
      <p class="subtitle">Upload a CSV to import engagement records</p>
    </div>
    <a href="/corp/engagements" class="btn-secondary">← Back to Engagements</a>
  </header>

  {#if form?.success && form?.action === 'csv_confirm'}
    <div class="alert alert-success">✓ {form.message}</div>
  {/if}
  {#if form?.error}
    <div class="alert alert-error">✗ {form.error}</div>
  {/if}

  <!-- ── Step 1: Upload + preview ─────────────────────────────────────────── -->
  {#if !reviewMode}
    <div class="upload-card">
      <label for="fileInput" class="upload-label">CSV File</label>
      <input type="file" id="fileInput" accept=".csv" on:change={handleFileSelect} class="input-file" />
      <p class="upload-hint">Expected columns: title, company name, email, engagement type, pipeline status, contract status, engagement date, amount paid, notes, is archived</p>
    </div>

    {#if csvPreview && csvParsed.length > 0}
      <form method="POST" action="?/csv_check" use:enhance={() => {
        return async ({ result }) => {
          if (result.type === 'success' && /** @type {any} */ (result.data)?.action === 'csv_check') {
            const d = /** @type {any} */ (result.data);
            matchResults = d.matchResults;
            reviewMode = true;

            decisions = matchResults.map(m => {
              if (m.engMatchType === 'new') return { action: 'create', updateFields: [] };
              if (m.engMatchType === 'duplicate') {
                const updateFields = [];
                const csv = m.csv;
                const db  = m.dbEngagement;
                if (db) {
                  if (csv.engagement_type && csv.engagement_type !== db.engagement_type) updateFields.push('engagement_type');
                  if (csv.pipeline_status && csv.pipeline_status !== db.pipeline_status) updateFields.push('pipeline_status');
                  if (csv.contract_status && csv.contract_status !== db.contract_status) updateFields.push('contract_status');
                  if (csv.amount_paid !== '' && Number(csv.amount_paid) !== db.amount_paid) updateFields.push('amount_paid');
                  if (csv.notes && csv.notes !== db.notes) updateFields.push('notes');
                }
                return { action: 'skip', updateFields };
              }
              return { action: 'create', updateFields: [] };
            });
          }
        };
      }}>
        <input type="hidden" name="csv_data" value={JSON.stringify(csvParsed)} />

        <div class="preview-header">
          <h2 class="section-title">Preview — {csvParsed.length} rows</h2>
          <div class="preview-actions">
            <button type="submit" class="btn-primary">Check for Matches →</button>
            <button type="button" class="btn-secondary" on:click={() => { csvParsed = []; csvPreview = false; }}>Clear</button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Company</th>
                <th>Date</th>
                <th>Type</th>
                <th>Pipeline</th>
                <th class="num">Revenue</th>
                <th>Archived</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each csvParsed as row, i (i)}
                <tr class:archived={row.is_archived}>
                  <td class="row-num">{i + 1}</td>
                  <td class="title-cell">{row.title || '—'}</td>
                  <td>{row.company_name || '—'}</td>
                  <td>{row.engagement_date || '—'}</td>
                  <td><span class="type-tag">{row.engagement_type?.replace(/_/g,' ')}</span></td>
                  <td>{row.pipeline_status?.replace(/_/g,' ') || '—'}</td>
                  <td class="num">{fmt(row.amount_paid)}</td>
                  <td>{row.is_archived ? 'Yes' : '—'}</td>
                  <td>
                    <button type="button" class="btn-remove" on:click={() => removeRow(i)} title="Remove">×</button>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </form>
    {:else if csvPreview}
      <div class="alert alert-error">No valid rows found. Make sure the CSV has at least a title, company name, or date column.</div>
    {/if}
  {/if}

  <!-- ── Step 2: Review matches ───────────────────────────────────────────── -->
  {#if reviewMode && matchResults.length > 0}
    <form method="POST" action="?/csv_confirm" use:enhance={({ formData }) => {
      const builtDecisions = matchResults.map((match, i) => {
        const d = decisions[i];
        if (!d) return { action: 'skip', csv: match.csv };
        return {
          action:            d.action,
          csv:               match.csv,
          corp_contact_id:   d.corp_contact_id ?? match.dbContact?.corp_contact_id ?? null,
          corp_engagement_id: match.dbEngagement?.corp_engagement_id ?? null,
          updateFields:      d.updateFields || [],
        };
      });
      formData.set('decisions', JSON.stringify(builtDecisions));

      return async ({ result, update }) => {
        if (result.type === 'success') {
          reviewMode = false; csvPreview = false; csvParsed = []; matchResults = [];
          await update();
        }
      };
    }}>
      <input type="hidden" name="decisions" value="" />

      <div class="preview-header">
        <h2 class="section-title">Review — {matchResults.length} engagements</h2>
        <div class="review-badges">
          <span class="badge badge-new">{newCount} new</span>
          <span class="badge badge-dup">{dupCount} exact duplicate</span>
          <span class="badge badge-date">{sameDateCount} same date</span>
          {#if noContactCount > 0}
            <span class="badge badge-warn">{noContactCount} no contact match</span>
          {/if}
        </div>
      </div>

      <div class="action-summary">
        Will: <strong>{createCount} create</strong>, <strong>{updateCount} update</strong>, <strong>{skipCount} skip</strong>
        <button type="button" class="btn-link" on:click={() => { decisions = decisions.map((d, i) => ({ ...d, action: matchResults[i]?.engMatchType === 'duplicate' ? 'update' : 'create' })); }}>Accept all</button>
        <button type="button" class="btn-link" on:click={() => { decisions = decisions.map(d => ({ ...d, action: 'skip' })); }}>Skip all</button>
      </div>

      <div class="review-list">
        {#each matchResults as match, i (i)}
          <div class="review-card {match.engMatchType} {match.contactMatchType === 'none' ? 'no-contact' : ''}">
            <div class="review-header">
              <span class="row-num">#{i + 1}</span>
              <span class="eng-title">{match.csv.title || '(untitled)'}</span>
              <span class="eng-date">{match.csv.engagement_date || '—'}</span>
              <span class="eng-revenue">{fmt(match.csv.amount_paid)}</span>

              {#if match.engMatchType === 'new'}
                <span class="match-badge badge-new">New</span>
              {:else if match.engMatchType === 'duplicate'}
                <span class="match-badge badge-dup">Exact duplicate</span>
              {:else}
                <span class="match-badge badge-date">Same date / contact</span>
              {/if}
            </div>

            <!-- Contact matching -->
            <div class="contact-row">
              {#if match.dbContact}
                <span class="contact-matched">
                  ✓ Contact: <strong>{match.dbContact.company_name || [match.dbContact.first_name, match.dbContact.last_name].filter(Boolean).join(' ')}</strong>
                  ({match.contactMatchType === 'email' ? 'email match' : 'company match'})
                </span>
              {:else}
                <span class="contact-missing">⚠ No contact match for "{match.csv.company_name || match.csv.email || '?'}"</span>
                <select
                  class="input-select contact-override"
                  on:change={(e) => { decisions[i] = { ...decisions[i], corp_contact_id: /** @type {HTMLInputElement} */ (e.target).value ? parseInt(/** @type {HTMLInputElement} */ (e.target).value) : null }; }}
                >
                  <option value="">— Link to contact (optional) —</option>
                  {#each data.contacts as c}
                    <option value={c.corp_contact_id}>
                      {c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ')} {c.email ? '(' + c.email + ')' : ''}
                    </option>
                  {/each}
                </select>
              {/if}
            </div>

            <!-- Inline field overrides -->
            <div class="field-overrides">
              <label class="field-label">Type:
                <select class="input-select-sm" bind:value={csvParsed[match.index].engagement_type}>
                  {#each TYPES as [v, l]}<option value={v}>{l}</option>{/each}
                </select>
              </label>
              <label class="field-label">Pipeline:
                <select class="input-select-sm" bind:value={csvParsed[match.index].pipeline_status}>
                  {#each PIPELINES as [v, l]}<option value={v}>{l}</option>{/each}
                </select>
              </label>
              <label class="field-label">Contract:
                <select class="input-select-sm" bind:value={csvParsed[match.index].contract_status}>
                  {#each CONTRACTS as [v, l]}<option value={v}>{l}</option>{/each}
                </select>
              </label>
            </div>

            <!-- Action -->
            <div class="action-row">
              {#if match.engMatchType === 'new'}
                <label class="radio-label"><input type="radio" bind:group={decisions[i].action} value="create" /> Create engagement</label>
                <label class="radio-label"><input type="radio" bind:group={decisions[i].action} value="skip"   /> Skip</label>
              {:else if match.engMatchType === 'duplicate'}
                <label class="radio-label"><input type="radio" bind:group={decisions[i].action} value="skip"   /> Skip (keep existing)</label>
                <label class="radio-label"><input type="radio" bind:group={decisions[i].action} value="update" /> Update existing</label>
                <label class="radio-label"><input type="radio" bind:group={decisions[i].action} value="create" /> Create as duplicate</label>
              {:else}
                <span class="possible-dup">Possible duplicate — same contact + date:</span>
                <label class="radio-label"><input type="radio" bind:group={decisions[i].action} value="create" /> Create anyway</label>
                <label class="radio-label"><input type="radio" bind:group={decisions[i].action} value="skip"   /> Skip</label>
              {/if}
            </div>

            <!-- Diff fields when updating a duplicate -->
            {#if decisions[i].action === 'update' && match.dbEngagement}
              {@const diffs = [
                { field: 'engagement_type', label: 'Type',     db: match.dbEngagement.engagement_type, csv: match.csv.engagement_type },
                { field: 'pipeline_status', label: 'Pipeline', db: match.dbEngagement.pipeline_status, csv: match.csv.pipeline_status },
                { field: 'contract_status', label: 'Contract', db: match.dbEngagement.contract_status, csv: match.csv.contract_status },
                { field: 'amount_paid',     label: 'Revenue',  db: match.dbEngagement.amount_paid != null ? String(match.dbEngagement.amount_paid) : '', csv: match.csv.amount_paid !== '' ? String(match.csv.amount_paid) : '' },
                { field: 'notes',           label: 'Notes',    db: match.dbEngagement.notes, csv: match.csv.notes },
              ].filter(d => d.csv && String(d.csv) !== String(d.db || ''))}

              {#if diffs.length > 0}
                <div class="diff-section">
                  <div class="diff-title">Fields that differ — check to update:</div>
                  <div class="diff-table">
                    {#each diffs as diff (diff.field)}
                      <label class="diff-row">
                        <input type="checkbox" bind:group={decisions[i].updateFields} value={diff.field} />
                        <span class="diff-field">{diff.label}:</span>
                        <span class="diff-db">{diff.db || '(empty)'}</span>
                        <span class="diff-arrow">→</span>
                        <span class="diff-csv">{diff.csv}</span>
                      </label>
                    {/each}
                  </div>
                </div>
              {:else}
                <div class="no-diff">No differences found.</div>
              {/if}
            {/if}
          </div>
        {/each}
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary">Confirm Import</button>
        <button type="button" class="btn-secondary" on:click={() => { reviewMode = false; }}>← Back to Preview</button>
        <button type="button" class="btn-secondary" on:click={() => { reviewMode = false; csvPreview = false; csvParsed = []; matchResults = []; }}>Cancel</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
  h1 { font-size: 2rem; font-weight: 700; margin: 0 0 0.25rem; }
  .subtitle { color: #6b7280; margin: 0; }

  .alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
  .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .alert-error   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

  .upload-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 1.5rem; margin-bottom: 1.5rem; }
  .upload-label { display: block; font-weight: 600; font-size: 0.875rem; color: #374151; margin-bottom: 0.5rem; }
  .input-file { font-size: 0.9rem; }
  .upload-hint { margin: 0.75rem 0 0; font-size: 0.8rem; color: #9ca3af; }

  .preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem; }
  .section-title { font-size: 1.1rem; font-weight: 600; margin: 0; }
  .preview-actions { display: flex; gap: 0.75rem; }
  .review-badges { display: flex; gap: 0.5rem; flex-wrap: wrap; }

  .table-wrap { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); overflow-x: auto; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: #f9fafb; }
  th { padding: 0.625rem 0.75rem; text-align: left; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: #374151; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
  td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; vertical-align: middle; }
  tr.archived td { color: #bbb; }
  .row-num { color: #9ca3af; font-size: 0.8rem; text-align: center; }
  .title-cell { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .num { text-align: right; }
  .type-tag { font-size: 0.78rem; background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 0.25rem; white-space: nowrap; }

  .action-summary { font-size: 0.9rem; color: #374151; margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }

  .review-list { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .review-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 1rem 1.25rem; border-left: 4px solid #d1d5db; }
  .review-card.new       { border-left-color: #3b82f6; }
  .review-card.duplicate { border-left-color: #f59e0b; }
  .review-card.same_date { border-left-color: #f97316; }
  .review-card.no-contact { border-top: 2px dashed #fbbf24; }

  .review-header { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
  .eng-title { font-weight: 600; color: #1a202c; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .eng-date { font-size: 0.85rem; color: #6b7280; white-space: nowrap; }
  .eng-revenue { font-size: 0.85rem; font-weight: 600; color: #166534; white-space: nowrap; }

  .match-badge { padding: 0.2rem 0.6rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; margin-left: auto; white-space: nowrap; }
  .badge { padding: 0.3rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; }
  .badge-new  { background: #dbeafe; color: #1e40af; }
  .badge-dup  { background: #fef3c7; color: #92400e; }
  .badge-date { background: #ffedd5; color: #9a3412; }
  .badge-warn { background: #fee2e2; color: #991b1b; }

  .contact-row { font-size: 0.85rem; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
  .contact-matched { color: #065f46; }
  .contact-missing { color: #92400e; }
  .contact-override { font-size: 0.82rem; padding: 0.25rem 0.4rem; }

  .field-overrides { display: flex; gap: 1.25rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
  .field-label { font-size: 0.82rem; color: #6b7280; display: flex; align-items: center; gap: 0.35rem; }
  .input-select-sm { padding: 0.25rem 0.4rem; border: 1px solid #d1d5db; border-radius: 0.25rem; font-size: 0.82rem; background: white; }

  .action-row { display: flex; gap: 1.25rem; flex-wrap: wrap; align-items: center; }
  .possible-dup { font-size: 0.82rem; color: #92400e; font-weight: 500; }
  .radio-label { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; color: #374151; cursor: pointer; }
  .radio-label input { accent-color: #3b82f6; }

  .diff-section { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #f3f4f6; }
  .diff-title { font-size: 0.8rem; font-weight: 600; color: #6b7280; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.03em; }
  .diff-table { display: flex; flex-direction: column; gap: 0.35rem; }
  .diff-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; background: #fefce8; border-radius: 0.25rem; font-size: 0.85rem; cursor: pointer; }
  .diff-row:hover { background: #fef9c3; }
  .diff-row input { accent-color: #3b82f6; }
  .diff-field { font-weight: 600; color: #374151; min-width: 75px; }
  .diff-db  { color: #991b1b; background: #fee2e2; padding: 0.1rem 0.4rem; border-radius: 0.2rem; }
  .diff-arrow { color: #9ca3af; }
  .diff-csv { color: #166534; background: #dcfce7; padding: 0.1rem 0.4rem; border-radius: 0.2rem; }
  .no-diff { font-size: 0.85rem; color: #9ca3af; font-style: italic; margin-top: 0.5rem; }

  .input-select { padding: 0.35rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; background: white; }
  .form-actions { display: flex; gap: 1rem; align-items: center; }
  .btn-primary  { background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 1rem; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn-primary:hover { background: #2563eb; }
  .btn-secondary { background: #e5e7eb; color: #374151; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 1rem; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn-secondary:hover { background: #d1d5db; }
  .btn-remove { width: 1.5rem; height: 1.5rem; border-radius: 50%; border: none; background: #ef4444; color: white; font-size: 0.9rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .btn-remove:hover { background: #dc2626; }
  .btn-link { background: none; border: none; color: #3b82f6; font-size: 0.9rem; cursor: pointer; padding: 0; text-decoration: underline; }
  .btn-link:hover { color: #2563eb; }
</style>