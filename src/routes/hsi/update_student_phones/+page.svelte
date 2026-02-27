<!-- src/routes/hsi/update_student_phones/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  import { base } from '$app/paths';

  export let data;
  export let form;

  // CSV State
  let csvFile = null;
  let csvParsed = [];
  let csvPreview = false;
  let csvDataJson = '';

  // Review state
  let reviewMode = false;
  let matchResults = [];
  let decisions = [];

  // Summary counts
  $: matchedCount = matchResults.filter(r => r.matchType !== 'not_found').length;
  $: notFoundCount = matchResults.filter(r => r.matchType === 'not_found').length;
  $: changesCount = matchResults.filter(r => r.hasChanges).length;
  $: noChangeCount = matchResults.filter(r => r.matchType !== 'not_found' && !r.hasChanges).length;

  // When form returns from csv_check, populate review
  $: if (form?.action === 'csv_check' && form?.success) {
    matchResults = form.matchResults;
    reviewMode = true;
    // Default: update all fields that differ
    decisions = matchResults.map(r => ({
      index: r.index,
      student_id: r.dbStudent?.student_id || null,
      action: r.matchType === 'not_found' ? 'skip' : (r.hasChanges ? 'update' : 'skip'),
      updatePhone: r.phoneDiff,
      updateMobile: r.mobileDiff,
      phone: r.csv.phone,
      mobile_phone: r.csv.mobile_phone
    }));
  }

  // When form returns from csv_confirm, clear state
  $: if (form?.action === 'csv_confirm' && form?.success) {
    reviewMode = false;
    matchResults = [];
    decisions = [];
    csvParsed = [];
    csvPreview = false;
    csvDataJson = '';
    csvFile = null;
  }

  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    csvFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      parseCSV(e.target.result);
    };
    reader.readAsText(file);
  }

  function parseCSV(text) {
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const rawLines = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        inQuotes = !inQuotes;
        current += char;
      } else if (char === '\n' && !inQuotes) {
        if (current.trim()) rawLines.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    if (current.trim()) rawLines.push(current);

    if (rawLines.length < 2) {
      csvParsed = [];
      return;
    }

    const header = parseCSVLine(rawLines[0]).map(h =>
      h.replace(/["'\r\n]+/g, '').trim().toLowerCase()
    );

    const colMap = {
      email: findCol(header, ['email', 'email address', 'e-mail']),
      first_name: findCol(header, ['first name', 'first', 'firstname']),
      last_name: findCol(header, ['last name', 'last', 'lastname']),
      phone: findCol(header, ['phone', 'telephone', 'home phone']),
      mobile_phone: findCol(header, ['mobile phone', 'mobile', 'cell', 'cell phone']),
      acct_id: findCol(header, ['acctid', 'acct id', 'account id', 'vbo id', 'vbo account'])
    };

    // Check we found at least one phone column
    if (colMap.phone === -1 && colMap.mobile_phone === -1) {
      alert('No phone or mobile phone column found in CSV. Expected columns: Phone, Mobile Phone, Cell, etc.');
      csvParsed = [];
      return;
    }

    const parsed = [];
    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseCSVLine(rawLines[i]);
      if (cols.length < 2) continue;

      const row = {
        email: cleanVal(cols[colMap.email]),
        first_name: cleanVal(cols[colMap.first_name]),
        last_name: cleanVal(cols[colMap.last_name]),
        phone: cleanPhone(cols[colMap.phone]),
        mobile_phone: cleanPhone(cols[colMap.mobile_phone]),
        acct_id: cleanVal(cols[colMap.acct_id])
      };

      if (row.acct_id === '0') row.acct_id = '';
      if (!row.email && !row.acct_id && (!row.first_name || !row.last_name)) continue;
      if (!row.phone && !row.mobile_phone) continue;

      parsed.push(row);
    }

    csvParsed = parsed;
    csvPreview = true;
    csvDataJson = JSON.stringify(parsed);

    // Reset review state
    reviewMode = false;
    matchResults = [];
    decisions = [];
  }

  function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);
    return result;
  }

  function findCol(header, names) {
    for (const name of names) {
      const idx = header.indexOf(name);
      if (idx !== -1) return idx;
    }
    for (const name of names) {
      const idx = header.findIndex(h => h.includes(name));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  function cleanVal(val) {
    if (val === undefined || val === null) return '';
    return val.replace(/^["'\s]+|["'\s]+$/g, '').replace(/^\d+\.\s*$/, '').trim();
  }

  function cleanPhone(val) {
    if (val === undefined || val === null) return '';
    val = val.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    if (!val || val === '+1-' || val === '+1') return '';
    return val;
  }

  function formatPhoneDisplay(phone) {
    if (!phone) return '—';
    // Normalize to digits only
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0,3)}) ${digits.slice(3,6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
      return `(${digits.slice(1,4)}) ${digits.slice(4,7)}-${digits.slice(7)}`;
    }
    return phone;
  }

  function togglePhoneUpdate(idx) {
    decisions[idx].updatePhone = !decisions[idx].updatePhone;
    decisions[idx].action = (decisions[idx].updatePhone || decisions[idx].updateMobile) ? 'update' : 'skip';
    decisions = [...decisions];
  }

  function toggleMobileUpdate(idx) {
    decisions[idx].updateMobile = !decisions[idx].updateMobile;
    decisions[idx].action = (decisions[idx].updatePhone || decisions[idx].updateMobile) ? 'update' : 'skip';
    decisions = [...decisions];
  }

  function selectAll() {
    decisions = decisions.map((d, i) => {
      const r = matchResults[i];
      if (r.matchType === 'not_found') return d;
      return { ...d, updatePhone: r.phoneDiff, updateMobile: r.mobileDiff, action: r.hasChanges ? 'update' : 'skip' };
    });
  }

  function deselectAll() {
    decisions = decisions.map(d => ({ ...d, updatePhone: false, updateMobile: false, action: 'skip' }));
  }

  $: updateCount = decisions.filter(d => d.action === 'update').length;
</script>

<svelte:head>
  <title>Update Student Phones | HSI</title>
</svelte:head>

<div class="container" data-sveltekit-reload>
  <header>
    <div>
      <a href="{base}/hsi/classes" class="breadcrumb">← HSI</a>
      <h1>Update Student Phone Numbers</h1>
      <p class="subtitle">Import phone and mobile numbers from CSV registration files</p>
    </div>
  </header>

  <!-- Status Messages -->
  {#if form?.success && form?.action === 'csv_confirm'}
    <div class="alert alert-success">✓ {form.message}</div>
  {/if}
  {#if form?.error}
    <div class="alert alert-error">✗ {form.error}</div>
  {/if}

  {#if !reviewMode}
    <!-- CSV Upload -->
    <div class="card">
      <h2>Upload CSV File</h2>
      <p class="card-desc">Select a VBO registration CSV file. The file should have Phone and/or Mobile Phone columns along with Email, First Name, Last Name, or AcctID for matching.</p>

      <div class="upload-area">
        <input type="file" accept=".csv" on:change={handleFileSelect} class="file-input" id="csvFileInput" />
        <label for="csvFileInput" class="file-label">
          {csvFile ? csvFile.name : 'Choose CSV file...'}
        </label>
      </div>

      {#if csvPreview && csvParsed.length > 0}
        <div class="preview-section">
          <h3>Preview — {csvParsed.length} rows with phone data</h3>
          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>AcctID</th>
                  <th>Phone</th>
                  <th>Mobile Phone</th>
                </tr>
              </thead>
              <tbody>
                {#each csvParsed.slice(0, 20) as row, i}
                  <tr>
                    <td class="row-num">{i + 1}</td>
                    <td>{row.first_name} {row.last_name}</td>
                    <td>{row.email || '—'}</td>
                    <td class="mono">{row.acct_id || '—'}</td>
                    <td>{formatPhoneDisplay(row.phone) || '—'}</td>
                    <td>{formatPhoneDisplay(row.mobile_phone) || '—'}</td>
                  </tr>
                {/each}
                {#if csvParsed.length > 20}
                  <tr><td colspan="6" class="more-rows">...and {csvParsed.length - 20} more rows</td></tr>
                {/if}
              </tbody>
            </table>
          </div>

          <form method="POST" action="?/csv_check" use:enhance>
            <input type="hidden" name="csv_data" value={csvDataJson} />
            <div class="action-bar">
              <button type="submit" class="btn-primary">Match Students & Review</button>
            </div>
          </form>
        </div>
      {/if}
    </div>
  {:else}
    <!-- Review Mode -->
    <div class="card">
      <h2>Review Matches</h2>

      <div class="review-summary">
        <span class="review-badge badge-match">{matchedCount} Matched</span>
        <span class="review-badge badge-changes">{changesCount} With Changes</span>
        <span class="review-badge badge-nochange">{noChangeCount} Already Current</span>
        {#if notFoundCount > 0}
          <span class="review-badge badge-notfound">{notFoundCount} Not Found</span>
        {/if}
      </div>

      <div class="bulk-actions">
        <button class="btn-small" on:click={selectAll}>Select All Changes</button>
        <button class="btn-small btn-small-secondary" on:click={deselectAll}>Deselect All</button>
        <span class="update-count">{updateCount} student{updateCount !== 1 ? 's' : ''} will be updated</span>
      </div>

      <div class="review-list">
        {#each matchResults as result, i (result.index)}
          <div class="review-card {result.matchType}" class:no-changes={!result.hasChanges && result.matchType !== 'not_found'}>
            <div class="review-header">
              <span class="review-num">#{i + 1}</span>
              <span class="review-name">{result.csv.first_name} {result.csv.last_name}</span>
              <span class="review-email">{result.csv.email}</span>
              {#if result.csv.acct_id}
                <span class="acctid-tag">{result.csv.acct_id}</span>
              {/if}
              <span class="match-badge badge-{result.matchType}">
                {#if result.matchType === 'acctid_match'}AcctID Match
                {:else if result.matchType === 'email_match'}Email Match
                {:else if result.matchType === 'name_match'}Name Match
                {:else}Not Found
                {/if}
              </span>
            </div>

            {#if result.matchType === 'not_found'}
              <p class="not-found-msg">No matching student found in database. Skipping.</p>
            {:else if !result.hasChanges}
              <p class="no-change-msg">Phone numbers already match — no update needed.</p>
              {#if result.dbStudent}
                <div class="current-phones">
                  <span>Phone: {formatPhoneDisplay(result.dbStudent.phone)}</span>
                  <span>Mobile: {formatPhoneDisplay(result.dbStudent.mobile_phone)}</span>
                </div>
              {/if}
            {:else}
              <!-- Show diffs -->
              {#if result.dbStudent}
                <div class="db-student-info">
                  DB: {result.dbStudent.first_name} {result.dbStudent.last_name} · {result.dbStudent.email}
                </div>
              {/if}

              <div class="diff-section">
                {#if result.phoneDiff}
                  <label class="diff-row" on:click={() => togglePhoneUpdate(i)}>
                    <input type="checkbox" checked={decisions[i]?.updatePhone} on:click|stopPropagation={() => togglePhoneUpdate(i)} />
                    <span class="diff-field">Phone</span>
                    <span class="diff-db">{formatPhoneDisplay(result.dbStudent?.phone) || '(empty)'}</span>
                    <span class="diff-arrow">→</span>
                    <span class="diff-csv">{formatPhoneDisplay(result.csv.phone)}</span>
                  </label>
                {/if}
                {#if result.mobileDiff}
                  <label class="diff-row" on:click={() => toggleMobileUpdate(i)}>
                    <input type="checkbox" checked={decisions[i]?.updateMobile} on:click|stopPropagation={() => toggleMobileUpdate(i)} />
                    <span class="diff-field">Mobile</span>
                    <span class="diff-db">{formatPhoneDisplay(result.dbStudent?.mobile_phone) || '(empty)'}</span>
                    <span class="diff-arrow">→</span>
                    <span class="diff-csv">{formatPhoneDisplay(result.csv.mobile_phone)}</span>
                  </label>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </div>

      <form method="POST" action="?/csv_confirm" use:enhance>
        <input type="hidden" name="decisions" value={JSON.stringify(decisions)} />
        <div class="action-bar">
          <button type="submit" class="btn-primary" disabled={updateCount === 0}>
            Update {updateCount} Student{updateCount !== 1 ? 's' : ''}
          </button>
          <button type="button" class="btn-secondary" on:click={() => { reviewMode = false; }}>
            ← Back to Upload
          </button>
        </div>
      </form>
    </div>
  {/if}
</div>

<style>
  .container {
    max-width: 1100px;
    margin: 0 auto;
    padding: 2rem;
  }

  header { margin-bottom: 1.5rem; }
  .breadcrumb { color: #6366f1; text-decoration: none; font-size: 0.85rem; }
  .breadcrumb:hover { text-decoration: underline; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0.5rem 0 0 0; }
  h2 { font-size: 1.2rem; font-weight: 600; color: #374151; margin: 0 0 0.75rem 0; }
  h3 { font-size: 1rem; font-weight: 600; color: #374151; margin: 1.25rem 0 0.75rem 0; }
  .subtitle { color: #6b7280; margin: 0.25rem 0 0 0; font-size: 0.9rem; }
  .card-desc { color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem; }

  .card {
    background: white;
    padding: 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    margin-bottom: 1.5rem;
  }

  /* Alerts */
  .alert {
    padding: 0.75rem 1rem;
    border-radius: 0.375rem;
    margin-bottom: 1.5rem;
    font-size: 0.9rem;
    font-weight: 500;
  }
  .alert-success { background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; }
  .alert-error { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; }

  /* Upload */
  .upload-area { margin-bottom: 1rem; }
  .file-input { display: none; }
  .file-label {
    display: inline-block;
    padding: 0.75rem 1.5rem;
    background: #f3f4f6;
    border: 2px dashed #d1d5db;
    border-radius: 0.5rem;
    cursor: pointer;
    font-size: 0.9rem;
    color: #374151;
    transition: all 0.2s;
  }
  .file-label:hover { background: #e5e7eb; border-color: #9ca3af; }

  /* Preview Table */
  .table-wrapper { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  thead { background-color: #f9fafb; }
  th {
    padding: 0.6rem 0.75rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    border-bottom: 2px solid #e5e7eb;
    white-space: nowrap;
  }
  td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid #f3f4f6;
    color: #1a202c;
    font-size: 0.85rem;
  }
  tr:hover td { background-color: #f9fafb; }
  .row-num { color: #9ca3af; font-size: 0.8rem; }
  .mono { font-family: monospace; font-size: 0.8rem; }
  .more-rows { text-align: center; color: #6b7280; font-style: italic; padding: 0.75rem; }

  /* Action Bar */
  .action-bar {
    display: flex;
    gap: 0.75rem;
    align-items: center;
    margin-top: 1.25rem;
    padding-top: 1rem;
    border-top: 1px solid #f3f4f6;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    font-weight: 600;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .btn-primary:hover { background-color: #2563eb; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

  .btn-secondary {
    background-color: #e5e7eb;
    color: #374151;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    font-weight: 500;
    font-size: 0.95rem;
    cursor: pointer;
  }
  .btn-secondary:hover { background-color: #d1d5db; }

  /* Review Summary */
  .review-summary {
    display: flex;
    gap: 0.75rem;
    margin-bottom: 1rem;
    flex-wrap: wrap;
  }
  .review-badge {
    padding: 0.4rem 0.85rem;
    border-radius: 9999px;
    font-size: 0.85rem;
    font-weight: 600;
  }
  .badge-match { background: #dbeafe; color: #1e40af; }
  .badge-changes { background: #fef3c7; color: #92400e; }
  .badge-nochange { background: #f3f4f6; color: #6b7280; }
  .badge-notfound { background: #fef2f2; color: #991b1b; }

  /* Bulk Actions */
  .bulk-actions {
    display: flex;
    gap: 0.5rem;
    align-items: center;
    margin-bottom: 1.25rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #f3f4f6;
  }
  .btn-small {
    padding: 0.35rem 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid #d1d5db;
    background: white;
    font-size: 0.8rem;
    cursor: pointer;
    color: #374151;
  }
  .btn-small:hover { background: #f3f4f6; }
  .btn-small-secondary { color: #6b7280; }
  .update-count {
    margin-left: auto;
    font-size: 0.85rem;
    color: #6b7280;
    font-weight: 500;
  }

  /* Review Cards */
  .review-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .review-card {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    padding: 0.85rem 1rem;
    border-left: 4px solid #d1d5db;
    border: 1px solid #e5e7eb;
  }
  .review-card.acctid_match { border-left-color: #3b82f6; }
  .review-card.email_match { border-left-color: #10b981; }
  .review-card.name_match { border-left-color: #f59e0b; }
  .review-card.not_found { border-left-color: #ef4444; opacity: 0.6; }
  .review-card.no-changes { opacity: 0.6; }

  .review-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }
  .review-num { color: #9ca3af; font-size: 0.8rem; font-weight: 600; }
  .review-name { font-weight: 600; color: #1a202c; font-size: 0.9rem; }
  .review-email { color: #6b7280; font-size: 0.8rem; }
  .acctid-tag {
    display: inline-block;
    padding: 0.1rem 0.4rem;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    background-color: #dbeafe;
    color: #1e40af;
    font-family: monospace;
  }
  .match-badge {
    padding: 0.15rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    margin-left: auto;
  }
  .badge-acctid_match { background: #dbeafe; color: #1e40af; }
  .badge-email_match { background: #dcfce7; color: #166534; }
  .badge-name_match { background: #fef3c7; color: #92400e; }
  .badge-not_found { background: #fef2f2; color: #991b1b; }

  .db-student-info { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.5rem; }
  .not-found-msg { font-size: 0.85rem; color: #991b1b; margin: 0; }
  .no-change-msg { font-size: 0.85rem; color: #6b7280; margin: 0 0 0.25rem 0; }
  .current-phones {
    display: flex;
    gap: 1.5rem;
    font-size: 0.8rem;
    color: #9ca3af;
  }

  /* Diff Rows */
  .diff-section {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-top: 0.5rem;
  }
  .diff-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.4rem 0.5rem;
    background-color: #fefce8;
    border-radius: 0.25rem;
    font-size: 0.85rem;
    cursor: pointer;
  }
  .diff-row:hover { background-color: #fef9c3; }
  .diff-row input[type="checkbox"] { accent-color: #3b82f6; }
  .diff-field { font-weight: 600; color: #374151; min-width: 60px; }
  .diff-db {
    color: #991b1b;
    background-color: #fee2e2;
    padding: 0.1rem 0.4rem;
    border-radius: 0.2rem;
    font-family: monospace;
    font-size: 0.8rem;
  }
  .diff-arrow { color: #9ca3af; }
  .diff-csv {
    color: #166534;
    background-color: #dcfce7;
    padding: 0.1rem 0.4rem;
    border-radius: 0.2rem;
    font-family: monospace;
    font-size: 0.8rem;
  }

  @media (max-width: 768px) {
    .container { padding: 1rem; }
    .review-header { flex-direction: column; align-items: flex-start; }
    .match-badge { margin-left: 0; }
    .bulk-actions { flex-direction: column; align-items: flex-start; }
    .update-count { margin-left: 0; }
  }
</style>