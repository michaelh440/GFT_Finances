<!-- src/routes/hsi/student_surveys/enter/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import { goto, invalidate } from '$app/navigation';
	import { page } from '$app/stores';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form;

	$: templates = data.templates || [];
	$: sessions = data.sessions || [];
	$: students = data.students || [];
	$: questions = data.questions || [];
	$: selectedSessionId = data.selectedSessionId;
	$: selectedTemplateId = data.selectedTemplateId;

	/** @param {Event} e */
	async function onSessionChange(e) {
		const val = /** @type {HTMLSelectElement} */ (e.target).value;
		const params = new URLSearchParams($page.url.search);
		if (val) {
			params.set('session_id', val);
		} else {
			params.delete('session_id');
		}
		await goto(`${$page.url.pathname}?${params.toString()}`, { replaceState: false, invalidateAll: true });
	}

	/** @param {Event} e */
	async function onTemplateChange(e) {
		const val = /** @type {HTMLSelectElement} */ (e.target).value;
		const params = new URLSearchParams($page.url.search);
		if (val) {
			params.set('template_id', val);
		} else {
			params.delete('template_id');
		}
		await goto(`${$page.url.pathname}?${params.toString()}`, { replaceState: false, invalidateAll: true });
	}

	$: selectedSession = sessions.find(s => s.session_id === selectedSessionId);
</script>

