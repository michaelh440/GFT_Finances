<!-- src/routes/hsi/classes/[class_code]/edit/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {{ classInfo: any, form: any }} */
	export let data;
	export let form;

	$: classInfo = data.classInfo;

	// Use form values (on validation error) or loaded data
	$: class_name = form?.values?.class_name ?? classInfo?.class_name ?? '';
	$: class_type = form?.values?.class_type ?? classInfo?.class_type ?? '';
	$: student_type = form?.values?.student_type ?? classInfo?.student_type ?? '';
	$: standard_price = form?.values?.standard_price ?? classInfo?.standard_price ?? 0;
	$: track = form?.values?.track ?? classInfo?.track ?? '';
	$: description = form?.values?.description ?? classInfo?.description ?? '';
	$: is_active = form?.values?.is_active ?? classInfo?.is_active ?? true;
</script>

<svelte:head>
	<title>{classInfo ? `Edit ${classInfo.class_name}` : 'Class Not Found'} | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	{#if !classInfo}
		<div class="not-found">
			<h1>Class Not Found</h1>
			<p>The class you're looking for doesn't exist.</p>
			<a href="{base}/hsi/classes" class="btn-secondary">Back to Classes</a>
		</div>
	{:else}
		<header>
			<div>
				<a href="{base}/hsi/classes/{classInfo.class_code}" class="back-link">← Back to {classInfo.class_name}</a>
				<h1>Edit Class</h1>
			</div>
		</header>

		{#if form?.error}
			<div class="error-banner">
				{form.error}
			</div>
		{/if}

		<div class="form-card">
			<form method="POST" use:enhance>
				<div class="form-grid">
					<div class="form-group">
						<label for="class_code">Class Code</label>
						<input
							type="text"
							id="class_code"
							value={classInfo.class_code}
							disabled
							class="input-disabled"
						/>
						<span class="help-text">Class code cannot be changed.</span>
					</div>

					<div class="form-group">
						<label for="class_name">Class Name <span class="required">*</span></label>
						<input
							type="text"
							id="class_name"
							name="class_name"
							value={class_name}
							required
						/>
					</div>

					<div class="form-group">
						<label for="class_type">Class Type</label>
						<select id="class_type" name="class_type" value={class_type}>
							<option value="">— Select —</option>
							<option value="8 week class">8 Week Class</option>
							<option value="1 day workshop">1 Day Workshop</option>
							<option value="intensive">Intensive</option>
							<option value="private">Private</option>
						</select>
					</div>

					<div class="form-group">
						<label for="student_type">Student Type</label>
						<select id="student_type" name="student_type" value={student_type}>
							<option value="">— Select —</option>
							<option value="adult">Adult</option>
							<option value="minor">Minor</option>
							<option value="high school league">High School League</option>
							<option value="child">Child</option>
						</select>
					</div>

					<div class="form-group">
						<label for="standard_price">Standard Price</label>
						<div class="price-input">
							<span class="price-prefix">$</span>
							<input
								type="number"
								id="standard_price"
								name="standard_price"
								value={standard_price}
								min="0"
								step="0.01"
							/>
						</div>
					</div>

					<div class="form-group">
						<label for="track">Track</label>
						<input
							type="text"
							id="track"
							name="track"
							value={track}
							placeholder="e.g. Core Track, Musical Improv Track"
						/>
					</div>

					<div class="form-group full-width">
						<label for="description">Description</label>
						<textarea
							id="description"
							name="description"
							rows="3"
						>{description}</textarea>
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
					<a href="{base}/hsi/classes/{classInfo.class_code}" class="btn-secondary">Cancel</a>
					<button type="submit" class="btn-primary">Save Changes</button>
				</div>
			</form>
		</div>
	{/if}
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

	.input-disabled {
		background-color: #f3f4f6;
		color: #6b7280;
		cursor: not-allowed;
		font-family: monospace;
		font-weight: 600;
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

	.btn-primary:hover {
		background-color: #2563eb;
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

	.not-found {
		text-align: center;
		padding: 3rem;
	}

	.not-found h1 {
		margin-bottom: 0.5rem;
	}

	.not-found p {
		color: #6b7280;
		margin-bottom: 1.5rem;
	}

	@media (max-width: 768px) {
		.form-grid {
			grid-template-columns: 1fr;
		}
	}
</style>