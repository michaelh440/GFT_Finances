<!-- src/routes/shows/enter_new_show/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';

	export let form;

	let submitting = false;

	$: show_code = form?.values?.show_code ?? '';
	$: show_name = form?.values?.show_name ?? '';
	$: format = form?.values?.format ?? '';
	$: audience_type = form?.values?.audience_type ?? '';
	$: day_of_week = form?.values?.day_of_week ?? '';
	$: standard_ticket_price = form?.values?.standard_ticket_price ?? 0;
	$: description = form?.values?.description ?? '';

	// Auto-generate show code from show name
	let codeManuallyEdited = false;

	/** @param {any} e */
	function handleNameInput(e) {
		if (!codeManuallyEdited) {
			show_code = e.target.value
				.toUpperCase()
				.replace(/[^A-Z0-9\s-]/g, '')
				.replace(/\s+/g, '-')
				.substring(0, 20);
		}
	}

	function handleCodeInput() {
		codeManuallyEdited = true;
	}
</script>

<svelte:head>
	<title>Add New Show | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href="{base}/shows" class="back-link">← Back to Shows</a>
			<h1>Add New Show</h1>
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
					<label for="show_name">Show Name <span class="required">*</span></label>
					<input
						type="text"
						id="show_name"
						name="show_name"
						value={show_name}
						on:input={handleNameInput}
						required
						placeholder="e.g. Friday Night ComedySportz"
					/>
				</div>

				<div class="form-group">
					<label for="show_code">Show Code <span class="required">*</span></label>
					<input
						type="text"
						id="show_code"
						name="show_code"
						value={show_code}
						on:input={handleCodeInput}
						required
						class="code-input"
						placeholder="e.g. FRI-CSZ"
					/>
					<span class="help-text">Unique identifier. Auto-generated from name, or type your own. Letters, numbers, hyphens only.</span>
				</div>

				<div class="form-group">
					<label for="format">Format</label>
					<input
						type="text"
						id="format"
						name="format"
						value={format}
						placeholder="e.g. Improv, Sketch, Stand-up"
					/>
				</div>

				<div class="form-group">
					<label for="audience_type">Audience Type</label>
					<select id="audience_type" name="audience_type" value={audience_type}>
						<option value="">— Select —</option>
						<option value="All Ages">All Ages</option>
						<option value="18+">18+</option>
						<option value="21+">21+</option>
						<option value="Family">Family</option>
					</select>
				</div>

				<div class="form-group">
					<label for="day_of_week">Day of Week</label>
					<select id="day_of_week" name="day_of_week" value={day_of_week}>
						<option value="">— Select —</option>
						<option value="Monday">Monday</option>
						<option value="Tuesday">Tuesday</option>
						<option value="Wednesday">Wednesday</option>
						<option value="Thursday">Thursday</option>
						<option value="Friday">Friday</option>
						<option value="Saturday">Saturday</option>
						<option value="Sunday">Sunday</option>
					</select>
				</div>

				<div class="form-group">
					<label for="standard_ticket_price">Standard Ticket Price</label>
					<div class="price-input">
						<span class="price-prefix">$</span>
						<input
							type="number"
							id="standard_ticket_price"
							name="standard_ticket_price"
							value={standard_ticket_price}
							min="0"
							step="0.01"
						/>
					</div>
				</div>

				<div class="form-group full-width">
					<label for="description">Description</label>
					<textarea
						id="description"
						name="description"
						rows="3"
						placeholder="Brief description of the show..."
					>{description}</textarea>
				</div>
			</div>

			<div class="form-actions">
				<a href="{base}/shows" class="btn-secondary">Cancel</a>
				<button type="submit" class="btn-primary" disabled={submitting}>
					{submitting ? 'Creating...' : 'Create Show'}
				</button>
			</div>
		</form>
	</div>
</div>

<style>
	.container {
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		margin-bottom: 2rem;
	}

	.back-link {
		color: #6b7280;
		text-decoration: none;
		font-size: 0.875rem;
		display: inline-block;
		margin-bottom: 0.5rem;
	}

	.back-link:hover {
		color: #3b82f6;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		color: #1a202c;
		margin: 0;
	}

	.error-banner {
		background-color: #fef2f2;
		border: 1px solid #fecaca;
		color: #991b1b;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
		font-weight: 500;
	}

	.form-card {
		background: white;
		padding: 2rem;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
	}

	.form-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 1.5rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}

	.form-group.full-width {
		grid-column: 1 / -1;
	}

	label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #374151;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}

	.required {
		color: #ef4444;
	}

	input,
	select,
	textarea {
		padding: 0.6rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.95rem;
		color: #1a202c;
		background: white;
		transition: border-color 0.2s;
	}

	input:focus,
	select:focus,
	textarea:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.code-input {
		font-family: monospace;
		font-weight: 600;
		text-transform: uppercase;
	}

	.help-text {
		font-size: 0.75rem;
		color: #9ca3af;
	}

	textarea {
		resize: vertical;
		font-family: inherit;
	}

	.price-input {
		display: flex;
		align-items: center;
	}

	.price-prefix {
		padding: 0.6rem 0.75rem;
		background-color: #f3f4f6;
		border: 1px solid #d1d5db;
		border-right: none;
		border-radius: 0.375rem 0 0 0.375rem;
		color: #6b7280;
		font-size: 0.95rem;
	}

	.price-input input {
		border-radius: 0 0.375rem 0.375rem 0;
		flex: 1;
	}

	.form-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		margin-top: 2rem;
		padding-top: 1.5rem;
		border-top: 1px solid #f3f4f6;
	}

	.btn-primary {
		background-color: #3b82f6;
		color: white;
		padding: 0.6rem 1.5rem;
		border-radius: 0.5rem;
		border: none;
		font-weight: 500;
		font-size: 0.9rem;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.btn-primary:hover:not(:disabled) {
		background-color: #2563eb;
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.btn-secondary {
		background-color: #e5e7eb;
		color: #374151;
		padding: 0.6rem 1.5rem;
		border-radius: 0.5rem;
		text-decoration: none;
		font-weight: 500;
		font-size: 0.9rem;
		transition: background-color 0.2s;
	}

	.btn-secondary:hover {
		background-color: #d1d5db;
	}

	@media (max-width: 768px) {
		.form-grid {
			grid-template-columns: 1fr;
		}
	}
</style>