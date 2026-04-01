<!-- src/routes/hsi/student_surveys/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { canDataEntry } from '$lib/permissions';

	/** @type {any} */
	export let data;

	$: user = data.user;
	$: templates = data.templates || [];
	$: recentResponses = data.recentResponses || [];
</script>

<svelte:head>
	<title>Student Surveys | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Student Surveys</h1>
		<div class="header-actions">
			{#if canDataEntry(user, 'hsi')}
				<a href={resolve('/hsi/student_surveys/enter')} class="btn-primary">Enter Survey</a>
				<a href={resolve('/hsi/student_surveys/templates/new')} class="btn-secondary">New Template</a>
			{/if}
			<a href={resolve('/hsi/student_surveys/results')} class="btn-secondary">View Results</a>
			<a href={resolve('/hsi')} class="btn-secondary">Back to HSI Dashboard</a>
		</div>
	</header>

	<!-- Survey Templates -->
	<section class="section">
		<h2>Survey Templates</h2>
		{#if templates.length === 0}
			<p class="empty-state">No survey templates found. Create one to get started.</p>
		{:else}
			<div class="card-grid">
				{#each templates as template (template.template_id)}
					<a href={resolve(`/hsi/student_surveys/templates/${template.template_id}`)} class="template-card" class:inactive={!template.is_active}>
						<div class="template-header">
							<h3>{template.template_name}</h3>
							<span class="status-badge" class:active={template.is_active}>
								{template.is_active ? 'Active' : 'Inactive'}
							</span>
						</div>
						{#if template.description}
							<p class="template-desc">{template.description}</p>
						{/if}
						<div class="template-stats">
							<span>{template.question_count} question{template.question_count !== 1 ? 's' : ''}</span>
							<span>{template.response_count} response{template.response_count !== 1 ? 's' : ''}</span>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Recent Responses -->
	<section class="section">
		<h2>Recent Responses</h2>
		{#if recentResponses.length === 0}
			<p class="empty-state">No survey responses yet.</p>
		{:else}
			<div class="table-card">
				<table>
					<thead>
						<tr>
							<th>Date</th>
							<th>Student</th>
							<th>Template</th>
							<th>Class</th>
							<th>Session</th>
							<th>Instructor</th>
						</tr>
					</thead>
					<tbody>
						{#each recentResponses as resp (resp.response_id)}
							<tr>
								<td>{resp.submitted_at}</td>
								<td>{resp.student_name}</td>
								<td>{resp.template_name}</td>
								<td>{resp.class_name}</td>
								<td>{resp.session_name}</td>
								<td>{resp.instructor}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<style>
	.container { max-width: 1400px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; }
	.header-actions { display: flex; gap: 0.75rem; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	.section { margin-bottom: 2.5rem; }
	.section h2 { font-size: 1.25rem; font-weight: 600; color: #1a202c; margin-bottom: 1rem; }

	.card-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1rem; }
	.template-card { background: white; border-radius: 0.5rem; padding: 1.25rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); text-decoration: none; color: inherit; transition: box-shadow 0.2s; display: block; }
	.template-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
	.template-card.inactive { opacity: 0.6; }
	.template-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem; }
	.template-header h3 { font-size: 1rem; font-weight: 600; color: #1a202c; margin: 0; }
	.template-desc { font-size: 0.85rem; color: #6b7280; margin-bottom: 0.75rem; }
	.template-stats { display: flex; gap: 1rem; font-size: 0.8rem; color: #9ca3af; }

	.status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }

	.table-card { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); overflow: hidden; }
	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; }
	td { padding: 0.75rem 1rem; border-top: 1px solid #f3f4f6; font-size: 0.9rem; color: #1a202c; }
	tr:hover { background-color: #f9fafb; }

	.empty-state { text-align: center; padding: 2rem; color: #6b7280; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0,0,0,0.1); }

	@media (max-width: 768px) {
		header { flex-direction: column; align-items: flex-start; gap: 1rem; }
		.header-actions { flex-wrap: wrap; }
		.card-grid { grid-template-columns: 1fr; }
	}
</style>
