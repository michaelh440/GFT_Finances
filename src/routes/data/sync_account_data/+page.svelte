<!-- src/routes/shows/patrons/sync_acct_id/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	export let data;
	export let form;

	let finding = false;
	let applying = false;
	let reviewMode = false;
	let complete = false;

	/** @type {any[]} */
	let matchResults = [];
	/** @type {boolean[]} */
	let selected = [];

	// Initialize review from find_matches
	$: if (form?.action === 'find_matches' && form?.success && !reviewMode) {
		matchResults = form.matchResults ?? [];
		reviewMode = true;
		complete = false;
		// Auto-select rows that need update (empty patron acct_id)
		selected = matchResults.map((r) => r.needsUpdate && !(r.patron?.vbo_account_id));
	}

	// Apply complete
	$: if (form?.action === 'apply_updates' && form?.success && !complete) {
		complete = true;
		reviewMode = false;
	}

	function resetAll() {
		reviewMode = false;
		complete = false;
		matchResults = [];
		selected = [];
	}

	function selectAllUpdatable() {
		selected = matchResults.map((r) => r.needsUpdate);
	}

	function deselectAll() {
		selected = matchResults.map(() => false);
	}

	// Build updates JSON
	$: updatesJson = JSON.stringify(
		matchResults
			.map((r, i) => {
				if (!selected[i] || !r.needsUpdate || !r.patron) return null;
				return { patron_id: r.patron.patron_id, vbo_account_id: r.student.vbo_account_id };
			})
			.filter(Boolean)
	);

	$: selectedCount = selected.filter((s, i) => s && matchResults[i]?.needsUpdate).length;

	// Filter controls
	let showFilter = 'all'; // 'all', 'needs_update', 'already_set', 'different', 'no_match'

	$: filteredResults = matchResults.map((r, i) => ({ ...r, _idx: i })).filter((r) => {
		if (showFilter === 'needs_update') return r.needsUpdate && !(r.patron?.vbo_account_id);
		if (showFilter === 'already_set') return r.alreadyMatches;
		if (showFilter === 'different') return r.needsUpdate && r.patron?.vbo_account_id;
		if (showFilter === 'no_match') return r.matchType === 'no_match';
		return true;
	});
</script>

