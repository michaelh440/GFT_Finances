<!-- src/routes/corp/website_sync/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  /** @type {{ candidates: any[], pagination: any, pageSizeOptions: number[], user: any }} */
  export let data;
  export let form;

  $: user       = data.user;
  $: candidates = data.candidates ?? [];
  $: pagination = data.pagination ?? { page: 1, pageSize: 50, total: 0, totalPages: 1 };
  $: pageSizeOptions = data.pageSizeOptions ?? [25, 50, 100];

  // Track which rows are checked — default to companies needing a website with a proposed domain
  /** @type {Set<number>} */
  let checked = new Set();
  $: checked = new Set((data.candidates ?? []).filter(c => !c.has_website && c.proposed_domain).map(c => c.corp_company_id));

  // AI validation results keyed by company id
  /** @type {Record<number, { verdict: string, reason: string, summary: string, industry: string, company_size: string, checked: boolean, discoveredDomain: string }>} */
  let validationResults = {};
  let validating = false;
  let validateProgress = 0;
  let validateTotal = 0;

  // User-editable industry overrides keyed by corp_company_id
  /** @type {Record<number, string>} */
  let industryOverrides = {};
  // User-editable summary overrides keyed by corp_company_id
  /** @type {Record<number, string>} */
  let summaryOverrides = {};
  // User-editable company size overrides keyed by corp_company_id
  /** @type {Record<number, string>} */
  let sizeOverrides = {};

  // Pre-fill overrides from existing DB values
  $: {
    for (const c of (data.candidates ?? [])) {
      if (c.has_industry && !(c.corp_company_id in industryOverrides)) {
        industryOverrides[c.corp_company_id] = c.industry;
      }
      if (c.has_summary && !(c.corp_company_id in summaryOverrides)) {
        summaryOverrides[c.corp_company_id] = c.summary;
      }
      if (c.has_size && !(c.corp_company_id in sizeOverrides)) {
        sizeOverrides[c.corp_company_id] = c.company_size;
      }
    }
    industryOverrides = industryOverrides;
    summaryOverrides = summaryOverrides;
    sizeOverrides = sizeOverrides;
  }

  /** Get the domain to validate for a company — existing website or proposed */
  function domainFor(c) {
    if (c.has_website) {
      // Extract domain from stored URL (strip protocol + www)
      return c.existing_website.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
    }
    return c.proposed_domain;
  }

  async function validateWebsites() {
    validating = true;
    validationResults = {};
    // Validate ALL candidates — those with domains use the domain,
    // those without get a web search by company name
    const toValidate = candidates;
    validateTotal = toValidate.length;
    validateProgress = 0;

    for (const c of toValidate) {
      const domain = domainFor(c);
      try {
        const resp = await fetch('/corp/website_sync/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            domain: domain || '',
            companyName: !domain ? c.company_name : '',
          }),
        });
        const result = await resp.json();

        validationResults[c.corp_company_id] = {
          verdict: result.verdict,
          reason: result.reason,
          summary: result.summary || '',
          industry: result.industry || '',
          company_size: result.company_size || '',
          checked: result.checked,
          discoveredDomain: result.discoveredDomain || '',
        };
        validationResults = validationResults; // trigger reactivity

        // Seed the editable industry override with AI suggestion (only if no existing industry)
        if (result.industry && !c.has_industry) {
          industryOverrides[c.corp_company_id] = result.industry;
          industryOverrides = industryOverrides;
        }

        // Seed the editable summary override with AI suggestion (only if no existing summary)
        if (result.summary && !c.has_summary) {
          summaryOverrides[c.corp_company_id] = result.summary;
          summaryOverrides = summaryOverrides;
        }

        // Seed the editable company size override with AI suggestion (only if no existing size)
        if (result.company_size && !c.has_size) {
          sizeOverrides[c.corp_company_id] = result.company_size;
          sizeOverrides = sizeOverrides;
        }

        // Update checked state for rows that need a website
        if (!c.has_website) {
          const hasDomain = c.proposed_domain || result.discoveredDomain;
          if (hasDomain && result.checked) {
            checked.add(c.corp_company_id);
          } else {
            checked.delete(c.corp_company_id);
          }
          checked = checked;
        }
      } catch (err) {
        validationResults[c.corp_company_id] = {
          verdict: 'unknown',
          reason: 'Request failed',
          summary: '',
          industry: '',
          company_size: '',
          checked: true,
          discoveredDomain: '',
        };
        validationResults = validationResults;
      }
      validateProgress++;
    }

    validating = false;
  }

  /** @param {number} id */
  function toggle(id) {
    if (checked.has(id)) checked.delete(id);
    else checked.add(id);
    checked = checked;
  }

  function selectAll()   { checked = new Set(candidates.map(c => c.corp_company_id)); }
  function selectNone()  { checked = new Set(); }

  $: checkedCount = checked.size;
  $: checkableCount = candidates.length;

  let submitting = false;

  /** @param {number} newPage */
  function goToPage(newPage) {
    const params = new URLSearchParams($page.url.search);
    params.set('page', String(newPage));
    goto(`${$page.url.pathname}?${params.toString()}`, { invalidateAll: true });
  }

  /** @param {Event} e */
  function changePageSize(e) {
    const val = /** @type {HTMLSelectElement} */ (e.target).value;
    const params = new URLSearchParams();
    params.set('pageSize', val);
    params.set('page', '1');
    goto(`${$page.url.pathname}?${params.toString()}`, { invalidateAll: true });
  }

  /** @param {string} verdict */
  function verdictClass(verdict) {
    if (verdict === 'real') return 'verdict-real';
    if (verdict === 'temporary') return 'verdict-temp';
    return 'verdict-invalid';
  }

  /** @param {string} verdict */
  function verdictLabel(verdict) {
    if (verdict === 'real') return 'Real';
    if (verdict === 'temporary') return 'Temporary';
    if (verdict === 'invalid') return 'Invalid';
    return 'Unknown';
  }
