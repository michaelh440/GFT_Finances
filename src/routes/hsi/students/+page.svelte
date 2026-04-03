<!-- src/routes/hsi/students/+page.svelte -->
<script>
	import { resolve } from '$app/paths';

	/** @type {any} */
	export let data;

	$: canSeePII = data.canSeePII;
	$: pagination = data.pagination || { currentPage: 1, totalPages: 1, pageSize: 50, totalCount: 0 };
	let showPII = false;

	// Filter state — init from server
	let searchTerm = '';
	let selectedClass = 'all';
	let selectedTrack = 'all';
	let selectedStatus = 'all';
	let selectedHasClasses = 'all';

	// Sync filters from URL on data change
	$: {
		searchTerm       = data.filters?.search     || '';
		selectedClass    = data.filters?.classCode   || 'all';
		selectedTrack    = data.filters?.track        || 'all';
		selectedStatus   = data.filters?.status       || 'all';
		selectedHasClasses = data.filters?.hasClasses || 'all';
	}

	$: hasFilters = selectedClass !== 'all' || selectedTrack !== 'all' || selectedStatus !== 'all' || selectedHasClasses !== 'all';

	/** @param {number} page */
	function buildParams(page) {
		const p = new URLSearchParams();
		if (searchTerm)                      p.set('search', searchTerm);
		if (selectedClass !== 'all')         p.set('class', selectedClass);
		if (selectedTrack !== 'all')         p.set('track', selectedTrack);
		if (selectedStatus !== 'all')        p.set('status', selectedStatus);
		if (selectedHasClasses !== 'all')    p.set('has_classes', selectedHasClasses);
		if (page > 1)                        p.set('page', page.toString());
		return p.toString();
	}

	function applyFilters() {
		const qs = buildParams(1);
		window.location.href = `${resolve('/hsi/students')}${qs ? '?' + qs : ''}`;
	}

	function clearFilters() {
		window.location.href = resolve('/hsi/students');
	}

	function applySearch() { applyFilters(); }

	/** @param {number} page */
	function goToPage(page) {
		const qs = buildParams(page);
		window.location.href = `${resolve('/hsi/students')}${qs ? '?' + qs : ''}`;
	}

	/**
	 * @param {number} current
	 * @param {number} total
	 * @returns {(number|string)[]}
	 */
	function pageNumbers(current, total) {
		if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
		/** @type {(number|string)[]} */
		const pages = [1];
		if (current > 3) pages.push('...');
		const start = Math.max(2, current - 1);
		const end = Math.min(total - 1, current + 1);
		for (let i = start; i <= end; i++) pages.push(i);
		if (current < total - 2) pages.push('...');
		pages.push(total);
		return pages;
	}

	$: visiblePages = pageNumbers(pagination.currentPage, pagination.totalPages);
	$: rangeStart = (pagination.currentPage - 1) * pagination.pageSize + 1;
	$: rangeEnd = Math.min(pagination.currentPage * pagination.pageSize, pagination.totalCount);

	/** @param {string|null|undefined} dateStr */
	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr + 'T12:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}

	/** @param {KeyboardEvent} e */
	function onSearchKeydown(e) { if (e.key === 'Enter') applySearch(); }
</script>

<svelte:head>
	<title>Students | StageLedger</title>
</svelte:head>

