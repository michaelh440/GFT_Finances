<!-- src/routes/corp/companies/[id]/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  export let data;
  export let form;

  let editing = false;

  $: company        = data.company;
  $: divisions      = data.divisions      ?? [];
  $: activeContacts = data.activeContacts ?? [];
  $: prevContacts   = data.prevContacts   ?? [];
  $: engagements    = data.engagements    ?? [];
  $: stats          = data.stats          ?? {};
  $: isDivision     = !!company?.parent_company_id;
  $: hasRollup      = divisions.length > 0;

  // Engagement filter
  let engFilter    = 'all';   // 'all' | 'paid' | 'active'
  let divFilter    = 'all';   // 'all' | company_id (string)

  $: divFilterOptions = [
    { value: 'all', label: 'All' },
    { value: String(company?.corp_company_id), label: company?.company_name ?? '' },
    ...divisions.map(d => ({ value: String(d.corp_company_id), label: d.company_name })),
  ];

  $: visibleEngagements = engagements.filter(e => {
    if (engFilter === 'paid'   && !(e.amount_paid > 0)) return false;
    if (engFilter === 'active' && e.is_archived)        return false;
    if (divFilter !== 'all'   && String(e.corp_company_id) !== divFilter) return false;
    return true;
  });

  const fmt = (/** @type {any} */ n) =>
    n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 });

  const labelify = (/** @type {string|null} */ s) =>
    s ? s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—';

  /** @param {string|null|undefined} d */
  function formatDate(d) {
    if (!d) return '—';
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric'
    });
  }

  /** @param {string|null|undefined} url */
  function displayUrl(url) {
    if (!url) return '';
    return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  }
</script>

<svelte:head>
  <title>{company?.company_name ?? 'Company'} | Corp | B&C Financial Tracker</title>
</svelte:head>

