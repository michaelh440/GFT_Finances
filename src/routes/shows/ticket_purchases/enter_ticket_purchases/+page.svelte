<!-- src/routes/shows/ticket_purchases/enter_ticket_purchases/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';

	export let data;
	export let form;

	let activeTab = 'manual';

	// Submission state (prevents double-clicks)
	let manualSubmitting = false;
	let uploadSubmitting = false;
	let importSubmitting = false;

	// ============================================================
	// MANUAL ENTRY STATE
	// ============================================================
	let rows = [createRow()];

	function createRow() {
		return {
			id: crypto.randomUUID(),
			mode: 'existing', // 'existing' or 'new'
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

	// Auto-calculate amount when show or ticket count changes
	function autoCalc(index) {
		const row = rows[index];
		const show = data.shows.find((s) => s.show_code === row.show_code);
		if (show && row.tickets_purchased > 0) {
			rows[index].amount_paid = show.standard_ticket_price * row.tickets_purchased;
			rows = rows;
		}
	}

	// Group shows by format for dropdown
	$: showsByFormat = data.shows.reduce((/** @type {Record<string, any[]>} */ acc, s) => {
		const fmt = s.format || 'Other';
		if (!acc[fmt]) acc[fmt] = [];
		acc[fmt].push(s);
		return acc;
	}, {});
	$: formats = Object.keys(showsByFormat).sort();

	// ============================================================
	// CSV IMPORT STATE
	// ============================================================
	/** @type {any[]} */
	let csvRows = [];
	/** @type {string[]} */
	let csvEventNames = [];
	/** @type {string[]} */
	let csvDiscountCodes = [];
	/** @type {Record<string, string>} */
	let mappings = {};
	/** @type {Record<string, string>} */
	let promoMappings = {};
	let csvParsed = false;
	let csvSummary = { totalRows: 0, rowsWithNames: 0, rowsAnonymous: 0 };
	let skipAnonymous = false;

	// Known class/non-show event names to auto-skip
	const classEventNames = [
		'Level One: Intro to Improv!',
		'Level Two: Characters & Stories',
		'Level Three: Intermediate Scene Work',
		'Level Four: Advanced Short Form',
		'Improv Workshop',
		'HSI Showcase'
	];

	// Known promotion-style event names (not real shows)
	const promoEventNames = [
		'Summer Ticket Sale',
		'Winter Ticket Sale',
		'Holiday Ticket Sale',
		'Ticket Sale'
	];

	/**
	 * Check if an event name looks like a promotion rather than a real show
	 * @param {string} name
	 * @returns {boolean}
	 */
	function isPromoEvent(name) {
		const lower = name.toLowerCase();
		return promoEventNames.some((p) => lower.includes(p.toLowerCase())) ||
			lower.includes('ticket sale') ||
			lower.includes('gift card') ||
			lower.includes('season pass');
	}

	// Initialize mappings when csv_upload returns data
	$: if (form?.action === 'csv_upload' && form.success && !csvParsed) {
		csvRows = form.rows;
		csvEventNames = form.eventNames;
		csvDiscountCodes = form.discountCodes || [];
		csvSummary = {
			totalRows: form.totalRows,
			rowsWithNames: form.rowsWithNames,
			rowsAnonymous: form.rowsAnonymous
		};
		csvParsed = true;

		// Auto-map events
		mappings = {};
		promoMappings = {};
		for (const eventName of csvEventNames) {
			if (classEventNames.includes(eventName)) {
				mappings[eventName] = '__skip__';
				continue;
			}
			// Promo events: don't auto-map to a show, leave unmapped for user to decide
			if (isPromoEvent(eventName)) {
				mappings[eventName] = '';
				// Auto-map promo event to a matching promotion by name
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

		// Initialize discount code promo mappings
		for (const code of csvDiscountCodes) {
			promoMappings[code] = '';
		}
	}

	$: unmappedCount = csvEventNames.filter((e) => !mappings[e] || mappings[e] === '').length;
	$: skippedEventCount = csvEventNames.filter((e) => mappings[e] === '__skip__').length;
	$: mappedEventCount = csvEventNames.filter(
		(e) => mappings[e] && mappings[e] !== '__skip__' && mappings[e] !== ''
	).length;

	// Count rows per event
	$: rowCountByEvent = csvRows.reduce((/** @type {Record<string, number>} */ acc, r) => {
		acc[r.eventName] = (acc[r.eventName] || 0) + 1;
		return acc;
	}, {});

	// Count total tickets per event
	$: ticketCountByEvent = csvRows.reduce((/** @type {Record<string, number>} */ acc, r) => {
		acc[r.eventName] = (acc[r.eventName] || 0) + (r.qty || 0);
		return acc;
	}, {});

	// Revenue per event
	$: revenueByEvent = csvRows.reduce((/** @type {Record<string, number>} */ acc, r) => {
		acc[r.eventName] = (acc[r.eventName] || 0) + (r.itemTotal || 0);
		return acc;
	}, {});

	// Count rows per discount code
	$: rowCountByCode = csvRows.reduce((/** @type {Record<string, number>} */ acc, r) => {
		if (r.discountCode) acc[r.discountCode] = (acc[r.discountCode] || 0) + 1;
		return acc;
	}, {});

	// Check if any promo mapping is set
	$: hasAnyPromoMapping = Object.values(promoMappings).some((v) => v && v !== '');

	function resetCsv() {
		csvRows = [];
		csvEventNames = [];
		csvDiscountCodes = [];
		mappings = {};
		promoMappings = {};
		csvParsed = false;
		csvSummary = { totalRows: 0, rowsWithNames: 0, rowsAnonymous: 0 };
	}

	/**
	 * @param {number} amount
	 * @returns {string}
	 */
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
		<a href="{base}/shows/patrons" class="btn-secondary">Back to Patrons</a>
	</header>

	{#if form?.success && form?.action !== 'csv_upload'}
		<div class="alert alert-success">
			<div>✓ {form.message}</div>
			{#if form.action === 'csv_import'}
				<div class="import-stats">
					Imported: {form.imported} · Skipped: {form.skipped} · New Patrons: {form.patronsCreated}
					{#if form.anonymousImported > 0} · Anonymous: {form.anonymousImported}{/if}
				</div>
				{#if form.errors && form.errors.length > 0}
					<details class="results-details">
						<summary>{form.errors.length} error{form.errors.length !== 1 ? 's' : ''}</summary>
						<ul>
							{#each form.errors as err}
								<li>{err}</li>
							{/each}
						</ul>
					</details>
				{/if}
			{/if}
		</div>
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
	<!-- MANUAL ENTRY TAB -->
	<!-- ============================================================ -->
	{#if activeTab === 'manual'}
		<form method="POST" action="?/manual" use:enhance={() => {
			manualSubmitting = true;
			return async ({ update }) => {
				manualSubmitting = false;
				await update();
			};
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
												<option value={p.patron_id}>
													{p.last_name}, {p.first_name}
												</option>
											{/each}
										</select>
										<button type="button" class="btn-toggle" on:click={() => { rows[i].mode = 'new'; rows = rows; }} title="Create new patron">+ New</button>
									{:else}
										<div class="new-patron-fields">
											<input type="text" name="first_name_{i}" bind:value={row.first_name} placeholder="First" class="input-text input-sm" required />
											<input type="text" name="last_name_{i}" bind:value={row.last_name} placeholder="Last" class="input-text input-sm" required />
											<input type="email" name="email_{i}" bind:value={row.email} placeholder="Email" class="input-text input-sm" />
											<input type="text" name="phone_{i}" bind:value={row.phone} placeholder="Phone" class="input-text input-sm" />
											<button type="button" class="btn-toggle" on:click={() => { rows[i].mode = 'existing'; rows = rows; }} title="Select existing">↩ Existing</button>
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
								<td>
									<input type="date" name="show_date_{i}" bind:value={row.show_date} class="input-date" required />
								</td>
								<td>
									<input
										type="number"
										name="tickets_purchased_{i}"
										bind:value={row.tickets_purchased}
										on:change={() => autoCalc(i)}
										min="1"
										class="input-number"
										required
									/>
								</td>
								<td>
									<input type="number" name="amount_paid_{i}" bind:value={row.amount_paid} min="0" step="0.01" class="input-number" />
								</td>
								<td>
									<input type="date" name="purchase_date_{i}" bind:value={row.purchase_date} class="input-date" />
								</td>
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
				<button type="submit" class="btn-primary" disabled={manualSubmitting}>
					{manualSubmitting ? 'Saving...' : 'Save Ticket Purchases'}
				</button>
				<button type="button" class="btn-secondary" on:click={addRow}>+ Add Another Row</button>
			</div>
		</form>
	{/if}

	<!-- ============================================================ -->
	<!-- CSV IMPORT TAB -->
	<!-- ============================================================ -->
	{#if activeTab === 'csv'}
		<div class="csv-section">
			{#if !csvParsed}
				<!-- Step 1: Upload -->
				<div class="card">
					<h2>Upload CSV File</h2>
					<p class="hint">
						Upload a CSZ Past Event Sales report CSV file. The importer will parse event names,
						ticket quantities, amounts, patron info, and discount codes. You'll map each event to a show before importing.
					</p>

					<form method="POST" action="?/csv_upload" enctype="multipart/form-data" use:enhance={() => {
						uploadSubmitting = true;
						return async ({ update }) => {
							uploadSubmitting = false;
							await update();
						};
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

			{:else}
				<!-- Step 2: Summary + Map + Import -->
				<div class="card">
					<h2>CSV Summary</h2>
					<div class="summary-grid">
						<div class="summary-item">
							<span class="summary-value">{csvSummary.totalRows}</span>
							<span class="summary-label">Total Rows</span>
						</div>
						<div class="summary-item">
							<span class="summary-value">{csvSummary.rowsWithNames}</span>
							<span class="summary-label">With Names</span>
						</div>
						<div class="summary-item">
							<span class="summary-value">{csvSummary.rowsAnonymous}</span>
							<span class="summary-label">Anonymous</span>
						</div>
						<div class="summary-item">
							<span class="summary-value">{csvEventNames.length}</span>
							<span class="summary-label">Unique Events</span>
						</div>
						{#if csvDiscountCodes.length > 0}
							<div class="summary-item">
								<span class="summary-value">{csvDiscountCodes.length}</span>
								<span class="summary-label">Discount Codes</span>
							</div>
						{/if}
					</div>
				</div>

				<div class="card">
					<h2>Map Events to Shows</h2>
					<p class="hint">
						Map each CSV event name to a show in your database. Promotion-style events (like "Summer Ticket Sale")
						should be mapped to the show the tickets are redeemable for. Class-related events are auto-skipped.
					</p>

					<div class="mapping-status">
						<span class="badge badge-green">{mappedEventCount} mapped</span>
						<span class="badge badge-gray">{skippedEventCount} skipped</span>
						{#if unmappedCount > 0}
							<span class="badge badge-red">{unmappedCount} unmapped</span>
						{/if}
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
										{#if isPromoEvent(eventName)}
											<span class="promo-tag">Promotion</span>
										{/if}
										{#if classEventNames.includes(eventName) && mappings[eventName] === '__skip__'}
											<span class="class-tag">Class</span>
										{/if}
									</td>
									<td class="col-right">{rowCountByEvent[eventName] || 0}</td>
									<td class="col-right">{ticketCountByEvent[eventName] || 0}</td>
									<td class="col-right">{formatCurrency(revenueByEvent[eventName] || 0)}</td>
									<td>
										<select bind:value={mappings[eventName]} class="mapping-select">
											<option value="">— Select Show —</option>
											<option value="__skip__">⊘ Skip this event</option>
											{#each formats as fmt (fmt)}
												<optgroup label={fmt}>
													{#each showsByFormat[fmt] as show (show.show_code)}
														<option value={show.show_code}>
															{show.show_name}
														</option>
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

				<!-- Promotion Mapping -->
				{#if csvDiscountCodes.length > 0 || csvEventNames.some(isPromoEvent)}
					<div class="card">
						<h2>Map Promotions</h2>
						<p class="hint">
							Optionally tag ticket purchases with a promotion. Event-based promotions (like "Summer Ticket Sale")
							and CSV discount codes (like CSZBDAY, HSL) can each be linked to a promotion in your database.
							Leave blank to import without a promotion tag.
						</p>

						<!-- Event-level promotions -->
						{#if csvEventNames.some(isPromoEvent)}
							<h3 class="section-subhead">Promotion Events</h3>
							<table>
								<thead>
									<tr>
										<th>Event Name</th>
										<th class="col-right">Rows</th>
										<th>Link to Promotion</th>
									</tr>
								</thead>
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

						<!-- Discount code promotions -->
						{#if csvDiscountCodes.length > 0}
							<h3 class="section-subhead">Discount Codes</h3>
							<table>
								<thead>
									<tr>
										<th>Discount Code</th>
										<th class="col-right">Rows</th>
										<th>Link to Promotion</th>
									</tr>
								</thead>
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
					<h2>Import Options</h2>
					<div class="options">
						<label class="checkbox-option">
							<input type="checkbox" bind:checked={skipAnonymous} />
							<span>Skip anonymous rows (no name — {csvSummary.rowsAnonymous} rows)</span>
						</label>
					</div>
				</div>

				<form method="POST" action="?/csv_import" use:enhance={() => {
					importSubmitting = true;
					return async ({ result, update }) => {
						importSubmitting = false;
						if (result.type === 'success' && result.data?.success) {
							resetCsv();
						}
						await update();
					};
				}}>
					<input type="hidden" name="rows_json" value={JSON.stringify(csvRows)} />
					<input type="hidden" name="mappings_json" value={JSON.stringify(mappings)} />
					<input type="hidden" name="promo_mappings_json" value={JSON.stringify(promoMappings)} />
					<input type="hidden" name="skip_anonymous" value={skipAnonymous.toString()} />

					<div class="form-actions">
						<button type="submit" class="btn-primary" disabled={mappedEventCount === 0 || importSubmitting}>
							{#if importSubmitting}
								Importing...
							{:else if mappedEventCount > 0}
								Import
							{:else}
								Import (map at least one event)
							{/if}
						</button>
						<button type="button" class="btn-secondary" on:click={resetCsv} disabled={importSubmitting}>Start Over</button>
					</div>
				</form>
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
		margin: 0;
	}

	h2 {
		font-size: 1.25rem;
		font-weight: 600;
		color: #1a202c;
		margin: 0 0 1rem 0;
	}

	h3.section-subhead {
		font-size: 0.9rem;
		font-weight: 600;
		color: #374151;
		margin: 1.25rem 0 0.5rem 0;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.subtitle {
		color: #6b7280;
		margin: 0.25rem 0 0 0;
		font-size: 0.9rem;
	}

	/* Alerts */
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

	.import-stats {
		font-size: 0.85rem;
		font-weight: 400;
		margin-top: 0.25rem;
	}

	.results-details {
		margin-top: 0.5rem;
		font-size: 0.85rem;
	}

	.results-details summary {
		cursor: pointer;
		font-weight: 600;
	}

	.results-details ul {
		margin: 0.5rem 0 0 1rem;
		padding: 0;
		list-style: disc;
	}

	.results-details li {
		margin: 0.2rem 0;
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
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
		font-size: 1rem;
		font-weight: 500;
		color: #6b7280;
		cursor: pointer;
		transition: color 0.2s, border-color 0.2s;
	}

	.tab:hover {
		color: #1a202c;
	}

	.tab.active {
		color: #3b82f6;
		border-bottom-color: #3b82f6;
		font-weight: 600;
	}

	/* Manual Entry Table */
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
		padding: 0.75rem 0.75rem;
		text-align: left;
		font-weight: 600;
		color: #374151;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.03em;
		border-bottom: 2px solid #e5e7eb;
		white-space: nowrap;
	}

	td {
		padding: 0.5rem 0.75rem;
		border-bottom: 1px solid #f3f4f6;
		vertical-align: top;
	}

	/* Inputs */
	.input-select,
	.input-text,
	.input-date,
	.input-number {
		padding: 0.4rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.85rem;
		color: #1a202c;
		background: white;
		transition: border-color 0.2s;
	}

	.input-select:focus,
	.input-text:focus,
	.input-date:focus,
	.input-number:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.input-select {
		min-width: 140px;
	}

	.input-sm-select {
		min-width: 80px;
	}

	.input-number {
		width: 80px;
	}

	.input-date {
		width: 130px;
	}

	.input-sm {
		width: 100%;
		margin-bottom: 0.25rem;
	}

	/* Patron cell */
	.patron-cell {
		min-width: 200px;
	}

	.new-patron-fields {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.btn-toggle {
		background: none;
		border: none;
		color: #3b82f6;
		font-size: 0.75rem;
		cursor: pointer;
		padding: 0.15rem 0;
		text-align: left;
	}

	.btn-toggle:hover {
		text-decoration: underline;
	}

	/* Row action buttons */
	.col-actions {
		width: 60px;
	}

	.row-actions {
		display: flex;
		gap: 0.35rem;
	}

	.btn-add,
	.btn-remove {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		border: none;
		cursor: pointer;
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
		transition: background-color 0.2s;
	}

	.btn-add {
		background-color: #dcfce7;
		color: #166534;
	}

	.btn-add:hover {
		background-color: #bbf7d0;
	}

	.btn-remove {
		background-color: #fee2e2;
		color: #991b1b;
	}

	.btn-remove:hover {
		background-color: #fecaca;
	}

	/* Form actions */
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

	.btn-secondary:hover:not(:disabled) {
		background-color: #d1d5db;
	}

	.btn-secondary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* ============================================================ */
	/* CSV Import Styles */
	/* ============================================================ */

	.csv-section {
		margin-top: 0.5rem;
	}

	.card {
		background: white;
		padding: 1.5rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		margin-bottom: 1.5rem;
	}

	.hint {
		color: #6b7280;
		font-size: 0.9rem;
		margin: 0 0 1.5rem 0;
		line-height: 1.5;
	}

	.upload-area {
		margin-bottom: 1.5rem;
	}

	.upload-area input[type='file'] {
		font-size: 0.95rem;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
		gap: 1rem;
	}

	.summary-item {
		text-align: center;
		padding: 1rem;
		background: #f9fafb;
		border-radius: 0.375rem;
	}

	.summary-value {
		display: block;
		font-size: 1.5rem;
		font-weight: 700;
		color: #1a202c;
	}

	.summary-label {
		font-size: 0.8rem;
		color: #6b7280;
		font-weight: 500;
	}

	.mapping-status {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.badge {
		padding: 0.3rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.8rem;
		font-weight: 500;
	}

	.badge-green {
		background: #dcfce7;
		color: #166534;
	}

	.badge-gray {
		background: #f3f4f6;
		color: #6b7280;
	}

	.badge-red {
		background: #fee2e2;
		color: #991b1b;
	}

	.event-name {
		font-weight: 500;
	}

	.promo-tag {
		display: inline-block;
		padding: 0.1rem 0.4rem;
		border-radius: 0.25rem;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		background-color: #fef3c7;
		color: #92400e;
		margin-left: 0.4rem;
		vertical-align: middle;
	}

	.class-tag {
		display: inline-block;
		padding: 0.1rem 0.4rem;
		border-radius: 0.25rem;
		font-size: 0.65rem;
		font-weight: 600;
		text-transform: uppercase;
		background-color: #e0e7ff;
		color: #4338ca;
		margin-left: 0.4rem;
		vertical-align: middle;
	}

	tr.promo-row {
		background-color: #fffbeb;
	}

	.col-right {
		text-align: right;
	}

	tr.dimmed {
		opacity: 0.5;
	}

	.mapping-select {
		padding: 0.4rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.85rem;
		width: 100%;
		background: white;
	}

	.mapping-select:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.checkbox-option {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
	}

	.checkbox-option input {
		width: 1rem;
		height: 1rem;
		cursor: pointer;
	}

	code {
		background: #f3f4f6;
		padding: 0.15rem 0.35rem;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-weight: 600;
		color: #374151;
	}

	@media (max-width: 768px) {
		.container {
			padding: 1rem;
		}

		header {
			flex-direction: column;
			gap: 1rem;
		}

		.summary-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}
</style>