</script>

<svelte:head>
  <title>Company Lookup | StageLedger</title>
</svelte:head>

<div class="container">
  <header>
    <div>
      <a href="/corp/companies" class="back-link">← Back to Companies</a>
      <h1>Company Lookup</h1>
      <p class="subtitle">
        AI-powered company lookup — validate websites, discover industries, and generate summaries.
        Select companies and run AI validation, then apply updates individually.
      </p>
    </div>
  </header>

  {#if form?.success}
    <div class="alert alert-success">
      Updated {form.updated} {form.updated === 1 ? 'company' : 'companies'}
      {#if form.action === 'websites'}(websites){:else if form.action === 'industries'}(industries){:else if form.action === 'summaries'}(summaries){:else if form.action === 'sizes'}(company sizes){/if}.
    </div>
  {/if}

  {#if pagination.total === 0}
    <div class="empty-state">
      No active companies found.
    </div>
  {:else}
    <div class="toolbar">
      <div class="toolbar-left">
        <span class="count-label">
          {pagination.total} compan{pagination.total !== 1 ? 'ies' : 'y'}
          &nbsp;&middot;&nbsp;
          <strong>{checkedCount}</strong> selected
        </span>
        <button class="btn-link" on:click={selectAll}>Select all</button>
        <button class="btn-link" on:click={selectNone}>Select none</button>
      </div>
      <div class="toolbar-right">
        <!-- Validate button -->
        <button class="btn-validate" disabled={validating || candidates.length === 0} on:click={validateWebsites}>
          {#if validating}
            Validating {validateProgress} of {validateTotal}…
          {:else}
            AI Company Lookup
          {/if}
        </button>

        <div class="page-size-control">
          <label for="pageSize">Show</label>
          <select id="pageSize" value={pagination.pageSize} on:change={changePageSize}>
            {#each pageSizeOptions as size}
              <option value={size}>{size}</option>
            {/each}
          </select>
        </div>
      </div>
    </div>

    <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th class="col-check">
                <input type="checkbox"
                  checked={checkableCount > 0 && checkedCount === checkableCount}
                  indeterminate={checkedCount > 0 && checkedCount < checkableCount}
                  on:change={(e) => /** @type {HTMLInputElement} */ (e.target).checked ? selectAll() : selectNone()}
                  class="checkbox" />
              </th>
              <th>Company</th>
              <th>Industry</th>
              <th>Website</th>
              <th class="col-center">Based On</th>
              <th>Contacts</th>
              {#if Object.keys(validationResults).length > 0}
                <th>Proposed Industry</th>
                <th>Company Size</th>
                <th>Proposed Summary</th>
                <th>AI Result</th>
              {/if}
            </tr>
          </thead>
          <tbody>
            {#each candidates as c (c.corp_company_id)}
              {@const vr = validationResults[c.corp_company_id]}
              {@const effectiveDomain = c.proposed_domain || vr?.discoveredDomain}
              <tr class:unchecked={!checked.has(c.corp_company_id)}
                  on:click={() => toggle(c.corp_company_id)}
                  style="cursor:pointer">
                <td class="col-check" on:click|stopPropagation>
                  <input type="checkbox"
                    checked={checked.has(c.corp_company_id)}
                    on:change={() => toggle(c.corp_company_id)}
                    class="checkbox" />
                </td>
                <td class="company-name">
                  <a href="/corp/companies/{c.corp_company_id}"
                    on:click|stopPropagation
                    class="company-link">
                    {c.company_name}
                  </a>
                </td>
                <td>
                  {#if c.has_industry}
                    <span class="existing-value">{c.industry}</span>
                  {:else if industryOverrides[c.corp_company_id]}
                    <span class="proposed-value" title="AI proposed">{industryOverrides[c.corp_company_id]}</span>
                  {:else}
                    <span class="muted">—</span>
                  {/if}
                </td>
                <td>
                  {#if c.has_website}
                    <a href={c.existing_website.startsWith('http') ? c.existing_website : `https://${c.existing_website}`}
                       target="_blank" rel="noopener" on:click|stopPropagation
                       class="domain-pill existing">{c.existing_website}</a>
                  {:else if c.proposed_domain}
                    <a href="https://{c.proposed_domain}" target="_blank" rel="noopener" on:click|stopPropagation class="domain-pill proposed">{c.proposed_domain}</a>
                  {:else if vr?.discoveredDomain}
                    <a href="https://{vr.discoveredDomain}" target="_blank" rel="noopener" on:click|stopPropagation class="domain-pill discovered">{vr.discoveredDomain}</a>
                  {:else}
                    <span class="muted small">No email domain</span>
                  {/if}
                </td>
                <td class="col-center">
                  {#if c.has_website}
                    <span class="existing-badge">Saved</span>
                  {:else if c.proposed_domain}
                    <span class="count-badge">{c.domain_count} contact{c.domain_count !== 1 ? 's' : ''}</span>
                  {:else if vr?.discoveredDomain}
                    <span class="search-badge">Search</span>
                  {:else}
                    <span class="muted small">—</span>
                  {/if}
                </td>
                <td class="muted small">{c.contact_names ?? '—'}</td>
                {#if Object.keys(validationResults).length > 0}
                  <td on:click|stopPropagation>
                    {#if vr || industryOverrides[c.corp_company_id]}
                      <input type="text"
                        class="inline-edit"
                        value={industryOverrides[c.corp_company_id] ?? ''}
                        on:input={(e) => { industryOverrides[c.corp_company_id] = /** @type {HTMLInputElement} */ (e.target).value; industryOverrides = industryOverrides; }}
                        placeholder="Enter industry…" />
                    {:else}
                      <span class="muted small">—</span>
                    {/if}
                  </td>
                  <td on:click|stopPropagation>
                    {#if vr || sizeOverrides[c.corp_company_id]}
                      <select
                        class="inline-edit size-select"
                        value={sizeOverrides[c.corp_company_id] ?? ''}
                        on:change={(e) => { sizeOverrides[c.corp_company_id] = /** @type {HTMLSelectElement} */ (e.target).value; sizeOverrides = sizeOverrides; }}>
                        <option value="">—</option>
                        <option value="1-10">1-10</option>
                        <option value="11-50">11-50</option>
                        <option value="51-200">51-200</option>
                        <option value="201-500">201-500</option>
                        <option value="501-1000">501-1000</option>
                        <option value="1001-5000">1001-5000</option>
                        <option value="5000+">5000+</option>
                      </select>
                    {:else}
                      <span class="muted small">—</span>
                    {/if}
                  </td>
                  <td on:click|stopPropagation>
                    {#if vr || summaryOverrides[c.corp_company_id]}
                      <textarea
                        class="inline-edit summary-edit"
                        value={summaryOverrides[c.corp_company_id] ?? ''}
                        on:input={(e) => { summaryOverrides[c.corp_company_id] = /** @type {HTMLTextAreaElement} */ (e.target).value; summaryOverrides = summaryOverrides; }}
                        placeholder="Enter summary…"
                        rows="2"></textarea>
                    {:else}
                      <span class="muted small">—</span>
                    {/if}
                  </td>
                  <td>
                    {#if vr}
                      <span class="verdict-badge {verdictClass(vr.verdict)}">{verdictLabel(vr.verdict)}</span>
                      <span class="verdict-reason" title={vr.reason}>{vr.reason}</span>
                    {:else}
                      <span class="muted small">—</span>
                    {/if}
                  </td>
                {/if}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      {#if pagination.totalPages > 1}
        <div class="pagination">
          <button class="page-btn" disabled={pagination.page <= 1} on:click|preventDefault={() => goToPage(pagination.page - 1)}>← Prev</button>
          <span class="page-info">Page {pagination.page} of {pagination.totalPages}</span>
          <button class="page-btn" disabled={pagination.page >= pagination.totalPages} on:click|preventDefault={() => goToPage(pagination.page + 1)}>Next →</button>
        </div>
      {/if}

      {#if Object.keys(validationResults).length > 0}
        <div class="action-bar">
          <span class="action-note">
            {checkedCount} of {candidates.length} companies selected
          </span>
          <div class="action-buttons">
            <!-- Update Websites -->
            <form method="POST" action="?/updateWebsites" use:enhance={() => {
              submitting = true;
              return async ({ update }) => { submitting = false; await update(); };
            }}>
              {#each candidates as c (c.corp_company_id)}
                {#if checked.has(c.corp_company_id)}
                  <input type="hidden" name="selected" value={c.corp_company_id} />
                  {#if !c.has_website && (c.proposed_domain || validationResults[c.corp_company_id]?.discoveredDomain)}
                    <input type="hidden" name="approved" value="{c.corp_company_id}:{c.proposed_domain || validationResults[c.corp_company_id]?.discoveredDomain}" />
                  {/if}
                {/if}
              {/each}
              <button type="submit" class="btn-action-update btn-websites" disabled={submitting || checkedCount === 0}>
                Update Websites
              </button>
            </form>

            <!-- Update Industries -->
            <form method="POST" action="?/updateIndustries" use:enhance={() => {
              submitting = true;
              return async ({ update }) => { submitting = false; await update(); };
            }}>
              {#each candidates as c (c.corp_company_id)}
                {#if checked.has(c.corp_company_id)}
                  <input type="hidden" name="selected" value={c.corp_company_id} />
                  {#if industryOverrides[c.corp_company_id]}
                    <input type="hidden" name="industry" value="{c.corp_company_id}:{industryOverrides[c.corp_company_id]}" />
                  {/if}
                {/if}
              {/each}
              <button type="submit" class="btn-action-update btn-industries" disabled={submitting || checkedCount === 0}>
                Update Industries
              </button>
            </form>

            <!-- Update Summaries -->
            <form method="POST" action="?/updateSummaries" use:enhance={() => {
              submitting = true;
              return async ({ update }) => { submitting = false; await update(); };
            }}>
              {#each candidates as c (c.corp_company_id)}
                {#if checked.has(c.corp_company_id)}
                  <input type="hidden" name="selected" value={c.corp_company_id} />
                  {#if summaryOverrides[c.corp_company_id]}
                    <input type="hidden" name="summary" value="{c.corp_company_id}:{summaryOverrides[c.corp_company_id]}" />
                  {/if}
                {/if}
              {/each}
              <button type="submit" class="btn-action-update btn-summaries" disabled={submitting || checkedCount === 0}>
                Update Summaries
              </button>
            </form>

            <!-- Update Company Sizes -->
            <form method="POST" action="?/updateSizes" use:enhance={() => {
              submitting = true;
              return async ({ update }) => { submitting = false; await update(); };
            }}>
              {#each candidates as c (c.corp_company_id)}
                {#if checked.has(c.corp_company_id)}
                  <input type="hidden" name="selected" value={c.corp_company_id} />
                  {#if sizeOverrides[c.corp_company_id]}
                    <input type="hidden" name="company_size" value="{c.corp_company_id}:{sizeOverrides[c.corp_company_id]}" />
                  {/if}
                {/if}
              {/each}
              <button type="submit" class="btn-action-update btn-sizes" disabled={submitting || checkedCount === 0}>
                Update Sizes
              </button>
            </form>
          </div>
        </div>
      {/if}
  {/if}
</div>

<style>
  .container { max-width: 1600px; margin: 0 auto; padding: 2rem; }
  header { margin-bottom: 1.5rem; }
  .back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
  .back-link:hover { color: #3b82f6; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
  .subtitle { color: #6b7280; margin: 0.25rem 0 0; font-size: 0.875rem; max-width: 560px; }

  .alert { padding: 0.875rem 1.25rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
  .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }

  .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.75rem; }
  .toolbar-left { display: flex; align-items: center; gap: 1rem; }
  .toolbar-right { display: flex; align-items: center; gap: 1rem; }
  .count-label { font-size: 0.875rem; color: #6b7280; }
  .btn-link { background: none; border: none; color: #3b82f6; font-size: 0.8rem; cursor: pointer; padding: 0; }
  .btn-link:hover { text-decoration: underline; }

  .btn-validate { background: #7c3aed; color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.85rem; cursor: pointer; transition: background-color 0.2s; }
  .btn-validate:hover { background: #6d28d9; }
  .btn-validate:disabled { background: #c4b5fd; cursor: not-allowed; }

  .page-size-control { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #6b7280; }
  .page-size-control select { padding: 0.3rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; }

  .table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; margin-bottom: 1rem; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: #f9fafb; }
  th { padding: 0.625rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
  th.col-check { width: 2.5rem; }
  th.col-center, td.col-center { text-align: center; }
  td { padding: 0.55rem 1rem; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; color: #1a202c; }
  tr:hover td { background: #f9fafb; }
  tr.unchecked td { opacity: 0.4; }

  .checkbox { accent-color: #3b82f6; width: 1rem; height: 1rem; cursor: pointer; }
  .company-name { font-weight: 500; }
  .company-link { color: #3b82f6; text-decoration: none; }
  .company-link:hover { text-decoration: underline; }
  .muted { color: #6b7280; }
  .small { font-size: 0.8rem; }

  .domain-pill { font-family: monospace; font-size: 0.8rem; padding: 0.2rem 0.5rem; border-radius: 0.25rem; text-decoration: none; }
  .domain-pill.existing { background: #ecfdf5; color: #065f46; }
  .domain-pill.existing:hover { background: #d1fae5; }
  .domain-pill.proposed { background: #dbeafe; color: #1e40af; }
  .domain-pill.proposed:hover { background: #bfdbfe; }
  .domain-pill.discovered { background: #faf5ff; color: #7c3aed; }
  .domain-pill.discovered:hover { background: #ede9fe; }
  .existing-value { font-size: 0.85rem; color: #374151; }
  .proposed-value { font-size: 0.85rem; color: #7c3aed; font-style: italic; }
  .existing-badge { font-size: 0.7rem; background: #ecfdf5; color: #065f46; padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 500; white-space: nowrap; }
  .count-badge { font-size: 0.75rem; background: #f3f4f6; color: #374151; padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 500; white-space: nowrap; }
  .search-badge { font-size: 0.7rem; background: #faf5ff; color: #7c3aed; padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 500; white-space: nowrap; }

  .inline-edit { font-size: 0.8rem; padding: 0.25rem 0.4rem; border: 1px solid #d1d5db; border-radius: 0.25rem; width: 140px; color: #374151; background: #faf5ff; font-family: inherit; }
  .inline-edit:focus { outline: none; border-color: #7c3aed; box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.15); }
  .summary-edit { width: 220px; resize: vertical; min-height: 2.5rem; }

  .verdict-badge { display: inline-block; font-size: 0.7rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 0.25rem; text-transform: uppercase; letter-spacing: 0.03em; margin-right: 0.35rem; }
  .verdict-real { background: #dcfce7; color: #166534; }
  .verdict-temp { background: #fef9c3; color: #854d0e; }
  .verdict-invalid { background: #fee2e2; color: #991b1b; }
  .verdict-reason { font-size: 0.75rem; color: #6b7280; display: inline-block; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; vertical-align: middle; }

  .pagination { display: flex; justify-content: center; align-items: center; gap: 1rem; margin-bottom: 1rem; }
  .page-btn { background: #e5e7eb; color: #374151; padding: 0.4rem 0.75rem; border-radius: 0.375rem; border: none; font-size: 0.85rem; cursor: pointer; transition: background-color 0.2s; }
  .page-btn:hover:not(:disabled) { background: #d1d5db; }
  .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .page-info { font-size: 0.85rem; color: #6b7280; }

  .action-bar { display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; padding: 1rem 0; flex-wrap: wrap; }
  .action-note { font-size: 0.85rem; color: #6b7280; }
  .action-buttons { display: flex; gap: 0.75rem; flex-wrap: wrap; }
  .btn-action-update { padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.85rem; cursor: pointer; transition: background-color 0.2s; color: white; }
  .btn-action-update:disabled { opacity: 0.5; cursor: not-allowed; }
  .btn-websites { background: #3b82f6; }
  .btn-websites:hover:not(:disabled) { background: #2563eb; }
  .btn-industries { background: #7c3aed; }
  .btn-industries:hover:not(:disabled) { background: #6d28d9; }
  .btn-summaries { background: #059669; }
  .btn-summaries:hover:not(:disabled) { background: #047857; }
  .btn-sizes { background: #d97706; }
  .btn-sizes:hover:not(:disabled) { background: #b45309; }
  .size-select { width: 110px; }

  .empty-state { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 3rem; text-align: center; color: #6b7280; }
</style>
