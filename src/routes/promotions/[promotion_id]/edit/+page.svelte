<!-- src/routes/promotions/[promotion_id]/edit/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {{ data: any, form: any }} */
	let { data, form } = $props();

	let promotion = $state(data.promotion ? { ...data.promotion } : null);
	let shows = $derived(data.shows || []);
	let classes = $derived(data.classes || []);
	let linkedShowCodes = $derived(data.linkedShowCodes || []);
	let linkedClassCodes = $derived(data.linkedClassCodes || []);

	// Re-sync promotion from data when it changes
	$effect(() => {
		if (data.promotion) {
			promotion = { ...data.promotion };
		}
	});

	let submitting = $state(false);

	// Group shows by format
	let showsByFormat = $derived(shows.reduce((/** @type {Record<string, any[]>} */ acc, /** @type {any} */ s) => {
		const fmt = s.format || 'Other';
		if (!acc[fmt]) acc[fmt] = [];
		acc[fmt].push(s);
		return acc;
	}, /** @type {Record<string, any[]>} */ ({})));
	let formats = $derived(Object.keys(showsByFormat).sort());

	// Group classes by track
	let classesByTrack = $derived(classes.reduce((/** @type {Record<string, any[]>} */ acc, /** @type {any} */ c) => {
		const track = c.track || 'Other';
		if (!acc[track]) acc[track] = [];
		acc[track].push(c);
		return acc;
	}, /** @type {Record<string, any[]>} */ ({})));
	let tracks = $derived(Object.keys(classesByTrack).sort());

	const discountTypes = [
		{ value: '', label: '— Select —' },
		{ value: 'flat', label: 'Flat Amount Off ($)' },
		{ value: 'percentage', label: 'Percentage Off (%)' },
		{ value: 'fixed_price', label: 'Fixed Price ($)' },
		{ value: 'bogo', label: 'Buy One Get One' },
		{ value: 'comp', label: 'Complimentary / Free' },
		{ value: 'other', label: 'Other' }
	];

	/** @param {string} type */
	function valueLabel(type) {
		if (type === 'flat' || type === 'fixed_price') return 'Amount ($)';
		if (type === 'percentage') return 'Percentage (%)';
		return 'Value';
	}

	/** @param {string} type */
	function needsValue(type) {
		return type && type !== 'bogo' && type !== 'comp' && type !== 'other';
	}
</script>

<svelte:head>
	<title>Edit {promotion ? promotion.promotion_name : 'Promotion'} | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	{#if !promotion}
		<div class="alert alert-error">Promotion not found.</div>
		<a href={resolve('/promotions')} class="btn-secondary">Back to Promotions</a>
	{:else}
		<header>
			<div>
				<a href={resolve(`/promotions/${promotion.promotion_id}`)} class="breadcrumb">← Back to {promotion.promotion_name}</a>
				<h1>Edit Promotion</h1>
			</div>
		</header>

		{#if form?.error}
			<div class="alert alert-error">✗ {form.error}</div>
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
					<div class="form-group full-width">
						<label for="promotion_name">Promotion Name <span class="required">*</span></label>
						<input type="text" id="promotion_name" name="promotion_name" value={promotion.promotion_name} required class="input" />
					</div>

					<div class="form-group">
						<label for="discount_type">Discount Type</label>
						<select id="discount_type" name="discount_type" bind:value={promotion.discount_type} class="input">
							{#each discountTypes as dt (dt.value)}
								<option value={dt.value}>{dt.label}</option>
							{/each}
						</select>
					</div>

					<div class="form-group">
						<label for="discount_value">{valueLabel(promotion.discount_type)}</label>
						<input
							type="number"
							id="discount_value"
							name="discount_value"
							value={promotion.discount_value ?? ''}
							min="0"
							step="0.01"
							class="input"
							disabled={!needsValue(promotion.discount_type)}
						/>
					</div>

					<div class="form-group">
						<label for="start_date">Start Date</label>
						<input type="date" id="start_date" name="start_date" value={promotion.start_date || ''} class="input" />
					</div>

					<div class="form-group">
						<label for="end_date">End Date</label>
						<input type="date" id="end_date" name="end_date" value={promotion.end_date || ''} class="input" />
					</div>

					<div class="form-group">
						<label for="is_active">Status</label>
						<select id="is_active" name="is_active" value={promotion.is_active.toString()} class="input">
							<option value="true">Active</option>
							<option value="false">Inactive</option>
						</select>
					</div>

					<div class="form-group full-width">
						<label for="description">Description</label>
						<textarea id="description" name="description" rows="3" class="input">{promotion.description || ''}</textarea>
					</div>

					<div class="form-group full-width">
						<label>Linked Shows <span class="help-text">(optional — select which shows this promotion applies to)</span></label>
						<div class="show-checkboxes">
							{#each formats as fmt (fmt)}
								<div class="show-group">
									<span class="show-group-label">{fmt}</span>
									{#each showsByFormat[fmt] as show (show.show_code)}
										<label class="show-check">
											<input
												type="checkbox"
												name="show_codes"
												value={show.show_code}
												checked={linkedShowCodes.includes(show.show_code)}
											/>
											{show.show_name}
										</label>
									{/each}
								</div>
							{/each}
						</div>
					</div>

					<div class="form-group full-width">
						<label>Linked Classes <span class="help-text">(optional — select which classes this promotion applies to)</span></label>
						<div class="show-checkboxes">
							{#each tracks as track (track)}
								<div class="show-group">
									<span class="show-group-label">{track}</span>
									{#each classesByTrack[track] as cls (cls.class_code)}
										<label class="show-check">
											<input
												type="checkbox"
												name="class_codes"
												value={cls.class_code}
												checked={linkedClassCodes.includes(cls.class_code)}
											/>
											{cls.class_name}
										</label>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn-primary" disabled={submitting}>
						{submitting ? 'Saving...' : 'Save Changes'}
					</button>
					<a href={resolve(`/promotions/${promotion.promotion_id}`)} class="btn-secondary">Cancel</a>
				</div>
			</form>
		</div>
	{/if}
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
	.form-group.full-width { grid-column: 1 / -1; }
	.form-group label { font-size: 0.8rem; font-weight: 600; color: #374151; }
	.required { color: #ef4444; }
	.help-text { font-size: 0.75rem; color: #9ca3af; font-weight: 400; text-transform: none; }

	.input { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	.input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
	.input:disabled { background: #f3f4f6; color: #9ca3af; cursor: not-allowed; }
	textarea.input { resize: vertical; font-family: inherit; }

	.show-checkboxes { border: 1px solid #e5e7eb; border-radius: 0.375rem; padding: 1rem; max-height: 250px; overflow-y: auto; }
	.show-group { margin-bottom: 0.75rem; }
	.show-group:last-child { margin-bottom: 0; }
	.show-group-label { font-size: 0.7rem; font-weight: 700; color: #6b7280; text-transform: uppercase; letter-spacing: 0.04em; display: block; margin-bottom: 0.35rem; }
	.show-check { display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; color: #374151; cursor: pointer; padding: 0.15rem 0; }
	.show-check input { cursor: pointer; }

	.form-actions { display: flex; gap: 1rem; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 1rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover:not(:disabled) { background-color: #2563eb; }
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 1rem; display: inline-block; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	@media (max-width: 768px) {
		.form-grid { grid-template-columns: 1fr; }
	}
</style>