<!-- src/routes/shows/patrons/[patron_id]/edit/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {{ patron: any, form: any }} */
	export let data;
	/** @type {any} */
	export let form;

	$: patron = data.patron;

	$: first_name = form?.values?.first_name ?? patron?.first_name ?? '';
	$: last_name = form?.values?.last_name ?? patron?.last_name ?? '';
	$: email = form?.values?.email ?? patron?.email ?? '';
	$: phone = form?.values?.phone ?? patron?.phone ?? '';
	$: is_active = form?.values?.is_active ?? patron?.is_active ?? true;
</script>

<svelte:head>
	<title>{patron ? `Edit ${patron.first_name} ${patron.last_name}` : 'Patron Not Found'} | StageLedger</title>
</svelte:head>

<div class="container">
	{#if !patron}
		<div class="not-found">
			<h1>Patron Not Found</h1>
			<p>The patron you're looking for doesn't exist.</p>
			<a href={resolve(/** @type {any} */ ('/gft/patrons'))} class="btn-secondary">Back to Patrons</a>
		</div>
	{:else}
		<header>
			<div>
				<a href={resolve(/** @type {any} */ (`/gft/patrons/${patron.patron_id}`))} class="back-link">← Back to {patron.first_name} {patron.last_name}</a>
				<h1>Edit Patron</h1>
			</div>
		</header>

		{#if form?.error}
			<div class="error-banner">{form.error}</div>
		{/if}

		<div class="form-card">
			<form method="POST" use:enhance>
				<div class="form-grid">
					<div class="form-group">
						<label for="first_name">First Name <span class="required">*</span></label>
						<input type="text" id="first_name" name="first_name" value={first_name} required />
					</div>

					<div class="form-group">
						<label for="last_name">Last Name <span class="required">*</span></label>
						<input type="text" id="last_name" name="last_name" value={last_name} required />
					</div>

					<div class="form-group">
						<label for="email">Email</label>
						<input type="email" id="email" name="email" value={email} />
					</div>

					<div class="form-group">
						<label for="phone">Phone</label>
						<input type="text" id="phone" name="phone" value={phone} />
					</div>

					<div class="form-group">
						<label for="is_active">Status</label>
						<select id="is_active" name="is_active" value={is_active.toString()}>
							<option value="true">Active</option>
							<option value="false">Inactive</option>
						</select>
					</div>
				</div>

				<div class="form-actions">
					<a href={resolve(/** @type {any} */ (`/gft/patrons/${patron.patron_id}`))} class="btn-secondary">Cancel</a>
					<button type="submit" class="btn-primary">Save Changes</button>
				</div>
			</form>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 800px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	.error-banner { background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-size: 0.9rem; }
	.form-card { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
	.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
	label { font-size: 0.8rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.03em; }
	.required { color: #ef4444; }
	input, select { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	input:focus, select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
	.form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #f3f4f6; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }
	.not-found { text-align: center; padding: 3rem; }
	.not-found h1 { margin-bottom: 0.5rem; }
	.not-found p { color: #6b7280; margin-bottom: 1.5rem; }
	@media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
</style>