<svelte:head>
	<title>Enter Survey | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/hsi/student_surveys')} class="back-link">← Back to Surveys</a>
			<h1>Enter Survey Response</h1>
		</div>
	</header>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<!-- Step 1: Select Session and Template -->
	<div class="step-card">
		<h2>1. Select Session & Template</h2>
		<div class="select-grid">
			<div class="form-group">
				<label for="session_select">Class Session</label>
				<select id="session_select" on:change={onSessionChange} value={selectedSessionId || ''}>
					<option value="">— Select Session —</option>
					{#each sessions as s (s.session_id)}
						<option value={s.session_id}>
							{s.class_name} — {s.session_name} ({s.start_date || 'No date'}) [{s.instructor || 'No instructor'}]
						</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="template_select">Survey Template</label>
				<select id="template_select" on:change={onTemplateChange} value={selectedTemplateId || ''}>
					<option value="">— Select Template —</option>
					{#each templates as t (t.template_id)}
						<option value={t.template_id}>{t.template_name}</option>
					{/each}
				</select>
			</div>
		</div>

		{#if selectedSession}
			<div class="session-info">
				<span><strong>Class:</strong> {selectedSession.class_name}</span>
				<span><strong>Session:</strong> {selectedSession.session_name}</span>
				<span><strong>Instructor:</strong> {selectedSession.instructor || 'N/A'}</span>
				<span><strong>Dates:</strong> {selectedSession.start_date || '?'} – {selectedSession.end_date || '?'}</span>
			</div>
		{/if}
	</div>

	<!-- Step 2: Select Student and Fill Out Survey -->
	{#if selectedSessionId && selectedTemplateId && questions.length > 0}
		<div class="step-card">
			<h2>2. Complete Survey</h2>
			<form method="POST" use:enhance>
				<input type="hidden" name="template_id" value={selectedTemplateId} />
				<input type="hidden" name="session_id" value={selectedSessionId} />

				<div class="form-group" style="margin-bottom: 1.5rem;">
					<label for="student_id">Student</label>
					<select id="student_id" name="student_id" required>
						<option value="">— Select —</option>
						<option value="anonymous">Anonymous</option>
						{#each students as s (s.student_id)}
							<option value={s.student_id}>{s.last_name}, {s.first_name}</option>
						{/each}
					</select>
					<span class="help-text">Select the student or choose Anonymous if the survey is unsigned.</span>
				</div>

				<div class="questions-form">
					{#each questions as q (q.question_id)}
						<div class="question-block">
							<label for="q_{q.question_id}">
								<span class="q-num">{q.question_number}.</span>
								{q.question_text}
							</label>

							{#if q.question_type === 'likert'}
								<div class="rating-group">
									{#each [1, 2, 3, 4, 5] as val}
										<label class="rating-option">
											<input type="radio" name="q_{q.question_id}" value={val} />
											<span class="rating-label">{val}</span>
										</label>
									{/each}
									<div class="rating-legend">
										<span>Strongly Disagree</span>
										<span>Strongly Agree</span>
									</div>
								</div>

							{:else if q.question_type === 'rating_1_5'}
								<div class="rating-group">
									{#each [1, 2, 3, 4, 5] as val}
										<label class="rating-option">
											<input type="radio" name="q_{q.question_id}" value={val} />
											<span class="rating-label">{val}</span>
										</label>
									{/each}
								</div>

							{:else if q.question_type === 'rating_1_10'}
								<div class="rating-group wide">
									{#each [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as val}
										<label class="rating-option">
											<input type="radio" name="q_{q.question_id}" value={val} />
											<span class="rating-label">{val}</span>
										</label>
									{/each}
								</div>

							{:else if q.question_type === 'yes_no'}
								<div class="yn-group">
									<label class="rating-option">
										<input type="radio" name="q_{q.question_id}" value="true" />
										<span class="rating-label">Yes</span>
									</label>
									<label class="rating-option">
										<input type="radio" name="q_{q.question_id}" value="false" />
										<span class="rating-label">No</span>
									</label>
								</div>

							{:else if q.question_type === 'free_text'}
								<textarea name="q_{q.question_id}" rows="3" placeholder="Enter response..."></textarea>
							{/if}
						</div>
					{/each}
				</div>

				<div class="form-actions">
					<a href={resolve('/hsi/student_surveys')} class="btn-secondary">Cancel</a>
					<button type="submit" class="btn-primary" disabled={students.length === 0}>Submit Survey</button>
				</div>
			</form>
		</div>
	{:else if selectedSessionId && selectedTemplateId}
		<div class="step-card">
			<p class="empty-state">This template has no questions. Add questions first.</p>
		</div>
	{/if}
</div>

<style>
	.container { max-width: 900px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1.15rem; font-weight: 600; color: #1a202c; margin-bottom: 1rem; }

	.error-banner { background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1rem; font-size: 0.9rem; }

	.step-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); margin-bottom: 1.5rem; }

	.select-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
	.session-info { display: flex; flex-wrap: wrap; gap: 1rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid #f3f4f6; font-size: 0.85rem; color: #374151; }

	.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
	label { font-size: 0.8rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.03em; }
	.required { color: #ef4444; }
	select, textarea { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	select:focus, textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
	textarea { resize: vertical; font-family: inherit; }
	.help-text { font-size: 0.8rem; color: #9ca3af; }

	.questions-form { display: flex; flex-direction: column; gap: 1.5rem; margin-bottom: 1.5rem; }
	.question-block { border: 1px solid #e5e7eb; border-radius: 0.5rem; padding: 1.25rem; }
	.question-block label { text-transform: none; font-size: 0.95rem; display: block; margin-bottom: 0.75rem; }
	.q-num { color: #3b82f6; font-weight: 700; }

	.rating-group { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; }
	.rating-group.wide { gap: 0.35rem; }
	.rating-option { display: flex; flex-direction: column; align-items: center; cursor: pointer; }
	.rating-option input[type="radio"] { margin: 0; }
	.rating-label { font-size: 0.85rem; font-weight: 500; color: #374151; margin-top: 0.15rem; text-transform: none; letter-spacing: 0; }
	.rating-legend { display: flex; justify-content: space-between; width: 100%; font-size: 0.7rem; color: #9ca3af; margin-top: 0.25rem; text-transform: none; letter-spacing: 0; }

	.yn-group { display: flex; gap: 1.5rem; }

	.form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; padding-top: 1.5rem; border-top: 1px solid #f3f4f6; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	.empty-state { text-align: center; padding: 1rem; color: #6b7280; }

	@media (max-width: 768px) {
		.select-grid { grid-template-columns: 1fr; }
		select { width: 100%; box-sizing: border-box; }
	}
</style>
