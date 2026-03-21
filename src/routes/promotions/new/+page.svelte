<!-- src/routes/promotions/new/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form;

	let submitting = false;
	let discount_type = '';

	$: shows = data.shows || [];
	$: classes = data.classes || [];

	// Group shows by format
	$: showsByFormat = shows.reduce((/** @type {Record<string, any[]>} */ acc, /** @type {any} */ s) => {
		const fmt = s.format || 'Other';
		if (!acc[fmt]) acc[fmt] = [];
		acc[fmt].push(s);
		return acc;
	}, /** @type {Record<string, any[]>} */ ({}));
	$: formats = Object.keys(showsByFormat).sort();

	// Group classes by track
	$: classesByTrack = classes.reduce((/** @type {Record<string, any[]>} */ acc, /** @type {any} */ c) => {
		const track = c.track || 'Other';
		if (!acc[track]) acc[track] = [];
		acc[track].push(c);
		return acc;
	}, /** @type {Record<string, any[]>} */ ({}));
	$: tracks = Object.keys(classesByTrack).sort();

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
	<title>Add Promotion | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/promotions')} class="breadcrumb">← Promotions</a>
			<h1>Add Promotion</h1>
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
					<input type="text" id="promotion_name" name="promotion_name" required class="input" placeholder="e.g. Summer Ticket Sale" />
				</div>

				<div class="form-group">
					<label for="discount_type">Discount Type</label>
					<select id="discount_type" name="discount_type" bind:value={discount_type} class="input">
						{#each discountTypes as dt (dt.value)}
							<option value={dt.value}>{dt.label}</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="discount_value">{valueLabel(discount_type)}</label>
					<input
						type="number"
						id="discount_value"
						name="discount_value"
						min="0"
						step="0.01"
						class="input"
						disabled={!needsValue(discount_type)}
						placeholder={needsValue(discount_type) ? 'e.g. 5.00' : 'N/A'}
					/>
				</div>

				<div class="form-group">
					<label for="start_date">Start Date</label>
					<input type="date" id="start_date" name="start_date" class="input" />
					<span class="field-hint">Leave blank for no start restriction</span>
				</div>

				<div class="form-group">
					<label for="end_date">End Date</label>
					<input type="date" id="end_date" name="end_date" class="input" />
					<span class="field-hint">Leave blank for no end restriction</span>
				</div>

				<div class="form-group full-width">
					<label for="description">Description</label>
					<textarea id="description" name="description" rows="3" class="input" placeholder="Brief description of this promotion..."></textarea>
				</div>

				{#if shows.length > 0}
					<div class="form-group full-width">
						<label>Linked Shows <span class="help-text">(optional — leave unchecked to apply to all shows)</span></label>
						<div class="show-checkboxes">
							{#each formats as fmt (fmt)}
								<div class="show-group">
									<span class="show-group-label">{fmt}</span>
									{#each showsByFormat[fmt] as show (show.show_code)}
										<label class="show-check">
											<input type="checkbox" name="show_codes" value={show.show_code} />
											{show.show_name}
										</label>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				{/if}

				{#if classes.length > 0}
					<div class="form-group full-width">
						<label>Linked Classes <span class="help-text">(optional — leave unchecked to apply to all classes)</span></label>
						<div class="show-checkboxes">
							{#each tracks as track (track)}
								<div class="show-group">
									<span class="show-group-label">{track}</span>
									{#each classesByTrack[track] as cls (cls.class_code)}
										<label class="show-check">
											<input type="checkbox" name="class_codes" value={cls.class_code} />
											{cls.class_name}
										</label>
									{/each}
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<div class="form-actions">
				<button type="submit" class="btn-primary" disabled={submitting}>
					{submitting ? 'Creating...' : 'Create Promotion'}
				</button>
				<a href={resolve('/promotions')} class="btn-secondary">Cancel</a>
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
	.form-group.full-width { grid-column: 1 / -1; }
	.form-group label { font-size: 0.8rem; font-weight: 600; color: #374151; }
	.required { color: #ef4444; }
	.help-text { font-size: 0.75rem; color: #9ca3af; font-weight: 400; text-transform: none; }
	.field-hint { font-size: 0.7rem; color: #9ca3af; }

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