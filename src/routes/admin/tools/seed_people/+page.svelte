<!-- src/routes/admin/tools/seed_people/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form;

	$: stats = data.stats;
	$: activeTable = data.activeTable;
	$: record = data.currentRecord;
	$: matches = data.candidateMatches || [];
	$: skippedParam = data.skippedParam || '';
	$: skippedCount = skippedParam ? skippedParam.split(',').length : 0;

	const FIELD_LABELS = /** @type {Record<string, string>} */ ({
		first_name: 'First Name', last_name: 'Last Name', email: 'Email',
		phone: 'Phone', mobile_phone: 'Mobile Phone',
		address_line1: 'Address', address_line2: 'Address 2',
		city: 'City', state: 'State', zip_code: 'ZIP Code', country: 'Country'
	});
	const FIELDS = Object.keys(FIELD_LABELS);

	// Mode: 'choose' (pick create/link), 'create' (field selection for new), 'link' (field selection for existing)
	let mode = 'choose';
	/** @type {any} */
	let selectedMatch = null;

	// Field selections for link mode: 'existing' or 'incoming'
	/** @type {Record<string, string>} */
	let linkSelections = {};

	// Determine which side has the higher VBO number (more recent account = better data)
	$: incomingVbo = parseInt((record?.vbo_account_id || '').replace(/\D/g, '')) || 0;
	$: existingMaxVbo = (selectedMatch?.vbo_account_ids || []).reduce((/** @type {number} */ max, /** @type {string} */ id) => {
		const n = parseInt((id || '').replace(/\D/g, '')) || 0;
		return n > max ? n : max;
	}, 0);
	$: preferIncoming = incomingVbo > existingMaxVbo;

	$: if (record && selectedMatch) {
		/** @type {Record<string, string>} */
		const auto = {};
		for (const f of FIELDS) {
			const incoming = ((record[f]) || '').toString().trim();
			const existing = ((selectedMatch[f]) || '').toString().trim();
			if (incoming === existing) continue;
			// Prefer non-empty; if both filled, prefer higher VBO side
			if (existing && !incoming) auto[f] = 'existing';
			else if (incoming && !existing) auto[f] = 'incoming';
			else auto[f] = preferIncoming ? 'incoming' : 'existing';
		}
		linkSelections = auto;
	}

	/** @param {any} match */
	function startLink(match) {
		selectedMatch = match;
		mode = 'link';
	}

	function startCreate() {
		mode = 'create';
		selectedMatch = null;
	}

	function backToChoose() {
		mode = 'choose';
		selectedMatch = null;
	}

	/** @param {string} field @param {string} source */
	function setLinkSelection(field, source) {
		linkSelections[field] = source;
		linkSelections = linkSelections;
	}

	$: linkSelectionsJson = JSON.stringify(linkSelections);

	let submitting = false;
</script>

