<!-- src/routes/admin/tools/state_standardization/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {{ students: any[], patrons: any[], contacts: any[] }} */
	export let data;
	/** @type {any} */
	export let form;

	/** @type {Record<string, string>} */
	let edits = {};
	/** @type {Record<string, boolean>} */
	let skipped = {};

	$: students = data.students || [];
	$: patrons = data.patrons || [];
	$: contacts = data.contacts || [];
	$: totalNonStandard = students.length + patrons.length + contacts.length;
	$: autoFixable = students.filter(s => s.suggested).length
		+ patrons.filter(p => p.suggested).length
		+ contacts.filter(c => c.suggested).length;

	/**
	 * @param {string} table
	 * @param {string|number} id
	 * @param {string} suggested
	 */
	function getEditValue(table, id, suggested) {
		const key = `${table}_${id}`;
		return edits[key] ?? suggested ?? '';
	}

	/**
	 * @param {string} table
	 * @param {string|number} id
	 * @param {string} value
	 */
	function setEdit(table, id, value) {
		edits[`${table}_${id}`] = value;
		edits = edits;
	}

	/**
	 * @param {string} table
	 * @param {string|number} id
	 */
	function toggleSkip(table, id) {
		const key = `${table}_${id}`;
		skipped[key] = !skipped[key];
		skipped = skipped;
	}

	/**
	 * @param {string} table
	 * @param {string|number} id
	 */
	function isSkipped(table, id) {
		return !!skipped[`${table}_${id}`];
	}

	/** @param {any[]} rows @param {string} table @param {string} idField */
	function buildUpdates(rows, table, idField) {
		return rows.map(row => {
			const key = `${table}_${row[idField]}`;
			if (skipped[key]) return null;
			const newState = edits[key] ?? row.suggested ?? '';
			if (!newState) return null;
			return { table, id: row[idField], new_state: newState };
		}).filter(Boolean);
	}

	let savingStudents = false;
	let savingPatrons = false;
	let savingContacts = false;
</script>

