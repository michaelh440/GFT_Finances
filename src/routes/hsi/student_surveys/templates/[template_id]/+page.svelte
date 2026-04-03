<!-- src/routes/hsi/student_surveys/templates/[template_id]/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { canDataEntry, canManage } from '$lib/permissions';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form;

	$: user = data.user;
	$: template = data.template;
	$: questions = data.questions || [];
	$: responseCount = data.responseCount || 0;

	let showAddQuestion = false;
	let editingTemplate = false;

	const questionTypes = [
		{ value: 'likert', label: 'Likert Scale (1-5 Agree)' },
		{ value: 'rating_1_5', label: 'Rating 1-5' },
		{ value: 'rating_1_10', label: 'Rating 1-10' },
		{ value: 'yes_no', label: 'Yes / No' },
		{ value: 'free_text', label: 'Free Text' }
	];

	/** @param {string} type */
	function typeLabel(type) {
		return questionTypes.find(t => t.value === type)?.label || type;
	}
</script>

<svelte:head>
	<title>{template ? template.template_name : 'Template Not Found'} | StageLedger</title>
</svelte:head>

<div class="container">
	{#if !template}
		<div class="not-found">
			<h1>Template Not Found</h1>
			<p>The survey template you're looking for doesn't exist.</p>
			<a href={resolve('/hsi/student_surveys')} class="btn-secondary">Back to Surveys</a>
		</div>
	{:else}
		<header>
			<div>
				<a href={resolve('/hsi/student_surveys')} class="back-link">← Back to Surveys</a>
				<h1>{template.template_name}</h1>
			</div>
		</header>

		{#if form?.error}
			<div class="error-banner">{form.error}</div>
		{/if}
		{#if form?.success}
			<div class="success-banner">Changes saved successfully.</div>
		{/if}

		<!-- Template Info -->
		<div class="info-card">
			{#if editingTemplate}
				<form method="POST" action="?/updateTemplate" use:enhance={() => {
					return async ({ update }) => {
						await update();
						editingTemplate = false;
					};
				}}>
					<div class="edit-grid">
						<div class="form-group">
							<label for="template_name">Template Name</label>
							<input type="text" id="template_name" name="template_name" value={template.template_name} required />
						</div>
						<div class="form-group">
							<label for="is_active">Status</label>
							<select id="is_active" name="is_active" value={template.is_active.toString()}>
								<option value="true">Active</option>
								<option value="false">Inactive</option>
							</select>
						</div>
						<div class="form-group full-width">
							<label for="description">Description</label>
							<textarea id="description" name="description" rows="2">{template.description || ''}</textarea>
						</div>
					</div>
					<div class="edit-actions">
						<button type="button" class="btn-secondary" on:click={() => editingTemplate = false}>Cancel</button>
						<button type="submit" class="btn-primary">Save</button>
					</div>
				</form>
			{:else}
				<div class="info-row">
					<div class="info-item">
						<span class="info-label">Status</span>
						<span class="status-badge" class:active={template.is_active}>
							{template.is_active ? 'Active' : 'Inactive'}
						</span>
					</div>
					<div class="info-item">
						<span class="info-label">Questions</span>
						<span>{questions.length}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Responses</span>
						<span>{responseCount}</span>
					</div>
					<div class="info-item">
						<span class="info-label">Created</span>
						<span>{template.created_at}</span>
					</div>
					{#if canDataEntry(user, 'hsi')}
						<button class="btn-action" on:click={() => editingTemplate = true}>Edit Template</button>
					{/if}
				</div>
				{#if template.description}
					<p class="description">{template.description}</p>
				{/if}
			{/if}
		</div>

		<!-- Questions -->
		<section class="section">
			<div class="section-header">
				<h2>Questions</h2>
				{#if canDataEntry(user, 'hsi')}
					<button class="btn-primary btn-sm" on:click={() => showAddQuestion = !showAddQuestion}>
						{showAddQuestion ? 'Cancel' : '+ Add Question'}
					</button>
				{/if}
			</div>

			{#if showAddQuestion}
				<div class="add-question-card">
					<form method="POST" action="?/addQuestion" use:enhance={() => {
						return async ({ update }) => {
							await update();
							showAddQuestion = false;
						};
					}}>
						<div class="form-grid">
							<div class="form-group full-width">
								<label for="question_text">Question Text <span class="required">*</span></label>
								<input type="text" id="question_text" name="question_text" required placeholder="e.g. How would you rate the instructor?" />
							</div>
							<div class="form-group">
								<label for="question_type">Question Type <span class="required">*</span></label>
								<select id="question_type" name="question_type" required>
									<option value="">— Select —</option>
									{#each questionTypes as qt (qt.value)}
										<option value={qt.value}>{qt.label}</option>
									{/each}
								</select>
							</div>
						</div>
						<div class="form-actions">
							<button type="submit" class="btn-primary">Add Question</button>
						</div>
					</form>
				</div>
			{/if}

			{#if questions.length === 0}
				<p class="empty-state">No questions yet. Add questions to this template.</p>
			{:else}
				<div class="questions-list">
					{#each questions as q (q.question_id)}
						<div class="question-item">
							<div class="question-number">{q.question_number}</div>
							<div class="question-content">
								<div class="question-text">{q.question_text}</div>
								<span class="question-type-badge">{typeLabel(q.question_type)}</span>
							</div>
							{#if canManage(user, 'hsi')}
								<form method="POST" action="?/deleteQuestion" use:enhance>
									<input type="hidden" name="question_id" value={q.question_id} />
									<button type="submit" class="btn-delete" title="Delete question">×</button>
								</form>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	{/if}
</div>

<style>
	.container { max-width: 900px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }

	.error-banner { background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.9rem; }
	.success-banner { background-color: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.9rem; }

	.info-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); margin-bottom: 2rem; }
	.info-row { display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
	.info-item { display: flex; flex-direction: column; gap: 0.25rem; }
	.info-label { font-size: 0.75rem; font-weight: 600; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }
	.description { font-size: 0.9rem; color: #6b7280; margin-top: 0.75rem; }

	.status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }

	.edit-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
	.edit-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }

	.section { margin-bottom: 2rem; }
	.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
	.section-header h2 { font-size: 1.25rem; font-weight: 600; color: #1a202c; margin: 0; }

	.add-question-card { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.5rem; margin-bottom: 1rem; }

	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
	.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
	.form-group.full-width { grid-column: 1 / -1; }
	label { font-size: 0.8rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.03em; }
	.required { color: #ef4444; }
	input, select, textarea { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	input:focus, select:focus, textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
	textarea { resize: vertical; font-family: inherit; }
	.help-text { font-size: 0.75rem; color: #9ca3af; }
	.form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1rem; }

	.questions-list { display: flex; flex-direction: column; gap: 0.5rem; }
	.question-item { display: flex; align-items: flex-start; gap: 1rem; background: white; padding: 1rem 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); }
	.question-number { width: 2rem; height: 2rem; background: #3b82f6; color: white; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; }
	.question-content { flex: 1; }
	.question-text { font-size: 0.95rem; font-weight: 500; color: #1a202c; margin-bottom: 0.35rem; }
	.question-type-badge { display: inline-block; font-size: 0.75rem; color: #6366f1; background: #eef2ff; padding: 0.15rem 0.5rem; border-radius: 0.25rem; }

	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-primary.btn-sm { padding: 0.4rem 0.75rem; font-size: 0.8rem; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; border: none; cursor: pointer; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }
	.btn-action { background-color: #e5e7eb; color: #374151; padding: 0.375rem 0.75rem; border-radius: 0.375rem; text-decoration: none; font-size: 0.8rem; font-weight: 500; border: none; cursor: pointer; transition: background-color 0.2s; }
	.btn-action:hover { background-color: #d1d5db; }
	.btn-delete { background: none; border: none; color: #ef4444; font-size: 1.25rem; cursor: pointer; padding: 0.25rem 0.5rem; border-radius: 0.25rem; line-height: 1; }
	.btn-delete:hover { background-color: #fef2f2; }

	.empty-state { text-align: center; padding: 2rem; color: #6b7280; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); }
	.not-found { text-align: center; padding: 3rem; }
	.not-found h1 { margin-bottom: 0.5rem; }
	.not-found p { color: #6b7280; margin-bottom: 1.5rem; }

	@media (max-width: 768px) {
		.form-grid, .edit-grid { grid-template-columns: 1fr; }
		.info-row { flex-direction: column; gap: 1rem; }
	}
</style>
