<!-- src/routes/gft/bar/[item_code]/edit/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {{ item: any }} */
	export let data;
	/** @type {any} */
	export let form;

	$: item = data.item;

	$: item_name = form?.values?.item_name ?? item?.item_name ?? '';
	$: category = form?.values?.category ?? item?.category ?? '';
	$: is_active = form?.values?.is_active ?? item?.is_active ?? true;
</script>

<svelte:head>
	<title>{item ? `Edit ${item.item_name}` : 'Item Not Found'} | StageLedger</title>
</svelte:head>

<div class="container">
	{#if !item}
		<div class="not-found">
			<h1>Item Not Found</h1>
			<p>The bar item you're looking for doesn't exist.</p>
			<a href={resolve('/gft/bar')} class="btn-secondary">Back to Bar Items</a>
		</div>
	{:else}
		<header>
			<div>
				<a href={resolve(`/gft/bar/${item.item_code}`)} class="back-link">← Back to {item.item_name}</a>
				<h1>Edit Bar Item</h1>
			</div>
		</header>

		{#if form?.error}
			<div class="error-banner">{form.error}</div>
		{/if}

		<div class="form-card">
			<form method="POST" use:enhance>
				<div class="form-grid">
					<div class="form-group">
						<label for="item_code">Item Code</label>
						<input type="text" id="item_code" value={item.item_code} disabled class="input-disabled" />
						<span class="help-text">Item code cannot be changed.</span>
					</div>

					<div class="form-group">
						<label for="item_name">Item Name <span class="required">*</span></label>
						<input type="text" id="item_name" name="item_name" value={item_name} required />
					</div>

					<div class="form-group">
						<label for="category">Category</label>
						<input type="text" id="category" name="category" value={category}
							placeholder="e.g. Drinks, Snacks, Merchandise" />
					</div>

					<div class="form-group">
						<label for="is_active">Status</label>
						<select id="is_active" name="is_active" value={is_active ? 'true' : 'false'}>
							<option value="true">Active</option>
							<option value="false">Inactive</option>
						</select>
					</div>
				</div>

				<div class="form-actions">
					<a href={resolve(`/gft/bar/${item.item_code}`)} class="btn-secondary">Cancel</a>
					<button type="submit" class="btn-primary">Save Changes</button>
				</div>
			</form>
		</div>
	{/if}
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
	.input-disabled { background-color: #f3f4f6; color: #6b7280; cursor: not-allowed; font-family: monospace; }

	.form-actions { display: flex; gap: 1rem; justify-content: flex-end; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 0.95rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.95rem; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	.not-found { text-align: center; padding: 3rem; }
	.not-found h1 { margin-bottom: 0.5rem; }
	.not-found p { color: #6b7280; margin-bottom: 1.5rem; }

	@media (max-width: 768px) {
		.form-grid { grid-template-columns: 1fr; }
	}
</style>
