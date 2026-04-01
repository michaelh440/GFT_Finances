<!-- src/routes/reviews/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  import { resolve } from '$app/paths';

  /** @type {any} */
  export let data;
  /** @type {any} */
  export let form;

  $: reviews = data.reviews ?? [];
  $: stats = data.stats ?? {};
  $: pagination = data.pagination;
  $: canManage = data.canManage;
  $: opts = data.linkOptions ?? {};

  let showAddForm = false;
  let showImportForm = false;
  /** @type {number|null} */
  let linkingId = null;

  // Filters
  let fSource = data.filters?.source || '';
  let fSearch = data.filters?.search || '';
  let fLinked = data.filters?.linked || '';
  let fMinRating = data.filters?.minRating || '';

  function applyFilters() {
    const p = new URLSearchParams();
    if (fSource) p.set('source', fSource);
    if (fSearch) p.set('search', fSearch);
    if (fLinked) p.set('linked', fLinked);
    if (fMinRating) p.set('min_rating', fMinRating);
    const qs = p.toString();
    window.location.href = `${resolve('/reviews')}${qs ? '?' + qs : ''}`;
  }
  function clearFilters() { window.location.href = resolve('/reviews'); }

  /** @param {number} page */
  function goToPage(page) {
    const p = new URLSearchParams();
    if (fSource) p.set('source', fSource);
    if (fSearch) p.set('search', fSearch);
    if (fLinked) p.set('linked', fLinked);
    if (fMinRating) p.set('min_rating', fMinRating);
    if (page > 1) p.set('page', String(page));
    const qs = p.toString();
    window.location.href = `${resolve('/reviews')}${qs ? '?' + qs : ''}`;
  }

  /** @param {number} n */
  function stars(n) { return '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n)); }

  const SOURCES = ['google', 'yelp', 'tripadvisor', 'facebook', 'manual'];

  /** @param {KeyboardEvent} e */
  function onSearchKey(e) { if (e.key === 'Enter') applyFilters(); }
</script>

<svelte:head><title>Customer Reviews | B&C Financial Tracker</title></svelte:head>

<div class="container" data-sveltekit-reload>
  <header>
    <div>
      <h1>Customer Reviews</h1>
      <p class="subtitle">Reviews from Google, Yelp, TripAdvisor and more</p>
    </div>
    {#if canManage}
      <div class="header-actions">
        <button class="btn-primary" on:click={() => { showAddForm = !showAddForm; showImportForm = false; }}>
          {showAddForm ? 'Cancel' : '+ Add Review'}
        </button>
        <button class="btn-secondary" on:click={() => { showImportForm = !showImportForm; showAddForm = false; }}>
          {showImportForm ? 'Cancel' : 'Import CSV'}
        </button>
      </div>
    {/if}
  </header>

  {#if form?.success}
    <div class="alert alert-success">{form.message}</div>
  {/if}
  {#if form?.error}
    <div class="alert alert-error">{form.error}</div>
  {/if}

  <!-- Stats -->
  <div class="stats-bar">
    <div class="stat-card"><span class="stat-num">{stats.total ?? 0}</span><span class="stat-label">Total Reviews</span></div>
    <div class="stat-card"><span class="stat-num">{stats.avg_rating ?? '—'}</span><span class="stat-label">Avg Rating</span></div>
    <div class="stat-card"><span class="stat-num">{stats.positive ?? 0}</span><span class="stat-label">4+ Stars</span></div>
    <div class="stat-card"><span class="stat-num">{stats.source_count ?? 0}</span><span class="stat-label">Sources</span></div>
  </div>

  <!-- Add Review Form -->
  {#if showAddForm && canManage}
    <div class="form-card">
      <h2>Add Review</h2>
      <form method="POST" action="?/add" use:enhance>
        <div class="form-grid">
          <label>Source
            <select name="source">
              {#each SOURCES as s}<option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>{/each}
            </select>
          </label>
          <label>Reviewer Name <input name="reviewer_name" placeholder="John D." /></label>
          <label>Rating (1-5) <input name="rating" type="number" min="1" max="5" step="0.5" placeholder="4.5" /></label>
          <label>Date <input name="review_date" type="date" /></label>
          <label class="full">Review Text <textarea name="review_text" rows="3" placeholder="The review content..."></textarea></label>
          <label>Source URL <input name="source_url" placeholder="https://..." /></label>
          <label><input type="checkbox" name="is_featured" /> Featured</label>
        </div>
        <button type="submit" class="btn-primary">Save Review</button>
      </form>
    </div>
  {/if}

  <!-- Import CSV Form -->
  {#if showImportForm && canManage}
    <div class="form-card">
      <h2>Import Reviews from CSV</h2>
      <p class="hint">Columns: reviewer_name, rating, review_text, review_date, source_url, source_review_id (header row required)</p>
      <form method="POST" action="?/import_csv" use:enhance>
        <div class="form-grid">
          <label>Source
            <select name="import_source">
              {#each SOURCES as s}<option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>{/each}
            </select>
          </label>
        </div>
        <label class="full">CSV Data <textarea name="csv_text" rows="8" placeholder="Paste CSV data here..."></textarea></label>
        <button type="submit" class="btn-primary" style="margin-top:0.75rem">Import</button>
      </form>
    </div>
  {/if}

  <!-- Filters -->
  <div class="filter-bar">
    <select bind:value={fSource} on:change={applyFilters} class="filter-select">
      <option value="">All Sources</option>
      {#each SOURCES as s}<option value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>{/each}
    </select>
    <select bind:value={fLinked} on:change={applyFilters} class="filter-select">
      <option value="">All</option>
      <option value="yes">Linked</option>
      <option value="no">Unlinked</option>
    </select>
    <select bind:value={fMinRating} on:change={applyFilters} class="filter-select">
      <option value="">Any Rating</option>
      <option value="4">4+ Stars</option>
      <option value="3">3+ Stars</option>
      <option value="2">2+ Stars</option>
    </select>
    <div class="search-group">
      <input type="text" bind:value={fSearch} on:keydown={onSearchKey} placeholder="Search reviews..." class="search-input" />
      <button class="btn-search" on:click={applyFilters}>Search</button>
    </div>
    {#if fSource || fSearch || fLinked || fMinRating}
      <button class="btn-clear" on:click={clearFilters}>Clear</button>
    {/if}
  </div>

  <!-- Reviews list -->
  <div class="reviews-list">
    {#if reviews.length === 0}
      <div class="empty-state">No reviews found.</div>
    {:else}
      {#each reviews as r (r.review_id)}
        <div class="review-card" class:featured={r.is_featured}>
          <div class="review-header">
            <div class="review-meta">
              <span class="source-badge source-{r.source}">{r.source}</span>
              {#if r.rating}
                <span class="review-stars" title="{r.rating}/5">{stars(r.rating)}</span>
                <span class="review-rating">{r.rating}</span>
              {/if}
              {#if r.reviewer_name}
                <span class="reviewer-name">{r.reviewer_name}</span>
              {/if}
              {#if r.review_date}
                <span class="review-date">{r.review_date}</span>
              {/if}
              {#if r.is_featured}<span class="featured-badge">Featured</span>{/if}
            </div>
            {#if canManage}
              <div class="review-actions">
                <button class="btn-link-action" on:click={() => linkingId = linkingId === r.review_id ? null : r.review_id}>
                  {linkingId === r.review_id ? 'Cancel' : 'Link / Edit'}
                </button>
                <form method="POST" action="?/delete" use:enhance class="inline-form">
                  <input type="hidden" name="review_id" value={r.review_id} />
                  <button type="submit" class="btn-delete"
                    on:click={(e) => { if (!confirm('Delete this review?')) e.preventDefault(); }}>Delete</button>
                </form>
              </div>
            {/if}
          </div>

          {#if r.review_text}
            <p class="review-text">{r.review_text}</p>
          {/if}

          <!-- Current links -->
          {#if r.class_name || r.show_name || r.company_name || r.engagement_title || r.session_name}
            <div class="review-links">
              {#if r.class_name}<span class="link-pill link-class">{r.class_name}</span>{/if}
              {#if r.session_name}<span class="link-pill link-session">{r.session_name}</span>{/if}
              {#if r.show_name}<span class="link-pill link-show">{r.show_name}</span>{/if}
              {#if r.company_name}<span class="link-pill link-company">{r.company_name}</span>{/if}
              {#if r.engagement_title}<span class="link-pill link-engagement">{r.engagement_title}</span>{/if}
            </div>
          {/if}

          {#if r.source_url}
            <a href={r.source_url} target="_blank" rel="noopener" class="source-link">View original →</a>
          {/if}

          <!-- Link/edit panel -->
          {#if linkingId === r.review_id && canManage}
            <div class="link-panel">
              <form method="POST" action="?/link" use:enhance>
                <input type="hidden" name="review_id" value={r.review_id} />
                <div class="link-grid">
                  <label>Class
                    <select name="class_code">
                      <option value="">— None —</option>
                      {#each opts.classes as c (c.class_code)}<option value={c.class_code} selected={r.class_code === c.class_code}>{c.class_name}</option>{/each}
                    </select>
                  </label>
                  <label>Session
                    <select name="session_id">
                      <option value="">— None —</option>
                      {#each opts.sessions as s (s.session_id)}<option value={s.session_id} selected={r.session_id === s.session_id}>{s.session_name} ({s.class_code})</option>{/each}
                    </select>
                  </label>
                  <label>Show
                    <select name="show_code">
                      <option value="">— None —</option>
                      {#each opts.shows as s (s.show_code)}<option value={s.show_code} selected={r.show_code === s.show_code}>{s.show_name}</option>{/each}
                    </select>
                  </label>
                  <label>Company
                    <select name="corp_company_id">
                      <option value="">— None —</option>
                      {#each opts.companies as c (c.corp_company_id)}<option value={c.corp_company_id} selected={r.corp_company_id === c.corp_company_id}>{c.company_name}</option>{/each}
                    </select>
                  </label>
                  <label>Engagement
                    <select name="corp_engagement_id">
                      <option value="">— None —</option>
                      {#each opts.engagements as e (e.corp_engagement_id)}<option value={e.corp_engagement_id} selected={r.corp_engagement_id === e.corp_engagement_id}>{e.title}</option>{/each}
                    </select>
                  </label>
                  <label><input type="checkbox" name="is_featured" checked={r.is_featured} /> Featured</label>
                </div>
                <label class="full">Notes <textarea name="notes" rows="2">{r.notes ?? ''}</textarea></label>
                <button type="submit" class="btn-primary" style="margin-top:0.5rem">Save Links</button>
              </form>
            </div>
          {/if}
        </div>
      {/each}
    {/if}
  </div>

  <!-- Pagination -->
  {#if pagination.totalPages > 1}
    <div class="pagination">
      <button class="page-btn" disabled={pagination.currentPage === 1} on:click={() => goToPage(1)}>«</button>
      <button class="page-btn" disabled={pagination.currentPage === 1} on:click={() => goToPage(pagination.currentPage - 1)}>‹</button>
      <span class="page-info">Page {pagination.currentPage} of {pagination.totalPages}</span>
      <button class="page-btn" disabled={pagination.currentPage === pagination.totalPages} on:click={() => goToPage(pagination.currentPage + 1)}>›</button>
      <button class="page-btn" disabled={pagination.currentPage === pagination.totalPages} on:click={() => goToPage(pagination.totalPages)}>»</button>
    </div>
  {/if}
</div>

<style>
  .container { max-width: 1100px; margin: 0 auto; padding: 2rem; }
  header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
  h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
  h2 { font-size: 1.1rem; font-weight: 600; margin: 0 0 1rem; }
  .subtitle { color: #6b7280; margin: 0.25rem 0 0; font-size: 0.875rem; }
  .header-actions { display: flex; gap: 0.75rem; }
  .hint { font-size: 0.8rem; color: #9ca3af; margin: 0 0 0.75rem; }

  .alert { padding: 0.875rem 1.25rem; border-radius: 0.5rem; margin-bottom: 1rem; font-weight: 500; }
  .alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
  .alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

  /* Stats */
  .stats-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
  .stat-card { background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); text-align: center; }
  .stat-num { display: block; font-size: 1.5rem; font-weight: 700; color: #1a202c; }
  .stat-label { font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }

  /* Forms */
  .form-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); margin-bottom: 1.5rem; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem 1rem; margin-bottom: 0.75rem; }
  .form-grid label, .link-grid label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.82rem; font-weight: 500; color: #374151; }
  .form-grid input, .form-grid select, .form-grid textarea,
  .link-grid input, .link-grid select, .link-grid textarea { padding: 0.4rem 0.6rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; font-family: inherit; }
  .full { grid-column: 1 / -1; }

  /* Filters */
  .filter-bar { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; flex-wrap: wrap; align-items: center; }
  .filter-select { padding: 0.45rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; background: white; }
  .search-group { display: flex; gap: 0.35rem; flex: 1; max-width: 350px; }
  .search-input { flex: 1; padding: 0.45rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; }
  .btn-search { padding: 0.45rem 0.85rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; font-size: 0.82rem; font-weight: 500; cursor: pointer; }
  .btn-clear { padding: 0.45rem 0.85rem; background: white; color: #6b7280; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.82rem; cursor: pointer; }

  /* Review cards */
  .reviews-list { display: flex; flex-direction: column; gap: 0.75rem; }
  .review-card { background: white; padding: 1rem 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.08); border-left: 3px solid #e5e7eb; }
  .review-card.featured { border-left-color: #f59e0b; }
  .review-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem; }
  .review-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
  .source-badge { padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.72rem; font-weight: 600; text-transform: uppercase; }
  .source-google { background: #dcfce7; color: #166534; }
  .source-yelp { background: #fee2e2; color: #991b1b; }
  .source-tripadvisor { background: #d1fae5; color: #065f46; }
  .source-facebook { background: #dbeafe; color: #1e40af; }
  .source-manual { background: #f3f4f6; color: #374151; }
  .review-stars { color: #f59e0b; font-size: 0.9rem; letter-spacing: -1px; }
  .review-rating { font-size: 0.8rem; font-weight: 600; color: #374151; }
  .reviewer-name { font-weight: 500; color: #1a202c; font-size: 0.85rem; }
  .review-date { font-size: 0.78rem; color: #9ca3af; }
  .featured-badge { font-size: 0.7rem; background: #fef3c7; color: #92400e; padding: 0.1rem 0.4rem; border-radius: 9999px; font-weight: 600; }
  .review-text { color: #374151; font-size: 0.9rem; line-height: 1.5; margin: 0.25rem 0 0.5rem; }
  .review-links { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-bottom: 0.35rem; }
  .link-pill { padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.72rem; font-weight: 500; }
  .link-class { background: #ede9fe; color: #6d28d9; }
  .link-session { background: #e0e7ff; color: #4338ca; }
  .link-show { background: #fef3c7; color: #92400e; }
  .link-company { background: #dbeafe; color: #1e40af; }
  .link-engagement { background: #d1fae5; color: #065f46; }
  .source-link { font-size: 0.8rem; color: #3b82f6; text-decoration: none; }
  .source-link:hover { text-decoration: underline; }

  /* Actions */
  .review-actions { display: flex; gap: 0.35rem; }
  .btn-link-action { padding: 0.3rem 0.65rem; background: #e5e7eb; color: #374151; border: none; border-radius: 0.375rem; font-size: 0.78rem; cursor: pointer; }
  .btn-link-action:hover { background: #d1d5db; }
  .btn-delete { padding: 0.3rem 0.65rem; background: white; color: #dc2626; border: 1px solid #fecaca; border-radius: 0.375rem; font-size: 0.78rem; cursor: pointer; }
  .btn-delete:hover { background: #fef2f2; }
  .inline-form { display: inline; }

  /* Link panel */
  .link-panel { margin-top: 0.75rem; padding: 0.75rem; background: #f9fafb; border-radius: 0.375rem; border: 1px solid #e5e7eb; }
  .link-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem 0.75rem; margin-bottom: 0.5rem; }

  .btn-primary { background: #3b82f6; color: white; padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; }
  .btn-primary:hover { background: #2563eb; }
  .btn-secondary { background: #e5e7eb; color: #374151; padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; text-decoration: none; }
  .btn-secondary:hover { background: #d1d5db; }

  .empty-state { text-align: center; padding: 3rem; color: #6b7280; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,.1); }

  .pagination { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 1.5rem; }
  .page-btn { padding: 0.4rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: white; cursor: pointer; font-size: 0.85rem; }
  .page-btn:hover:not(:disabled) { background: #f3f4f6; }
  .page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .page-info { font-size: 0.85rem; color: #6b7280; }

  @media (max-width: 768px) {
    header { flex-direction: column; gap: 1rem; }
    .stats-bar { grid-template-columns: repeat(2, 1fr); }
    .form-grid, .link-grid { grid-template-columns: 1fr; }
  }
</style>
