<!-- src/routes/hsi/enter_class_registrations/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';

  export let data;
  export let form;

  let activeTab = 'manual';

  // ---- Manual Entry State ----
  /** @type {any[]} */
  let rows = [createRow()];

  function createRow() {
    return {
      id: crypto.randomUUID(),
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      class_code: '',
      class_date: '',
      registration_date: new Date().toISOString().split('T')[0],
      amount_paid: 0
    };
  }

  function addRow() {
    const last = rows[rows.length - 1];
    const newRow = createRow();
    newRow.class_code = last?.class_code || '';
    newRow.class_date = last?.class_date || '';
    rows = [...rows, newRow];
  }

  /** @param {any} id */
  function removeRow(id) {
    if (rows.length <= 1) return;
    rows = rows.filter(r => r.id !== id);
  }

  // Group classes by track for dropdown
  $: classesByTrack = data.classes.reduce((/** @type {Record<string, any[]>} */ acc, /** @type {any} */ c) => {
    const track = c.track || 'Other';
    if (!acc[track]) acc[track] = [];
    acc[track].push(c);
    return acc;
  }, /** @type {Record<string, any[]>} */ ({}));
  $: tracks = Object.keys(classesByTrack).sort();

  // ---- CSV Upload State ----
  let csvClassCode = '';
  let csvClassDate = '';
  /** @type {File|null} */
  let _csvFile = null;
  /** @type {any[]} */
  let csvParsed = [];
  let csvPreview = false;
  let _csvDataJson = '';
  let reviewMode = false;
  /** @type {any[]} */
  let matchResults = [];
  /** @type {any[]} */
  let decisions = [];
  let sessionName = '';
  /** @type {string|null} */
  let existingSessionId = null;
  /** @type {any} */
  let sessionInfo = null;

  // Decisions are built fresh at submit time in the enhance callback

  // Auto-generate session name when class or date change
  /**
   * @param {string} classCode
   * @param {string} dateStr
   */
  function generateSessionName(classCode, dateStr) {
    if (!classCode || !dateStr) return '';
    const classObj = data.classes.find((/** @type {any} */ c) => c.class_code === classCode);
    const className = classObj ? /** @type {any} */ (classObj).class_name : classCode;
    const d = new Date(dateStr + 'T12:00:00');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${monthNames[d.getMonth()]} ${d.getFullYear()} ${className}`;
  }

  $: if (csvClassCode && csvClassDate && !sessionInfo) {
    sessionName = generateSessionName(csvClassCode, csvClassDate);
  }

  /** @type {{ date: string|null, classCode: string|null }|null} */
  let filenameParsed = null;

  // Map level names in filenames to class codes
  /** @type {Record<string, string>} */
  const levelToClassCode = {
    '1': 'CT1', 'level 1': 'CT1', 'level1': 'CT1',
    '2': 'CT2', 'level 2': 'CT2', 'level2': 'CT2',
    '3': 'CT3', 'level 3': 'CT3', 'level3': 'CT3',
    '4': 'AGT1', 'level 4': 'AGT1', 'level4': 'AGT1',
    'agt1': 'AGT1', 'agt 1': 'AGT1'
  };

  /** @param {string} filename */
  function parseFilename(filename) {
    // Remove extension
    const name = filename.replace(/\.[^.]+$/, '').replace(/_/g, ' ').trim();
    let detectedDate = null;
    let detectedClass = null;

    // Try to find a 6-digit date at the start: MMDDYY
    const dateMatch = name.match(/^(\d{6})/);
    if (dateMatch) {
      const d = dateMatch[1];
      const mm = parseInt(d.substring(0, 2));
      const dd = parseInt(d.substring(2, 4));
      const yy = parseInt(d.substring(4, 6));
      if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
        const yyyy = yy >= 50 ? 1900 + yy : 2000 + yy;
        const month = String(mm).padStart(2, '0');
        const day = String(dd).padStart(2, '0');
        detectedDate = `${yyyy}-${month}-${day}`;
      }
    }

    // Try to find class level in the filename
    const nameLower = name.toLowerCase();
    // Check for "Level X" pattern
    const levelMatch = nameLower.match(/level\s*(\d)/);
    if (levelMatch) {
      const key = 'level ' + levelMatch[1];
      detectedClass = levelToClassCode[key] || null;
    }
    // Check for AGT1 pattern
    if (!detectedClass) {
      const agtMatch = nameLower.match(/agt\s*1/);
      if (agtMatch) {
        detectedClass = 'AGT1';
      }
    }
    // Check for CT1/CT2/CT3 directly in filename
    if (!detectedClass) {
      const ctMatch = nameLower.match(/\b(ct[1-4]|agt1)\b/);
      if (ctMatch) {
        detectedClass = ctMatch[1].toUpperCase();
        if (detectedClass === 'CT4') detectedClass = 'AGT1';
      }
    }

    return { date: detectedDate, classCode: detectedClass };
  }

  /** @param {any} event */
  function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    _csvFile = file;

    // Try to parse class and date from filename
    const parsed = parseFilename(file.name);
    filenameParsed = parsed;

    if (parsed.classCode) {
      csvClassCode = parsed.classCode;
    }
    if (parsed.date) {
      csvClassDate = parsed.date;
    }

    const reader = new FileReader();
    reader.onload = (/** @type {any} */ e) => {
      parseCSV(e.target.result);
    };
    reader.readAsText(file);
  }

  /** @param {string} text */
  function parseCSV(text) {
    // Normalize line endings and handle quoted fields that span lines
    text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    // Rebuild lines respecting quoted fields (handles newlines inside quotes)
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

    // Parse header — strip quotes, whitespace, newlines from each field
    const header = parseCSVLine(rawLines[0]).map(h =>
      h.replace(/["'\r\n]+/g, '').trim().toLowerCase()
    );

    // Map common column names
    const colMap = {
      email: findCol(header, ['email', 'email address', 'e-mail']),
      first_name: findCol(header, ['first name', 'first', 'firstname']),
      last_name: findCol(header, ['last name', 'last', 'lastname']),
      phone: findCol(header, ['phone', 'telephone', 'home phone']),
      mobile_phone: findCol(header, ['mobile phone', 'mobile', 'cell', 'cell phone']),
      amount_paid: findCol(header, ['amount', 'amount spent', 'amount_paid', 'paid', 'price']),
      registration_date: findCol(header, ['last ticket bought', 'last ticket', 'ticket date', 'registration date', 'reg date']),
      tickets_bought: findCol(header, ['tickets bought', 'tickets', 'ticket count', 'qty', 'quantity']),
      account_date: findCol(header, ['account date', 'date']),
      acct_id: findCol(header, ['acctid', 'acct id', 'account id', 'vbo id', 'vbo account']),
      address_line1: findCol(header, ['address', 'address 1', 'street']),
      address_line2: findCol(header, ['address 2', 'address2', 'apt', 'suite']),
      city: findCol(header, ['city']),
      state: findCol(header, ['state', 'state/province', 'province']),
      zip_code: findCol(header, ['zipcode', 'zip code', 'zip', 'postal code', 'postal']),
      country: findCol(header, ['country'])
    };

    const parsed = [];
    for (let i = 1; i < rawLines.length; i++) {
      const cols = parseCSVLine(rawLines[i]);
      if (cols.length < 2) continue;

      const row = {
        email: cleanVal(cols[colMap.email]),
        first_name: cleanVal(cols[colMap.first_name]),
        last_name: cleanVal(cols[colMap.last_name]),
        phone: cleanVal(cols[colMap.phone]),
        amount_paid: cleanAmount(cols[colMap.amount_paid]),
        registration_date: cleanDate(cols[colMap.registration_date]),
        tickets_bought: parseInt(cleanVal(cols[colMap.tickets_bought])) || 1,
        account_date: cleanDate(cols[colMap.account_date]),
        acct_id: cleanVal(cols[colMap.acct_id]),
        address_line1: cleanVal(cols[colMap.address_line1]),
        address_line2: cleanVal(cols[colMap.address_line2]),
        city: cleanVal(cols[colMap.city]),
        state: cleanVal(cols[colMap.state]),
        zip_code: cleanVal(cols[colMap.zip_code]),
        country: cleanVal(cols[colMap.country])
      };

      // Treat acct_id of '0' as empty
      if (row.acct_id === '0') row.acct_id = '';

      if (!row.email) continue;

      const ticketCount = Math.max(1, row.tickets_bought);

      // Primary registrant gets the full amount
      parsed.push({
        ...row,
        is_guest: false,
        guest_number: 0,
        purchaser_name: null
      });

      // Additional guest rows for extra tickets get $0
      for (let g = 2; g <= ticketCount; g++) {
        parsed.push({
          email: '',
          first_name: `Guest ${g}`,
          last_name: `of ${row.first_name} ${row.last_name}`,
          phone: '',
          amount_paid: 0,
          registration_date: row.registration_date,
          tickets_bought: 1,
          account_date: row.account_date,
          is_guest: true,
          guest_number: g,
          purchaser_name: `${row.first_name} ${row.last_name}`
        });
      }
    }

    csvParsed = parsed;
    csvPreview = true;
    _csvDataJson = JSON.stringify(parsed);
  }

  /** @param {string} line */
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

  /**
   * @param {string[]} header
   * @param {string[]} names
   */
  function findCol(header, names) {
    for (const name of names) {
      const idx = header.indexOf(name);
      if (idx !== -1) return idx;
    }
    // Try partial match
    for (const name of names) {
      const idx = header.findIndex(h => h.includes(name));
      if (idx !== -1) return idx;
    }
    return -1;
  }

  /** @param {any} val */
  function cleanVal(val) {
    if (val === undefined || val === null) return '';
    return val.replace(/^["'\s]+|["'\s]+$/g, '').replace(/^\d+\.\s*$/, '').trim();
  }

  /** @param {any} val */
  function cleanAmount(val) {
    if (val === undefined || val === null) return 0;
    val = val.replace(/[^0-9.-]/g, '');
    return parseFloat(val) || 0;
  }

  /** @param {any} val */
  function cleanDate(val) {
    if (val === undefined || val === null || !val.trim()) return '';
    val = val.replace(/^["'\s]+|["'\s]+$/g, '').trim();
    // Try M/D/YYYY or M/D/YYYY H:MM:SS
    const match = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (match) {
      const m = match[1].padStart(2, '0');
      const d = match[2].padStart(2, '0');
      return `${match[3]}-${m}-${d}`;
    }
    return val;
  }

  /** @param {number} index */
  function removeCsvRow(index) {
    csvParsed = csvParsed.filter((_, i) => i !== index);
    _csvDataJson = JSON.stringify(csvParsed);
  }
</script>

<svelte:head>
  <title>Enter Class Registrations | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <div>
      <h1>Enter Class Registrations</h1>
      <p class="subtitle">Add or import student registrations</p>
    </div>
    <a href={resolve('/hsi/classes')} class="btn-secondary">Back to Classes</a>
  </header>

  {#if form?.success}
    <div class="alert alert-success">
      <div>✓ {form?.message}</div>
      {#if form?.results && form?.results.length > 0}
        <details class="results-details">
          <summary>{form?.results.length} students processed</summary>
          <ul>
            {#each (form?.results || []) as r, i (i)}
              <li>{r.name} ({r.email}) — <span class="tag {r.status === 'new student' ? 'tag-new' : 'tag-existing'}">{r.status}</span></li>
            {/each}
          </ul>
        </details>
      {/if}
    </div>
  {/if}

  {#if form?.error}
    <div class="alert alert-error">✗ {form?.error}</div>
  {/if}

  <!-- Tab Navigation -->
  <div class="tabs">
    <button class="tab" class:active={activeTab === 'manual'} on:click={() => activeTab = 'manual'}>
      Manual Entry
    </button>
    <button class="tab" class:active={activeTab === 'csv'} on:click={() => activeTab = 'csv'}>
      CSV Upload
    </button>
  </div>

  <!-- Manual Entry Tab -->
  {#if activeTab === 'manual'}
    <form method="POST" action="?/manual" use:enhance>
      <input type="hidden" name="row_count" value={rows.length} />

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>First Name</th>
              <th>Last Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Class</th>
              <th>Class Date</th>
              <th>Reg Date</th>
              <th>Amount</th>
              <th class="col-actions"></th>
            </tr>
          </thead>
          <tbody>
            {#each rows as row, i (row.id)}
              <tr>
                <td>
                  <input type="text" name="first_name_{i}" bind:value={row.first_name} class="input-text" placeholder="First" />
                </td>
                <td>
                  <input type="text" name="last_name_{i}" bind:value={row.last_name} class="input-text" placeholder="Last" />
                </td>
                <td>
                  <input type="email" name="email_{i}" bind:value={row.email} class="input-text input-email" placeholder="email@..." required />
                </td>
                <td>
                  <input type="text" name="phone_{i}" bind:value={row.phone} class="input-text input-phone" placeholder="Phone" />
                </td>
                <td>
                  <select name="class_code_{i}" bind:value={row.class_code} class="input-select" required>
                    <option value="">Class...</option>
                    {#each tracks as track (track)}
                      <optgroup label={track}>
                        {#each classesByTrack[track] as c (c.class_code)}
                          <option value={c.class_code}>{c.class_name}</option>
                        {/each}
                      </optgroup>
                    {/each}
                  </select>
                </td>
                <td>
                  <input type="date" name="class_date_{i}" bind:value={row.class_date} class="input-date" required />
                </td>
                <td>
                  <input type="date" name="registration_date_{i}" bind:value={row.registration_date} class="input-date" />
                </td>
                <td>
                  <input type="number" name="amount_paid_{i}" bind:value={row.amount_paid} min="0" step="0.01" class="input-number" placeholder="0.00" />
                </td>
                <td>
                  <div class="row-actions">
                    {#if i === rows.length - 1}
                      <button type="button" class="btn-add" on:click={addRow} title="Add row">+</button>
                    {/if}
                    {#if rows.length > 1}
                      <button type="button" class="btn-remove" on:click={() => removeRow(row.id)} title="Remove row">×</button>
                    {/if}
                  </div>
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="form-actions">
        <button type="submit" class="btn-primary">Save Registrations</button>
        <button type="button" class="btn-secondary" on:click={addRow}>+ Add Another Row</button>
      </div>
    </form>
  {/if}

  <!-- CSV Upload Tab -->
  {#if activeTab === 'csv'}
    <div class="csv-section">
      <div class="csv-config">
        <div class="config-row">
          <div class="config-group">
            <label for="csvFileInput">CSV File:</label>
            <input type="file" id="csvFileInput" accept=".csv" on:change={handleFileSelect} class="input-file" />
          </div>
        </div>

        {#if filenameParsed && (filenameParsed.classCode || filenameParsed.date)}
          <div class="detection-message">
            <span class="detection-icon">✓</span>
            Detected from filename:
            {#if filenameParsed.classCode}
              <span class="detection-tag">Class: {filenameParsed.classCode}</span>
            {/if}
            {#if filenameParsed.date}
              <span class="detection-tag">Date: {filenameParsed.date}</span>
            {/if}
            <span class="detection-note">— verify and adjust below if needed</span>
          </div>
        {/if}

        <div class="config-row">
          <div class="config-group">
            <label for="csvClassCode">Class:</label>
            <select id="csvClassCode" bind:value={csvClassCode} class="input-select" required>
              <option value="">Select class...</option>
              {#each tracks as track (track)}
                <optgroup label={track}>
                  {#each classesByTrack[track] as c (c.class_code)}
                    <option value={c.class_code}>{c.class_name}</option>
                  {/each}
                </optgroup>
              {/each}
            </select>
          </div>

          <div class="config-group">
            <label for="csvClassDate">Class Date:</label>
            <input type="date" id="csvClassDate" bind:value={csvClassDate} class="input-date" required />
          </div>

          <div class="config-group config-group-wide">
            <label for="csvSessionName">Session Name:</label>
            <input type="text" id="csvSessionName" bind:value={sessionName} class="input-text" placeholder="e.g. Jan 2026 Level 1" />
          </div>
        </div>
      </div>

      {#if csvPreview && csvParsed.length > 0 && !reviewMode}
        <!-- Step 1: Preview and Check -->
        <form method="POST" action="?/csv_check" use:enhance={() => {
          return async ({ result }) => {
            if (result.type === 'success' && /** @type {any} */ (result.data)?.action === 'csv_check') {
              const resultData = /** @type {any} */ (result.data);
              matchResults = resultData.matchResults;
              reviewMode = true;

              // Handle session info from server
              if (resultData.sessionInfo?.exists) {
                sessionInfo = resultData.sessionInfo;
                existingSessionId = sessionInfo.session_id;
                sessionName = sessionInfo.session_name;
              } else {
                sessionInfo = null;
                existingSessionId = null;
              }

              // Initialize decisions with all diffs pre-checked
              decisions = matchResults.map(m => {
                if (m.matchType === 'new') return { action: 'add_new', updateFields: [] };
                if (m.matchType === 'existing_no_reg' || m.matchType === 'acctid_match' || m.matchType === 'email_match' || m.matchType === 'name_match') {
                  // Pre-check all differing student fields
                  const updateFields = [];
                  if (m.dbStudent) {
                    if (m.csv.first_name.toLowerCase() !== (m.dbStudent.first_name || '').toLowerCase()) updateFields.push('first_name');
                    if (m.csv.last_name.toLowerCase() !== (m.dbStudent.last_name || '').toLowerCase()) updateFields.push('last_name');
                    if (m.csv.phone && m.csv.phone !== (m.dbStudent.phone || '')) updateFields.push('phone');
                  }
                  return { action: 'add_reg', updateFields };
                }
                // existing_with_reg
                const updateStudentFields = [];
                const updateRegFields = [];
                if (m.dbStudent) {
                  if (m.csv.first_name.toLowerCase() !== (m.dbStudent.first_name || '').toLowerCase()) updateStudentFields.push('first_name');
                  if (m.csv.last_name.toLowerCase() !== (m.dbStudent.last_name || '').toLowerCase()) updateStudentFields.push('last_name');
                  if (m.csv.phone && m.csv.phone !== (m.dbStudent.phone || '')) updateStudentFields.push('phone');
                }
                if (m.dbRegistration) {
                  if (csvClassDate !== m.dbRegistration.class_date) updateRegFields.push('class_date');
                  if (m.csv.amount_paid !== m.dbRegistration.amount_paid) updateRegFields.push('amount_paid');
                  if (m.csv.registration_date && m.csv.registration_date !== m.dbRegistration.registration_date) updateRegFields.push('registration_date');
                }
                return { action: 'skip', updateStudentFields, updateRegFields, updateFields: [] };
              });
            } else if (result.type === 'success' && /** @type {any} */ (result.data)?.error) {
              form = /** @type {any} */ (result.data);
            }
          };
        }}>
          <input type="hidden" name="csv_data" value={JSON.stringify(csvParsed)} />
          <input type="hidden" name="csv_class_code" value={csvClassCode} />
          <input type="hidden" name="csv_class_date" value={csvClassDate} />

          <h3 class="preview-title">Preview ({csvParsed.length} students)</h3>

          <div class="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>First Name</th>
                  <th>Last Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Amount</th>
                  <th>Reg Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each csvParsed as row, i (i)}
                  <tr class:guest-row={row.is_guest}>
                    <td class="row-num">{i + 1}</td>
                    {#if row.is_guest}
                      <td><input type="text" bind:value={csvParsed[i].first_name} class="input-text input-guest" placeholder="Guest first name" /></td>
                      <td><input type="text" bind:value={csvParsed[i].last_name} class="input-text input-guest" placeholder="Guest last name" /></td>
                      <td><input type="email" bind:value={csvParsed[i].email} class="input-text input-guest" placeholder="Guest email" /></td>
                      <td><input type="text" bind:value={csvParsed[i].phone} class="input-text input-guest" placeholder="Phone" /></td>
                    {:else}
                      <td>{row.first_name}</td>
                      <td>{row.last_name}</td>
                      <td class="csv-email">{row.email}</td>
                      <td>{row.phone || '—'}</td>
                    {/if}
                    <td class="col-right">${row.amount_paid.toFixed(2)}</td>
                    <td>{row.registration_date || '—'}</td>
                    <td>
                      {#if row.is_guest}
                        <span class="guest-tag" title="Purchased by {row.purchaser_name}">Guest</span>
                      {/if}
                      <button type="button" class="btn-remove-sm" on:click={() => removeCsvRow(i)} title="Remove">×</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>

          <div class="form-actions">
            {#if csvClassCode && csvClassDate}
              <button type="submit" class="btn-primary">Check for Matches</button>
            {:else}
              <button type="button" class="btn-primary" disabled>Select class and date above</button>
            {/if}
            <button type="button" class="btn-secondary" on:click={() => { csvPreview = false; csvParsed = []; }}>Clear</button>
          </div>
        </form>
      {:else if reviewMode && matchResults.length > 0}
        <!-- Step 2: Review Matches -->
        <form method="POST" action="?/csv_confirm" use:enhance={({ formData }) => {
          // Build decisions fresh at submit time to capture all user changes
          const builtDecisions = matchResults.map((match, i) => {
            const d = decisions[i];
            if (!d) return { action: 'skip', csv: match.csv };
            return {
              action: d.action,
              csv: match.csv,
              student_id: match.dbStudent?.student_id || null,
              registration_id: match.dbRegistration?.registration_id || null,
              updateFields: d.updateFields || [],
              updateStudentFields: d.updateStudentFields || [],
              updateRegFields: d.updateRegFields || []
            };
          });
          formData.set('decisions', JSON.stringify(builtDecisions));

          return async ({ result, update }) => {
            if (result.type === 'success') {
              reviewMode = false;
              csvPreview = false;
              csvParsed = [];
              matchResults = [];
              sessionInfo = null;
              existingSessionId = null;
              sessionName = '';
              await update();
            }
          };
        }}>
          <input type="hidden" name="csv_class_code" value={csvClassCode} />
          <input type="hidden" name="csv_class_date" value={csvClassDate} />
          <input type="hidden" id="decisions-input" name="decisions" value="" />
          <input type="hidden" name="session_name" value={sessionName} />
          <input type="hidden" name="existing_session_id" value={existingSessionId || ''} />

          <h3 class="preview-title">Review Matches ({matchResults.length} students)</h3>

          <!-- Session Info -->
          <div class="session-card">
            {#if sessionInfo?.exists}
              <div class="session-status session-existing">
                <span class="session-status-icon">✓</span>
                Existing session found
              </div>
              <div class="session-fields">
                <div class="session-field">
                  <label>Session Name:</label>
                  <input type="text" bind:value={sessionName} class="input-text" />
                </div>
                <div class="session-field">
                  <span class="session-detail">Start: {sessionInfo.start_date}</span>
                  {#if sessionInfo.instructor}
                    <span class="session-detail">Instructor: {sessionInfo.instructor}</span>
                  {/if}
                  {#if sessionInfo.location}
                    <span class="session-detail">Location: {sessionInfo.location}</span>
                  {/if}
                </div>
              </div>
            {:else}
              <div class="session-status session-new">
                <span class="session-status-icon">+</span>
                New session will be created
              </div>
              <div class="session-fields">
                <div class="session-field">
                  <label for="reviewSessionName">Session Name:</label>
                  <input type="text" id="reviewSessionName" bind:value={sessionName} class="input-text" placeholder="e.g. Jan 2026 Level 1" />
                </div>
              </div>
            {/if}
          </div>

          <div class="review-summary">
            <span class="review-badge badge-new">{matchResults.filter(m => m.matchType === 'new').length} new</span>
            <span class="review-badge badge-add">{matchResults.filter(m => m.matchType === 'existing_no_reg' || m.matchType === 'acctid_match' || m.matchType === 'email_match' || m.matchType === 'name_match').length} existing (no reg)</span>
            <span class="review-badge badge-match">{matchResults.filter(m => m.matchType === 'existing_with_reg').length} existing (has reg)</span>
          </div>

          <div class="review-list">
            {#each matchResults as match, i (i)}
              <div class="review-card {match.matchType}">
                <div class="review-header">
                  <span class="review-num">#{i + 1}</span>
                  <span class="review-name">{match.csv.first_name} {match.csv.last_name}</span>
                  <span class="review-email">{match.csv.email}</span>
                  {#if match.csv.acct_id}<span class="acctid-tag">AcctID: {match.csv.acct_id}</span>{/if}
                  {#if match.matchType === 'new'}
                    <span class="match-badge badge-new">New Student</span>
                  {:else if match.matchType === 'acctid_match'}
                    <span class="match-badge badge-acctid">Matched by AcctID</span>
                  {:else if match.matchType === 'name_match'}
                    <span class="match-badge badge-name">Matched by Name</span>
                  {:else if match.matchType === 'existing_no_reg' || match.matchType === 'acctid_match' || match.matchType === 'email_match' || match.matchType === 'name_match'}
                    <span class="match-badge badge-add">Existing — No Registration for {csvClassCode}</span>
                  {:else}
                    <span class="match-badge badge-match">Existing — Has {match.dbRegistration?.class_code} Registration</span>
                  {/if}
                  {#if match.dbStudent}
                    <div class="db-student-info">
                      DB: {match.dbStudent.first_name} {match.dbStudent.last_name}
                      {#if match.dbStudent.email} · {match.dbStudent.email}{/if}
                      {#if match.dbStudent.vbo_account_id} <span class="acctid-tag">AcctID: {match.dbStudent.vbo_account_id}</span>{/if}
                    </div>
                  {/if}
                </div>

                {#if match.matchType === 'new'}
                  <div class="review-action-row">
                    <label class="radio-label">
                      <input type="radio" bind:group={decisions[i].action} value="add_new" /> Add new student + registration
                    </label>
                    <label class="radio-label">
                      <input type="radio" bind:group={decisions[i].action} value="skip" /> Skip
                    </label>
                  </div>

                {:else if match.matchType === 'existing_no_reg' || match.matchType === 'acctid_match' || match.matchType === 'email_match' || match.matchType === 'name_match'}
                  <div class="review-action-row">
                    <label class="radio-label">
                      <input type="radio" bind:group={decisions[i].action} value="add_reg" /> Add registration
                    </label>
                    <label class="radio-label">
                      <input type="radio" bind:group={decisions[i].action} value="skip" /> Skip
                    </label>
                  </div>

                  <!-- Show differences in student data -->
                  {#if decisions[i].action === 'add_reg' && match.dbStudent}
                    <div class="diff-section">
                      <div class="diff-title">Student data — check fields to update from CSV:</div>
                      <div class="diff-table">
                        {#if match.csv.first_name.toLowerCase() !== (match.dbStudent.first_name || '').toLowerCase()}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateFields} value="first_name" />
                            <span class="diff-field">First Name:</span>
                            <span class="diff-db">{match.dbStudent.first_name}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{match.csv.first_name}</span>
                          </label>
                        {/if}
                        {#if match.csv.last_name.toLowerCase() !== (match.dbStudent.last_name || '').toLowerCase()}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateFields} value="last_name" />
                            <span class="diff-field">Last Name:</span>
                            <span class="diff-db">{match.dbStudent.last_name}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{match.csv.last_name}</span>
                          </label>
                        {/if}
                        {#if match.csv.phone && match.csv.phone !== (match.dbStudent.phone || '')}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateFields} value="phone" />
                            <span class="diff-field">Phone:</span>
                            <span class="diff-db">{match.dbStudent.phone || '(empty)'}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{match.csv.phone}</span>
                          </label>
                        {/if}
                      </div>
                    </div>
                  {/if}

                {:else}
                  <!-- existing_with_reg -->
                  <div class="review-action-row">
                    <label class="radio-label">
                      <input type="radio" bind:group={decisions[i].action} value="update_reg" /> Update existing registration
                    </label>
                    <label class="radio-label">
                      <input type="radio" bind:group={decisions[i].action} value="add_reg" /> Add as new registration
                    </label>
                    <label class="radio-label">
                      <input type="radio" bind:group={decisions[i].action} value="skip" /> Skip
                    </label>
                  </div>

                  {#if decisions[i].action === 'update_reg' && match.dbStudent && match.dbRegistration}
                    <div class="diff-section">
                      <div class="diff-title">Student data — check fields to update:</div>
                      <div class="diff-table">
                        {#if match.csv.first_name.toLowerCase() !== (match.dbStudent.first_name || '').toLowerCase()}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateStudentFields} value="first_name" />
                            <span class="diff-field">First Name:</span>
                            <span class="diff-db">{match.dbStudent.first_name}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{match.csv.first_name}</span>
                          </label>
                        {/if}
                        {#if match.csv.last_name.toLowerCase() !== (match.dbStudent.last_name || '').toLowerCase()}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateStudentFields} value="last_name" />
                            <span class="diff-field">Last Name:</span>
                            <span class="diff-db">{match.dbStudent.last_name}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{match.csv.last_name}</span>
                          </label>
                        {/if}
                        {#if match.csv.phone && match.csv.phone !== (match.dbStudent.phone || '')}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateStudentFields} value="phone" />
                            <span class="diff-field">Phone:</span>
                            <span class="diff-db">{match.dbStudent.phone || '(empty)'}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{match.csv.phone}</span>
                          </label>
                        {/if}
                      </div>

                      <div class="diff-title">Registration data — check fields to update:</div>
                      <div class="diff-table">
                        {#if csvClassDate !== match.dbRegistration.class_date}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateRegFields} value="class_date" />
                            <span class="diff-field">Class Date:</span>
                            <span class="diff-db">{match.dbRegistration.class_date}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{csvClassDate}</span>
                          </label>
                        {/if}
                        {#if match.csv.amount_paid !== match.dbRegistration.amount_paid}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateRegFields} value="amount_paid" />
                            <span class="diff-field">Amount Paid:</span>
                            <span class="diff-db">${match.dbRegistration.amount_paid.toFixed(2)}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">${match.csv.amount_paid.toFixed(2)}</span>
                          </label>
                        {/if}
                        {#if match.csv.registration_date && match.csv.registration_date !== match.dbRegistration.registration_date}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateRegFields} value="registration_date" />
                            <span class="diff-field">Reg Date:</span>
                            <span class="diff-db">{match.dbRegistration.registration_date}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{match.csv.registration_date}</span>
                          </label>
                        {/if}
                      </div>
                    </div>
                  {/if}

                  {#if decisions[i].action === 'add_reg' && match.dbStudent}
                    <div class="diff-section">
                      <div class="diff-title">Student data — check fields to update:</div>
                      <div class="diff-table">
                        {#if match.csv.first_name.toLowerCase() !== (match.dbStudent.first_name || '').toLowerCase()}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateFields} value="first_name" />
                            <span class="diff-field">First Name:</span>
                            <span class="diff-db">{match.dbStudent.first_name}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{match.csv.first_name}</span>
                          </label>
                        {/if}
                        {#if match.csv.last_name.toLowerCase() !== (match.dbStudent.last_name || '').toLowerCase()}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateFields} value="last_name" />
                            <span class="diff-field">Last Name:</span>
                            <span class="diff-db">{match.dbStudent.last_name}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{match.csv.last_name}</span>
                          </label>
                        {/if}
                        {#if match.csv.phone && match.csv.phone !== (match.dbStudent.phone || '')}
                          <label class="diff-row">
                            <input type="checkbox" bind:group={decisions[i].updateFields} value="phone" />
                            <span class="diff-field">Phone:</span>
                            <span class="diff-db">{match.dbStudent.phone || '(empty)'}</span>
                            <span class="diff-arrow">→</span>
                            <span class="diff-csv">{match.csv.phone}</span>
                          </label>
                        {/if}
                      </div>
                    </div>
                  {/if}
                {/if}
              </div>
            {/each}
          </div>

          <div class="form-actions">
            <button type="submit" class="btn-primary">Confirm Import</button>
            <button type="button" class="btn-secondary" on:click={() => { reviewMode = false; }}>Back to Preview</button>
            <button type="button" class="btn-secondary" on:click={() => { reviewMode = false; csvPreview = false; csvParsed = []; matchResults = []; sessionInfo = null; existingSessionId = null; sessionName = ''; }}>Cancel</button>
          </div>
        </form>
      {:else if csvPreview}
        <div class="alert alert-error">No valid rows found in CSV. Make sure it has columns for email, first name, and last name.</div>
      {/if}
    </div>
  {/if}
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
    padding: 1rem 1.5rem;
    border-radius: 0.5rem;
    margin-bottom: 1.5rem;
    font-weight: 500;
  }

  .alert-success {
    background-color: #ecfdf5;
    color: #065f46;
    border: 1px solid #a7f3d0;
  }

  .alert-error {
    background-color: #fef2f2;
    color: #991b1b;
    border: 1px solid #fecaca;
  }

  .results-details {
    margin-top: 0.75rem;
    font-weight: 400;
    font-size: 0.9rem;
  }

  .results-details summary {
    cursor: pointer;
    font-weight: 500;
  }

  .results-details ul {
    margin: 0.5rem 0 0 0;
    padding-left: 1.5rem;
  }

  .results-details li {
    margin-bottom: 0.25rem;
  }

  .tag {
    display: inline-block;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .tag-new {
    background-color: #dbeafe;
    color: #1e40af;
  }

  .tag-existing {
    background-color: #f3f4f6;
    color: #374151;
  }

  /* Tabs */
  .tabs {
    display: flex;
    gap: 0;
    margin-bottom: 1.5rem;
    border-bottom: 2px solid #e5e7eb;
  }

  .tab {
    padding: 0.75rem 1.5rem;
    border: none;
    background: none;
    font-size: 1rem;
    font-weight: 500;
    color: #6b7280;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -2px;
    transition: all 0.2s;
  }

  .tab:hover {
    color: #374151;
  }

  .tab.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
  }

  /* Table */
  .table-wrapper {
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
  }

  th {
    padding: 0.625rem 0.5rem;
    text-align: left;
    font-weight: 600;
    color: #374151;
    font-size: 0.8rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-bottom: 2px solid #e5e7eb;
    white-space: nowrap;
  }

  td {
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid #f3f4f6;
    vertical-align: middle;
  }

  .col-actions {
    width: 70px;
  }

  .col-right {
    text-align: right;
  }

  .row-num {
    color: #9ca3af;
    font-size: 0.8rem;
    text-align: center;
  }

  .csv-email {
    font-size: 0.85rem;
    color: #6b7280;
  }

  .guest-row {
    background-color: #fffbeb;
  }

  .guest-row:hover {
    background-color: #fef3c7 !important;
  }

  .input-guest {
    background-color: #fffbeb;
    border-color: #fbbf24;
    font-size: 0.85rem;
    padding: 0.3rem 0.4rem;
  }

  .input-guest:focus {
    border-color: #f59e0b;
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.15);
  }

  .guest-tag {
    display: inline-block;
    padding: 0.15rem 0.4rem;
    background-color: #fef3c7;
    color: #92400e;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    vertical-align: middle;
    margin-right: 0.25rem;
  }

  /* Inputs */
  .input-text,
  .input-select,
  .input-date,
  .input-number {
    padding: 0.4rem 0.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.85rem;
    width: 100%;
    background-color: white;
    box-sizing: border-box;
  }

  .input-email {
    min-width: 180px;
  }

  .input-phone {
    min-width: 120px;
  }

  .input-number {
    text-align: right;
    width: 90px;
  }

  .input-date {
    min-width: 130px;
  }

  .input-select {
    min-width: 140px;
  }

  .input-text:focus,
  .input-select:focus,
  .input-date:focus,
  .input-number:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
  }

  .input-file {
    font-size: 0.9rem;
  }

  /* Row actions */
  .row-actions {
    display: flex;
    gap: 0.25rem;
    justify-content: center;
  }

  .btn-add {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    border: none;
    background-color: #3b82f6;
    color: white;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
    line-height: 1;
  }

  .btn-add:hover {
    background-color: #2563eb;
  }

  .btn-remove,
  .btn-remove-sm {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    border: none;
    background-color: #ef4444;
    color: white;
    font-size: 1.1rem;
    font-weight: 700;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background-color 0.2s;
    line-height: 1;
  }

  .btn-remove:hover,
  .btn-remove-sm:hover {
    background-color: #dc2626;
  }

  .btn-remove-sm {
    width: 1.5rem;
    height: 1.5rem;
    font-size: 0.9rem;
  }

  /* CSV Section */
  .csv-section {
    margin-bottom: 2rem;
  }

  .csv-config {
    background: white;
    padding: 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
  }

  .config-row {
    display: flex;
    gap: 2rem;
    align-items: end;
    flex-wrap: wrap;
  }

  .config-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .config-group label {
    font-weight: 600;
    color: #374151;
    font-size: 0.875rem;
  }

  .preview-title {
    font-size: 1.1rem;
    font-weight: 600;
    color: #374151;
    margin: 0 0 1rem 0;
  }

  /* Buttons */
  .form-actions {
    display: flex;
    gap: 1rem;
    align-items: center;
  }

  .btn-primary {
    background-color: #3b82f6;
    color: white;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    font-weight: 600;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #2563eb;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
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

  /* Session Card */
  .session-card {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    padding: 1rem 1.25rem;
    margin-bottom: 1.5rem;
    border-left: 4px solid #3b82f6;
  }

  .session-status {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.75rem;
  }

  .session-existing {
    color: #065f46;
  }

  .session-new {
    color: #1e40af;
  }

  .session-status-icon {
    font-size: 1rem;
  }

  .session-fields {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .session-field {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .session-field label {
    font-weight: 600;
    font-size: 0.85rem;
    color: #374151;
    min-width: 100px;
  }

  .session-field .input-text {
    flex: 1;
    max-width: 400px;
  }

  .session-detail {
    font-size: 0.85rem;
    color: #6b7280;
    padding: 0.2rem 0.6rem;
    background-color: #f3f4f6;
    border-radius: 0.25rem;
  }

  .config-group-wide {
    flex: 1;
    min-width: 250px;
  }

  /* Review Mode */
  .review-summary {
    display: flex;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .review-badge {
    padding: 0.4rem 1rem;
    border-radius: 9999px;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .badge-new {
    background-color: #dbeafe;
    color: #1e40af;
  }

  .badge-add {
    background-color: #dcfce7;
    color: #166534;
  }

  .badge-match {
    background-color: #fef3c7;
    color: #92400e;
  }

  .review-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .review-card {
    background: white;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    padding: 1rem 1.25rem;
    border-left: 4px solid #d1d5db;
  }

  .review-card.new {
    border-left-color: #3b82f6;
  }

  .review-card.existing_no_reg {
    border-left-color: #10b981;
  }

  .review-card.existing_with_reg {
    border-left-color: #f59e0b;
  }

  .review-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    flex-wrap: wrap;
  }

  .review-num {
    color: #9ca3af;
    font-size: 0.85rem;
    font-weight: 600;
  }

  .review-name {
    font-weight: 600;
    color: #1a202c;
  }

  .review-email {
    color: #6b7280;
    font-size: 0.85rem;
  }

  .match-badge {
    padding: 0.2rem 0.6rem;
    border-radius: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    margin-left: auto;
  }

  .badge-acctid { background: #dbeafe; color: #1e40af; }
  .badge-name { background: #fef3c7; color: #92400e; }
  .acctid-tag { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 600; background-color: #dbeafe; color: #1e40af; margin-left: 0.4rem; font-family: monospace; }
  .db-student-info { font-size: 0.8rem; color: #6b7280; margin-top: 0.25rem; }

  .review-action-row {
    display: flex;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.5rem;
  }

  .radio-label {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.9rem;
    color: #374151;
    cursor: pointer;
  }

  .radio-label input[type="radio"] {
    accent-color: #3b82f6;
  }

  .diff-section {
    margin-top: 0.75rem;
    padding-top: 0.75rem;
    border-top: 1px solid #f3f4f6;
  }

  .diff-title {
    font-size: 0.8rem;
    font-weight: 600;
    color: #6b7280;
    margin-bottom: 0.5rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .diff-table {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    margin-bottom: 0.75rem;
  }

  .diff-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.35rem 0.5rem;
    background-color: #fefce8;
    border-radius: 0.25rem;
    font-size: 0.85rem;
    cursor: pointer;
  }

  .diff-row:hover {
    background-color: #fef9c3;
  }

  .diff-row input[type="checkbox"] {
    accent-color: #3b82f6;
  }

  .diff-field {
    font-weight: 600;
    color: #374151;
    min-width: 90px;
  }

  .diff-db {
    color: #991b1b;
    background-color: #fee2e2;
    padding: 0.1rem 0.4rem;
    border-radius: 0.2rem;
  }

  .diff-arrow {
    color: #9ca3af;
  }

  .diff-csv {
    color: #166534;
    background-color: #dcfce7;
    padding: 0.1rem 0.4rem;
    border-radius: 0.2rem;
  }

  .detection-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    margin: 1rem 0;
    background-color: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 0.375rem;
    font-size: 0.9rem;
    color: #065f46;
    flex-wrap: wrap;
  }

  .detection-icon {
    font-weight: 700;
    font-size: 1rem;
  }

  .detection-tag {
    display: inline-block;
    padding: 0.2rem 0.6rem;
    background-color: #d1fae5;
    border-radius: 0.25rem;
    font-weight: 600;
    font-size: 0.85rem;
  }

  .detection-note {
    color: #6b7280;
    font-size: 0.8rem;
    font-style: italic;
  }

  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    header {
      flex-direction: column;
      gap: 1rem;
    }

    .config-row {
      flex-direction: column;
      gap: 1rem;
    }
  }
</style>