<div class="container" data-sveltekit-reload>
	<header>
		<h1>Students</h1>
		<div class="header-actions">
			{#if canSeePII}
				<a href={resolve('/hsi/students/new')} class="btn-primary">Add Students</a>
			{/if}
			<a href={resolve('/hsi')} class="btn-secondary">Back to HSI Dashboard</a>
		</div>
	</header>

	<!-- Filters -->
	<div class="filter-section">
		<div class="filter-row">
			<div class="filter-group">
				<label for="classSelect">Class:</label>
				<select id="classSelect" bind:value={selectedClass} on:change={applyFilters} class="filter-select">
					<option value="all">All Classes</option>
					{#each data.classes || [] as c (c.class_code)}
						<option value={c.class_code}>{c.class_name}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="trackSelect">Track:</label>
				<select id="trackSelect" bind:value={selectedTrack} on:change={applyFilters} class="filter-select">
					<option value="all">All Tracks</option>
					{#each data.tracks || [] as t (t)}
						<option value={t}>{t}</option>
					{/each}
				</select>
			</div>

			<div class="filter-group">
				<label for="statusSelect">Status:</label>
				<select id="statusSelect" bind:value={selectedStatus} on:change={applyFilters} class="filter-select">
					<option value="all">All</option>
					<option value="active">Active</option>
					<option value="inactive">Inactive</option>
				</select>
			</div>

			<div class="filter-group">
				<label for="hasClassesSelect">Registrations:</label>
				<select id="hasClassesSelect" bind:value={selectedHasClasses} on:change={applyFilters} class="filter-select">
					<option value="all">Any</option>
					<option value="yes">Has Classes</option>
					<option value="no">No Classes</option>
				</select>
			</div>
		</div>

		<div class="filter-row">
			<div class="search-group">
				<input type="text" placeholder="Search by name, email, or phone..."
					bind:value={searchTerm} on:keydown={onSearchKeydown} class="search-input" />
				<button class="btn-search" on:click={applySearch}>Search</button>
			</div>
			{#if hasFilters || searchTerm}
				<button class="btn-clear" on:click={clearFilters}>Clear Filters</button>
			{/if}
		</div>
	</div>

	<!-- Toolbar -->
	<div class="toolbar">
		<div class="toolbar-left">
			<span class="stat">
				{#if pagination.totalCount > 0}
					Showing {rangeStart}–{rangeEnd} of {pagination.totalCount} student{pagination.totalCount !== 1 ? 's' : ''}
				{:else}
					No students found
				{/if}
			</span>
		</div>
		<div class="toolbar-right">
			{#if canSeePII}
				<button class="btn-unmask" on:click={() => showPII = !showPII}>
					{showPII ? 'Hide PII' : 'Show PII'}
				</button>
			{/if}
		</div>
	</div>

	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Email</th>
					<th>Phone</th>
					<th>Mobile</th>
					<th class="col-center">Classes</th>
					<th>Account Date</th>
					<th>Last Class</th>
					<th>Status</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if data.students.length === 0}
					<tr>
						<td colspan="9" class="empty-state">
							{searchTerm || hasFilters ? 'No students match your filters.' : 'No students found.'}
						</td>
					</tr>
				{:else}
					{#each data.students as student (student.student_id)}
						<tr class:inactive={!student.is_active}>
							<td class="student-name">
								<a href={resolve(`/hsi/students/${student.student_id}`)} class="student-link">
									{student.first_name || ''} {student.last_name || ''}
								</a>
							</td>
							<td class="student-email">{(showPII ? student.email : student.email_masked) || '—'}</td>
							<td>{(showPII ? student.phone : student.phone_masked) || '—'}</td>
							<td>{(showPII ? student.mobile_phone : student.mobile_phone_masked) || '—'}</td>
							<td class="col-center">
								<span class="count-badge">{student.registration_count}</span>
							</td>
							<td>{formatDate(student.account_date)}</td>
							<td>{formatDate(student.last_class_date)}</td>
							<td>
								<span class="status-badge" class:active={student.is_active}>
									{student.is_active ? 'Active' : 'Inactive'}
								</span>
							</td>
							<td>
								<div class="actions">
									<a href={resolve(`/hsi/students/${student.student_id}`)} class="btn-action">View</a>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	<!-- Pagination -->
	{#if pagination.totalPages > 1}
		<div class="pagination">
			<button class="page-btn" disabled={pagination.currentPage === 1} on:click={() => goToPage(1)}>«</button>
			<button class="page-btn" disabled={pagination.currentPage === 1} on:click={() => goToPage(pagination.currentPage - 1)}>‹</button>

			{#each visiblePages as p (p)}
				{#if p === '...'}
					<span class="page-ellipsis">...</span>
				{:else}
					<button class="page-btn" class:page-active={p === pagination.currentPage}
						on:click={() => goToPage(/** @type {number} */ (p))}>{p}</button>
				{/if}
			{/each}

			<button class="page-btn" disabled={pagination.currentPage === pagination.totalPages} on:click={() => goToPage(pagination.currentPage + 1)}>›</button>
			<button class="page-btn" disabled={pagination.currentPage === pagination.totalPages} on:click={() => goToPage(pagination.totalPages)}>»</button>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; }
	.header-actions { display: flex; gap: 1rem; }

	/* Filters */
	.filter-section { background: white; padding: 1.25rem 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
	.filter-row { display: flex; gap: 1rem; align-items: flex-end; flex-wrap: wrap; margin-bottom: 0.75rem; }
	.filter-row:last-child { margin-bottom: 0; }
	.filter-group { display: flex; flex-direction: column; gap: 0.25rem; }
	.filter-group label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; }
	.filter-select { padding: 0.5rem 1rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; background-color: white; min-width: 140px; }
	.filter-select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

	.search-group { display: flex; gap: 0.5rem; flex: 1; max-width: 500px; }
	.search-input { flex: 1; padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.875rem; }
	.search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
	.btn-search { padding: 0.5rem 1rem; background: #3b82f6; color: white; border: none; border-radius: 0.375rem; font-size: 0.85rem; font-weight: 500; cursor: pointer; }
	.btn-search:hover { background: #2563eb; }
	.btn-clear { padding: 0.5rem 1rem; background: white; color: #6b7280; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; cursor: pointer; }
	.btn-clear:hover { background: #f3f4f6; color: #374151; }

	/* Toolbar */
	.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; gap: 1rem; flex-wrap: wrap; }
	.toolbar-left { display: flex; align-items: center; gap: 1rem; }
	.toolbar-right { display: flex; align-items: center; gap: 1rem; }
	.stat { font-weight: 500; color: #6b7280; font-size: 0.85rem; }
	.btn-unmask { padding: 0.4rem 0.85rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: white; color: #374151; font-size: 0.8rem; font-weight: 500; cursor: pointer; transition: all 0.15s; }
	.btn-unmask:hover { background: #f3f4f6; border-color: #3b82f6; color: #3b82f6; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	/* Table */
	.table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; margin-bottom: 1.5rem; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.875rem; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
	th.col-center, td.col-center { text-align: center; }
	td { padding: 0.625rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; font-size: 0.9rem; }
	tr:hover { background-color: #f9fafb; }
	tr.inactive { opacity: 0.5; }
	.student-name { font-weight: 500; }
	.student-link { color: #3b82f6; text-decoration: none; }
	.student-link:hover { text-decoration: underline; }
	.student-email { color: #6b7280; font-size: 0.85rem; }
	.count-badge { display: inline-block; min-width: 1.5rem; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; text-align: center; background-color: #e0e7ff; color: #4338ca; }
	.status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }
	.actions { display: flex; gap: 0.5rem; }
	.btn-action { background-color: #e5e7eb; color: #374151; padding: 0.375rem 0.75rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 500; text-decoration: none; }
	.btn-action:hover { background-color: #d1d5db; }
	.empty-state { text-align: center; padding: 2rem; color: #6b7280; }

	/* Pagination */
	.pagination { display: flex; align-items: center; justify-content: center; gap: 0.35rem; flex-wrap: wrap; }
	.page-btn { padding: 0.45rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background: white; color: #374151; font-weight: 500; cursor: pointer; font-size: 0.85rem; }
	.page-btn:hover:not(:disabled) { background: #f3f4f6; border-color: #3b82f6; }
	.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.page-btn.page-active { background: #3b82f6; color: white; border-color: #3b82f6; }
	.page-ellipsis { padding: 0.45rem 0.5rem; color: #9ca3af; }

	@media (max-width: 768px) {
		header { flex-direction: column; gap: 1rem; align-items: flex-start; }
		.filter-row { flex-direction: column; align-items: stretch; }
		.filter-group { width: 100%; }
		.filter-group label { text-align: left; }
		.filter-select { width: 100%; min-width: 0; }
		.search-group { max-width: 100%; width: 100%; }
		.search-input { width: 100%; }
		th, td { padding: 0.5rem 0.75rem; }
	}
</style>
