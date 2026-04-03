<!-- src/routes/admin/tools/bi_directional_vbo_sync/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form;

	$: stats = data.stats;
	$: pair = data.currentPair;
	$: fields = pair?.fields || [];
	$: diffCount = fields.filter(f => f.differs).length;
	$: skippedParam = data.skippedParam || '';
	$: skippedCount = skippedParam ? skippedParam.split(',').length : 0;

	/** @type {Record<string, string>} */
	let selections = {};

	// When pair changes, auto-select differing fields: pick the non-empty value, or student if both filled
	$: if (pair && fields) {
		/** @type {Record<string, string>} */
		const auto = {};
		for (const f of fields) {
			if (!f.differs) continue;
			if (f.student_val && !f.patron_val) auto[f.field] = 'student';
			else if (!f.student_val && f.patron_val) auto[f.field] = 'patron';
			else auto[f.field] = 'student';
		}
		selections = auto;
	}

	const FIELD_LABELS = /** @type {Record<string, string>} */ ({
		first_name: 'First Name', last_name: 'Last Name', email: 'Email',
		phone: 'Phone', mobile_phone: 'Mobile Phone', vbo_account_id: 'VBO Account ID',
		address_line1: 'Address', address_line2: 'Address 2',
		city: 'City', state: 'State', zip_code: 'ZIP Code', country: 'Country'
	});

	/** @param {string} field @param {string} source */
	function select(field, source) {
		selections[field] = source;
		selections = selections;
	}

	$: selectionsJson = JSON.stringify(selections);

	let syncing = false;
</script>

