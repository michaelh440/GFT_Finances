<!-- src/routes/shows/patrons/new/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {any} */
	export let form;

	$: first_name = form?.values?.first_name ?? '';
	$: last_name = form?.values?.last_name ?? '';
	$: email = form?.values?.email ?? '';
	$: phone = form?.values?.phone ?? '';
</script>

<svelte:head>
	<title>Add Patron | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve(/** @type {any} */ ('/gft/patrons'))} class="back-link">← Back to Patrons</a>
			<h1>Add New Patron</h1>
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
			</div>

			<div class="form-actions">
				<a href={resolve(/** @type {any} */ ('/gft/patrons'))} class="btn-secondary">Cancel</a>
				<button type="submit" class="btn-primary">Add Patron</button>
			</div>
		</form>
	</div>
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
	input { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
	.form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #f3f4f6; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }
	@media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
</style>