<!-- src/routes/corp/import_contacts/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  export let data;
  export let form;

  // ── State ────────────────────────────────────────────────────────────────
  /** @type {any[]} */
  let csvParsed = [];
  let csvPreview = false;
  let reviewMode = false;
  /** @type {any[]} */
  let matchResults = [];
  /** @type {any[]} */
  let decisions = [];

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
      for (const n of names) {
        const i = header.indexOf(n);
        if (i !== -1) return i;
      }
      for (const n of names) {
        const i = header.findIndex(h => h.includes(n));
        if (i !== -1) return i;
      }
      return -1;
    };

    const colMap = {
      company_name:  col(['company name', 'company', 'organization', 'org']),
      first_name:    col(['first name', 'first', 'firstname', 'client first name']),
      last_name:     col(['last name', 'last', 'lastname', 'client last name']),
      email:         col(['email', 'email address', 'client email']),
      phone:         col(['phone', 'telephone', 'client phone']),
      address_line1: col(['address', 'address 1', 'address line 1', 'client address line 1', 'street']),
      address_line2: col(['address 2', 'address line 2', 'client address line 2', 'apt', 'suite']),
      city:          col(['city', 'client address city']),
      state:         col(['state', 'client address state']),
      zip:           col(['zip', 'zip code', 'postal', 'postal code', 'client address zip']),
      country:       col(['country', 'client address country']),
    };

    const parsed = [];
    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseCSVLine(rawLines[i]);
      if (cols.length < 2) continue;
      const g = (/** @type {number} */ idx) => idx === -1 ? '' : cleanVal(cols[idx]);
      const row = {
        company_name:  g(colMap.company_name),
        first_name:    g(colMap.first_name),
        last_name:     g(colMap.last_name),
        email:         g(colMap.email),
        phone:         formatPhone(g(colMap.phone)),
        address_line1: g(colMap.address_line1),
        address_line2: g(colMap.address_line2),
        city:          g(colMap.city),
        state:         g(colMap.state),
        zip:           g(colMap.zip),
        country:       g(colMap.country),
      };
      if (!row.email && !row.company_name) continue;
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
    if (val === undefined || val === null) return '';
    return val.replace(/^["'\s]+|["'\s]+$/g, '').trim();
  }

  /** @param {number} index */
  function removeRow(index) {
    csvParsed = csvParsed.filter((_, i) => i !== index);
  }

  // ── Phone formatting ─────────────────────────────────────────────────────
  /** @param {string} raw */
  function formatPhone(raw) {
    if (!raw) return '';
    // Strip everything except digits and leading +
    const hasPlus = raw.trim().startsWith('+');
    const digits = raw.replace(/\D/g, '');

    if (!digits) return raw; // nothing to format, return as-is

    // International: 11+ digits starting with country code
    // e.g. +1-713-555-1234  or  +44-20-1234-5678
    if (hasPlus || digits.length > 10) {
      // Split off country code (1–3 digits) then format remainder
      if (digits.length === 11 && digits[0] === '1') {
        // North America +1
        return `+1-${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7,11)}`;
      }
      // Generic international: +CC-rest (CC = first 1–3 digits)
      // Heuristic: if 11 digits, CC=1 digit; 12 digits CC=2; 13 digits CC=3
      const ccLen = digits.length - 10;
      if (ccLen >= 1 && ccLen <= 3) {
        const cc = digits.slice(0, ccLen);
        const rest = digits.slice(ccLen);
        return `+${cc}-${rest.slice(0,3)}-${rest.slice(3,6)}-${rest.slice(6)}`;
      }
      // Fallback: just return with + prefix
      return `+${digits}`;
    }

    // Domestic 10-digit
    if (digits.length === 10) {
      return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
    }

    // 7-digit (local, no area code)
    if (digits.length === 7) {
      return `${digits.slice(0,3)}-${digits.slice(3,7)}`;
    }

    // Anything else: return cleaned digits
    return digits;
  }

  // ── Email validation ─────────────────────────────────────────────────────
  /** @param {string} email */
  function isValidEmail(email) {
    if (!email) return true; // blank is not flagged — missing, not malformed
    // Must have exactly one @, something before it, a dot after, and a TLD
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  }

  // ── Computed summaries ───────────────────────────────────────────────────
  $: newCount      = matchResults.filter(m => m.matchType === 'new').length;
  $: emailCount    = matchResults.filter(m => m.matchType === 'email_match').length;
  $: companyCount  = matchResults.filter(m => m.matchType === 'company_match').length;

  $: skipCount     = decisions.filter(d => d?.action === 'skip').length;
  $: createCount   = decisions.filter(d => d?.action === 'create').length;
  $: updateCount   = decisions.filter(d => d?.action === 'update').length;
</script>

<svelte:head><title>Import Corp Contacts</title></svelte:head>

<div class="container">
  <header>
    <div>
      <h1>Import Corp Contacts</h1>
      <p class="subtitle">Upload a CSV to add or update corporate contacts</p>
    </div>
    <a href="/corp/contacts" class="btn-secondary">← Back to Contacts</a>
  </header>

  {#if form?.success && form?.action === 'csv_confirm'}
    <div class="alert alert-success">✓ {form.message}</div>
  {/if}
  {#if form?.error}
    <div class="alert alert-error">✗ {form.error}</div>
  {/if}

  <!-- ── Step 1: File upload + preview ───────────────────────────────────── -->
  {#if !reviewMode}
    <div class="upload-card">
      <label for="fileInput" class="upload-label">CSV File</label>
      <input type="file" id="fileInput" accept=".csv" on:change={handleFileSelect} class="input-file" />
      <p class="upload-hint">Expected columns: company name, first name, last name, email, phone, address, city, state, zip</p>
    </div>

    {#if csvPreview && csvParsed.length > 0}
      <form method="POST" action="?/csv_check" use:enhance={() => {
        return async ({ result }) => {
          if (result.type === 'success' && /** @type {any} */ (result.data)?.action === 'csv_check') {
            const d = /** @type {any} */ (result.data);
            matchResults = d.matchResults;
            reviewMode = true;

            decisions = matchResults.map(m => {
              if (m.matchType === 'new') return { action: 'create', updateFields: [] };

              // Pre-check differing fields
              const updateFields = [];
              if (m.dbContact) {
                if (m.csv.company_name && m.csv.company_name.toLowerCase() !== (m.dbContact.company_name || '').toLowerCase()) updateFields.push('company_name');
                if (m.csv.first_name  && m.csv.first_name.toLowerCase()  !== (m.dbContact.first_name  || '').toLowerCase()) updateFields.push('first_name');
                if (m.csv.last_name   && m.csv.last_name.toLowerCase()   !== (m.dbContact.last_name   || '').toLowerCase()) updateFields.push('last_name');
                if (m.csv.phone       && m.csv.phone !== (m.dbContact.phone || '')) updateFields.push('phone');
                if (m.csv.city        && m.csv.city !== (m.dbContact.city  || '')) updateFields.push('city');
                if (m.csv.state       && m.csv.state !== (m.dbContact.state || '')) updateFields.push('state');
              }
              return { action: 'update', updateFields };
            });
          }
        };
      }}>
        <input type="hidden" name="csv_data" value={JSON.stringify(csvParsed)} />

        <div class="preview-header">
          <h2 class="section-title">Preview — {csvParsed.length} rows</h2>
          <div class="preview-actions">
            {#if csvParsed.filter(r => r.email && !isValidEmail(r.email)).length > 0}
              <span class="email-warn-count">
                ⚠ {csvParsed.filter(r => r.email && !isValidEmail(r.email)).length} invalid email{csvParsed.filter(r => r.email && !isValidEmail(r.email)).length !== 1 ? 's' : ''}
              </span>
            {/if}
            <button type="submit" class="btn-primary">Check for Matches →</button>
            <button type="button" class="btn-secondary" on:click={() => { csvParsed = []; csvPreview = false; }}>Clear</button>
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Company</th>
                <th>First</th>
                <th>Last</th>
                <th>Email</th>
                <th>Phone</th>
                <th>City</th>
                <th>State</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each csvParsed as row, i (i)}
                {@const emailBad = row.email && !isValidEmail(row.email)}
                <tr class:email-warn={emailBad}>
                  <td class="row-num">{i + 1}</td>
                  <td>{row.company_name || '—'}</td>
                  <td>{row.first_name || '—'}</td>
                  <td>{row.last_name || '—'}</td>
                  <td class="email-cell" class:email-invalid={emailBad}>
                    {row.email || '—'}
                    {#if emailBad}<span class="email-warn-icon" title="Email format looks invalid">⚠</span>{/if}
                  </td>
                  <td>{row.phone || '—'}</td>
                  <td>{row.city || '—'}</td>
                  <td>{row.state || '—'}</td>
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
      <div class="alert alert-error">No valid rows found. Make sure the CSV has at least an email or company name column.</div>
    {/if}
  {/if}

  <!-- ── Step 2: Review matches ───────────────────────────────────────────── -->
  {#if reviewMode && matchResults.length > 0}
    <form method="POST" action="?/csv_confirm" use:enhance={({ formData }) => {
      const builtDecisions = matchResults.map((match, i) => {
        const d = decisions[i];
        if (!d) return { action: 'skip', csv: match.csv };
        return {
          action: d.action,
          csv: match.csv,
          corp_contact_id: match.dbContact?.corp_contact_id ?? null,
          updateFields: d.updateFields || [],
        };
      });
      formData.set('decisions', JSON.stringify(builtDecisions));

      return async ({ result, update }) => {
        if (result.type === 'success') {
          reviewMode = false;
          csvPreview = false;
          csvParsed = [];
          matchResults = [];
          await update();
        }
      };
    }}>
      <input type="hidden" name="decisions" value="" />

      <div class="preview-header">
        <h2 class="section-title">Review — {matchResults.length} contacts</h2>
        <div class="review-badges">
          <span class="badge badge-new">{newCount} new</span>
          <span class="badge badge-email">{emailCount} email match</span>
          <span class="badge badge-company">{companyCount} company match</span>
        </div>
      </div>

      <div class="action-summary">
        Will: <strong>{createCount} create</strong>, <strong>{updateCount} update</strong>, <strong>{skipCount} skip</strong>
        <button type="button" class="btn-link" on:click={() => { decisions = decisions.map(d => ({ ...d, action: d.action === 'skip' ? (matchResults[decisions.indexOf(d)]?.matchType === 'new' ? 'create' : 'update') : d.action })); }}>Accept all</button>
        <button type="button" class="btn-link" on:click={() => { decisions = decisions.map(d => ({ ...d, action: 'skip' })); }}>Skip all</button>
      </div>

      <div class="review-list">
        {#each matchResults as match, i (i)}
          <div class="review-card {match.matchType}">
            <div class="review-header">
              <span class="row-num">#{i + 1}</span>
              <span class="contact-name">
                {match.csv.company_name || [match.csv.first_name, match.csv.last_name].filter(Boolean).join(' ') || '(unnamed)'}
              </span>
              <span class="contact-email">{match.csv.email || '—'}</span>

              {#if match.matchType === 'new'}
                <span class="match-badge badge-new">New</span>
              {:else if match.matchType === 'email_match'}
                <span class="match-badge badge-email">Email match</span>
              {:else}
                <span class="match-badge badge-company">Company match</span>
              {/if}

              {#if match.dbContact}
                <div class="db-info">
                  DB: {match.dbContact.company_name || ''} — {[match.dbContact.first_name, match.dbContact.last_name].filter(Boolean).join(' ')} {match.dbContact.email ? '· ' + match.dbContact.email : ''}
                </div>
              {/if}
            </div>

            <!-- Action choice -->
            <div class="action-row">
              {#if match.matchType === 'new'}
                <label class="radio-label">
                  <input type="radio" bind:group={decisions[i].action} value="create" /> Create contact
                </label>
                <label class="radio-label">
                  <input type="radio" bind:group={decisions[i].action} value="skip" /> Skip
                </label>
              {:else}
                <label class="radio-label">
                  <input type="radio" bind:group={decisions[i].action} value="update" /> Update existing
                </label>
                <label class="radio-label">
                  <input type="radio" bind:group={decisions[i].action} value="skip" /> Skip
                </label>
              {/if}
            </div>

            <!-- Diff fields (shown when updating an existing contact) -->
            {#if (decisions[i].action === 'update') && match.dbContact}
              {@const diffs = [
                { field: 'company_name', label: 'Company',   db: match.dbContact.company_name, csv: match.csv.company_name },
                { field: 'first_name',  label: 'First Name', db: match.dbContact.first_name,   csv: match.csv.first_name },
                { field: 'last_name',   label: 'Last Name',  db: match.dbContact.last_name,    csv: match.csv.last_name },
                { field: 'phone',       label: 'Phone',      db: match.dbContact.phone,         csv: match.csv.phone },
                { field: 'city',        label: 'City',       db: match.dbContact.city,          csv: match.csv.city },
                { field: 'state',       label: 'State',      db: match.dbContact.state,         csv: match.csv.state },
                { field: 'address_line1', label: 'Address',  db: match.dbContact.address_line1, csv: match.csv.address_line1 },
                { field: 'zip',         label: 'Zip',        db: match.dbContact.zip,           csv: match.csv.zip },
              ].filter(d => d.csv && d.csv.toLowerCase() !== (d.db || '').toLowerCase())}

              {#if diffs.length > 0}
                <div class="diff-section">
                  <div class="diff-title">Differing fields — check to update from CSV:</div>
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
                  <p class="diff-note">Empty DB fields will be filled automatically regardless of selection above.</p>
                </div>
              {:else}
                <div class="no-diff">No field differences — existing record will have empty fields filled in.</div>
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
  .review-badges { display: flex; gap: 0.5rem; }

  .table-wrap { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); overflow-x: auto; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: #f9fafb; }
  th { padding: 0.625rem 0.75rem; text-align: left; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: #374151; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
  td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; vertical-align: middle; }
  .row-num { color: #9ca3af; font-size: 0.8rem; text-align: center; }
  .email-cell { color: #6b7280; font-size: 0.82rem; }

  tr.email-warn { background-color: #fffbeb; }
  tr.email-warn:hover { background-color: #fef3c7; }
  .email-invalid { color: #92400e !important; font-weight: 500; }
  .email-warn-icon { margin-left: 0.3rem; color: #d97706; font-size: 0.85rem; cursor: help; }
  .email-warn-count { font-size: 0.875rem; font-weight: 600; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; padding: 0.35rem 0.75rem; border-radius: 0.375rem; }

  .action-summary { font-size: 0.9rem; color: #374151; margin-bottom: 1rem; display: flex; align-items: center; gap: 1rem; }

  .review-list { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
  .review-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 1rem 1.25rem; border-left: 4px solid #d1d5db; }
  .review-card.new             { border-left-color: #3b82f6; }
  .review-card.email_match     { border-left-color: #10b981; }
  .review-card.company_match   { border-left-color: #f59e0b; }

  .review-header { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
  .contact-name { font-weight: 600; color: #1a202c; }
  .contact-email { font-size: 0.85rem; color: #6b7280; }
  .db-info { font-size: 0.8rem; color: #9ca3af; width: 100%; margin-top: 0.1rem; }

  .match-badge { padding: 0.2rem 0.6rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; margin-left: auto; }
  .badge-new     { background: #dbeafe; color: #1e40af; }
  .badge-email   { background: #dcfce7; color: #166534; }
  .badge-company { background: #fef3c7; color: #92400e; }

  .action-row { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  .radio-label { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; color: #374151; cursor: pointer; }
  .radio-label input { accent-color: #3b82f6; }

  .diff-section { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid #f3f4f6; }
  .diff-title { font-size: 0.8rem; font-weight: 600; color: #6b7280; margin-bottom: 0.5rem; text-transform: uppercase; letter-spacing: 0.03em; }
  .diff-table { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.5rem; }
  .diff-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.35rem 0.5rem; background: #fefce8; border-radius: 0.25rem; font-size: 0.85rem; cursor: pointer; }
  .diff-row:hover { background: #fef9c3; }
  .diff-row input { accent-color: #3b82f6; }
  .diff-field { font-weight: 600; color: #374151; min-width: 90px; }
  .diff-db  { color: #991b1b; background: #fee2e2; padding: 0.1rem 0.4rem; border-radius: 0.2rem; }
  .diff-arrow { color: #9ca3af; }
  .diff-csv { color: #166534; background: #dcfce7; padding: 0.1rem 0.4rem; border-radius: 0.2rem; }
  .diff-note { font-size: 0.78rem; color: #9ca3af; margin: 0.25rem 0 0; }
  .no-diff { font-size: 0.85rem; color: #9ca3af; font-style: italic; margin-top: 0.5rem; }

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