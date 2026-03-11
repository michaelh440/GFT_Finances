<!-- src/routes/hsi/teachers/+page.svelte -->
<script>
	import { resolve } from '$app/paths';

	/** @type {any} */
	export let data;

	let searchQuery = '';
	let sortField = 'last_name';
	let sortDirection = 'asc';
	let currentPage = 1;
	let pageSize = 25;

	/** @param {string} field */
	function toggleSort(field) {
		if (sortField === field) {
			sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
		} else {
			sortField = field;
			sortDirection = 'asc';
		}
		currentPage = 1;
	}

	/** @param {string} field */
	function sortIndicator(field) {
		if (sortField !== field) return '';
		return sortDirection === 'asc' ? ' ▲' : ' ▼';
	}

	$: filteredTeachers = (data.teachers || []).filter((/** @type {any} */ t) => {
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		return (
			(t.first_name && t.first_name.toLowerCase().includes(q)) ||
			(t.last_name && t.last_name.toLowerCase().includes(q)) ||
			(t.email && t.email.toLowerCase().includes(q))
		);
	});

	$: sortedTeachers = [...filteredTeachers].sort((/** @type {any} */ a, /** @type {any} */ b) => {
		let aVal = a[sortField];
		let bVal = b[sortField];
		if (aVal == null) aVal = '';
		if (bVal == null) bVal = '';
		if (typeof aVal === 'number' && typeof bVal === 'number') {
			return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
		}
		aVal = String(aVal).toLowerCase();
		bVal = String(bVal).toLowerCase();
		return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
	});

	$: totalPages = Math.ceil(sortedTeachers.length / pageSize);
	$: pagedTeachers = sortedTeachers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

	$: {
		searchQuery;
		currentPage = 1;
	}

	/** @param {string} dateStr */
	function formatDate(dateStr) {
		if (!dateStr) return '—';
		const d = new Date(dateStr + 'T12:00:00');
		return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>Teachers | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Teachers</h1>
		<div class="header-actions">
			<a href={resolve('/hsi/teachers/new')} class="btn-primary">Add Teacher</a>
			<a href={resolve('/hsi')} class="btn-secondary">Back to Classes</a>
		</div>
	</header>

	<div class="toolbar">
		<div class="search-group">
			<input
				type="text"
				placeholder="Search by name or email..."
				bind:value={searchQuery}
				class="search-input"
			/>
		</div>
		<div class="stats">
			<span class="stat">{filteredTeachers.length} teacher{filteredTeachers.length !== 1 ? 's' : ''}</span>
		</div>
	</div>

	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th class="sortable" on:click={() => toggleSort('last_name')}>
						Name{sortIndicator('last_name')}
					</th>
					<th class="sortable" on:click={() => toggleSort('email')}>
						Email{sortIndicator('email')}
					</th>
					<th>Phone</th>
					<th class="sortable col-center" on:click={() => toggleSort('session_count')}>
						Sessions{sortIndicator('session_count')}
					</th>
					<th class="sortable col-center" on:click={() => toggleSort('total_students_taught')}>
						Students{sortIndicator('total_students_taught')}
					</th>
					<th class="sortable" on:click={() => toggleSort('last_session_date')}>
						Last Session{sortIndicator('last_session_date')}
					</th>
					<th>Status</th>
					<th>Actions</th>
				</tr>
			</thead>
			<tbody>
				{#if pagedTeachers.length === 0}
					<tr>
						<td colspan="8" class="empty-state">
							{searchQuery ? 'No teachers match your search.' : 'No teachers found. Add your first teacher to get started.'}
						</td>
					</tr>
				{:else}
					{#each pagedTeachers as teacher (teacher.teacher_id)}
						<tr class:inactive={!teacher.is_active}>
							<td class="teacher-name">
								<a href={resolve(`/hsi/teachers/${teacher.teacher_id}`)} class="name-link">
									{teacher.first_name} {teacher.last_name}
								</a>
							</td>
							<td class="teacher-email">{teacher.email || '—'}</td>
							<td>{teacher.phone || '—'}</td>
							<td class="col-center">
								<span class="count-badge">{teacher.session_count}</span>
							</td>
							<td class="col-center">
								<span class="count-badge count-badge-alt">{teacher.total_students_taught}</span>
							</td>
							<td>{formatDate(teacher.last_session_date)}</td>
							<td>
								<span class="status-badge" class:active={teacher.is_active}>
									{teacher.is_active ? 'Active' : 'Inactive'}
								</span>
							</td>
							<td>
								<div class="actions">
									<a href={resolve(`/hsi/teachers/${teacher.teacher_id}`)} class="btn-action">View</a>
									<a href={resolve(`/hsi/teachers/${teacher.teacher_id}/edit`)} class="btn-action">Edit</a>
								</div>
							</td>
						</tr>
					{/each}
				{/if}
			</tbody>
		</table>
	</div>

	{#if totalPages > 1}
		<div class="pagination">
			<button class="page-btn" disabled={currentPage === 1} on:click={() => (currentPage = 1)}>«</button>
			<button class="page-btn" disabled={currentPage === 1} on:click={() => currentPage--}>‹</button>
			<span class="page-info">Page {currentPage} of {totalPages}</span>
			<button class="page-btn" disabled={currentPage === totalPages} on:click={() => currentPage++}>›</button>
			<button class="page-btn" disabled={currentPage === totalPages} on:click={() => (currentPage = totalPages)}>»</button>
			<select bind:value={pageSize} on:change={() => (currentPage = 1)} class="page-size-select">
				<option value={25}>25 per page</option>
				<option value={50}>50 per page</option>
				<option value={100}>100 per page</option>
			</select>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	.header-actions { display: flex; gap: 0.75rem; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1rem; flex-wrap: wrap; }
	.search-group { flex: 1; max-width: 400px; }
	.search-input { width: 100%; padding: 0.625rem 1rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; background-color: white; }
	.search-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
	.stats { color: #6b7280; font-size: 0.9rem; }
	.stat { font-weight: 500; }

	.table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow-x: auto; margin-bottom: 1.5rem; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
	th.sortable { cursor: pointer; user-select: none; }
	th.sortable:hover { color: #3b82f6; }
	th.col-center, td.col-center { text-align: center; }
	td { padding: 0.625rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; font-size: 0.9rem; }
	tr:hover { background-color: #f9fafb; }
	tr.inactive { opacity: 0.5; }

	.teacher-name { font-weight: 500; }
	.name-link { color: #3b82f6; text-decoration: none; font-weight: 500; }
	.name-link:hover { text-decoration: underline; }
	.teacher-email { color: #6b7280; font-size: 0.85rem; }

	.count-badge { display: inline-block; min-width: 1.5rem; padding: 0.125rem 0.5rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; text-align: center; background-color: #e0e7ff; color: #4338ca; }
	.count-badge-alt { background-color: #fef3c7; color: #92400e; }

	.status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }

	.actions { display: flex; gap: 0.5rem; }
	.btn-action { background-color: #e5e7eb; color: #374151; padding: 0.375rem 0.75rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 500; text-decoration: none; transition: background-color 0.2s; }
	.btn-action:hover { background-color: #d1d5db; }

	.empty-state { text-align: center; padding: 2rem; color: #6b7280; }

	.pagination { display: flex; align-items: center; justify-content: center; gap: 0.5rem; flex-wrap: wrap; }
	.page-btn { padding: 0.5rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; background-color: white; color: #374151; font-weight: 500; cursor: pointer; transition: all 0.2s; }
	.page-btn:hover:not(:disabled) { background-color: #f3f4f6; border-color: #3b82f6; }
	.page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
	.page-info { padding: 0.5rem 1rem; color: #374151; font-weight: 500; font-size: 0.9rem; }
	.page-size-select { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; background-color: white; margin-left: 1rem; }

	@media (max-width: 768px) {
		header { flex-direction: column; gap: 1rem; align-items: flex-start; }
		.toolbar { flex-direction: column; align-items: stretch; }
		.search-group { max-width: 100%; }
		th, td { padding: 0.5rem 0.75rem; }
	}
</style>