<svelte:head>
	<title>Bi-Directional VBO Sync | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/admin/users')} class="back-link">← Admin</a>
			<h1>Bi-Directional VBO Sync</h1>
			<p class="subtitle">Match students and patrons one at a time, syncing data in either direction</p>
		</div>
	</header>

	{#if form?.success && form?.message}
		<div class="alert alert-success">{form.message}</div>
	{/if}
	{#if form?.error}
		<div class="alert alert-error">{form.error}</div>
	{/if}

	<div class="stats-row">
		<div class="stat-card stat-info">
			<span class="stat-value">{stats.studentsWithVbo} / {stats.studentsTotal}</span>
			<span class="stat-label">Students with VBO</span>
		</div>
		<div class="stat-card stat-info">
			<span class="stat-value">{stats.patronsWithVbo} / {stats.patronsTotal}</span>
			<span class="stat-label">Patrons with VBO</span>
		</div>
	</div>

	{#if !pair}
		<div class="empty-state">
			All matched student/patron pairs are in sync. Nothing left to review.
			{#if skippedCount > 0}
				<div style="margin-top: 1rem;">
					<a href={resolve('/admin/tools/bi_directional_vbo_sync')} class="btn-clear-skip">{skippedCount} skipped — click to review again</a>
				</div>
			{/if}
		</div>
	{:else}
		<div class="sync-card">
			<!-- Match header -->
			<div class="match-info">
				<span class="match-badge" class:email={pair.match_type === 'email'} class:name={pair.match_type === 'name'}>
					Matched by {pair.match_type === 'email' ? 'Email' : 'Name'}
				</span>
				<span class="diff-count">{diffCount} field{diffCount !== 1 ? 's' : ''} differ</span>
				<div class="match-links">
					<a href={resolve(`/hsi/students/${pair.student.student_id}`)} class="person-link">Student Profile →</a>
					<a href={resolve(`/gft/patrons/${pair.patron.patron_id}`)} class="person-link">Patron Profile →</a>
				</div>
			</div>

			<!-- Field comparison table -->
			<form method="POST" action="?/sync" use:enhance={() => {
				syncing = true;
				return async ({ update }) => {
					syncing = false;
					await update();
				};
			}}>
				<input type="hidden" name="student_id" value={pair.student.student_id} />
				<input type="hidden" name="patron_id" value={pair.patron.patron_id} />
				<input type="hidden" name="skipped" value={skippedParam} />
				<input type="hidden" name="field_selections" value={selectionsJson} />

				<div class="field-table">
					<div class="field-row field-header">
						<div class="field-label">Field</div>
						<div class="field-student">Student</div>
						<div class="field-patron">Patron</div>
					</div>

					{#each fields as f (f.field)}
						<div class="field-row" class:field-row-match={!f.differs} class:field-row-diff={f.differs}>
							<div class="field-label">{FIELD_LABELS[f.field] || f.field}</div>
							{#if f.differs}
								<div class="field-student">
									<button type="button"
										class="field-value-btn"
										class:selected={selections[f.field] === 'student'}
										class:empty-val={!f.student_val}
										on:click={() => select(f.field, 'student')}>
										{f.student_val || '(empty)'}
									</button>
									<input type="hidden" name="value_{f.field}"
										value={selections[f.field] === 'student' ? f.student_val : f.patron_val} />
								</div>
								<div class="field-patron">
									<button type="button"
										class="field-value-btn"
										class:selected={selections[f.field] === 'patron'}
										class:empty-val={!f.patron_val}
										on:click={() => select(f.field, 'patron')}>
										{f.patron_val || '(empty)'}
									</button>
								</div>
							{:else}
								<div class="field-student field-static">{f.student_val || '—'}</div>
								<div class="field-patron field-static">{f.patron_val || '—'}</div>
							{/if}
						</div>
					{/each}
				</div>

				{#if skippedCount > 0}
					<div class="skipped-bar">
						<span>{skippedCount} pair{skippedCount !== 1 ? 's' : ''} skipped</span>
						<a href={resolve('/admin/tools/bi_directional_vbo_sync')} class="btn-clear-skip">Clear & Start Over</a>
					</div>
				{/if}

				<div class="actions-section">
					<div class="action-buttons">
						<button type="submit" name="sync_action" value="apply" class="btn-action btn-sync" disabled={syncing || diffCount === 0}>
							{syncing ? 'Syncing...' : `Sync ${diffCount} Field${diffCount !== 1 ? 's' : ''}`}
						</button>
						<button type="submit" name="sync_action" value="skip" class="btn-action btn-skip" disabled={syncing}>
							Skip
						</button>
						<button type="submit" name="sync_action" value="not_same_person" class="btn-action btn-not-same" disabled={syncing}>
							Not Same Person
						</button>
					</div>
				</div>
			</form>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 900px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0 0 0.5rem 0; }
	.subtitle { color: #6b7280; margin: 0; }

	.alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
	.alert-success { background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
	.alert-error { background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

	.stats-row { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; margin-bottom: 2rem; }
	.stat-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.25rem; }
	.stat-card.stat-info { border-top: 3px solid #3b82f6; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	.empty-state { text-align: center; padding: 3rem; color: #6b7280; font-size: 1.125rem; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

	.sync-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }

	.match-info { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; background-color: #f9fafb; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
	.match-badge { padding: 0.2rem 0.6rem; border-radius: 0.25rem; font-size: 0.8rem; font-weight: 600; }
	.match-badge.email { background: #dbeafe; color: #1e40af; }
	.match-badge.name { background: #fed7aa; color: #9a3412; }
	.diff-count { font-size: 0.85rem; color: #6b7280; }
	.match-links { margin-left: auto; display: flex; gap: 1rem; }
	.person-link { font-size: 0.8rem; color: #3b82f6; text-decoration: none; font-weight: 500; }
	.person-link:hover { text-decoration: underline; }

	/* Field comparison table */
	.field-table { padding: 0; }
	.field-row { display: grid; grid-template-columns: 140px 1fr 1fr; border-bottom: 1px solid #f3f4f6; }
	.field-row:last-child { border-bottom: none; }
	.field-header { background-color: #f9fafb; border-bottom: 2px solid #e5e7eb; font-weight: 600; font-size: 0.75rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
	.field-header > div { padding: 0.6rem 1rem; }
	.field-label { padding: 0.6rem 1rem; font-size: 0.8rem; font-weight: 600; color: #374151; display: flex; align-items: center; }
	.field-student { padding: 0.35rem 0.5rem; border-right: 1px solid #f3f4f6; }
	.field-patron { padding: 0.35rem 0.5rem; }

	.field-row-match { background-color: #f9fafb; }
	.field-row-diff { background-color: #fffbeb; }
	.field-static { padding: 0.6rem 1rem; font-size: 0.85rem; color: #6b7280; }

	.field-value-btn {
		display: block;
		width: 100%;
		text-align: left;
		padding: 0.5rem 0.75rem;
		border: 2px solid #e5e7eb;
		border-radius: 0.375rem;
		background: white;
		font-size: 0.85rem;
		color: #1a202c;
		cursor: pointer;
		transition: all 0.15s;
		word-break: break-word;
	}
	.field-value-btn:hover { border-color: #93c5fd; background-color: #f0f7ff; }
	.field-value-btn.selected { border-color: #3b82f6; background-color: #eff6ff; color: #1e40af; font-weight: 600; }
	.field-value-btn.empty-val { color: #9ca3af; font-style: italic; }
	.field-value-btn.selected.empty-val { color: #6b7280; }

	.skipped-bar { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1.5rem; background-color: #f3f4f6; border-top: 1px solid #e5e7eb; font-size: 0.85rem; color: #6b7280; }
	.btn-clear-skip { font-size: 0.8rem; color: #3b82f6; text-decoration: none; font-weight: 500; }
	.btn-clear-skip:hover { text-decoration: underline; }

	.actions-section { padding: 1.25rem 1.5rem; border-top: 1px solid #e5e7eb; background-color: #fafafa; }
	.action-buttons { display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap; }

	.btn-action { padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-action:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-sync { background-color: #3b82f6; color: white; }
	.btn-sync:hover:not(:disabled) { background-color: #2563eb; }
	.btn-skip { background-color: #e5e7eb; color: #374151; }
	.btn-skip:hover:not(:disabled) { background-color: #d1d5db; }
	.btn-not-same { background-color: #fef3c7; color: #92400e; }
	.btn-not-same:hover:not(:disabled) { background-color: #fde68a; }

	@media (max-width: 768px) {
		.stats-row { grid-template-columns: 1fr; }
		.match-links { margin-left: 0; width: 100%; }
		.field-row { grid-template-columns: 100px 1fr 1fr; }
		.field-label { font-size: 0.7rem; }
		.field-value-btn { font-size: 0.8rem; padding: 0.4rem 0.5rem; }
		.action-buttons { flex-direction: column; align-items: stretch; }
		.btn-action { text-align: center; }
	}
</style>
