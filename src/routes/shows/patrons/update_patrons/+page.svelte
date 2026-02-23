<!-- src/routes/shows/patrons/update_patrons/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';

	export let data;
	export let form;

	let uploading = false;
	let applying = false;
	let updateMode = 'fill';

	// Parsed data from CSV
	$: csvUploaded = form?.action === 'csv_upload' && form?.success;
	$: matched = form?.matched || [];
	$: unmatched = form?.unmatched || [];
	$: updateApplied = form?.action === 'apply_updates' && form?.success;

	// Debug logging
	$: if (form) {
		console.log('[update_patrons client] form action:', form?.action, 'success:', form?.success);
		console.log('[update_patrons client] matched:', matched.length, 'unmatched:', unmatched.length);
		if (form?.error) console.log('[update_patrons client] error:', form.error);
	}
</script>

<svelte:head>
	<title>Update Patron Data | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href="{base}/shows/patrons" class="breadcrumb">← Back to Patrons</a>
			<h1>Update Patron Data</h1>
			<p class="subtitle">Import address and contact data from updated CSZ report</p>
		</div>
	</header>

	<!-- Current Stats -->
	<div class="stats-row">
		<div class="stat-card">
			<span class="stat-value">{data.stats.total_patrons.toLocaleString()}</span>
			<span class="stat-label">Total Patrons</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{data.stats.with_zip.toLocaleString()}</span>
			<span class="stat-label">With Zip Code</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{data.stats.with_city.toLocaleString()}</span>
			<span class="stat-label">With City</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{data.stats.total_patrons > 0 ? Math.round((data.stats.with_zip / data.stats.total_patrons) * 100) : 0}%</span>
			<span class="stat-label">Zip Coverage</span>
		</div>
	</div>

	{#if form?.error}
		<div class="alert alert-error">✗ {form.error}</div>
	{/if}

	{#if form && !form.success && !form.error}
		<div class="alert alert-error">✗ Something went wrong — the server returned no data. Check the server console.</div>
	{/if}

	{#if updateApplied}
		<div class="alert alert-success">
			✓ Updated {form.updated} patron{form.updated !== 1 ? 's' : ''}{form.skipped > 0 ? `, skipped ${form.skipped} with no new data` : ''}.
			<a href="{base}/shows/patrons/update_patrons" class="alert-link">Upload another file</a>
		</div>
	{/if}

	<!-- Upload Section -->
	{#if !csvUploaded && !updateApplied}
		<div class="card">
			<h2>Upload Updated CSV</h2>
			<p class="hint">
				Upload a CSZ Past Event Sales report that includes address columns
				(Address, Address 2, City, State/Province, ZipCode, Country).
				Existing patrons will be matched by name and email.
			</p>

			<form
				method="POST"
				action="?/csv_upload"
				enctype="multipart/form-data"
				use:enhance={() => {
					uploading = true;
					return async ({ update }) => {
						await update();
						uploading = false;
					};
				}}
			>
				<div class="upload-area">
					<input type="file" name="csv_file" accept=".csv" required />
					<button type="submit" class="btn-primary" disabled={uploading}>
						{uploading ? 'Parsing...' : 'Upload & Preview'}
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Preview Results -->
	{#if csvUploaded}
		<div class="card">
			<h2>CSV Preview</h2>
			<div class="preview-stats">
				<span class="preview-stat">
					<strong>{form.totalParsed}</strong> unique patrons in CSV
				</span>
				<span class="preview-stat matched">
					<strong>{form.matchedCount}</strong> matched to existing patrons
				</span>
				<span class="preview-stat new-data">
					<strong>{form.withNewData}</strong> with new address data to add
				</span>
				{#if form.unmatchedCount > 0}
					<span class="preview-stat unmatched">
						<strong>{form.unmatchedCount}</strong> not found in database
					</span>
				{/if}
			</div>
		</div>

		<!-- Matched patrons with new data -->
		{#if matched.filter((m) => m.hasNewData).length > 0}
			<div class="card">
				<h2>Patrons to Update ({matched.filter((m) => m.hasNewData).length})</h2>
				<div class="table-wrapper">
					<table>
						<thead>
							<tr>
								<th>Patron</th>
								<th>Current Address</th>
								<th>→</th>
								<th>New Data from CSV</th>
							</tr>
						</thead>
						<tbody>
							{#each matched.filter((m) => m.hasNewData).slice(0, 50) as m (m.patron_id)}
								<tr>
									<td>
										<strong>{m.name}</strong>
										{#if m.email}<br /><span class="text-muted">{m.email}</span>{/if}
									</td>
									<td class="addr-cell">
										{#if m.current.address_line1}
											{m.current.address_line1}<br />
										{/if}
										{#if m.current.city || m.current.state || m.current.zip_code}
											{m.current.city}{m.current.city && m.current.state ? ', ' : ''}{m.current.state} {m.current.zip_code}
										{:else}
											<span class="text-muted">—</span>
										{/if}
									</td>
									<td class="arrow-cell">→</td>
									<td class="addr-cell new-data">
										{#if m.update.address_line1}
											{m.update.address_line1}<br />
										{/if}
										{#if m.update.address_line2}
											{m.update.address_line2}<br />
										{/if}
										{#if m.update.city || m.update.state || m.update.zip_code}
											{m.update.city}{m.update.city && m.update.state ? ', ' : ''}{m.update.state} {m.update.zip_code}
										{/if}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if matched.filter((m) => m.hasNewData).length > 50}
						<p class="text-muted" style="padding: 0.75rem 1rem;">
							Showing 50 of {matched.filter((m) => m.hasNewData).length} patrons with new data. All will be updated when you click the button below.
						</p>
					{/if}
				</div>

				<!-- Apply Form -->
				<form
					method="POST"
					action="?/apply_updates"
					use:enhance={() => {
						applying = true;
						return async ({ update }) => {
							await update();
							applying = false;
						};
					}}
				>
					<input type="hidden" name="matched_json" value={JSON.stringify(matched.filter((m) => m.hasNewData))} />

					<div class="apply-section">
						<div class="mode-select">
							<label class="radio-label">
								<input type="radio" name="update_mode" value="fill" bind:group={updateMode} />
								<span><strong>Fill empty fields only</strong> — don't overwrite existing data</span>
							</label>
							<label class="radio-label">
								<input type="radio" name="update_mode" value="overwrite" bind:group={updateMode} />
								<span><strong>Overwrite</strong> — replace existing values with CSV data</span>
							</label>
						</div>

						<div class="apply-actions">
							<button type="submit" class="btn-primary" disabled={applying}>
								{applying ? 'Updating...' : `Update ${matched.filter((m) => m.hasNewData).length} Patrons`}
							</button>
							<a href="{base}/shows/patrons/update_patrons" class="btn-secondary">Cancel</a>
						</div>
					</div>
				</form>
			</div>
		{:else}
			<div class="card">
				<p class="empty-state">All matched patrons already have address data. Nothing to update.</p>
				<a href="{base}/shows/patrons/update_patrons" class="btn-secondary" style="display:inline-block;margin-top:1rem;">Upload Another File</a>
			</div>
		{/if}

		<!-- Unmatched patrons -->
		{#if unmatched.length > 0}
			<details class="card">
				<summary class="details-summary">
					Unmatched Patrons ({unmatched.length}) — not found in database
				</summary>
				<div class="table-wrapper" style="margin-top:0.75rem;">
					<table>
						<thead>
							<tr>
								<th>Name</th>
								<th>Email</th>
								<th>Phone</th>
								<th>City</th>
								<th>Zip</th>
							</tr>
						</thead>
						<tbody>
							{#each unmatched.slice(0, 100) as u}
								<tr>
									<td>{u.name}</td>
									<td>{u.email || '—'}</td>
									<td>{u.phone || '—'}</td>
									<td>{u.city || '—'}</td>
									<td>{u.zip_code || '—'}</td>
								</tr>
							{/each}
						</tbody>
					</table>
					{#if unmatched.length > 100}
						<p class="text-muted" style="padding:0.75rem 1rem;">Showing first 100 of {unmatched.length}</p>
					{/if}
				</div>
			</details>
		{/if}
	{/if}
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 1.5rem; }
	.breadcrumb { color: #3b82f6; text-decoration: none; font-size: 0.85rem; }
	.breadcrumb:hover { text-decoration: underline; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0.5rem 0 0 0; }
	h2 { font-size: 1.1rem; font-weight: 600; color: #374151; margin: 0 0 0.75rem 0; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; font-size: 0.9rem; }

	.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; }
	.stat-card { background: white; padding: 1rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.2rem; }
	.stat-value { font-size: 1.4rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.75rem; color: #6b7280; font-weight: 500; text-transform: uppercase; letter-spacing: 0.03em; }

	.card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
	.hint { color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem; line-height: 1.5; }

	.alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
	.alert-success { background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
	.alert-error { background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
	.alert-link { color: #065f46; margin-left: 0.5rem; }

	.upload-area { display: flex; gap: 1rem; align-items: center; }
	.upload-area input[type="file"] { flex: 1; padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.9rem; }

	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; text-decoration: none; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; text-decoration: none; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	.preview-stats { display: flex; flex-wrap: wrap; gap: 1rem; }
	.preview-stat { padding: 0.5rem 1rem; background: #f3f4f6; border-radius: 0.375rem; font-size: 0.9rem; }
	.preview-stat.matched { background: #dbeafe; color: #1e40af; }
	.preview-stat.new-data { background: #ecfdf5; color: #065f46; }
	.preview-stat.unmatched { background: #fef3c7; color: #92400e; }

	.table-wrapper { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.6rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; }
	td { padding: 0.5rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; font-size: 0.85rem; vertical-align: top; }
	tr:hover td { background-color: #f9fafb; }

	.addr-cell { font-size: 0.8rem; line-height: 1.4; min-width: 180px; }
	.addr-cell.new-data { color: #065f46; font-weight: 500; }
	.arrow-cell { text-align: center; color: #9ca3af; font-size: 1.1rem; width: 2rem; }
	.text-muted { color: #9ca3af; font-size: 0.8rem; }

	.apply-section { margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid #e5e7eb; }
	.mode-select { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 1rem; }
	.radio-label { display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; font-size: 0.9rem; color: #374151; }
	.radio-label input[type="radio"] { margin-top: 0.2rem; }
	.apply-actions { display: flex; gap: 0.75rem; align-items: center; }

	.details-summary { cursor: pointer; font-weight: 600; font-size: 0.95rem; color: #374151; padding: 0.25rem 0; }
	.details-summary:hover { color: #1a202c; }

	.empty-state { text-align: center; color: #6b7280; padding: 1rem 0; }

	@media (max-width: 768px) {
		.upload-area { flex-direction: column; }
		.preview-stats { flex-direction: column; }
	}
</style>