<svelte:head>
	<title>Seed Customer Records | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/admin/users')} class="back-link">← Admin</a>
			<h1>Seed Customer Records</h1>
			<p class="subtitle">Link students, patrons, and contacts to master customer records one at a time</p>
		</div>
	</header>

	{#if form?.success && form?.message}
		<div class="alert alert-success">{form.message}</div>
	{/if}
	{#if form?.error}
		<div class="alert alert-error">{form.error}</div>
	{/if}

	<!-- Stats -->
	<div class="stats-row">
		<div class="stat-card" class:stat-good={stats.customerCount > 0}>
			<span class="stat-value">{stats.customerCount}</span>
			<span class="stat-label">Customers</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{stats.studentsUnlinked}</span>
			<span class="stat-label">Students Unlinked</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{stats.patronsUnlinked}</span>
			<span class="stat-label">Patrons Unlinked</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{stats.contactsUnlinked}</span>
			<span class="stat-label">Contacts Unlinked</span>
		</div>
	</div>

	<!-- Table selector tabs -->
	<div class="table-tabs">
		<a href="?table=students" class="tab" class:active={activeTable === 'students'}>
			Students ({stats.studentsUnlinked})
		</a>
		<a href="?table=patrons" class="tab" class:active={activeTable === 'patrons'}>
			Patrons ({stats.patronsUnlinked})
		</a>
		<a href="?table=contacts" class="tab" class:active={activeTable === 'contacts'}>
			Corp Contacts ({stats.contactsUnlinked})
		</a>
	</div>

	{#if !record}
		<div class="empty-state">
			No unlinked records remaining in {activeTable}.
			{#if skippedCount > 0}
				<div style="margin-top: 1rem;">
					<a href="?table={activeTable}" class="btn-clear">{skippedCount} skipped — click to review again</a>
				</div>
			{/if}
		</div>
	{:else if mode === 'choose'}
		<!-- ── Step 1: Show the record and matches ── -->
		<div class="wizard-card">
			<div class="record-header">
				<span class="source-badge">{record.source_table}</span>
				<span class="record-name">{record.first_name} {record.last_name}</span>
				{#if record.email}<span class="record-detail">{record.email}</span>{/if}
				{#if record.vbo_account_id}<span class="vbo-tag">VBO: {record.vbo_account_id}</span>{/if}
			</div>

			<!-- Source record details -->
			<div class="field-grid">
				{#each FIELDS as f}
					{@const val = (record[f] || '').toString().trim()}
					<div class="field-item">
						<span class="field-label">{FIELD_LABELS[f]}</span>
						<span class="field-val" class:empty={!val}>{val || '—'}</span>
					</div>
				{/each}
			</div>

			<!-- Candidate matches -->
			{#if matches.length > 0}
				<div class="matches-section">
					<h3>Potential Customer Matches ({matches.length})</h3>
					{#each matches as match (match.customer_id)}
						<div class="match-card">
							<div class="match-header">
								<span class="match-name">{match.first_name} {match.last_name}</span>
								{#if match.email}<span class="match-detail">{match.email}</span>{/if}
								<span class="match-badges">
									{#each match.match_types as mt}
										<span class="match-type-badge" class:vbo={mt === 'vbo'} class:email={mt === 'email'} class:name={mt === 'name'}>{mt}</span>
									{/each}
								</span>
								{#if match.vbo_account_ids.length > 0}
									<span class="vbo-tag">VBOs: {match.vbo_account_ids.join(', ')}</span>
								{/if}
							</div>
							<div class="match-fields">
								{#each FIELDS as f}
									{@const val = (match[f] || '').toString().trim()}
									{#if val}
										<span class="match-field"><span class="mf-label">{FIELD_LABELS[f]}:</span> {val}</span>
									{/if}
								{/each}
							</div>
							<button class="btn-link-match" on:click={() => startLink(match)}>
								Link to This Customer →
							</button>
						</div>
					{/each}
				</div>
			{:else}
				<div class="no-matches">No existing customer matches found.</div>
			{/if}

			<!-- Actions -->
			<div class="choose-actions">
				<button class="btn-primary" on:click={startCreate}>Create New Customer</button>
				<form method="POST" action="?/skip" use:enhance style="display:inline;">
					<input type="hidden" name="record_id" value={record.record_id} />
					<input type="hidden" name="active_table" value={activeTable} />
					<input type="hidden" name="skipped" value={skippedParam} />
					<button type="submit" class="btn-skip">Skip</button>
				</form>
				{#if activeTable === 'students' || activeTable === 'patrons'}
					<form method="POST" action="?/expedite" use:enhance={() => {
						submitting = true;
						return async ({ update }) => { submitting = false; await update(); };
					}} style="display:inline;">
						<input type="hidden" name="active_table" value={activeTable} />
						<input type="hidden" name="skipped" value={skippedParam} />
						<button type="submit" class="btn-expedite" disabled={submitting}>
							{submitting ? 'Processing...' : `Expedite ${activeTable === 'students' ? 'Students' : 'Patrons'}`}
						</button>
					</form>
				{/if}
				{#if activeTable === 'patrons'}
					<form method="POST" action="?/expedite_all" use:enhance={() => {
						submitting = true;
						return async ({ update }) => { submitting = false; await update(); };
					}} style="display:inline;">
						<input type="hidden" name="active_table" value={activeTable} />
						<button type="submit" class="btn-expedite-all" disabled={submitting}>
							{submitting ? 'Processing All...' : 'Expedite All (Skip Matches)'}
						</button>
					</form>
					<form method="POST" action="?/expedite_name" use:enhance={() => {
						submitting = true;
						return async ({ update }) => { submitting = false; await update(); };
					}} style="display:inline;">
						<button type="submit" class="btn-expedite-name" disabled={submitting}>
							{submitting ? 'Processing...' : 'Expedite Name-Only'}
						</button>
					</form>
				{/if}
				{#if skippedCount > 0}
					<span class="skipped-note">{skippedCount} skipped</span>
				{/if}
			</div>
		</div>

	{:else if mode === 'create'}
		<!-- ── Step 2a: Create new customer — confirm fields ── -->
		<div class="wizard-card">
			<div class="wizard-header">
				<button class="btn-back" on:click={backToChoose}>← Back</button>
				<h3>Create New Customer from {record.source_table} record</h3>
			</div>

			<form method="POST" action="?/create_new" use:enhance={() => {
				submitting = true;
				return async ({ update }) => { submitting = false; await update(); };
			}}>
				<input type="hidden" name="source_table" value={record.source_table} />
				<input type="hidden" name="record_id" value={record.record_id} />
				<input type="hidden" name="active_table" value={activeTable} />
				<input type="hidden" name="skipped" value={skippedParam} />
				<input type="hidden" name="vbo_account_id" value={record.vbo_account_id || ''} />

				<div class="create-fields">
					{#each FIELDS as f}
						{@const val = (record[f] || '').toString().trim()}
						<div class="create-field">
							<label for="cf_{f}">{FIELD_LABELS[f]}</label>
							<input type="text" id="cf_{f}" name="field_{f}" value={val} />
						</div>
					{/each}
				</div>

				{#if record.vbo_account_id}
					<div class="vbo-note">VBO Account ID <strong>{record.vbo_account_id}</strong> will be added to the customer.</div>
				{/if}

				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={submitting}>
						{submitting ? 'Creating...' : 'Create Customer & Link'}
					</button>
					<button type="button" class="btn-secondary" on:click={backToChoose}>Cancel</button>
				</div>
			</form>
		</div>

	{:else if mode === 'link' && selectedMatch}
		<!-- ── Step 2b: Link to existing — field-by-field selection ── -->
		<div class="wizard-card">
			<div class="wizard-header">
				<button class="btn-back" on:click={backToChoose}>← Back</button>
				<h3>Link to Customer #{selectedMatch.customer_id}: {selectedMatch.first_name} {selectedMatch.last_name}</h3>
			</div>

			<!-- VBO comparison bar -->
			<div class="vbo-compare">
				<div class="vbo-side">
					<span class="vbo-side-label">Customer VBOs:</span>
					{#if selectedMatch.vbo_account_ids.length > 0}
						{#each selectedMatch.vbo_account_ids as vid}
							<span class="vbo-chip" class:vbo-higher={parseInt(vid.replace(/\D/g,'')) >= existingMaxVbo && existingMaxVbo >= incomingVbo}>{vid}</span>
						{/each}
					{:else}
						<span class="vbo-none">(none)</span>
					{/if}
				</div>
				<div class="vbo-side">
					<span class="vbo-side-label">Incoming VBO:</span>
					{#if record.vbo_account_id}
						<span class="vbo-chip" class:vbo-higher={preferIncoming}>{record.vbo_account_id}</span>
					{:else}
						<span class="vbo-none">(none)</span>
					{/if}
				</div>
				{#if incomingVbo > 0 || existingMaxVbo > 0}
					<div class="vbo-prefer">
						Defaulting to: <strong>{preferIncoming ? 'Incoming (higher VBO)' : 'Existing Customer (higher VBO)'}</strong>
					</div>
				{/if}
			</div>

			<form method="POST" action="?/link_existing" use:enhance={() => {
				submitting = true;
				return async ({ update }) => { submitting = false; await update(); };
			}}>
				<input type="hidden" name="source_table" value={record.source_table} />
				<input type="hidden" name="record_id" value={record.record_id} />
				<input type="hidden" name="customer_id" value={selectedMatch.customer_id} />
				<input type="hidden" name="active_table" value={activeTable} />
				<input type="hidden" name="skipped" value={skippedParam} />
				<input type="hidden" name="vbo_account_id" value={record.vbo_account_id || ''} />
				<input type="hidden" name="field_selections" value={linkSelectionsJson} />

				<div class="link-table">
					<div class="link-row link-header">
						<div class="link-label">Field</div>
						<div class="link-existing">Existing Customer</div>
						<div class="link-incoming">Incoming ({record.source_table})</div>
					</div>

					{#each FIELDS as f}
						{@const existingVal = (selectedMatch[f] || '').toString().trim()}
						{@const incomingVal = (record[f] || '').toString().trim()}
						{@const differs = existingVal !== incomingVal && (existingVal || incomingVal)}
						<div class="link-row" class:link-row-diff={differs} class:link-row-match={!differs}>
							<div class="link-label">{FIELD_LABELS[f]}</div>
							{#if differs}
								<div class="link-existing">
									<button type="button" class="link-btn"
										class:selected={linkSelections[f] === 'existing'}
										class:empty-val={!existingVal}
										on:click={() => setLinkSelection(f, 'existing')}>
										{existingVal || '(empty)'}
									</button>
								</div>
								<div class="link-incoming">
									<button type="button" class="link-btn"
										class:selected={linkSelections[f] === 'incoming'}
										class:empty-val={!incomingVal}
										on:click={() => setLinkSelection(f, 'incoming')}>
										{incomingVal || '(empty)'}
									</button>
									<input type="hidden" name="field_{f}" value={incomingVal} />
								</div>
							{:else}
								<div class="link-existing link-static">{existingVal || '—'}</div>
								<div class="link-incoming link-static">{incomingVal || '—'}</div>
							{/if}
						</div>
					{/each}
				</div>

				{#if record.vbo_account_id}
					<div class="vbo-note">
						VBO Account ID <strong>{record.vbo_account_id}</strong> will be added to the customer's VBO list
						{#if selectedMatch.vbo_account_ids.length > 0}
							(existing: {selectedMatch.vbo_account_ids.join(', ')})
						{/if}
					</div>
				{/if}

				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={submitting}>
						{submitting ? 'Linking...' : 'Link & Update Customer'}
					</button>
					<button type="button" class="btn-secondary" on:click={backToChoose}>Cancel</button>
				</div>
			</form>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0 0 0.5rem 0; }
	h3 { font-size: 1.1rem; font-weight: 600; color: #1a202c; margin: 0; }
	.subtitle { color: #6b7280; margin: 0; }

	.alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
	.alert-success { background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
	.alert-error { background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

	.stats-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
	.stat-card { background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.2rem; }
	.stat-card.stat-good { border-top: 3px solid #10b981; }
	.stat-value { font-size: 1.3rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; }

	.table-tabs { display: flex; gap: 0.25rem; margin-bottom: 1.5rem; }
	.tab { padding: 0.6rem 1.25rem; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 0.375rem; font-size: 0.85rem; color: #6b7280; cursor: pointer; text-decoration: none; font-weight: 500; }
	.tab:hover { background: #e5e7eb; }
	.tab.active { background: #3b82f6; color: white; border-color: #3b82f6; }

	.empty-state { text-align: center; padding: 3rem; color: #6b7280; font-size: 1rem; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	.btn-clear { font-size: 0.85rem; color: #3b82f6; text-decoration: none; font-weight: 500; }
	.btn-clear:hover { text-decoration: underline; }

	.wizard-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }

	.record-header { display: flex; align-items: center; gap: 0.75rem; padding: 1rem 1.5rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb; flex-wrap: wrap; }
	.source-badge { padding: 0.2rem 0.6rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; background: #dbeafe; color: #1e40af; }
	.record-name { font-size: 1.1rem; font-weight: 600; color: #1a202c; }
	.record-detail { font-size: 0.85rem; color: #6b7280; }
	.vbo-tag { padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 600; background: #f3f4f6; color: #6366f1; font-family: monospace; }

	.field-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
	.field-item { display: flex; flex-direction: column; gap: 0.15rem; }
	.field-label { font-size: 0.65rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
	.field-val { font-size: 0.85rem; color: #1a202c; }
	.field-val.empty { color: #9ca3af; }

	/* Matches */
	.matches-section { padding: 1.25rem 1.5rem; border-bottom: 1px solid #e5e7eb; }
	.matches-section h3 { margin-bottom: 0.75rem; font-size: 0.9rem; color: #374151; }
	.no-matches { padding: 1rem 1.5rem; color: #6b7280; font-size: 0.9rem; border-bottom: 1px solid #e5e7eb; }

	.match-card { border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 0.75rem 1rem; margin-bottom: 0.5rem; }
	.match-header { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.35rem; }
	.match-name { font-weight: 600; color: #1a202c; font-size: 0.9rem; }
	.match-detail { font-size: 0.8rem; color: #6b7280; }
	.match-badges { display: flex; gap: 0.25rem; }
	.match-type-badge { padding: 0.1rem 0.4rem; border-radius: 0.2rem; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; }
	.match-type-badge.vbo { background: #dcfce7; color: #166534; }
	.match-type-badge.email { background: #dbeafe; color: #1e40af; }
	.match-type-badge.name { background: #fed7aa; color: #9a3412; }
	.match-type-badge.phone { background: #e0e7ff; color: #3730a3; }
	.match-fields { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 0.5rem; }
	.match-field { font-size: 0.75rem; color: #374151; background: #f9fafb; padding: 0.15rem 0.4rem; border-radius: 0.2rem; }
	.mf-label { color: #9ca3af; }
	.btn-link-match { background: #3b82f6; color: white; border: none; padding: 0.4rem 1rem; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; }
	.btn-link-match:hover { background: #2563eb; }

	/* Actions */
	.choose-actions { display: flex; align-items: center; gap: 0.75rem; padding: 1.25rem 1.5rem; flex-wrap: wrap; }
	.skipped-note { font-size: 0.8rem; color: #6b7280; }

	/* Wizard header */
	.wizard-header { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.5rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
	.btn-back { background: none; border: none; color: #3b82f6; font-size: 0.85rem; cursor: pointer; font-weight: 500; padding: 0; }
	.btn-back:hover { text-decoration: underline; }

	/* Create fields */
	.create-fields { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; padding: 1.25rem 1.5rem; }
	.create-field { display: flex; flex-direction: column; gap: 0.3rem; }
	.create-field label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
	.create-field input { padding: 0.5rem 0.65rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.9rem; }
	.create-field input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

	/* Link table */
	.link-table { }
	.link-row { display: grid; grid-template-columns: 120px 1fr 1fr; border-bottom: 1px solid #f3f4f6; }
	.link-header { background: #f9fafb; border-bottom: 2px solid #e5e7eb; font-weight: 600; font-size: 0.7rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
	.link-header > div { padding: 0.6rem 0.75rem; }
	.link-label { padding: 0.5rem 0.75rem; font-size: 0.75rem; font-weight: 600; color: #374151; display: flex; align-items: center; }
	.link-existing, .link-incoming { padding: 0.3rem 0.4rem; }
	.link-static { padding: 0.5rem 0.75rem; font-size: 0.85rem; color: #6b7280; }
	.link-row-match { background: #f9fafb; }
	.link-row-diff { background: #fffbeb; }

	.link-btn { display: block; width: 100%; text-align: left; padding: 0.45rem 0.65rem; border: 2px solid #e5e7eb; border-radius: 0.375rem; background: white; font-size: 0.83rem; color: #1a202c; cursor: pointer; transition: all 0.15s; word-break: break-word; }
	.link-btn:hover { border-color: #93c5fd; background: #f0f7ff; }
	.link-btn.selected { border-color: #3b82f6; background: #eff6ff; color: #1e40af; font-weight: 600; }
	.link-btn.empty-val { color: #9ca3af; font-style: italic; }

	.vbo-compare { display: flex; flex-wrap: wrap; gap: 1rem; padding: 0.75rem 1.5rem; background: #f8fafc; border-bottom: 1px solid #e5e7eb; align-items: center; }
	.vbo-side { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
	.vbo-side-label { font-size: 0.7rem; font-weight: 600; color: #6b7280; text-transform: uppercase; }
	.vbo-chip { font-family: monospace; font-weight: 600; font-size: 0.8rem; padding: 0.15rem 0.5rem; border-radius: 0.25rem; background: #f3f4f6; color: #6366f1; }
	.vbo-chip.vbo-higher { background: #dcfce7; color: #166534; border: 1px solid #a7f3d0; }
	.vbo-none { font-size: 0.8rem; color: #9ca3af; font-style: italic; }
	.vbo-prefer { width: 100%; font-size: 0.8rem; color: #374151; }

	.vbo-note { padding: 0.75rem 1.5rem; font-size: 0.85rem; color: #374151; background: #f0fdf4; border-top: 1px solid #e5e7eb; }

	.form-actions { display: flex; gap: 0.75rem; padding: 1.25rem 1.5rem; border-top: 1px solid #e5e7eb; }
	.btn-primary { background: #3b82f6; color: white; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; }
	.btn-primary:hover { background: #2563eb; }
	.btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
	.btn-secondary { background: #e5e7eb; color: #374151; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; }
	.btn-secondary:hover { background: #d1d5db; }
	.btn-skip { background: #f3f4f6; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: 1px solid #d1d5db; font-weight: 500; font-size: 0.9rem; cursor: pointer; }
	.btn-skip:hover { background: #e5e7eb; }
	.btn-expedite { background: #f59e0b; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-expedite:hover { background: #d97706; }
	.btn-expedite:disabled { background: #fcd34d; cursor: not-allowed; }
	.btn-expedite-all { background: #dc2626; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-expedite-all:hover { background: #b91c1c; }
	.btn-expedite-all:disabled { background: #fca5a5; cursor: not-allowed; }
	.btn-expedite-name { background: #8b5cf6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-expedite-name:hover { background: #7c3aed; }
	.btn-expedite-name:disabled { background: #c4b5fd; cursor: not-allowed; }

	@media (max-width: 768px) {
		.stats-row { grid-template-columns: repeat(2, 1fr); }
		.field-grid { grid-template-columns: repeat(2, 1fr); }
		.create-fields { grid-template-columns: 1fr; }
		.link-row { grid-template-columns: 90px 1fr 1fr; }
		.link-label { font-size: 0.65rem; }
		.table-tabs { flex-wrap: wrap; }
		.choose-actions { flex-direction: column; align-items: stretch; }
		.choose-actions .btn-primary, .choose-actions .btn-skip { text-align: center; }
	}
</style>
