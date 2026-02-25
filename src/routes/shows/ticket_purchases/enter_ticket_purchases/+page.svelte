<!-- src/routes/shows/ticket_purchases/enter_ticket_purchases/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';

	export let data;
	export let form;

	let activeTab = 'manual';

	// Submission state
	let manualSubmitting = false;
	let uploadSubmitting = false;
	let detectingConflicts = false;
	let importSubmitting = false;

	// ============================================================
	// MANUAL ENTRY STATE
	// ============================================================
	let rows = [createRow()];

	function createRow() {
		return {
			id: crypto.randomUUID(),
			mode: 'existing',
			patron_id: '',
			first_name: '',
			last_name: '',
			email: '',
			phone: '',
			show_code: '',
			show_date: '',
			tickets_purchased: 1,
			amount_paid: 0,
			purchase_date: new Date().toISOString().split('T')[0],
			payment_method: '',
			promotion_id: '',
			notes: ''
		};
	}

	function addRow() {
		const last = rows[rows.length - 1];
		const newRow = createRow();
		newRow.show_code = last?.show_code || '';
		newRow.show_date = last?.show_date || '';
		newRow.payment_method = last?.payment_method || '';
		newRow.promotion_id = last?.promotion_id || '';
		rows = [...rows, newRow];
	}

	function removeRow(id) {
		if (rows.length <= 1) return;
		rows = rows.filter((r) => r.id !== id);
	}

	function autoCalc(index) {
		const row = rows[index];
		const show = data.shows.find((s) => s.show_code === row.show_code);
		if (show && row.tickets_purchased > 0) {
			rows[index].amount_paid = show.standard_ticket_price * row.tickets_purchased;
			rows = rows;
		}
	}

	$: showsByFormat = data.shows.reduce((acc, s) => {
		const fmt = s.format || 'Other';
		if (!acc[fmt]) acc[fmt] = [];
		acc[fmt].push(s);
		return acc;
	}, {});
	$: formats = Object.keys(showsByFormat).sort();

	// ============================================================
	// CSV IMPORT STATE — 3 steps
	// ============================================================
	// Step 1: Parsed CSV data + event mapping
	let csvRows = [];
	let csvEventNames = [];
	let csvDiscountCodes = [];
	let mappings = {};
	let promoMappings = {};
	let csvParsed = false;
	let csvSummary = { totalRows: 0, rowsWithNames: 0, rowsAnonymous: 0 };
	let hasAddressData = false;
	let hasAcctIds = false;
	let skipAnonymous = false;

	// Step 2: Patron conflict resolution
	let conflicts = [];
	let autoMatched = [];
	let resolutions = {};
	let conflictsDetected = false;

	// Step 3: Import results
	let importComplete = false;
	let skipCsvContent = '';

	const classEventNames = [
		'Level One: Intro to Improv!',
		'Level Two: Characters & Stories',
		'Level Three: Intermediate Scene Work',
		'Level Four: Advanced Short Form',
		'Improv Workshop',
		'HSI Showcase'
	];

	const promoEventNames = [
		'Summer Ticket Sale',
		'Winter Ticket Sale',
		'Holiday Ticket Sale',
		'Ticket Sale'
	];

	function isPromoEvent(name) {
		const lower = name.toLowerCase();
		return promoEventNames.some((p) => lower.includes(p.toLowerCase())) ||
			lower.includes('ticket sale') ||
			lower.includes('gift card') ||
			lower.includes('season pass');
	}

	// Initialize event mappings from CSV upload
	$: if (form?.action === 'csv_upload' && form.success && !csvParsed) {
		csvRows = form.rows;
		csvEventNames = form.eventNames;
		csvDiscountCodes = form.discountCodes || [];
		csvSummary = {
			totalRows: form.totalRows,
			rowsWithNames: form.rowsWithNames,
			rowsAnonymous: form.rowsAnonymous
		};
		hasAddressData = form.hasAddressData || false;
		hasAcctIds = form.hasAcctIds || false;
		csvParsed = true;
		conflictsDetected = false;
		importComplete = false;

		mappings = {};
		promoMappings = {};
		for (const eventName of csvEventNames) {
			if (classEventNames.includes(eventName)) {
				mappings[eventName] = '__skip__';
				continue;
			}
			if (isPromoEvent(eventName)) {
				mappings[eventName] = '';
				const promoMatch = (data.promotions || []).find(
					(p) => p.promotion_name.toLowerCase() === eventName.toLowerCase()
				);
				if (promoMatch) {
					promoMappings['__event__' + eventName] = promoMatch.promotion_id.toString();
				}
				continue;
			}
			const match = data.shows.find((s) => s.show_name.toLowerCase() === eventName.toLowerCase());
			mappings[eventName] = match ? match.show_code : '';
		}
		for (const code of csvDiscountCodes) {
			const codeLower = code.toLowerCase();
			// Try exact match on promotion name
			let promoMatch = (data.promotions || []).find(
				(p) => p.promotion_name.toLowerCase() === codeLower
			);
			// Try if promotion name contains the code
			if (!promoMatch) {
				promoMatch = (data.promotions || []).find(
					(p) => p.promotion_name.toLowerCase().includes(codeLower)
				);
			}
			// Try if code contains the promotion name
			if (!promoMatch) {
				promoMatch = (data.promotions || []).find(
					(p) => codeLower.includes(p.promotion_name.toLowerCase())
				);
			}
			promoMappings[code] = promoMatch ? promoMatch.promotion_id.toString() : '';
		}
	}

	// Initialize conflict resolution from detect_conflicts
	$: if (form?.action === 'csv_detect_conflicts' && form.success && !conflictsDetected) {
		conflicts = form.conflicts || [];
		autoMatched = form.autoMatched || [];
		conflictsDetected = true;

		// Initialize resolutions for auto-matched
		resolutions = {};
		for (const am of autoMatched) {
			if (am.patron_id) {
				resolutions[am.key] = { action: 'use_existing', patron_id: am.patron_id };
			} else {
				resolutions[am.key] = { action: 'create_new' };
			}
		}
		// Conflicts start unresolved
		for (const c of conflicts) {
			resolutions[c.key] = { action: '' };
		}
	}

	// Import complete — grab skip CSV
	$: if (form?.action === 'csv_import' && form.success && !importComplete) {
		importComplete = true;
		skipCsvContent = form.skipCsvContent || '';
	}

	$: unmappedCount = csvEventNames.filter((e) => !mappings[e] || mappings[e] === '').length;
	$: skippedEventCount = csvEventNames.filter((e) => mappings[e] === '__skip__').length;
	$: mappedEventCount = csvEventNames.filter(
		(e) => mappings[e] && mappings[e] !== '__skip__' && mappings[e] !== ''
	).length;

	$: rowCountByEvent = csvRows.reduce((acc, r) => {
		acc[r.eventName] = (acc[r.eventName] || 0) + 1;
		return acc;
	}, {});

	$: ticketCountByEvent = csvRows.reduce((acc, r) => {
		acc[r.eventName] = (acc[r.eventName] || 0) + (r.qty || 0);
		return acc;
	}, {});

	$: revenueByEvent = csvRows.reduce((acc, r) => {
		acc[r.eventName] = (acc[r.eventName] || 0) + (r.itemTotal || 0);
		return acc;
	}, {});

	$: rowCountByCode = csvRows.reduce((acc, r) => {
		if (r.discountCode) acc[r.discountCode] = (acc[r.discountCode] || 0) + 1;
		return acc;
	}, {});

	$: unresolvedConflicts = conflicts.filter((c) => !resolutions[c.key]?.action);
	$: allConflictsResolved = unresolvedConflicts.length === 0;

	// Current step
	$: currentStep = importComplete ? 4 : conflictsDetected ? 3 : csvParsed ? 2 : 1;

	function resetCsv() {
		csvRows = [];
		csvEventNames = [];
		csvDiscountCodes = [];
		mappings = {};
		promoMappings = {};
		csvParsed = false;
		conflictsDetected = false;
		importComplete = false;
		conflicts = [];
		autoMatched = [];
		resolutions = {};
		skipCsvContent = '';
		csvSummary = { totalRows: 0, rowsWithNames: 0, rowsAnonymous: 0 };
	}

	function downloadSkipCsv() {
		if (!skipCsvContent) return;
		const blob = new Blob([skipCsvContent], { type: 'text/csv' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'skipped_rows.csv';
		a.click();
		URL.revokeObjectURL(url);
	}

	function resolveConflict(key, action, patronId) {
		if (action === 'use_existing' || action === 'update_existing') {
			resolutions[key] = { action, patron_id: patronId };
		} else {
			resolutions[key] = { action };
		}
		resolutions = resolutions; // trigger reactivity
	}

	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
	}
</script>

<svelte:head>
	<title>Enter Ticket Purchases | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<h1>Enter Ticket Purchases</h1>
			<p class="subtitle">Add ticket purchases manually or import from CSV</p>
		</div>
		<a href="{base}/shows/ticket_purchases" class="btn-secondary">Back to Purchases</a>
	</header>

	{#if form?.success && form?.action === 'manual'}
		<div class="alert alert-success">✓ {form.message}</div>
	{/if}

	{#if form?.error}
		<div class="alert alert-error">✗ {form.error}</div>
	{/if}

	<!-- Tab Navigation -->
	<div class="tabs">
		<button class="tab" class:active={activeTab === 'manual'} on:click={() => (activeTab = 'manual')}>
			Manual Entry
		</button>
		<button class="tab" class:active={activeTab === 'csv'} on:click={() => (activeTab = 'csv')}>
			CSV Import
		</button>
	</div>

	<!-- ============================================================ -->
	<!-- MANUAL ENTRY TAB (unchanged) -->
	<!-- ============================================================ -->
	{#if activeTab === 'manual'}
		<form method="POST" action="?/manual" use:enhance={() => {
			manualSubmitting = true;
			return async ({ update }) => { manualSubmitting = false; await update(); };
		}}>
			<input type="hidden" name="row_count" value={rows.length} />
			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th>Patron</th>
							<th>Show</th>
							<th>Show Date</th>
							<th>Tickets</th>
							<th>Amount</th>
							<th>Purchased</th>
							<th>Payment</th>
							<th>Promo</th>
							<th class="col-actions"></th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row, i (row.id)}
							<tr>
								<td class="patron-cell">
									{#if row.mode === 'existing'}
										<select name="patron_id_{i}" bind:value={row.patron_id} class="input-select" required>
											<option value="">Patron...</option>
											{#each data.patrons as p (p.patron_id)}
												<option value={p.patron_id}>{p.last_name}, {p.first_name}</option>
											{/each}
										</select>
										<button type="button" class="btn-toggle" on:click={() => { rows[i].mode = 'new'; rows = rows; }}>+ New</button>
									{:else}
										<div class="new-patron-fields">
											<input type="text" name="first_name_{i}" bind:value={row.first_name} placeholder="First" class="input-text input-sm" required />
											<input type="text" name="last_name_{i}" bind:value={row.last_name} placeholder="Last" class="input-text input-sm" required />
											<input type="email" name="email_{i}" bind:value={row.email} placeholder="Email" class="input-text input-sm" />
											<input type="text" name="phone_{i}" bind:value={row.phone} placeholder="Phone" class="input-text input-sm" />
											<button type="button" class="btn-toggle" on:click={() => { rows[i].mode = 'existing'; rows = rows; }}>↩ Existing</button>
										</div>
									{/if}
									<input type="hidden" name="mode_{i}" value={row.mode} />
								</td>
								<td>
									<select name="show_code_{i}" bind:value={row.show_code} on:change={() => autoCalc(i)} class="input-select" required>
										<option value="">Show...</option>
										{#each formats as fmt (fmt)}
											<optgroup label={fmt}>
												{#each showsByFormat[fmt] as s (s.show_code)}
													<option value={s.show_code}>{s.show_name}</option>
												{/each}
											</optgroup>
										{/each}
									</select>
								</td>
								<td><input type="date" name="show_date_{i}" bind:value={row.show_date} class="input-date" required /></td>
								<td><input type="number" name="tickets_purchased_{i}" bind:value={row.tickets_purchased} on:change={() => autoCalc(i)} min="1" class="input-number" required /></td>
								<td><input type="number" name="amount_paid_{i}" bind:value={row.amount_paid} min="0" step="0.01" class="input-number" /></td>
								<td><input type="date" name="purchase_date_{i}" bind:value={row.purchase_date} class="input-date" /></td>
								<td>
									<select name="payment_method_{i}" bind:value={row.payment_method} class="input-select input-sm-select">
										<option value="">—</option>
										<option value="Cash">Cash</option>
										<option value="Card">Card</option>
										<option value="Online">Online</option>
										<option value="Comp">Comp</option>
									</select>
								</td>
								<td>
									<select name="promotion_id_{i}" bind:value={row.promotion_id} class="input-select input-sm-select">
										<option value="">—</option>
										{#each data.promotions || [] as promo (promo.promotion_id)}
											<option value={promo.promotion_id}>{promo.promotion_name}</option>
										{/each}
									</select>
								</td>
								<td>
									<input type="hidden" name="notes_{i}" value={row.notes} />
									<div class="row-actions">
										{#if i === rows.length - 1}
											<button type="button" class="btn-add" on:click={addRow}>+</button>
										{/if}
										{#if rows.length > 1}
											<button type="button" class="btn-remove" on:click={() => removeRow(row.id)}>×</button>
										{/if}
									</div>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<div class="form-actions">
				<button type="submit" class="btn-primary" disabled={manualSubmitting}>
					{manualSubmitting ? 'Saving...' : 'Save Ticket Purchases'}
				</button>
				<button type="button" class="btn-secondary" on:click={addRow}>+ Add Another Row</button>
			</div>
		</form>
	{/if}

	<!-- ============================================================ -->
	<!-- CSV IMPORT TAB — 3-step flow -->
	<!-- ============================================================ -->
	{#if activeTab === 'csv'}
		<div class="csv-section">

			<!-- Step indicator -->
			{#if csvParsed}
				<div class="steps-bar">
					<div class="step" class:active={currentStep === 2} class:done={currentStep > 2}>
						<span class="step-num">{currentStep > 2 ? '✓' : '1'}</span> Map Events
					</div>
					<div class="step-divider"></div>
					<div class="step" class:active={currentStep === 3} class:done={currentStep > 3}>
						<span class="step-num">{currentStep > 3 ? '✓' : '2'}</span> Resolve Patrons
					</div>
					<div class="step-divider"></div>
					<div class="step" class:active={currentStep === 4}>
						<span class="step-num">3</span> Import
					</div>
				</div>
			{/if}

			<!-- ===================== STEP 1: UPLOAD ===================== -->
			{#if !csvParsed}
				<div class="card">
					<h2>Upload CSV File</h2>
					<p class="hint">
						Upload a CSZ Past Event Sales report. Supports both old format (without address) and new format (with address columns).
					</p>
					<form method="POST" action="?/csv_upload" enctype="multipart/form-data" use:enhance={() => {
						uploadSubmitting = true;
						return async ({ update }) => { uploadSubmitting = false; await update(); };
					}}>
						<div class="upload-area">
							<input type="file" name="csv_file" accept=".csv" required />
						</div>
						<div class="form-actions">
							<button type="submit" class="btn-primary" disabled={uploadSubmitting}>
								{uploadSubmitting ? 'Parsing...' : 'Upload & Parse'}
							</button>
						</div>
					</form>
				</div>
			{/if}

			<!-- ===================== STEP 2: MAP EVENTS ===================== -->
			{#if csvParsed && !conflictsDetected && !importComplete}
				<div class="card">
					<h2>CSV Summary</h2>
					<div class="summary-grid">
						<div class="summary-item"><span class="summary-value">{csvSummary.totalRows}</span><span class="summary-label">Total Rows</span></div>
						<div class="summary-item"><span class="summary-value">{csvSummary.rowsWithNames}</span><span class="summary-label">With Names</span></div>
						<div class="summary-item"><span class="summary-value">{csvSummary.rowsAnonymous}</span><span class="summary-label">Anonymous</span></div>
						<div class="summary-item"><span class="summary-value">{csvEventNames.length}</span><span class="summary-label">Events</span></div>
						{#if hasAddressData}
							<div class="summary-item highlight"><span class="summary-value">✓</span><span class="summary-label">Address Data</span></div>
						{/if}
						{#if hasAcctIds}
							<div class="summary-item highlight"><span class="summary-value">✓</span><span class="summary-label">AcctID</span></div>
						{/if}
					</div>
				</div>

				<div class="card">
					<h2>Map Events to Shows</h2>
					<p class="hint">Map each CSV event to a show. Class events are auto-skipped.</p>

					<div class="mapping-status">
						<span class="badge badge-green">{mappedEventCount} mapped</span>
						<span class="badge badge-gray">{skippedEventCount} skipped</span>
						{#if unmappedCount > 0}<span class="badge badge-red">{unmappedCount} unmapped</span>{/if}
					</div>

					<table>
						<thead>
							<tr>
								<th>CSV Event Name</th>
								<th class="col-right">Rows</th>
								<th class="col-right">Tickets</th>
								<th class="col-right">Revenue</th>
								<th>Map To Show</th>
							</tr>
						</thead>
						<tbody>
							{#each csvEventNames as eventName (eventName)}
								<tr class:dimmed={mappings[eventName] === '__skip__'} class:promo-row={isPromoEvent(eventName)}>
									<td class="event-name">
										{eventName}
										{#if isPromoEvent(eventName)}<span class="promo-tag">Promo</span>{/if}
										{#if classEventNames.includes(eventName)}<span class="class-tag">Class</span>{/if}
									</td>
									<td class="col-right">{rowCountByEvent[eventName] || 0}</td>
									<td class="col-right">{ticketCountByEvent[eventName] || 0}</td>
									<td class="col-right">{formatCurrency(revenueByEvent[eventName] || 0)}</td>
									<td>
										<select bind:value={mappings[eventName]} class="mapping-select">
											<option value="">— Select Show —</option>
											<option value="__skip__">⊘ Skip</option>
											{#each formats as fmt (fmt)}
												<optgroup label={fmt}>
													{#each showsByFormat[fmt] as show (show.show_code)}
														<option value={show.show_code}>{show.show_name}</option>
													{/each}
												</optgroup>
											{/each}
										</select>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>

				<!-- Promotion mapping -->
				{#if csvDiscountCodes.length > 0 || csvEventNames.some(isPromoEvent)}
					<div class="card">
						<h2>Map Promotions</h2>
						<p class="hint">Optionally link events or discount codes to promotions.</p>

						{#if csvEventNames.some(isPromoEvent)}
							<h3 class="section-subhead">Promotion Events</h3>
							<table>
								<thead><tr><th>Event</th><th class="col-right">Rows</th><th>Promotion</th></tr></thead>
								<tbody>
									{#each csvEventNames.filter(isPromoEvent) as eventName (eventName)}
										<tr>
											<td class="event-name">{eventName}</td>
											<td class="col-right">{rowCountByEvent[eventName] || 0}</td>
											<td>
												<select bind:value={promoMappings['__event__' + eventName]} class="mapping-select">
													<option value="">— No Promotion —</option>
													{#each data.promotions || [] as promo (promo.promotion_id)}
														<option value={promo.promotion_id.toString()}>{promo.promotion_name}</option>
													{/each}
												</select>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}

						{#if csvDiscountCodes.length > 0}
							<h3 class="section-subhead">Discount Codes</h3>
							<table>
								<thead><tr><th>Code</th><th class="col-right">Rows</th><th>Promotion</th></tr></thead>
								<tbody>
									{#each csvDiscountCodes as code (code)}
										<tr>
											<td class="event-name"><code>{code}</code></td>
											<td class="col-right">{rowCountByCode[code] || 0}</td>
											<td>
												<select bind:value={promoMappings[code]} class="mapping-select">
													<option value="">— No Promotion —</option>
													{#each data.promotions || [] as promo (promo.promotion_id)}
														<option value={promo.promotion_id.toString()}>{promo.promotion_name}</option>
													{/each}
												</select>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
				{/if}

				<div class="card">
					<h2>Options</h2>
					<label class="checkbox-option">
						<input type="checkbox" bind:checked={skipAnonymous} />
						<span>Skip anonymous rows ({csvSummary.rowsAnonymous} rows)</span>
					</label>
				</div>

				<!-- Proceed to conflict detection -->
				<form method="POST" action="?/csv_detect_conflicts" use:enhance={() => {
					detectingConflicts = true;
					return async ({ update }) => { detectingConflicts = false; await update(); };
				}}>
					<input type="hidden" name="rows_json" value={JSON.stringify(csvRows)} />
					<input type="hidden" name="mappings_json" value={JSON.stringify(mappings)} />
					<input type="hidden" name="skip_anonymous" value={skipAnonymous.toString()} />

					<div class="form-actions">
						<button type="submit" class="btn-primary" disabled={mappedEventCount === 0 || detectingConflicts}>
							{detectingConflicts ? 'Checking Patrons...' : 'Next: Check Patron Matches →'}
						</button>
						<button type="button" class="btn-secondary" on:click={resetCsv}>Start Over</button>
					</div>
				</form>
			{/if}

			<!-- ===================== STEP 3: RESOLVE PATRON CONFLICTS ===================== -->
			{#if conflictsDetected && !importComplete}
				<div class="card">
					<h2>Patron Matching Results</h2>
					<div class="summary-grid">
						<div class="summary-item"><span class="summary-value">{form?.autoMatchedExisting || 0}</span><span class="summary-label">Auto-Matched</span></div>
						{#if form?.acctIdMatched}
							<div class="summary-item highlight"><span class="summary-value">{form.acctIdMatched}</span><span class="summary-label">By AcctID</span></div>
						{/if}
						<div class="summary-item"><span class="summary-value">{form?.autoMatchedNew || 0}</span><span class="summary-label">New Patrons</span></div>
						<div class="summary-item" class:highlight={conflicts.length > 0}><span class="summary-value">{conflicts.length}</span><span class="summary-label">Need Review</span></div>
					</div>
				</div>

				{#if conflicts.length > 0}
					<div class="card">
						<h2>Resolve Patron Conflicts ({unresolvedConflicts.length} remaining)</h2>
						<p class="hint">
							These patrons from the CSV have multiple potential matches in the database. Choose how to handle each one.
						</p>

						{#each conflicts as conflict (conflict.key)}
							<div class="conflict-card" class:resolved={resolutions[conflict.key]?.action}>
								<div class="conflict-header">
									<div class="conflict-csv">
										<strong>{conflict.csvName}</strong>
										{#if conflict.acctId}<span class="acctid-tag">AcctID: {conflict.acctId}</span>{/if}
										{#if conflict.csvEmail}<span class="text-muted"> · {conflict.csvEmail}</span>{/if}
										{#if conflict.csvPhone}<span class="text-muted"> · {conflict.csvPhone}</span>{/if}
										{#if conflict.csvAddress}<br /><span class="text-muted text-sm">{conflict.csvAddress}</span>{/if}
									</div>
									{#if resolutions[conflict.key]?.action}
										<span class="resolution-badge">
											{resolutions[conflict.key].action === 'skip' ? '⊘ Skip' :
											 resolutions[conflict.key].action === 'create_new' ? '+ New' :
											 resolutions[conflict.key].action === 'use_existing' ? '→ Use Existing' :
											 resolutions[conflict.key].action === 'update_existing' ? '↻ Update' : ''}
										</span>
									{/if}
								</div>

								<div class="conflict-matches">
									<div class="match-header">Potential matches in database:</div>
									{#each conflict.matches as match (match.patron_id)}
										<div class="match-row">
											<div class="match-info">
												<strong>{match.first_name} {match.last_name}</strong>
												{#if match.vbo_account_id}<span class="acctid-tag">AcctID: {match.vbo_account_id}</span>{/if}
												{#if match.email}<span class="text-muted"> · {match.email}</span>{/if}
												{#if match.phone}<span class="text-muted"> · {match.phone}</span>{/if}
												<span class="match-type-badge">{match.matchType} ({match.confidence}%)</span>
											</div>
											<div class="match-actions">
												<button class="btn-sm btn-use"
													class:selected={resolutions[conflict.key]?.action === 'use_existing' && resolutions[conflict.key]?.patron_id === match.patron_id}
													on:click={() => resolveConflict(conflict.key, 'use_existing', match.patron_id)}>
													Use This
												</button>
												<button class="btn-sm btn-update"
													class:selected={resolutions[conflict.key]?.action === 'update_existing' && resolutions[conflict.key]?.patron_id === match.patron_id}
													on:click={() => resolveConflict(conflict.key, 'update_existing', match.patron_id)}>
													Update This
												</button>
											</div>
										</div>
									{/each}
								</div>

								<div class="conflict-other-actions">
									<button class="btn-sm btn-new"
										class:selected={resolutions[conflict.key]?.action === 'create_new'}
										on:click={() => resolveConflict(conflict.key, 'create_new')}>
										+ Create New Patron
									</button>
									<button class="btn-sm btn-skip"
										class:selected={resolutions[conflict.key]?.action === 'skip'}
										on:click={() => resolveConflict(conflict.key, 'skip')}>
										⊘ Skip
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Final import -->
				<form method="POST" action="?/csv_import" use:enhance={() => {
					importSubmitting = true;
					return async ({ update }) => { importSubmitting = false; await update(); };
				}}>
					<input type="hidden" name="rows_json" value={JSON.stringify(csvRows)} />
					<input type="hidden" name="mappings_json" value={JSON.stringify(mappings)} />
					<input type="hidden" name="promo_mappings_json" value={JSON.stringify(promoMappings)} />
					<input type="hidden" name="resolutions_json" value={JSON.stringify(resolutions)} />
					<input type="hidden" name="skip_anonymous" value={skipAnonymous.toString()} />

					<div class="form-actions">
						<button type="submit" class="btn-primary"
							disabled={importSubmitting || (conflicts.length > 0 && !allConflictsResolved)}>
							{#if importSubmitting}
								Importing...
							{:else if conflicts.length > 0 && !allConflictsResolved}
								Resolve all conflicts to continue ({unresolvedConflicts.length} remaining)
							{:else}
								Import Tickets
							{/if}
						</button>
						<button type="button" class="btn-secondary" on:click={resetCsv} disabled={importSubmitting}>Start Over</button>
					</div>
				</form>
			{/if}

			<!-- ===================== STEP 4: IMPORT RESULTS ===================== -->
			{#if importComplete}
				<div class="alert alert-success">
					<div>✓ {form.message}</div>
					<div class="import-stats">
						Imported: {form.imported} · Skipped: {form.skipped} · New Patrons: {form.patronsCreated} · Updated: {form.patronsUpdated}
						{#if form.anonymousImported > 0} · Anonymous: {form.anonymousImported}{/if}
					</div>
					{#if form.errors && form.errors.length > 0}
						<details class="results-details">
							<summary>{form.errors.length} error{form.errors.length !== 1 ? 's' : ''}</summary>
							<ul>{#each form.errors as err}<li>{err}</li>{/each}</ul>
						</details>
					{/if}
				</div>

				{#if form.skippedCount > 0 && skipCsvContent}
					<div class="card">
						<h2>Skipped Rows</h2>
						<p class="hint">{form.skippedCount} rows were not imported. Download the CSV to review why.</p>
						<button class="btn-primary" on:click={downloadSkipCsv}>
							Download Skipped Rows CSV ({form.skippedCount} rows)
						</button>
					</div>
				{/if}

				<div class="form-actions">
					<button class="btn-secondary" on:click={resetCsv}>Import Another File</button>
					<a href="{base}/shows/ticket_purchases" class="btn-secondary">View Ticket Purchases</a>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1.25rem; font-weight: 600; color: #1a202c; margin: 0 0 1rem 0; }
	h3.section-subhead { font-size: 0.9rem; font-weight: 600; color: #374151; margin: 1.25rem 0 0.5rem 0; text-transform: uppercase; letter-spacing: 0.03em; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; font-size: 0.9rem; }

	.alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
	.alert-success { background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
	.alert-error { background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
	.import-stats { font-size: 0.85rem; font-weight: 400; margin-top: 0.25rem; }
	.results-details { margin-top: 0.5rem; font-size: 0.85rem; }
	.results-details summary { cursor: pointer; font-weight: 600; }
	.results-details ul { margin: 0.5rem 0 0 1rem; padding: 0; list-style: disc; }

	.tabs { display: flex; gap: 0; margin-bottom: 1.5rem; border-bottom: 2px solid #e5e7eb; }
	.tab { padding: 0.75rem 1.5rem; background: none; border: none; border-bottom: 2px solid transparent; margin-bottom: -2px; font-size: 1rem; font-weight: 500; color: #6b7280; cursor: pointer; }
	.tab:hover { color: #1a202c; }
	.tab.active { color: #3b82f6; border-bottom-color: #3b82f6; font-weight: 600; }

	/* Steps bar */
	.steps-bar { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1.5rem; padding: 1rem; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
	.step { display: flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; color: #9ca3af; font-weight: 500; }
	.step.active { color: #3b82f6; font-weight: 600; }
	.step.done { color: #059669; }
	.step-num { display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; background: #f3f4f6; font-size: 0.75rem; font-weight: 700; }
	.step.active .step-num { background: #dbeafe; color: #2563eb; }
	.step.done .step-num { background: #d1fae5; color: #059669; }
	.step-divider { flex: 1; height: 2px; background: #e5e7eb; }

	.table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; margin-bottom: 1.5rem; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
	td { padding: 0.5rem 0.75rem; border-bottom: 1px solid #f3f4f6; vertical-align: top; }

	.input-select, .input-text, .input-date, .input-number { padding: 0.4rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; color: #1a202c; background: white; }
	.input-select:focus, .input-text:focus, .input-date:focus, .input-number:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
	.input-select { min-width: 140px; }
	.input-sm-select { min-width: 80px; }
	.input-number { width: 80px; }
	.input-date { width: 130px; }
	.input-sm { width: 100%; margin-bottom: 0.25rem; }

	.patron-cell { min-width: 200px; }
	.new-patron-fields { display: flex; flex-direction: column; gap: 0.25rem; }
	.btn-toggle { background: none; border: none; color: #3b82f6; font-size: 0.75rem; cursor: pointer; padding: 0.15rem 0; text-align: left; }
	.btn-toggle:hover { text-decoration: underline; }

	.col-actions { width: 60px; }
	.row-actions { display: flex; gap: 0.35rem; }
	.btn-add, .btn-remove { width: 24px; height: 24px; border-radius: 50%; border: none; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center; }
	.btn-add { background-color: #dcfce7; color: #166534; }
	.btn-add:hover { background-color: #bbf7d0; }
	.btn-remove { background-color: #fee2e2; color: #991b1b; }
	.btn-remove:hover { background-color: #fecaca; }

	.form-actions { display: flex; gap: 1rem; align-items: center; flex-wrap: wrap; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 1rem; cursor: pointer; text-decoration: none; }
	.btn-primary:hover:not(:disabled) { background-color: #2563eb; }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 1rem; cursor: pointer; text-decoration: none; display: inline-block; }
	.btn-secondary:hover:not(:disabled) { background-color: #d1d5db; }
	.btn-secondary:disabled { opacity: 0.5; cursor: not-allowed; }

	.csv-section { margin-top: 0.5rem; }
	.card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
	.hint { color: #6b7280; font-size: 0.9rem; margin: 0 0 1.5rem 0; line-height: 1.5; }
	.upload-area { margin-bottom: 1.5rem; }
	.upload-area input[type='file'] { font-size: 0.95rem; }

	.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 1rem; }
	.summary-item { text-align: center; padding: 1rem; background: #f9fafb; border-radius: 0.375rem; }
	.summary-item.highlight { background: #dbeafe; }
	.summary-value { display: block; font-size: 1.5rem; font-weight: 700; color: #1a202c; }
	.summary-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	.mapping-status { display: flex; gap: 0.75rem; margin-bottom: 1rem; }
	.badge { padding: 0.3rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; }
	.badge-green { background: #dcfce7; color: #166534; }
	.badge-gray { background: #f3f4f6; color: #6b7280; }
	.badge-red { background: #fee2e2; color: #991b1b; }

	.event-name { font-weight: 500; }
	.promo-tag { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; background-color: #fef3c7; color: #92400e; margin-left: 0.4rem; }
	.class-tag { display: inline-block; padding: 0.1rem 0.4rem; border-radius: 0.25rem; font-size: 0.65rem; font-weight: 600; text-transform: uppercase; background-color: #e0e7ff; color: #4338ca; margin-left: 0.4rem; }
	.acctid-tag { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 0.25rem; font-size: 0.7rem; font-weight: 600; background-color: #dbeafe; color: #1e40af; margin-left: 0.4rem; font-family: monospace; }
	tr.promo-row { background-color: #fffbeb; }
	.col-right { text-align: right; }
	tr.dimmed { opacity: 0.5; }

	.mapping-select { padding: 0.4rem 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.85rem; width: 100%; background: white; }
	.mapping-select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

	.checkbox-option { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
	.checkbox-option input { width: 1rem; height: 1rem; cursor: pointer; }
	code { background: #f3f4f6; padding: 0.15rem 0.35rem; border-radius: 0.25rem; font-size: 0.8rem; font-weight: 600; color: #374151; }

	/* Conflict resolution UI */
	.conflict-card { border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1rem; margin-bottom: 1rem; transition: border-color 0.2s; }
	.conflict-card.resolved { border-color: #a7f3d0; background: #f0fdf4; }
	.conflict-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
	.conflict-csv { font-size: 0.95rem; }
	.resolution-badge { padding: 0.25rem 0.6rem; background: #d1fae5; color: #065f46; border-radius: 0.25rem; font-size: 0.75rem; font-weight: 600; white-space: nowrap; }

	.conflict-matches { margin-bottom: 0.75rem; }
	.match-header { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 0.5rem; }
	.match-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0.75rem; background: white; border: 1px solid #e5e7eb; border-radius: 0.375rem; margin-bottom: 0.35rem; gap: 0.75rem; flex-wrap: wrap; }
	.match-info { font-size: 0.85rem; flex: 1; }
	.match-type-badge { display: inline-block; padding: 0.1rem 0.4rem; background: #e0e7ff; color: #4338ca; border-radius: 0.25rem; font-size: 0.65rem; font-weight: 600; margin-left: 0.4rem; }
	.match-actions { display: flex; gap: 0.35rem; }

	.conflict-other-actions { display: flex; gap: 0.5rem; }

	.btn-sm { padding: 0.3rem 0.65rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.8rem; font-weight: 500; cursor: pointer; background: white; color: #374151; transition: all 0.15s; }
	.btn-sm:hover { background: #f3f4f6; }
	.btn-sm.selected { font-weight: 600; }
	.btn-use.selected { background: #dbeafe; border-color: #93c5fd; color: #1e40af; }
	.btn-update.selected { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
	.btn-new.selected { background: #d1fae5; border-color: #6ee7b7; color: #065f46; }
	.btn-skip.selected { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }

	.text-muted { color: #6b7280; font-size: 0.85rem; }
	.text-sm { font-size: 0.8rem; }

	@media (max-width: 768px) {
		.container { padding: 1rem; }
		header { flex-direction: column; gap: 1rem; }
		.summary-grid { grid-template-columns: repeat(2, 1fr); }
		.match-row { flex-direction: column; align-items: flex-start; }
		.steps-bar { flex-wrap: wrap; }
	}
</style>