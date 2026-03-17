<!-- src/routes/corp/import/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  export let data;
  export let form;

  // ── Constants ────────────────────────────────────────────────────────────
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
  let csvParsed     = [];
  let csvPreview    = false;
  let reviewMode    = false;

  /** @type {any[]} */
  let contactMatches  = [];
  /** @type {any[]} */
  let engagements     = [];
  /** @type {any[]} */
  let contactDecisions = [];
  /** @type {any[]} */
  let engagementDecisions = [];

  let activeTab = 'contacts'; // 'contacts' | 'engagements' during review

  /** @type {HTMLFormElement|undefined} */
  let resetForm;

  // ── Phone formatting ─────────────────────────────────────────────────────
  /** @param {string} raw */
  function formatPhone(raw) {
    if (!raw) return '';
    const hasPlus = raw.trim().startsWith('+');
    const digits  = raw.replace(/\D/g, '');
    if (!digits) return raw;
    if (hasPlus || digits.length > 10) {
      if (digits.length === 11 && digits[0] === '1') {
        return `+1-${digits.slice(1,4)}-${digits.slice(4,7)}-${digits.slice(7,11)}`;
      }
      const ccLen = digits.length - 10;
      if (ccLen >= 1 && ccLen <= 3) {
        const cc   = digits.slice(0, ccLen);
        const rest = digits.slice(ccLen);
        return `+${cc}-${rest.slice(0,3)}-${rest.slice(3,6)}-${rest.slice(6)}`;
      }
      return `+${digits}`;
    }
    if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6,10)}`;
    if (digits.length === 7)  return `${digits.slice(0,3)}-${digits.slice(3,7)}`;
    return digits;
  }

  // ── Email validation ─────────────────────────────────────────────────────
  /** @param {string} email */
  function isValidEmail(email) {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
  }

  // ── Audience parsing (mirrors Python script logic) ────────────────────────
  /** @param {any} val */
  function parseAudience(val) {
    if (val === null || val === undefined || val === '') return { min: null, max: null, approx: false };
    const s = String(val).trim().toLowerCase();
    if (/^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}:\d{2}:\d{2}/.test(s)) return { min: null, max: null, approx: false };
    if (['tbd', '0', 'none', ''].includes(s)) return { min: null, max: null, approx: false };

    let approx = /approx|~|\+/.test(s);
    let cleaned = s.replace(/approx|~|\+/g, '').replace(/\s*(people|max|or less|or fewer|person)\s*$/, '').trim();

    const rangeMatch = cleaned.match(/^(\d+)\s*[-–to]+\s*(\d+)$/);
    if (rangeMatch) return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]), approx };

    const numMatch = cleaned.match(/^(\d+)$/);
    if (numMatch) { const n = parseInt(numMatch[1]); return { min: n, max: n, approx }; }

    return { min: null, max: null, approx: false };
  }

  // ── Engagement type inference (mirrors Python script) ─────────────────────
  /** @param {string} title @param {string} company */
  function inferType(title, company) {
    const combined = [title, company].filter(Boolean).join(' ').toLowerCase();
    if (/rental|rent\b/.test(combined))                   return 'space_rental';
    if (/private show|private party|private event/.test(combined)) return 'private_show_gft';
    if (/roadshow|road show/.test(combined))              return 'roadshow';
    if (/school|university|college|elementary|jr high|high school|nonprofit|non-?profit|foundation|501c|education/.test(combined)) return 'school_nonprofit';
    if (/team.?build|workshop|training|corporate|inc\b|ltd\b|llc\b|group\b|company|corp\b|rs for\b/.test(combined)) return 'corporate_training';
    return 'other';
  }

  // ── Pipeline / contract normalisation ────────────────────────────────────
  /** @param {string} val */
  function mapPipeline(val) {
    if (!val) return 'none';
    const v = val.trim().toLowerCase();
    const map = /** @type {Record<string,string>} */ ({
      'lm / emailed': 'lm_emailed', 'active & due jobs': 'active_due',
      'benji follow up': 'benji_follow_up', 'paid 2026': 'paid_2026',
      'proposal in progress': 'proposal_in_progress',
    });
    return map[v] ?? 'none';
  }

  /** @param {string} val */
  function mapContract(val) {
    if (!val) return '';
    const v = val.trim().toLowerCase();
    const map = /** @type {Record<string,string>} */ ({
      'needs sending': 'needs_sending', 'sent': 'sent', 'viewed': 'viewed', 'signed': 'signed',
    });
    return map[v] ?? '';
  }

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
    let current = '', inQuotes = false;
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
      // Contact fields
      company_name:  col(['company name', 'company', 'organization', 'org']),
      first_name:    col(['first name', 'first', 'firstname', 'client first name']),
      last_name:     col(['last name', 'last', 'lastname', 'client last name']),
      email:         col(['email', 'email address', 'client email']),
      phone:         col(['phone', 'telephone', 'client phone']),
      address_line1: col(['address', 'address 1', 'address line 1', 'client address line 1', 'street']),
      address_line2: col(['address 2', 'address line 2', 'client address line 2']),
      city:          col(['city', 'client address city']),
      state:         col(['state', 'client address state']),
      zip:           col(['zip', 'zip code', 'postal code', 'client address zip']),
      country:       col(['country', 'client address country']),
      // Engagement fields
      title:            col(['title', 'project title', 'project name']),
      project_status:   col(['project status']),
      contract_status:  col(['contract status', 'contract']),
      start_date:       col(['start date', 'engagement date', 'date']),
      end_date:         col(['end date']),
      audience:         col(['audience']),
      amount_paid:      col(['primary invoice paid', 'amount paid', 'paid', 'amount', 'revenue']),
      notes:            col(['notes', 'note']),
      archived:         col(['archived', 'is archived']),
    };

    const parsed = [];
    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseCSVLine(rawLines[i]);
      if (cols.length < 2) continue;
      const g = (/** @type {number} */ idx) => idx === -1 ? '' : cleanVal(cols[idx]);

      const title   = g(colMap.title);
      const company = g(colMap.company_name);
      const email   = g(colMap.email).toLowerCase();

      if (!email && !company && !title) continue;

      const aud = parseAudience(g(colMap.audience));
      const amtRaw = g(colMap.amount_paid);
      const amtNum = amtRaw ? parseFloat(amtRaw.replace(/[^0-9.-]/g, '')) : null;

      // Dates — handle ISO and M/D/YYYY
      const cleanDate = (/** @type {string} */ v) => {
        if (!v) return '';
        const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (m) return `${m[3]}-${m[1].padStart(2,'0')}-${m[2].padStart(2,'0')}`;
        if (/^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
        return v;
      };

      const archived = g(colMap.archived).toLowerCase();

      parsed.push({
        // Contact
        company_name:  company,
        first_name:    g(colMap.first_name),
        last_name:     g(colMap.last_name),
        email,
        phone:         formatPhone(g(colMap.phone)),
        address_line1: g(colMap.address_line1),
        address_line2: g(colMap.address_line2),
        city:          g(colMap.city),
        state:         g(colMap.state),
        zip:           g(colMap.zip),
        country:       g(colMap.country),
        // Engagement
        title,
        dubsado_project_title: title,
        engagement_type:  inferType(title, company),
        pipeline_status:  mapPipeline(g(colMap.project_status)),
        contract_status:  mapContract(g(colMap.contract_status)),
        engagement_date:  cleanDate(g(colMap.start_date)),
        end_date:         cleanDate(g(colMap.end_date)),
        audience_size_min:    aud.min,
        audience_size_max:    aud.max,
        audience_size_approx: aud.approx,
        amount_paid:      isNaN(/** @type {any} */ (amtNum)) ? null : amtNum,
        notes:            g(colMap.notes),
        is_archived:      archived === 'yes' || archived === 'true' || archived === '1',
      });
    }
    csvParsed = parsed;
    csvPreview = true;
  }

  /** @param {string} line */
  function parseCSVLine(line) {
    const result = []; let current = '', inQuotes = false;
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

  /** @param {number} index */
  function removeRow(index) {
    csvParsed = csvParsed.filter((_, i) => i !== index);
  }

  // ── Computed ──────────────────────────────────────────────────────────────
  $: badEmails = csvParsed.filter(r => r.email && !isValidEmail(r.email)).length;

  $: contactSkipCount      = contactDecisions.filter(d => d?.action === 'skip').length;
  $: contactCreateCount    = contactDecisions.filter(d => d?.action === 'create').length;
  $: contactUpdateCount    = contactDecisions.filter(d => d?.action === 'update').length;
  $: engSkipCount          = engagementDecisions.filter(d => d?.action === 'skip').length;
  $: engCreateCount        = engagementDecisions.filter(d => d?.action === 'create').length;

  const fmt = (/** @type {any} */ n) => n == null || n === '' ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 });
  const labelify = (/** @type {string|null} */ s) => s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';
</script>

<svelte:head><title>Import Corp Data | B&C Financial Tracker</title></svelte:head>

<div class="container">
  <header>
    <div>
      <h1>Import Corp Data</h1>
      <p class="subtitle">Import contacts and engagements together from a single CSV</p>
    </div>
    <div class="header-actions">
      <button
        type="button"
        class="btn-danger-sm"
        on:click={() => {
          if (confirm('Reset corp_contact_id sequence to 1? Only do this if the table is empty.')) {
            resetForm?.submit();
          }
        }}
      >Reset ID Sequence</button>
      <form bind:this={resetForm} method="POST" action="?/reset_sequence" style="display:none"></form>
      <a href="/corp/contacts" class="btn-secondary">← Back to Contacts</a>
    </div>
  </header>

  {#if form?.success && form?.action === 'csv_confirm'}
    <div class="alert alert-success">✓ {form.message}</div>
  {/if}
  {#if form?.success && form?.action === 'reset_sequence'}
    <div class="alert alert-success">✓ {form.message}</div>
  {/if}
  {#if form?.error}
    <div class="alert alert-error">✗ {form.error}</div>
  {/if}

  <!-- ── Step 1: Upload + Preview ──────────────────────────────────────────── -->
  {#if !reviewMode}
    <div class="upload-card">
      <label for="fileInput" class="upload-label">CSV File (Dubsado export or similar)</label>
      <input type="file" id="fileInput" accept=".csv" on:change={handleFileSelect} class="input-file" />
      <p class="upload-hint">
        Expected columns: company name, first name, last name, email, phone, address, city, state, zip,
        project title, project status, contract status, start date, end date, audience, primary invoice paid, notes, archived
      </p>
    </div>

    {#if csvPreview && csvParsed.length > 0}
      <form method="POST" action="?/csv_check" use:enhance={() => {
        return async ({ result }) => {
          if (result.type === 'success' && /** @type {any} */ (result.data)?.action === 'csv_check') {
            const d = /** @type {any} */ (result.data);
            contactMatches = d.contactMatches;
            engagements    = d.engagements;
            reviewMode     = true;
            activeTab      = 'contacts';

            // Default contact decisions
            contactDecisions = contactMatches.map((m, idx) => {
              if (m.matchType === 'new') return { idx, action: 'create', updateFields: [], csv: m.csv };
              const updateFields = /** @type {string[]} */ ([]);
              if (m.dbContact) {
                if (m.csv.company_name && m.csv.company_name.toLowerCase() !== (m.dbContact.company_name || '').toLowerCase()) updateFields.push('company_name');
                if (m.csv.first_name   && m.csv.first_name.toLowerCase()   !== (m.dbContact.first_name   || '').toLowerCase()) updateFields.push('first_name');
                if (m.csv.last_name    && m.csv.last_name.toLowerCase()    !== (m.dbContact.last_name    || '').toLowerCase()) updateFields.push('last_name');
                if (m.csv.phone        && m.csv.phone !== (m.dbContact.phone || ''))  updateFields.push('phone');
              }
              return { idx, action: 'update', updateFields, csv: m.csv, corp_contact_id: m.dbContact?.corp_contact_id };
            });

            // Default engagement decisions — create all
            engagementDecisions = engagements.map(e => ({ action: 'create', engagement: e }));
          }
        };
      }}>
        <input type="hidden" name="csv_data" value={JSON.stringify(csvParsed)} />

        <div class="preview-header">
          <h2 class="section-title">Preview — {csvParsed.length} rows</h2>
          <div class="preview-meta">
            {#if badEmails > 0}
              <span class="warn-badge">⚠ {badEmails} invalid email{badEmails !== 1 ? 's' : ''}</span>
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
                <th>Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Title</th>
                <th>Date</th>
                <th>Type</th>
                <th>Pipeline</th>
                <th class="col-right">Revenue</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {#each csvParsed as row, i (i)}
                {@const emailBad = row.email && !isValidEmail(row.email)}
                <tr class:email-warn={emailBad}>
                  <td class="row-num">{i + 1}</td>
                  <td>{row.company_name || '—'}</td>
                  <td>{[row.first_name, row.last_name].filter(Boolean).join(' ') || '—'}</td>
                  <td class="email-cell" class:email-invalid={emailBad}>
                    {row.email || '—'}{#if emailBad}<span class="warn-icon" title="Invalid email format">⚠</span>{/if}
                  </td>
                  <td>{row.phone || '—'}</td>
                  <td class="title-cell">{row.title || '—'}</td>
                  <td class="date-cell">{row.engagement_date || '—'}</td>
                  <td><span class="type-tag">{row.engagement_type?.replace(/_/g,' ')}</span></td>
                  <td>{row.pipeline_status?.replace(/_/g,' ') || '—'}</td>
                  <td class="col-right">{fmt(row.amount_paid)}</td>
                  <td><button type="button" class="btn-remove" on:click={() => removeRow(i)}>×</button></td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </form>
    {:else if csvPreview}
      <div class="alert alert-error">No valid rows found in CSV.</div>
    {/if}
  {/if}

  <!-- ── Step 2: Review ────────────────────────────────────────────────────── -->
  {#if reviewMode}
    <form method="POST" action="?/csv_confirm" use:enhance={({ formData }) => {
      formData.set('contact_decisions',    JSON.stringify(contactDecisions));
      formData.set('engagement_decisions', JSON.stringify(engagementDecisions));
      return async ({ result, update }) => {
        if (result.type === 'success') {
          reviewMode = false; csvPreview = false; csvParsed = []; contactMatches = []; engagements = [];
          await update();
        }
      };
    }}>
      <input type="hidden" name="contact_decisions"    value="" />
      <input type="hidden" name="engagement_decisions" value="" />

      <!-- Tab bar -->
      <div class="review-tabs">
        <button type="button" class="review-tab" class:active={activeTab === 'contacts'}
          on:click={() => activeTab = 'contacts'}>
          Contacts ({contactMatches.length})
          <span class="tab-sub">{contactCreateCount} create · {contactUpdateCount} update · {contactSkipCount} skip</span>
        </button>
        <button type="button" class="review-tab" class:active={activeTab === 'engagements'}
          on:click={() => activeTab = 'engagements'}>
          Engagements ({engagements.length})
          <span class="tab-sub">{engCreateCount} create · {engSkipCount} skip</span>
        </button>
      </div>

      <!-- ── Contacts tab ─────────────────────────────────────────────────── -->
      {#if activeTab === 'contacts'}
        <div class="tab-actions">
          <button type="button" class="btn-link" on:click={() => {
            contactDecisions = contactDecisions.map((d, i) => ({
              ...d, action: contactMatches[i]?.matchType === 'new' ? 'create' : 'update'
            }));
          }}>Accept all</button>
          <button type="button" class="btn-link" on:click={() => {
            contactDecisions = contactDecisions.map(d => ({ ...d, action: 'skip' }));
          }}>Skip all</button>
        </div>

        <div class="review-list">
          {#each contactMatches as match, i (i)}
            <div class="review-card match-{match.matchType}">
              <div class="card-header">
                <span class="card-name">{match.csv.company_name || [match.csv.first_name, match.csv.last_name].filter(Boolean).join(' ') || '(unnamed)'}</span>
                <span class="card-email">{match.csv.email || '—'}</span>
                <span class="card-phone">{match.csv.phone || ''}</span>
                {#if match.matchType === 'new'}
                  <span class="match-badge badge-new">New</span>
                {:else if match.matchType === 'email_match'}
                  <span class="match-badge badge-email">Email match</span>
                {:else}
                  <span class="match-badge badge-company">Company match</span>
                {/if}
                {#if match.dbContact}
                  <div class="db-info">DB: {match.dbContact.company_name || ''} — {[match.dbContact.first_name, match.dbContact.last_name].filter(Boolean).join(' ')} {match.dbContact.email ? '· ' + match.dbContact.email : ''}</div>
                {/if}
              </div>

              <div class="action-row">
                {#if match.matchType === 'new'}
                  <label class="radio-label"><input type="radio" bind:group={contactDecisions[i].action} value="create" /> Create</label>
                  <label class="radio-label"><input type="radio" bind:group={contactDecisions[i].action} value="skip"   /> Skip</label>
                {:else}
                  <label class="radio-label"><input type="radio" bind:group={contactDecisions[i].action} value="update" /> Update existing</label>
                  <label class="radio-label"><input type="radio" bind:group={contactDecisions[i].action} value="skip"   /> Skip</label>
                {/if}
              </div>

              {#if contactDecisions[i].action === 'update' && match.dbContact}
                {@const diffs = [
                  { field: 'company_name', label: 'Company',  db: match.dbContact.company_name, csv: match.csv.company_name },
                  { field: 'first_name',   label: 'First',    db: match.dbContact.first_name,   csv: match.csv.first_name },
                  { field: 'last_name',    label: 'Last',     db: match.dbContact.last_name,    csv: match.csv.last_name },
                  { field: 'phone',        label: 'Phone',    db: match.dbContact.phone,         csv: match.csv.phone },
                  { field: 'city',         label: 'City',     db: match.dbContact.city,          csv: match.csv.city },
                  { field: 'state',        label: 'State',    db: match.dbContact.state,         csv: match.csv.state },
                  { field: 'address_line1',label: 'Address',  db: match.dbContact.address_line1, csv: match.csv.address_line1 },
                  { field: 'zip',          label: 'Zip',      db: match.dbContact.zip,           csv: match.csv.zip },
                ].filter(d => d.csv && d.csv.toLowerCase() !== (d.db || '').toLowerCase())}

                {#if diffs.length > 0}
                  <div class="diff-section">
                    <div class="diff-title">Differing fields — check to update:</div>
                    <div class="diff-table">
                      {#each diffs as diff (diff.field)}
                        <label class="diff-row">
                          <input type="checkbox" bind:group={contactDecisions[i].updateFields} value={diff.field} />
                          <span class="diff-field">{diff.label}:</span>
                          <span class="diff-db">{diff.db || '(empty)'}</span>
                          <span class="diff-arrow">→</span>
                          <span class="diff-csv">{diff.csv}</span>
                        </label>
                      {/each}
                    </div>
                  </div>
                {:else}
                  <div class="no-diff">No field differences — empty fields will be filled in.</div>
                {/if}
              {/if}
            </div>
          {/each}
        </div>
      {/if}

      <!-- ── Engagements tab ──────────────────────────────────────────────── -->
      {#if activeTab === 'engagements'}
        <div class="tab-actions">
          <button type="button" class="btn-link" on:click={() => { engagementDecisions = engagementDecisions.map(d => ({ ...d, action: 'create' })); }}>Create all</button>
          <button type="button" class="btn-link" on:click={() => { engagementDecisions = engagementDecisions.map(d => ({ ...d, action: 'skip' })); }}>Skip all</button>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Title</th>
                <th>Contact</th>
                <th>Date</th>
                <th>Type</th>
                <th>Pipeline</th>
                <th class="col-right">Revenue</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {#each engagements as eng, i (i)}
                {@const contactName = eng.contactIdx >= 0
                  ? (contactMatches[eng.contactIdx]?.csv?.company_name ||
                     [contactMatches[eng.contactIdx]?.csv?.first_name, contactMatches[eng.contactIdx]?.csv?.last_name].filter(Boolean).join(' '))
                  : '(unlinked)'}
                <tr class:skip-row={engagementDecisions[i]?.action === 'skip'}>
                  <td class="row-num">{i + 1}</td>
                  <td class="title-cell">{eng.title || '(untitled)'}</td>
                  <td class="contact-cell">{contactName || '—'}</td>
                  <td class="date-cell">{eng.engagement_date || '—'}</td>
                  <td>
                    <select class="inline-select" bind:value={engagements[i].engagement_type}>
                      {#each TYPES as [v, l]}<option value={v}>{l}</option>{/each}
                    </select>
                  </td>
                  <td>
                    <select class="inline-select" bind:value={engagements[i].pipeline_status}>
                      {#each PIPELINES as [v, l]}<option value={v}>{l}</option>{/each}
                    </select>
                  </td>
                  <td class="col-right">{fmt(eng.amount_paid)}</td>
                  <td>
                    <select class="inline-select-sm" bind:value={engagementDecisions[i].action}>
                      <option value="create">Create</option>
                      <option value="skip">Skip</option>
                    </select>
                  </td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      {/if}

      <div class="form-actions">
        <button type="submit" class="btn-primary">
          Confirm Import ({contactCreateCount} contacts, {engCreateCount} engagements)
        </button>
        <button type="button" class="btn-secondary" on:click={() => { reviewMode = false; }}>← Back to Preview</button>
        <button type="button" class="btn-secondary" on:click={() => { reviewMode = false; csvPreview = false; csvParsed = []; }}>Cancel</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .container { max-width: 1400px; margin: 0 auto; padding: 2rem; }

  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0 0 0.25rem; }
  .subtitle { color: #6b7280; margin: 0; }
  .header-actions { display: flex; gap: 0.75rem; align-items: center; }

  .alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
  .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .alert-error   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

  .upload-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 1.5rem; margin-bottom: 1.5rem; }
  .upload-label { display: block; font-weight: 600; font-size: 0.875rem; color: #374151; margin-bottom: 0.5rem; }
  .input-file { font-size: 0.9rem; }
  .upload-hint { margin: 0.75rem 0 0; font-size: 0.8rem; color: #9ca3af; }

  .preview-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem; }
  .section-title { font-size: 1.1rem; font-weight: 600; margin: 0; color: #1a202c; }
  .preview-meta { display: flex; align-items: center; gap: 0.75rem; }
  .warn-badge { font-size: 0.875rem; font-weight: 600; color: #92400e; background: #fef3c7; border: 1px solid #fcd34d; padding: 0.35rem 0.75rem; border-radius: 0.375rem; }

  .table-wrap { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); overflow-x: auto; margin-bottom: 1.5rem; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: #f9fafb; }
  th { padding: 0.625rem 0.75rem; text-align: left; font-weight: 600; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; color: #374151; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
  th.col-right, td.col-right { text-align: right; }
  td { padding: 0.4rem 0.75rem; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; vertical-align: middle; }
  tr:hover td { background: #f9fafb; }
  tr.skip-row td { opacity: 0.4; }

  .row-num { color: #9ca3af; font-size: 0.8rem; text-align: center; width: 2rem; }
  .email-cell { color: #6b7280; font-size: 0.82rem; }
  .email-invalid { color: #92400e !important; font-weight: 500; }
  .warn-icon { margin-left: 0.3rem; color: #d97706; cursor: help; }
  tr.email-warn { background: #fffbeb; }
  tr.email-warn:hover td { background: #fef3c7; }

  .title-cell { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .date-cell { white-space: nowrap; color: #6b7280; font-size: 0.82rem; }
  .contact-cell { color: #374151; font-size: 0.85rem; max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .type-tag { font-size: 0.75rem; background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 0.25rem; white-space: nowrap; }

  .inline-select, .inline-select-sm {
    padding: 0.2rem 0.35rem;
    border: 1px solid #d1d5db;
    border-radius: 0.25rem;
    font-size: 0.78rem;
    background: white;
  }
  .inline-select-sm { font-weight: 600; }

  /* Review tabs */
  .review-tabs { display: flex; gap: 0; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb; }
  .review-tab { padding: 0.75rem 1.5rem; border: none; background: none; font-size: 0.95rem; font-weight: 500; color: #6b7280; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; display: flex; flex-direction: column; align-items: flex-start; gap: 0.2rem; transition: all 0.15s; }
  .review-tab:hover { color: #374151; }
  .review-tab.active { color: #3b82f6; border-bottom-color: #3b82f6; }
  .tab-sub { font-size: 0.75rem; font-weight: 400; color: #9ca3af; }
  .review-tab.active .tab-sub { color: #93c5fd; }

  .tab-actions { display: flex; gap: 1rem; margin-bottom: 1rem; align-items: center; font-size: 0.9rem; color: #6b7280; }

  /* Review cards */
  .review-list { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; }
  .review-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); padding: 0.875rem 1.25rem; border-left: 4px solid #d1d5db; }
  .review-card.match-new           { border-left-color: #3b82f6; }
  .review-card.match-email_match   { border-left-color: #10b981; }
  .review-card.match-company_match { border-left-color: #f59e0b; }

  .card-header { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.6rem; }
  .card-name  { font-weight: 600; color: #1a202c; }
  .card-email { font-size: 0.82rem; color: #6b7280; }
  .card-phone { font-size: 0.82rem; color: #9ca3af; }
  .db-info    { font-size: 0.78rem; color: #9ca3af; width: 100%; }

  .match-badge { padding: 0.2rem 0.6rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; margin-left: auto; }
  .badge-new     { background: #dbeafe; color: #1e40af; }
  .badge-email   { background: #dcfce7; color: #166534; }
  .badge-company { background: #fef3c7; color: #92400e; }

  .action-row { display: flex; gap: 1.5rem; flex-wrap: wrap; margin-bottom: 0.4rem; }
  .radio-label { display: flex; align-items: center; gap: 0.35rem; font-size: 0.9rem; color: #374151; cursor: pointer; }
  .radio-label input { accent-color: #3b82f6; }

  .diff-section { margin-top: 0.6rem; padding-top: 0.6rem; border-top: 1px solid #f3f4f6; }
  .diff-title { font-size: 0.75rem; font-weight: 600; color: #6b7280; margin-bottom: 0.4rem; text-transform: uppercase; letter-spacing: 0.03em; }
  .diff-table { display: flex; flex-direction: column; gap: 0.3rem; }
  .diff-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.3rem 0.5rem; background: #fefce8; border-radius: 0.25rem; font-size: 0.82rem; cursor: pointer; }
  .diff-row:hover { background: #fef9c3; }
  .diff-row input { accent-color: #3b82f6; }
  .diff-field { font-weight: 600; color: #374151; min-width: 65px; }
  .diff-db    { color: #991b1b; background: #fee2e2; padding: 0.1rem 0.35rem; border-radius: 0.2rem; }
  .diff-arrow { color: #9ca3af; }
  .diff-csv   { color: #166534; background: #dcfce7; padding: 0.1rem 0.35rem; border-radius: 0.2rem; }
  .no-diff { font-size: 0.82rem; color: #9ca3af; font-style: italic; margin-top: 0.4rem; }

  .form-actions { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }

  .btn-primary  { background: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 1rem; cursor: pointer; }
  .btn-primary:hover { background: #2563eb; }
  .btn-secondary { background: #e5e7eb; color: #374151; padding: 0.625rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.95rem; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn-secondary:hover { background: #d1d5db; }
  .btn-danger-sm { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; padding: 0.4rem 0.875rem; border-radius: 0.375rem; font-size: 0.825rem; font-weight: 500; cursor: pointer; }
  .btn-danger-sm:hover { background: #fecaca; }
  .btn-remove { width: 1.5rem; height: 1.5rem; border-radius: 50%; border: none; background: #ef4444; color: white; font-size: 0.9rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; }
  .btn-remove:hover { background: #dc2626; }
  .btn-link { background: none; border: none; color: #3b82f6; font-size: 0.875rem; cursor: pointer; padding: 0; text-decoration: underline; }
  .btn-link:hover { color: #2563eb; }

  @media (max-width: 768px) {
    .container { padding: 1rem; }
    header { flex-direction: column; gap: 1rem; }
    .review-tabs { flex-direction: column; border-bottom: none; }
    .review-tab { border-bottom: none; border-left: 2px solid transparent; padding: 0.5rem 1rem; }
    .review-tab.active { border-left-color: #3b82f6; }
  }
</style>