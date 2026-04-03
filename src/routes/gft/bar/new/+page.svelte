<!-- src/routes/gft/bar/new/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {any} */
	export let form;

	let submitting = false;

	$: item_code = form?.values?.item_code ?? '';
	$: item_name = form?.values?.item_name ?? '';
	$: category = form?.values?.category ?? '';

	let codeManuallyEdited = false;

	/** @param {any} e */
	function handleNameInput(e) {
		if (!codeManuallyEdited) {
			item_code = e.target.value
				.toUpperCase()
				.replace(/[^A-Z0-9\s-]/g, '')
				.replace(/\s+/g, '-')
				.substring(0, 30);
		}
	}

	function handleCodeInput() {
		codeManuallyEdited = true;
	}
</script>

<svelte:head>
	<title>Add Bar Item | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/gft/bar')} class="back-link">← Back to Bar Items</a>
			<h1>Add Bar Item</h1>
		</div>
	</header>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<div class="form-card">
		<form method="POST" use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				submitting = false;
				await update();
			};
		}}>
			<div class="form-grid">
				<div class="form-group">
					<label for="item_name">Item Name <span class="required">*</span></label>
					<input type="text" id="item_name" name="item_name" value={item_name}
						on:input={handleNameInput} required placeholder="e.g. Domestic Beer" />
				</div>

				<div class="form-group">
					<label for="item_code">Item Code <span class="required">*</span></label>
					<input type="text" id="item_code" name="item_code" value={item_code}
						on:input={handleCodeInput} required class="code-input" placeholder="e.g. DOMESTIC-BEER" />
					<span class="help-text">Unique identifier. Auto-generated from name, or type your own.</span>
				</div>

				<div class="form-group">
					<label for="category">Category</label>
					<input type="text" id="category" name="category" value={category}
						placeholder="e.g. Drinks, Snacks, Merchandise" />
				</div>
			</div>

			<div class="form-actions">
				<a href={resolve('/gft/bar')} class="btn-secondary">Cancel</a>
				<button type="submit" class="btn-primary" disabled={submitting}>
					{submitting ? 'Creating...' : 'Create Item'}
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	.container { max-width: 900px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }

	.error-banner { padding: 1rem 1.5rem; background-color: #fef2f2; color: #991b1b; border: 1px solid #fecaca; border-radius: 0.5rem; margin-bottom: 1.5rem; font-weight: 500; }

	.form-card { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
	.form-group { display: flex; flex-direction: column; gap: 0.5rem; }
	.form-group label { font-size: 0.875rem; font-weight: 600; color: #374151; }
	.required { color: #ef4444; }
	.help-text { font-size: 0.75rem; color: #9ca3af; }

	input, select { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	input:focus, select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
	.code-input { font-family: monospace; text-transform: uppercase; }

	.form-actions { display: flex; gap: 1rem; justify-content: flex-end; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-primary:disabled { background-color: #93c5fd; cursor: not-allowed; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.95rem; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	@media (max-width: 768px) {
		.form-grid { grid-template-columns: 1fr; }
	}
</style>
