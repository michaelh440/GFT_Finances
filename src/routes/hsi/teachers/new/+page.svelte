<!-- src/routes/hsi/teachers/new/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	export let form;
</script>

<svelte:head>
	<title>Add Teacher | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/hsi/teachers')} class="breadcrumb">← Teachers</a>
			<h1>Add Teacher</h1>
		</div>
	</header>

	{#if form?.error}
		<div class="alert alert-error">✗ {form.error}</div>
	{/if}

	<div class="form-card">
		<form method="POST" use:enhance>
			<div class="form-grid">
				<div class="form-group">
					<label for="first_name">First Name *</label>
					<input type="text" id="first_name" name="first_name" required class="input" />
				</div>

				<div class="form-group">
					<label for="last_name">Last Name *</label>
					<input type="text" id="last_name" name="last_name" required class="input" />
				</div>

				<div class="form-group">
					<label for="email">Email</label>
					<input type="email" id="email" name="email" class="input" />
				</div>

				<div class="form-group">
					<label for="phone">Phone</label>
					<input type="text" id="phone" name="phone" class="input" />
				</div>
			</div>

			<div class="form-group form-group-full">
				<label for="bio">Bio</label>
				<textarea id="bio" name="bio" rows="4" class="input" placeholder="Brief bio or notes about this teacher..."></textarea>
			</div>

			<div class="form-actions">
				<button type="submit" class="btn-primary">Add Teacher</button>
				<a href={resolve('/hsi/teachers')} class="btn-secondary">Cancel</a>
			</div>
		</form>
	</div>
</div>

<style>
	.container { max-width: 800px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 1.5rem; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0.25rem 0 0 0; }
	.breadcrumb { color: #3b82f6; text-decoration: none; font-size: 0.85rem; }
	.breadcrumb:hover { text-decoration: underline; }

	.alert-error { padding: 1rem 1.5rem; background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 0.5rem; margin-bottom: 1rem; font-weight: 500; }

	.form-card { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.25rem; }
	.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
	.form-group-full { margin-bottom: 1.25rem; }
	.form-group label { font-size: 0.8rem; font-weight: 600; color: #374151; }

	.input { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	.input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
	textarea.input { resize: vertical; font-family: inherit; }

	.form-actions { display: flex; gap: 1rem; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 1rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 1rem; display: inline-block; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	@media (max-width: 768px) {
		.form-grid { grid-template-columns: 1fr; }
	}
</style>