<div class="container">

  <!-- ── Header ──────────────────────────────────────────────────────── -->
  <div class="page-header">
    <div class="header-left">
      <a href="/corp/companies" class="back">← All Companies</a>
      {#if isDivision}
        <div class="parent-breadcrumb">
          <a href="/corp/companies/{company.parent_company_id}" class="parent-link">
            ← {company.parent_company_name}
          </a>
        </div>
      {/if}
      <div class="title-row">
        <h1>{company?.company_name ?? '—'}</h1>
        {#if isDivision}
          <span class="division-badge">Division</span>
        {/if}
      </div>
      <div class="header-meta">
        {#if company?.industry}
          <span class="meta-pill industry">{company.industry}</span>
        {/if}
        {#if company?.website}
          <a href={company.website} target="_blank" rel="noopener" class="meta-pill website">
            🔗 {displayUrl(company.website)}
          </a>
        {/if}
      </div>
    </div>
    <div class="header-actions">
      <a href="/corp/engagements/new?company={company?.corp_company_id}" class="btn-secondary">
        + New Engagement
      </a>
      <button class="btn-secondary" on:click={() => editing = !editing}>
        {editing ? 'Cancel' : 'Edit'}
      </button>
    </div>
  </div>

  {#if form?.success}
    <div class="alert alert-success">✓ Saved.</div>
  {/if}

  {#if company?.status === 'merged'}
    <div class="alert alert-warning">
      ⚠ This company was merged into
      <a href="/corp/companies/{company.merged_into_id}" class="alert-link">
        {company.merged_into_name ?? 'another company'}
      </a>.
      {#if company.status_note}
        {company.status_note}
      {/if}
    </div>
  {:else if company?.status === 'deactivated'}
    <div class="alert alert-error">
      This company has been deactivated.
      {#if company.status_note}{company.status_note}{/if}
    </div>
  {/if}

  <!-- ── Edit form ────────────────────────────────────────────────────── -->
  {#if editing}
    <div class="card edit-card">
      <form method="POST" action="?/updateCompany" use:enhance={() => {
        return async ({ result, update }) => {
          if (result.type === 'success') { editing = false; await update(); }
        };
      }}>
        <div class="form-grid">
          <label>Company Name
            <input name="company_name" value={company?.company_name ?? ''} />
          </label>
          <label>Industry
            <input name="industry" value={company?.industry ?? ''} placeholder="e.g. Energy, Healthcare" />
          </label>
          <label>Parent Company
            <input name="parent_company_name"
              value={company?.parent_company_name ?? ''}
              placeholder="Leave blank if top-level company" />
          </label>
          <label>Website
            <input name="website" type="url" value={company?.website ?? ''} placeholder="https://..." />
          </label>
          <label class="full">Notes
            <textarea name="notes" rows="3">{company?.notes ?? ''}</textarea>
          </label>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-primary">Save Changes</button>
          <button type="button" class="btn-secondary" on:click={() => editing = false}>Cancel</button>
        </div>
      </form>
    </div>

  {:else}

    <!-- ── Stats strip ─────────────────────────────────────────────────── -->
    <div class="stats-strip">
      <div class="stat-box">
        <div class="stat-val">{fmt(stats.total_revenue)}</div>
        <div class="stat-label">Total Revenue</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">{stats.total_engagements ?? 0}</div>
        <div class="stat-label">Engagements</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">{stats.paid_engagements ?? 0}</div>
        <div class="stat-label">Paid</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">{activeContacts.length}</div>
        <div class="stat-label">Active Contacts</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">{formatDate(stats.first_engagement_date)}</div>
        <div class="stat-label">First Engagement</div>
      </div>
      <div class="stat-box">
        <div class="stat-val">{formatDate(stats.last_engagement_date)}</div>
        <div class="stat-label">Last Engagement</div>
      </div>
    </div>

    {#if company?.notes}
      <div class="notes-block">{company.notes}</div>
    {/if}
  {/if}

  <!-- ── Divisions ────────────────────────────────────────────────────── -->
  {#if divisions.length > 0}
    <div class="section">
      <div class="section-header">
        <h2>Divisions / Sub-entities
          <span class="count-pill div">{divisions.length}</span>
        </h2>
      </div>
      <div class="divisions-grid">
        {#each divisions as div (div.corp_company_id)}
          <a href="/corp/companies/{div.corp_company_id}" class="division-card">
            <div class="div-name">{div.company_name}</div>
            {#if div.industry}
              <div class="div-industry">{div.industry}</div>
            {/if}
            <div class="div-stats">
              <span class="div-stat">{div.contact_count} contact{div.contact_count !== 1 ? 's' : ''}</span>
              <span class="div-stat">{div.engagement_count} eng</span>
              {#if div.total_revenue}
                <span class="div-stat revenue">{fmt(div.total_revenue)}</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- ── Active Contacts ──────────────────────────────────────────────── -->
  <div class="section">
    <div class="section-header">
      <h2>Active Contacts
        <span class="count-pill active">{activeContacts.length}</span>
      </h2>
    </div>
    {#if activeContacts.length === 0}
      <p class="empty">No active contacts at this company.</p>
    {:else}
      <div class="contacts-grid">
        {#each activeContacts as c (c.corp_contact_id)}
          <a href="/corp/contacts/{c.corp_contact_id}" class="contact-card active-card">
            <div class="contact-name">
              {[c.first_name, c.last_name].filter(Boolean).join(' ') || '(unnamed)'}
            </div>
            {#if hasRollup && c.corp_company_id !== company?.corp_company_id}
              <div class="contact-division">
                <a href="/corp/companies/{c.corp_company_id}"
                   class="division-tag"
                   on:click|stopPropagation>
                  {c.contact_company_name}
                </a>
              </div>
            {/if}
            {#if c.email}
              <div class="contact-detail">{c.email}</div>
            {/if}
            {#if c.phone}
              <div class="contact-detail">{c.phone}</div>
            {/if}
            {#if c.city || c.state}
              <div class="contact-detail muted">
                {[c.city, c.state].filter(Boolean).join(', ')}
              </div>
            {/if}
            <div class="contact-footer">
              <span class="eng-pill">
                {c.engagement_count} engagement{c.engagement_count !== 1 ? 's' : ''}
              </span>
              {#if c.last_engagement}
                <span class="last-eng">last {formatDate(c.last_engagement)}</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    {/if}
  </div>

  <!-- ── Previous Contacts ────────────────────────────────────────────── -->
  {#if prevContacts.length > 0}
    <div class="section">
      <div class="section-header">
        <h2>Previous Contacts
          <span class="count-pill prev">{prevContacts.length}</span>
        </h2>
      </div>
      <div class="contacts-grid">
        {#each prevContacts as c (c.corp_contact_id)}
          <a href="/corp/contacts/{c.corp_contact_id}" class="contact-card prev-card">
            <div class="contact-name">
              {[c.first_name, c.last_name].filter(Boolean).join(' ') || '(unnamed)'}
            </div>
            {#if c.email}
              <div class="contact-detail">{c.email}</div>
            {/if}
            {#if c.phone}
              <div class="contact-detail">{c.phone}</div>
            {/if}
            {#if c.current_company}
              <div class="contact-detail muted">
                Now: {#if c.current_company_id}
                  <a href="/corp/companies/{c.current_company_id}"
                     class="current-co-link"
                     on:click|stopPropagation>
                    {c.current_company}
                  </a>
                {:else}
                  {c.current_company}
                {/if}
              </div>
            {/if}
            <div class="contact-footer">
              <span class="prev-tag">Former</span>
              {#if c.recorded_at}
                <span class="last-eng">as of {formatDate(c.recorded_at)}</span>
              {/if}
            </div>
          </a>
        {/each}
      </div>
    </div>
  {/if}

  <!-- ── Engagements ──────────────────────────────────────────────────── -->
  <div class="section">
    <div class="section-header">
      <h2>Engagements
        <span class="count-pill eng">{visibleEngagements.length}</span>
      </h2>
      <div class="eng-filters">
        <button class="filter-btn" class:active={engFilter === 'all'}
          on:click={() => engFilter = 'all'}>All</button>
        <button class="filter-btn" class:active={engFilter === 'active'}
          on:click={() => engFilter = 'active'}>Active only</button>
        <button class="filter-btn" class:active={engFilter === 'paid'}
          on:click={() => engFilter = 'paid'}>Paid only</button>
        {#if hasRollup}
          <select class="div-filter-select" bind:value={divFilter}>
            {#each divFilterOptions as opt (opt.value)}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
        {/if}
      </div>
    </div>

    {#if visibleEngagements.length === 0}
      <p class="empty">No engagements match this filter.</p>
    {:else}
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Title</th>
              <th>Contact</th>
              {#if hasRollup}<th>Division</th>{/if}
              <th>Type</th>
              <th>Pipeline</th>
              <th>Contract</th>
              <th class="col-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {#each visibleEngagements as e (e.corp_engagement_id)}
              <tr class:archived={e.is_archived}>
                <td class="date-cell">{formatDate(e.engagement_date)}</td>
                <td>
                  <a href="/corp/engagements/{e.corp_engagement_id}" class="row-link">
                    {e.title || '(untitled)'}
                  </a>
                </td>
                <td>
                  <a href="/corp/contacts/{e.corp_contact_id}" class="contact-link">
                    {[e.first_name, e.last_name].filter(Boolean).join(' ') || '—'}
                  </a>
                </td>
                {#if hasRollup}
                  <td>
                    {#if e.corp_company_id !== company?.corp_company_id}
                      <a href="/corp/companies/{e.corp_company_id}" class="division-link">
                        {e.contact_company_name}
                      </a>
                    {:else}
                      <span class="muted-cell">—</span>
                    {/if}
                  </td>
                {/if}
                <td><span class="type-tag">{labelify(e.engagement_type)}</span></td>
                <td>{labelify(e.pipeline_status)}</td>
                <td>{labelify(e.contract_status)}</td>
                <td class="col-right">{fmt(e.amount_paid)}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  </div>

</div>

<style>
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }

  /* ── Header ─────────────────────────────────────────────────────────── */
  .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
  .header-left { flex: 1; min-width: 0; }
  .back { font-size: 0.85rem; color: #6b7280; text-decoration: none; display: block; margin-bottom: 0.25rem; }
  .back:hover { text-decoration: underline; }
  .parent-breadcrumb { margin-bottom: 0.2rem; }
  .parent-link { font-size: 0.85rem; color: #f59e0b; text-decoration: none; font-weight: 500; }
  .parent-link:hover { text-decoration: underline; }
  .title-row { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
  .division-badge { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; padding: 0.2rem 0.65rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
  .header-meta { display: flex; gap: 0.5rem; flex-wrap: wrap; }
  .meta-pill { display: inline-flex; align-items: center; padding: 0.2rem 0.65rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; }
  .meta-pill.industry { background: #e0e7ff; color: #4338ca; }
  .meta-pill.website  { background: #f0fdf4; color: #166534; text-decoration: none; }
  .meta-pill.website:hover { background: #dcfce7; }
  .header-actions { display: flex; gap: 0.75rem; align-items: flex-start; }

  .alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
  .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .alert-warning { background: #fef3c7; color: #92400e; border: 1px solid #fcd34d; }
  .alert-error   { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .alert-link { color: inherit; font-weight: 700; }

  /* ── Edit card ──────────────────────────────────────────────────────── */
  .card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); }
  .edit-card { padding: 1.5rem; margin-bottom: 1.5rem; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1.5rem; margin-bottom: 1rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #555; font-weight: 500; }
  label.full { grid-column: 1 / -1; }
  input, textarea { padding: 0.4rem 0.6rem; border: 1px solid #d1d5db; border-radius: 4px; font-size: 0.9rem; font-weight: 400; }
  input:focus, textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
  textarea { resize: vertical; }
  .form-actions { display: flex; gap: 0.75rem; }

  /* ── Stats strip ────────────────────────────────────────────────────── */
  .stats-strip { display: flex; gap: 1px; background: #e5e7eb; border-radius: 0.5rem; overflow: hidden; margin-bottom: 1.5rem; }
  .stat-box { flex: 1; background: white; padding: 1rem 1.25rem; min-width: 0; }
  .stat-val { font-size: 1.2rem; font-weight: 700; color: #1a202c; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .stat-label { font-size: 0.72rem; color: #9ca3af; margin-top: 0.2rem; text-transform: uppercase; letter-spacing: 0.05em; }

  .notes-block { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 0.875rem 1rem; margin-bottom: 1.5rem; font-size: 0.9rem; color: #374151; line-height: 1.6; }

  /* ── Sections ───────────────────────────────────────────────────────── */
  .section { margin-bottom: 2rem; }
  .section-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1rem; flex-wrap: wrap; }
  h2 { font-size: 1.1rem; font-weight: 600; color: #1a202c; margin: 0; display: flex; align-items: center; gap: 0.5rem; }

  .count-pill { padding: 0.15rem 0.6rem; border-radius: 9999px; font-size: 0.78rem; font-weight: 600; }
  .count-pill.div    { background: #fef3c7; color: #92400e; }
  .count-pill.active { background: #dcfce7; color: #166534; }
  .count-pill.prev   { background: #f1f5f9; color: #64748b; }
  .count-pill.eng    { background: #e0e7ff; color: #4338ca; }

  /* ── Divisions ──────────────────────────────────────────────────────── */
  .divisions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 0.75rem; }
  .division-card { display: block; text-decoration: none; background: white; border: 1px solid #e5e7eb; border-left: 3px solid #f59e0b; border-radius: 0.5rem; padding: 0.875rem 1rem; transition: all 0.15s; }
  .division-card:hover { border-color: #fbbf24; box-shadow: 0 1px 4px rgba(245,158,11,0.2); }
  .div-name     { font-weight: 600; color: #1a202c; font-size: 0.95rem; margin-bottom: 0.2rem; }
  .div-industry { font-size: 0.8rem; color: #6b7280; margin-bottom: 0.4rem; }
  .div-stats    { display: flex; gap: 0.4rem; flex-wrap: wrap; }
  .div-stat     { font-size: 0.75rem; background: #f3f4f6; color: #374151; padding: 0.1rem 0.4rem; border-radius: 0.25rem; }
  .div-stat.revenue { background: #dcfce7; color: #166534; }

  /* ── Contact cards ──────────────────────────────────────────────────── */
  .contacts-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 0.75rem; }
  .contact-card { display: block; text-decoration: none; padding: 0.875rem 1rem; border-radius: 0.5rem; border: 1px solid #e5e7eb; transition: all 0.15s; }
  .contact-card:hover { border-color: #93c5fd; box-shadow: 0 1px 4px rgba(59,130,246,0.15); }
  .active-card { background: white; border-left: 3px solid #22c55e; }
  .prev-card   { background: #f9fafb; border-left: 3px solid #94a3b8; }
  .contact-name   { font-weight: 600; color: #1a202c; font-size: 0.95rem; margin-bottom: 0.3rem; }
  .contact-detail { font-size: 0.82rem; color: #374151; margin-bottom: 0.1rem; word-break: break-word; }
  .contact-detail.muted { color: #9ca3af; }
  .current-co-link { color: #3b82f6; text-decoration: none; }
  .current-co-link:hover { text-decoration: underline; }
  .contact-footer { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
  .eng-pill  { font-size: 0.72rem; background: #e0e7ff; color: #4338ca; padding: 0.1rem 0.4rem; border-radius: 9999px; font-weight: 600; }
  .prev-tag  { font-size: 0.72rem; background: #f1f5f9; color: #64748b; padding: 0.1rem 0.4rem; border-radius: 9999px; font-weight: 600; }
  .last-eng  { font-size: 0.72rem; color: #9ca3af; }

  .contact-division { margin-bottom: 0.25rem; }
  .division-tag { font-size: 0.72rem; background: #fef3c7; color: #92400e; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-weight: 600; text-decoration: none; display: inline-block; }
  .division-tag:hover { background: #fde68a; }
  .division-link { font-size: 0.8rem; color: #f59e0b; text-decoration: none; font-weight: 500; }
  .division-link:hover { text-decoration: underline; }
  .muted-cell { color: #d1d5db; }
  .div-filter-select { padding: 0.25rem 0.5rem; border: 1px solid #e5e7eb; border-radius: 0.375rem; background: white; font-size: 0.8rem; color: #374151; cursor: pointer; margin-left: 0.25rem; }
  .eng-filters { display: flex; gap: 0.25rem; margin-left: auto; align-items: center; flex-wrap: wrap; }
  .filter-btn { padding: 0.25rem 0.75rem; border: 1px solid #e5e7eb; border-radius: 9999px; background: white; color: #6b7280; font-size: 0.8rem; cursor: pointer; transition: all 0.15s; }
  .filter-btn:hover { border-color: #3b82f6; color: #3b82f6; }
  .filter-btn.active { background: #3b82f6; border-color: #3b82f6; color: white; }

  /* ── Engagements table ──────────────────────────────────────────────── */
  .table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: #f9fafb; }
  th { padding: 0.625rem 0.875rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
  th.col-right, td.col-right { text-align: right; }
  td { padding: 0.5rem 0.875rem; border-bottom: 1px solid #f3f4f6; font-size: 0.875rem; color: #1a202c; }
  tr:last-child td { border-bottom: none; }
  tr:hover td { background: #f9fafb; }
  tr.archived td { color: #9ca3af; }
  .date-cell { white-space: nowrap; color: #6b7280; font-size: 0.82rem; }
  .row-link { color: #3b82f6; text-decoration: none; font-weight: 500; }
  .row-link:hover { text-decoration: underline; }
  .contact-link { color: #374151; text-decoration: none; font-size: 0.85rem; }
  .contact-link:hover { color: #3b82f6; }
  .type-tag { font-size: 0.78rem; background: #f3f4f6; padding: 0.15rem 0.4rem; border-radius: 0.25rem; }

  .empty { color: #9ca3af; font-style: italic; font-size: 0.875rem; }

  /* ── Buttons ────────────────────────────────────────────────────────── */
  .btn-primary   { background: #3b82f6; color: white; padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; border: none; cursor: pointer; }
  .btn-primary:hover   { background: #2563eb; }
  .btn-secondary { background: #e5e7eb; color: #374151; padding: 0.5rem 1rem; border-radius: 0.375rem; font-size: 0.875rem; font-weight: 500; border: none; cursor: pointer; text-decoration: none; display: inline-block; }
  .btn-secondary:hover { background: #d1d5db; }

  @media (max-width: 768px) {
    .container { padding: 1rem; }
    .page-header { flex-direction: column; }
    .stats-strip { flex-direction: column; gap: 1px; }
    .contacts-grid, .divisions-grid { grid-template-columns: 1fr; }
    .form-grid { grid-template-columns: 1fr; }
    .label.full { grid-column: 1; }
    .section-header { flex-direction: column; align-items: flex-start; gap: 0.5rem; }
    .eng-filters { margin-left: 0; }
  }
</style>