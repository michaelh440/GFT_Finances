<!-- src/routes/hsi/student_surveys/results/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	/** @type {any} */
	export let data;

	$: templates = data.templates || [];
	$: classes = data.classes || [];
	$: instructors = data.instructors || [];
	$: sessions = data.sessions || [];
	$: results = data.results || [];
	$: freeTextAnswers = data.freeTextAnswers || [];
	$: responseCount = data.responseCount || 0;
	$: filters = data.filters || {};

	function applyFilters() {
		const params = new URLSearchParams();

		const templateEl = /** @type {HTMLSelectElement} */ (document.getElementById('filter_template'));
		const classEl = /** @type {HTMLSelectElement} */ (document.getElementById('filter_class'));
		const instructorEl = /** @type {HTMLSelectElement} */ (document.getElementById('filter_instructor'));
		const sessionEl = /** @type {HTMLSelectElement} */ (document.getElementById('filter_session'));

		if (templateEl.value) params.set('template_id', templateEl.value);
		if (classEl.value) params.set('class_code', classEl.value);
		if (instructorEl.value) params.set('instructor', instructorEl.value);
		if (sessionEl.value) params.set('session_id', sessionEl.value);

		goto(`${$page.url.pathname}?${params.toString()}`, { invalidateAll: true });
	}

	function clearFilters() {
		goto($page.url.pathname, { invalidateAll: true });
	}

	/** @param {number} max */
	function ratingBarWidth(avg, max) {
		return (avg / max) * 100;
	}

	/** Group free text by question */
	$: freeTextByQuestion = freeTextAnswers.reduce((/** @type {Record<number, any[]>} */ acc, a) => {
		if (!acc[a.question_number]) acc[a.question_number] = [];
		acc[a.question_number].push(a);
		return acc;
	}, {});
</script>