<svelte:head>
	<title>Sync Patron Account IDs | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/shows/patrons')} class="back-link">← Back to Patrons</a>
			<h1>Sync Patron Account IDs</h1>
			<p class="subtitle">Copy VBO Account IDs from the students table to matching patrons</p>
		</div>
	</header>

	<!-- Stats -->
	<div class="stats-row">
		<div class="stat-card">
			<span class="stat-value">{data.stats.totalPatrons}</span>
			<span class="stat-label">Total Patrons</span>
		</div>
		<div class="stat-card stat-good">
			<span class="stat-value">{data.stats.withAcctId}</span>
			<span class="stat-label">Patrons with AcctID</span>
		</div>
		<div class="stat-card stat-warn">
			<span class="stat-value">{data.stats.withoutAcctId}</span>
			<span class="stat-label">Patrons Missing AcctID</span>
		</div>
		<div class="stat-card stat-info">
			<span class="stat-value">{data.stats.studentsWithAcctId}</span>
			<span class="stat-label">Students with AcctID</span>
		</div>
	</div>

	{#if form?.action === 'apply_updates' && form?.success}
		<div class="alert alert-success">✓ {form.message}</div>
	{/if}

	{#if form?.error}
		<div class="alert alert-error">✗ {form.error}</div>
	{/if}

	<!-- Step 1: Find Matches -->
	{#if !reviewMode && !complete}
		<div class="card">
			<h2>Find Matching Students</h2>
			<p class="help-text">This will look up every student that has a VBO Account ID and try to match them to a patron by email address first, then by name. You'll review all matches before anything is updated.</p>

			<form method="POST" action="?/find_matches" use:enhance={() => {
				finding = true;
				return async ({ update }) => {
					finding = false;
					await update();
				};
			}}>
				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={finding}>
						{finding ? 'Finding Matches...' : 'Find Matches →'}
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Step 2: Review -->
	{#if reviewMode}
		<div class="card">
			<div class="review-header">
				<h2>Review Matches</h2>
				{#if form?.summary}
				<div class="review-summary">
					<span class="badge badge-matched">{form.summary.matched} matched</span>
					<span class="badge badge-update">{form.summary.needsUpdate} need update</span>
					<span class="badge badge-set">{form.summary.alreadySet} already set</span>
					{#if form.summary.patronHasDifferent > 0}
						<span class="badge badge-warn">{form.summary.patronHasDifferent} have different ID</span>
					{/if}
					<span class="badge badge-none">{form.summary.unmatched} no match</span>
				</div>
			{/if}
			</div>

			<div class="toolbar">
				<div class="filter-tabs">
					<button class="tab" class:active={showFilter === 'all'} on:click={() => showFilter = 'all'}>
						All ({matchResults.length})
					</button>
					<button class="tab" class:active={showFilter === 'needs_update'} on:click={() => showFilter = 'needs_update'}>
						Empty → Fill ({matchResults.filter(r => r.needsUpdate && !r.patron?.vbo_account_id).length})
					</button>
					{#if form?.summary?.patronHasDifferent && form.summary.patronHasDifferent > 0}
						<button class="tab" class:active={showFilter === 'different'} on:click={() => showFilter = 'different'}>
							Different ID ({form.summary.patronHasDifferent})
						</button>
					{/if}
					<button class="tab" class:active={showFilter === 'already_set'} on:click={() => showFilter = 'already_set'}>
						Already Set ({form?.summary?.alreadySet ?? 0})
					</button>
					<button class="tab" class:active={showFilter === 'no_match'} on:click={() => showFilter = 'no_match'}>
						No Match ({form?.summary?.unmatched ?? 0})
					</button>
				</div>
				<div class="bulk-actions">
					<button class="btn-sm" on:click={selectAllUpdatable}>Select All Updatable</button>
					<button class="btn-sm" on:click={deselectAll}>Deselect All</button>
					<span class="update-count">{selectedCount} selected</span>
				</div>
			</div>

			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th class="col-check"></th>
							<th>Student</th>
							<th>Student AcctID</th>
							<th>Match</th>
							<th>Patron</th>
							<th>Patron AcctID</th>
							<th>Status</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredResults as result (result._idx)}
							{@const i = result._idx}
							<tr class:no-match={result.matchType === 'no_match'}
								class:already-set={result.alreadyMatches}
								class:has-different={result.needsUpdate && result.patron?.vbo_account_id}
								class:needs-fill={result.needsUpdate && !result.patron?.vbo_account_id}>
								<td class="col-check">
									{#if result.needsUpdate}
										<input type="checkbox" bind:checked={selected[i]} />
									{/if}
								</td>
								<td>
									<div class="person-name">{result.student.first_name} {result.student.last_name}</div>
									{#if result.student.email}<div class="person-email">{result.student.email}</div>{/if}
								</td>
								<td><span class="acctid">{result.student.vbo_account_id}</span></td>
								<td>
									<span class="match-badge" class:email={result.matchType === 'email_match'} class:name={result.matchType === 'name_match'} class:none={result.matchType === 'no_match'}>
										{#if result.matchType === 'email_match'}Email
										{:else if result.matchType === 'name_match'}Name
										{:else}—
										{/if}
									</span>
								</td>
								<td>
									{#if result.patron}
										<div class="person-name">{result.patron.first_name} {result.patron.last_name}</div>
										{#if result.patron.email}<div class="person-email">{result.patron.email}</div>{/if}
									{:else}
										<span class="empty-val">—</span>
									{/if}
								</td>
								<td>
									{#if result.patron}
										{#if result.patron.vbo_account_id}
											<span class="acctid">{result.patron.vbo_account_id}</span>
										{:else}
											<span class="empty-val">(empty)</span>
										{/if}
									{:else}
										<span class="empty-val">—</span>
									{/if}
								</td>
								<td>
									{#if result.matchType === 'no_match'}
										<span class="status-tag status-none">No patron match</span>
									{:else if result.alreadyMatches}
										<span class="status-tag status-ok">✓ Already set</span>
									{:else if result.needsUpdate && !result.patron?.vbo_account_id}
										<span class="status-tag status-fill">Fill empty</span>
									{:else if result.needsUpdate && result.patron?.vbo_account_id}
										<span class="status-tag status-overwrite">⚠ Overwrite</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<form method="POST" action="?/apply_updates" use:enhance={() => {
				applying = true;
				return async ({ update }) => {
					applying = false;
					await update();
				};
			}}>
				<input type="hidden" name="updates_json" value={updatesJson} />
				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={selectedCount === 0 || applying}>
						{applying ? 'Updating...' : `Update ${selectedCount} Patron${selectedCount !== 1 ? 's' : ''}`}
					</button>
					<button type="button" class="btn-secondary" on:click={resetAll}>Start Over</button>
				</div>
			</form>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1.25rem; font-weight: 600; color: #1a202c; margin: 0; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; }
	.help-text { color: #6b7280; font-size: 0.9rem; margin: 0.5rem 0 1rem 0; }

	.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 2rem; }
	.stat-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.25rem; }
	.stat-card.stat-good { border-top: 3px solid #10b981; }
	.stat-card.stat-warn { border-top: 3px solid #f59e0b; }
	.stat-card.stat-info { border-top: 3px solid #3b82f6; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	.alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
	.alert-success { background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
	.alert-error { background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

	.card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }

	.review-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem; }
	.review-summary { display: flex; gap: 0.5rem; flex-wrap: wrap; }
	.badge { padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
	.badge-matched { background: #dbeafe; color: #1e40af; }
	.badge-update { background: #fed7aa; color: #9a3412; }
	.badge-set { background: #dcfce7; color: #166534; }
	.badge-warn { background: #fef3c7; color: #92400e; }
	.badge-none { background: #f3f4f6; color: #6b7280; }

	.toolbar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; }
	.filter-tabs { display: flex; gap: 0.25rem; flex-wrap: wrap; }
	.tab { padding: 0.4rem 0.75rem; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 0.375rem; font-size: 0.8rem; color: #6b7280; cursor: pointer; }
	.tab:hover { background: #e5e7eb; }
	.tab.active { background: #3b82f6; color: white; border-color: #3b82f6; }
	.bulk-actions { display: flex; gap: 0.5rem; align-items: center; }
	.btn-sm { padding: 0.35rem 0.75rem; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.8rem; color: #374151; cursor: pointer; }
	.btn-sm:hover { background: #e5e7eb; }
	.update-count { font-size: 0.85rem; color: #6b7280; font-weight: 500; }

	.table-wrapper { overflow-x: auto; margin-bottom: 1rem; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.6rem 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; }
	td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f3f4f6; font-size: 0.85rem; vertical-align: middle; }
	tr:hover { background-color: #f9fafb; }
	.col-check { width: 40px; text-align: center; }

	tr.no-match { opacity: 0.5; }
	tr.already-set td { color: #6b7280; }
	tr.needs-fill { background-color: #fefce8; }
	tr.has-different { background-color: #fff7ed; }

	.person-name { font-weight: 500; color: #1a202c; }
	.person-email { font-size: 0.8rem; color: #6b7280; }
	.acctid { font-family: monospace; font-weight: 600; color: #6366f1; font-size: 0.85rem; }
	.empty-val { color: #9ca3af; }

	.match-badge { padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; }
	.match-badge.email { background: #dbeafe; color: #1e40af; }
	.match-badge.name { background: #fed7aa; color: #9a3412; }
	.match-badge.none { background: #f3f4f6; color: #9ca3af; }

	.status-tag { padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 500; white-space: nowrap; }
	.status-ok { background: #dcfce7; color: #166534; }
	.status-fill { background: #dbeafe; color: #1e40af; }
	.status-overwrite { background: #fef3c7; color: #92400e; }
	.status-none { background: #f3f4f6; color: #9ca3af; }

	.form-actions { display: flex; gap: 1rem; align-items: center; padding-top: 1rem; border-top: 1px solid #f3f4f6; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-primary:disabled { background-color: #93c5fd; cursor: not-allowed; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; }
	.btn-secondary:hover { background-color: #d1d5db; }

	@media (max-width: 768px) {
		.stats-row { grid-template-columns: repeat(2, 1fr); }
		.toolbar { flex-direction: column; align-items: stretch; }
	}
</style>