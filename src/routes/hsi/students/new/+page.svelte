<!-- src/routes/hsi/students/new/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form;

	// Start with one empty row
	let rows = [{ first_name: '', last_name: '', email: '', phone: '', mobile_phone: '' }];

	function addRow() {
		rows = [...rows, { first_name: '', last_name: '', email: '', phone: '', mobile_phone: '' }];
	}

	function removeRow(/** @type {number} */ index) {
		if (rows.length <= 1) return;
		rows = rows.filter((_, i) => i !== index);
	}

	/** @param {number} count */
	function addMultipleRows(count) {
		for (let i = 0; i < count; i++) {
			rows = [...rows, { first_name: '', last_name: '', email: '', phone: '', mobile_phone: '' }];
		}
	}

	$: filledRows = rows.filter(r => r.first_name.trim() || r.last_name.trim());
	$: canSubmit = filledRows.length > 0 && filledRows.every(r => r.first_name.trim() && r.last_name.trim());

	let submitting = false;
</script>

<svelte:head>
	<title>Add Students | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/hsi/students')} class="back-link">← Back to Students</a>
			<h1>Add Students</h1>
			<p class="subtitle">Add one or more students manually. First and last name are required.</p>
		</div>
	</header>

	{#if form?.success}
		<div class="alert alert-success">
			{form.message}
			{#if form.results?.length > 0}
				<ul class="result-list">
					{#each form.results as r}
						<li class="result-{r.status}">
							<strong>{r.name}</strong> —
							{#if r.status === 'created'}
								Added
							{:else if r.status === 'duplicate'}
								Skipped ({r.reason})
							{:else if r.status === 'skipped'}
								Skipped ({r.reason})
							{:else}
								Error: {r.reason}
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{/if}

	<div class="form-card">
		<form method="POST" use:enhance={() => {
			submitting = true;
			return async ({ update }) => { submitting = false; await update(); };
		}}>
			<input type="hidden" name="student_count" value={rows.length} />

			<div class="table-wrapper">
				<table>
					<thead>
						<tr>
							<th class="col-num">#</th>
							<th>First Name *</th>
							<th>Last Name *</th>
							<th>Email</th>
							<th>Phone</th>
							<th>Mobile</th>
							<th class="col-action"></th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row, i (i)}
							<tr>
								<td class="col-num">{i + 1}</td>
								<td>
									<input type="text" name="first_name_{i}" bind:value={row.first_name}
										placeholder="First name" class="input" required={row.last_name.trim() !== '' || row.email.trim() !== ''} />
								</td>
								<td>
									<input type="text" name="last_name_{i}" bind:value={row.last_name}
										placeholder="Last name" class="input" required={row.first_name.trim() !== '' || row.email.trim() !== ''} />
								</td>
								<td>
									<input type="email" name="email_{i}" bind:value={row.email}
										placeholder="email@example.com" class="input" />
								</td>
								<td>
									<input type="text" name="phone_{i}" bind:value={row.phone}
										placeholder="Phone" class="input" />
								</td>
								<td>
									<input type="text" name="mobile_phone_{i}" bind:value={row.mobile_phone}
										placeholder="Mobile" class="input" />
								</td>
								<td class="col-action">
									{#if rows.length > 1}
										<button type="button" class="btn-remove" on:click={() => removeRow(i)} title="Remove row">x</button>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			<div class="row-actions">
				<button type="button" class="btn-add" on:click={addRow}>+ Add Row</button>
				<button type="button" class="btn-add btn-add-multi" on:click={() => addMultipleRows(5)}>+ Add 5 Rows</button>
				<button type="button" class="btn-add btn-add-multi" on:click={() => addMultipleRows(10)}>+ Add 10 Rows</button>
			</div>

			<div class="form-actions">
				<span class="action-note">
					{filledRows.length} student{filledRows.length !== 1 ? 's' : ''} to add
				</span>
				<button type="submit" class="btn-primary" disabled={!canSubmit || submitting}>
					{submitting ? 'Adding...' : `Add ${filledRows.length} Student${filledRows.length !== 1 ? 's' : ''}`}
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 1.5rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0; font-size: 0.875rem; }

	.alert { padding: 0.875rem 1.25rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
	.alert-success { background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
	.result-list { margin: 0.5rem 0 0; padding-left: 1.25rem; font-weight: 400; font-size: 0.85rem; }
	.result-created { color: #065f46; }
	.result-duplicate { color: #92400e; }
	.result-skipped { color: #6b7280; }
	.result-error { color: #991b1b; }

	.form-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }

	.table-wrapper { overflow-x: auto; margin-bottom: 1rem; }
	table { width: 100%; border-collapse: collapse; }
	thead { background: #f9fafb; }
	th { padding: 0.625rem 0.5rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
	td { padding: 0.35rem 0.5rem; border-bottom: 1px solid #f3f4f6; vertical-align: top; }
	.col-num { width: 2rem; text-align: center; color: #9ca3af; font-size: 0.8rem; font-weight: 500; }
	.col-action { width: 2.5rem; text-align: center; }

	.input {
		width: 100%;
		padding: 0.45rem 0.6rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		color: #1a202c;
		background: white;
	}
	.input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 2px rgba(59,130,246,0.1); }
	.input::placeholder { color: #9ca3af; }

	.btn-remove {
		background: none;
		border: 1px solid #fecaca;
		color: #991b1b;
		width: 1.5rem;
		height: 1.5rem;
		border-radius: 0.25rem;
		cursor: pointer;
		font-size: 0.75rem;
		font-weight: 600;
		line-height: 1;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
	.btn-remove:hover { background: #fee2e2; }

	.row-actions { display: flex; gap: 0.75rem; margin-bottom: 1.5rem; }
	.btn-add {
		background: none;
		border: 1px dashed #d1d5db;
		color: #3b82f6;
		padding: 0.4rem 1rem;
		border-radius: 0.375rem;
		font-size: 0.85rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}
	.btn-add:hover { background: #f0f9ff; border-color: #3b82f6; }
	.btn-add-multi { color: #6b7280; }
	.btn-add-multi:hover { color: #3b82f6; }

	.form-actions { display: flex; justify-content: flex-end; align-items: center; gap: 1.5rem; padding-top: 1rem; border-top: 1px solid #f3f4f6; }
	.action-note { font-size: 0.85rem; color: #6b7280; }
	.btn-primary { background: #3b82f6; color: white; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.95rem; cursor: pointer; }
	.btn-primary:hover { background: #2563eb; }
	.btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }

	@media (max-width: 768px) {
		.container { padding: 1rem; }
		th, td { padding: 0.3rem 0.25rem; }
		.input { font-size: 0.8rem; padding: 0.35rem 0.5rem; }
	}
</style>