<svelte:head>
	<title>Survey Results | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href={resolve('/hsi/student_surveys')} class="back-link">← Back to Surveys</a>
			<h1>Survey Results</h1>
		</div>
	</header>

	<!-- Filters -->
	<div class="filter-card">
		<h2>Filters</h2>
		<div class="filter-grid">
			<div class="form-group">
				<label for="filter_template">Survey Template</label>
				<select id="filter_template" value={filters.templateId || ''}>
					<option value="">— All Templates —</option>
					{#each templates as t (t.template_id)}
						<option value={t.template_id}>{t.template_name}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="filter_class">Class</label>
				<select id="filter_class" value={filters.classCode || ''}>
					<option value="">— All Classes —</option>
					{#each classes as c (c.class_code)}
						<option value={c.class_code}>{c.class_name}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="filter_instructor">Instructor</label>
				<select id="filter_instructor" value={filters.instructor || ''}>
					<option value="">— All Instructors —</option>
					{#each instructors as i (i.instructor)}
						<option value={i.instructor}>{i.instructor}</option>
					{/each}
				</select>
			</div>
			<div class="form-group">
				<label for="filter_session">Session</label>
				<select id="filter_session" value={filters.sessionId || ''}>
					<option value="">— All Sessions —</option>
					{#each sessions as s (s.session_id)}
						<option value={s.session_id}>{s.class_name} — {s.session_name} ({s.start_date})</option>
					{/each}
				</select>
			</div>
		</div>
		<div class="filter-actions">
			<button class="btn-secondary" on:click={clearFilters}>Clear</button>
			<button class="btn-primary" on:click={applyFilters}>Apply Filters</button>
		</div>
	</div>

	{#if !filters.templateId && !filters.classCode && !filters.instructor && !filters.sessionId}
		<div class="info-card">
			<p>Select at least one filter above and click Apply Filters to view aggregated results.</p>
		</div>
	{:else}
		<!-- Summary -->
		<div class="summary-card">
			<div class="summary-stat">
				<span class="stat-value">{responseCount}</span>
				<span class="stat-label">Total Responses</span>
			</div>
		</div>

		{#if results.length === 0 && Object.keys(freeTextByQuestion).length === 0}
			<p class="empty-state">No survey responses match the selected filters.</p>
		{:else}
			<!-- Rating Questions -->
			{#each results as r (r.question_number)}
				<div class="result-card">
					<div class="result-header">
						<span class="q-num">{r.question_number}.</span>
						<span class="q-text">{r.question_text}</span>
						<span class="q-type">{r.question_type}</span>
					</div>

					{#if r.question_type === 'yes_no'}
						<div class="yn-result">
							<div class="yn-bar">
								<div class="yn-yes" style="width: {r.yes_pct}%">
									Yes {r.yes_pct}%
								</div>
								<div class="yn-no" style="width: {100 - r.yes_pct}%">
									No {100 - r.yes_pct}%
								</div>
							</div>
							<span class="answer-count">{r.answer_count} responses</span>
						</div>
					{:else}
						<div class="rating-result">
							<div class="rating-bar-container">
								<div class="rating-bar" style="width: {ratingBarWidth(r.avg_rating, r.question_type === 'rating_1_10' ? 10 : 5)}%"></div>
							</div>
							<div class="rating-details">
								<span class="avg-value">{r.avg_rating}</span>
								<span class="rating-range">/ {r.question_type === 'rating_1_10' ? '10' : '5'}</span>
								<span class="answer-count">({r.answer_count} responses, min: {r.min_rating}, max: {r.max_rating})</span>
							</div>
						</div>
					{/if}
				</div>
			{/each}

			<!-- Free Text Responses -->
			{#each Object.entries(freeTextByQuestion) as [qNum, answers] (qNum)}
				<div class="result-card">
					<div class="result-header">
						<span class="q-num">{qNum}.</span>
						<span class="q-text">{answers[0].question_text}</span>
						<span class="q-type">text</span>
					</div>
					<div class="text-responses">
						{#each answers as a}
							<div class="text-response">
								<p class="response-text">"{a.answer_text}"</p>
								<span class="response-meta">— {a.student_name}, {a.class_name} ({a.session_name})</span>
							</div>
						{/each}
					</div>
				</div>
			{/each}
		{/if}
	{/if}
</div>

<style>
	.container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1.15rem; font-weight: 600; color: #1a202c; margin-bottom: 1rem; }

	.filter-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); margin-bottom: 1.5rem; }
	.filter-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
	.filter-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem; }

	.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
	label { font-size: 0.8rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.03em; }
	select { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; }
	select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

	.info-card { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); text-align: center; color: #6b7280; }

	.summary-card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); margin-bottom: 1.5rem; display: flex; gap: 2rem; }
	.summary-stat { display: flex; flex-direction: column; align-items: center; }
	.stat-value { font-size: 2rem; font-weight: 700; color: #3b82f6; }
	.stat-label { font-size: 0.8rem; color: #6b7280; text-transform: uppercase; letter-spacing: 0.05em; }

	.result-card { background: white; padding: 1.25rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); margin-bottom: 0.75rem; }
	.result-header { display: flex; align-items: baseline; gap: 0.5rem; margin-bottom: 0.75rem; }
	.q-num { color: #3b82f6; font-weight: 700; font-size: 0.95rem; }
	.q-text { font-weight: 500; color: #1a202c; font-size: 0.95rem; flex: 1; }
	.q-type { font-size: 0.7rem; color: #6366f1; background: #eef2ff; padding: 0.15rem 0.5rem; border-radius: 0.25rem; }

	.rating-result { display: flex; flex-direction: column; gap: 0.5rem; }
	.rating-bar-container { height: 1.25rem; background: #e5e7eb; border-radius: 0.375rem; overflow: hidden; }
	.rating-bar { height: 100%; background: linear-gradient(90deg, #3b82f6, #60a5fa); border-radius: 0.375rem; transition: width 0.3s; }
	.rating-details { display: flex; align-items: baseline; gap: 0.35rem; }
	.avg-value { font-size: 1.5rem; font-weight: 700; color: #1a202c; }
	.rating-range { font-size: 0.9rem; color: #6b7280; }
	.answer-count { font-size: 0.8rem; color: #9ca3af; }

	.yn-result { display: flex; flex-direction: column; gap: 0.5rem; }
	.yn-bar { display: flex; height: 2rem; border-radius: 0.375rem; overflow: hidden; font-size: 0.8rem; font-weight: 500; }
	.yn-yes { background: #22c55e; color: white; display: flex; align-items: center; justify-content: center; min-width: 3rem; }
	.yn-no { background: #ef4444; color: white; display: flex; align-items: center; justify-content: center; min-width: 3rem; }

	.text-responses { display: flex; flex-direction: column; gap: 0.75rem; }
	.text-response { padding: 0.75rem; background: #f9fafb; border-radius: 0.375rem; border-left: 3px solid #3b82f6; }
	.response-text { font-size: 0.9rem; color: #1a202c; font-style: italic; margin: 0 0 0.25rem 0; }
	.response-meta { font-size: 0.75rem; color: #9ca3af; }

	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	.empty-state { text-align: center; padding: 2rem; color: #6b7280; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); }

	@media (max-width: 768px) {
		.filter-grid { grid-template-columns: 1fr; }
		select { width: 100%; box-sizing: border-box; }
	}
</style>