<svelte:head>
	<title>State Standardization | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/admin/users')} class="back-link">← Admin</a>
			<h1>State Standardization</h1>
			<p class="subtitle">Fix non-standard state values across all tables</p>
		</div>
	</header>

	{#if form?.success}
		<div class="alert alert-success">{form.message}</div>
	{/if}
	{#if form?.error}
		<div class="alert alert-error">{form.error}</div>
	{/if}

	<!-- Summary Stats -->
	<div class="stats-row">
		<div class="stat-card">
			<span class="stat-value">{totalNonStandard}</span>
			<span class="stat-label">Non-Standard Records</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{autoFixable}</span>
			<span class="stat-label">Auto-Fixable</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{students.length}</span>
			<span class="stat-label">Students</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{patrons.length}</span>
			<span class="stat-label">Patrons</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{contacts.length}</span>
			<span class="stat-label">Corp Contacts</span>
		</div>
	</div>

	<!-- Auto-Fix Button -->
	{#if autoFixable > 0}
		<form method="POST" action="?/auto_fix" use:enhance class="auto-fix-form">
			<button type="submit" class="btn-auto-fix">
				Auto-Fix {autoFixable} Recognizable Record{autoFixable !== 1 ? 's' : ''}
			</button>
			<span class="auto-fix-note">Automatically converts recognized state names and abbreviations (e.g., "Texas" → "TX", "tx" → "TX")</span>
		</form>
	{/if}

	{#if totalNonStandard === 0}
		<div class="empty-state">All state values are already standardized.</div>
	{/if}

	<!-- Students -->
	{#if students.length > 0}
		<form method="POST" action="?/update" use:enhance={({ formData }) => {
			savingStudents = true;
			formData.set('updates', JSON.stringify(buildUpdates(students, 'students', 'student_id')));
			return async ({ update }) => {
				savingStudents = false;
				await update();
			};
		}}>
			<div class="table-section">
				<div class="section-header-row">
					<h2>Students ({students.length})</h2>
					<button type="submit" class="btn-save" disabled={savingStudents}>
						{savingStudents ? 'Saving...' : 'Save Students'}
					</button>
				</div>
				<div class="table-wrapper">
					<table>
						<thead>
							<tr>
								<th class="col-skip">Skip</th>
								<th>Name</th>
								<th>City</th>
								<th>Current State</th>
								<th>New State</th>
							</tr>
						</thead>
						<tbody>
							{#each students as s (s.student_id)}
								<tr class:row-skipped={isSkipped('students', s.student_id)}>
									<td class="col-skip">
										<input type="checkbox" checked={isSkipped('students', s.student_id)}
											on:change={() => toggleSkip('students', s.student_id)} />
									</td>
									<td><a href={resolve(`/hsi/students/${s.student_id}`)} class="name-link">{s.first_name} {s.last_name}</a></td>
									<td>{s.city || '—'}</td>
									<td><span class="bad-value">{s.state}</span></td>
									<td>
										<input
											type="text"
											class="state-input"
											class:has-suggestion={s.suggested}
											maxlength="2"
											disabled={isSkipped('students', s.student_id)}
											value={getEditValue('students', s.student_id, s.suggested)}
											on:input={(e) => setEdit('students', s.student_id, /** @type {HTMLInputElement} */ (e.target).value)}
											placeholder="XX"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</form>
	{/if}

	<!-- Patrons -->
	{#if patrons.length > 0}
		<form method="POST" action="?/update" use:enhance={({ formData }) => {
			savingPatrons = true;
			formData.set('updates', JSON.stringify(buildUpdates(patrons, 'patrons', 'patron_id')));
			return async ({ update }) => {
				savingPatrons = false;
				await update();
			};
		}}>
			<div class="table-section">
				<div class="section-header-row">
					<h2>Patrons ({patrons.length})</h2>
					<button type="submit" class="btn-save" disabled={savingPatrons}>
						{savingPatrons ? 'Saving...' : 'Save Patrons'}
					</button>
				</div>
				<div class="table-wrapper">
					<table>
						<thead>
							<tr>
								<th class="col-skip">Skip</th>
								<th>Name</th>
								<th>City</th>
								<th>Current State</th>
								<th>New State</th>
							</tr>
						</thead>
						<tbody>
							{#each patrons as p (p.patron_id)}
								<tr class:row-skipped={isSkipped('patrons', p.patron_id)}>
									<td class="col-skip">
										<input type="checkbox" checked={isSkipped('patrons', p.patron_id)}
											on:change={() => toggleSkip('patrons', p.patron_id)} />
									</td>
									<td><a href={resolve(`/gft/patrons/${p.patron_id}`)} class="name-link">{p.first_name} {p.last_name}</a></td>
									<td>{p.city || '—'}</td>
									<td><span class="bad-value">{p.state}</span></td>
									<td>
										<input
											type="text"
											class="state-input"
											class:has-suggestion={p.suggested}
											maxlength="2"
											disabled={isSkipped('patrons', p.patron_id)}
											value={getEditValue('patrons', p.patron_id, p.suggested)}
											on:input={(e) => setEdit('patrons', p.patron_id, /** @type {HTMLInputElement} */ (e.target).value)}
											placeholder="XX"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</form>
	{/if}

	<!-- Corp Contacts -->
	{#if contacts.length > 0}
		<form method="POST" action="?/update" use:enhance={({ formData }) => {
			savingContacts = true;
			formData.set('updates', JSON.stringify(buildUpdates(contacts, 'corp_contacts', 'corp_contact_id')));
			return async ({ update }) => {
				savingContacts = false;
				await update();
			};
		}}>
			<div class="table-section">
				<div class="section-header-row">
					<h2>Corp Contacts ({contacts.length})</h2>
					<button type="submit" class="btn-save" disabled={savingContacts}>
						{savingContacts ? 'Saving...' : 'Save Contacts'}
					</button>
				</div>
				<div class="table-wrapper">
					<table>
						<thead>
							<tr>
								<th class="col-skip">Skip</th>
								<th>Name</th>
								<th>Company</th>
								<th>City</th>
								<th>Current State</th>
								<th>New State</th>
							</tr>
						</thead>
						<tbody>
							{#each contacts as c (c.corp_contact_id)}
								<tr class:row-skipped={isSkipped('corp_contacts', c.corp_contact_id)}>
									<td class="col-skip">
										<input type="checkbox" checked={isSkipped('corp_contacts', c.corp_contact_id)}
											on:change={() => toggleSkip('corp_contacts', c.corp_contact_id)} />
									</td>
									<td><a href={resolve(`/corp/contacts/${c.corp_contact_id}`)} class="name-link">{c.first_name} {c.last_name}</a></td>
									<td>{c.company_name || '—'}</td>
									<td>{c.city || '—'}</td>
									<td><span class="bad-value">{c.state}</span></td>
									<td>
										<input
											type="text"
											class="state-input"
											class:has-suggestion={c.suggested}
											maxlength="2"
											disabled={isSkipped('corp_contacts', c.corp_contact_id)}
											value={getEditValue('corp_contacts', c.corp_contact_id, c.suggested)}
											on:input={(e) => setEdit('corp_contacts', c.corp_contact_id, /** @type {HTMLInputElement} */ (e.target).value)}
											placeholder="XX"
										/>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</form>
	{/if}
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0 0 0.5rem 0; }
	h2 { font-size: 1.25rem; font-weight: 600; color: #1a202c; margin: 0 0 1rem 0; }
	.subtitle { color: #6b7280; margin: 0; }

	.alert { padding: 1rem 1.5rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }
	.alert-success { background-color: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0; }
	.alert-error { background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

	.stats-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
	.stat-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); text-align: center; display: flex; flex-direction: column; gap: 0.25rem; }
	.stat-value { font-size: 1.5rem; font-weight: 700; color: #1a202c; }
	.stat-label { font-size: 0.8rem; color: #6b7280; font-weight: 500; }

	.auto-fix-form { display: flex; align-items: center; gap: 1rem; margin-bottom: 2rem; flex-wrap: wrap; }
	.btn-auto-fix { background-color: #f59e0b; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; white-space: nowrap; }
	.btn-auto-fix:hover { background-color: #d97706; }
	.auto-fix-note { font-size: 0.8rem; color: #6b7280; }

	.table-section { margin-bottom: 2rem; }
	.table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; }
	td { padding: 0.5rem 1rem; border-bottom: 1px solid #f3f4f6; color: #1a202c; vertical-align: middle; }
	tr:hover { background-color: #f9fafb; }

	.name-link { color: #3b82f6; text-decoration: none; font-weight: 500; }
	.name-link:hover { text-decoration: underline; }

	.bad-value { background-color: #fef2f2; color: #991b1b; padding: 0.2rem 0.5rem; border-radius: 0.25rem; font-size: 0.85rem; font-weight: 500; }

	.state-input {
		width: 60px;
		padding: 0.4rem 0.5rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.9rem;
		text-transform: uppercase;
		text-align: center;
		font-weight: 600;
	}
	.state-input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
	.state-input.has-suggestion { border-color: #10b981; background-color: #ecfdf5; }

	.section-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
	.section-header-row h2 { margin: 0; }

	.btn-save { background-color: #3b82f6; color: white; padding: 0.5rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-save:hover { background-color: #2563eb; }
	.btn-save:disabled { background-color: #93c5fd; cursor: not-allowed; }

	.col-skip { width: 50px; text-align: center; }
	.col-skip input[type="checkbox"] { width: 1.1rem; height: 1.1rem; cursor: pointer; accent-color: #6b7280; }

	.row-skipped { opacity: 0.4; }
	.row-skipped td { text-decoration: line-through; }

	.empty-state { text-align: center; padding: 3rem; color: #6b7280; font-size: 1.125rem; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); }

	@media (max-width: 768px) {
		.stats-row { grid-template-columns: repeat(2, 1fr); }
		.auto-fix-form { flex-direction: column; align-items: stretch; }
	}
</style>
