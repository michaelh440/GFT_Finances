<!-- src/routes/hsi/classes/[class_code]/sessions/[session_id]/edit/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form;

	$: classInfo = data.classInfo;
	$: session = data.session;
	$: teachers = data.teachers || [];
</script>

<svelte:head>
	<title>Edit {session ? session.session_name : 'Session'} | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	{#if !classInfo || !session}
		<div class="alert alert-error">Session not found.</div>
		<a href={resolve('/hsi/classes')} class="btn-secondary">Back to Classes</a>
	{:else}
		<header>
			<div>
				<a href={resolve(`/hsi/classes/${classInfo.class_code}/sessions/${session.session_id}`)} class="breadcrumb">← Back to {session.session_name}</a>
				<h1>Edit Session</h1>
			</div>
		</header>

		{#if form?.error}
			<div class="alert alert-error">{form.error}</div>
		{/if}

		<div class="form-card">
			<form method="POST" use:enhance>
				<div class="form-grid">
					<div class="form-group">
						<label for="session_name">Session Name *</label>
						<input type="text" id="session_name" name="session_name" value={session.session_name} required class="input" />
					</div>

					<div class="form-group">
						<label for="instructor">Instructor</label>
						<select id="instructor" name="instructor" class="input">
							<option value="">— None —</option>
							{#each teachers as teacher (teacher.teacher_id)}
								<option value="{teacher.first_name} {teacher.last_name}" selected={session.instructor === `${teacher.first_name} ${teacher.last_name}`}>
									{teacher.last_name}, {teacher.first_name}
								</option>
							{/each}
						</select>
					</div>

					<div class="form-group">
						<label for="start_date">Start Date</label>
						<input type="date" id="start_date" name="start_date" value={session.start_date || ''} class="input" />
					</div>

					<div class="form-group">
						<label for="end_date">End Date</label>
						<input type="date" id="end_date" name="end_date" value={session.end_date || ''} class="input" />
					</div>

					<div class="form-group form-group-full-row">
						<label for="location">Location</label>
						<input type="text" id="location" name="location" value={session.location || ''} class="input" />
					</div>

					<div class="form-group">
						<label for="duration_value">Duration</label>
						<div class="duration-input">
							<input type="number" id="duration_value" name="duration_value" value={session.duration_value || ''} min="1" placeholder={classInfo.duration_value ? String(classInfo.duration_value) : 'e.g. 8'} class="input" />
							<select id="duration_unit" name="duration_unit" class="input">
								<option value="">— Unit —</option>
								<option value="minutes" selected={session.duration_unit === 'minutes'}>Minutes</option>
								<option value="hours" selected={session.duration_unit === 'hours'}>Hours</option>
								<option value="days" selected={session.duration_unit === 'days'}>Days</option>
								<option value="weeks" selected={session.duration_unit === 'weeks'}>Weeks</option>
							</select>
						</div>
						{#if classInfo.duration_value}
							<span class="help-text">Class default: {classInfo.duration_value} {classInfo.duration_unit}. Leave blank to inherit.</span>
						{/if}
					</div>
				</div>

				<div class="form-group">
					<label class="checkbox-label">
						<input type="checkbox" name="is_active" checked={session.is_active} />
						Active
					</label>
				</div>

				<div class="form-actions">
					<button type="submit" class="btn-primary">Save Changes</button>
					<a href={resolve(`/hsi/classes/${classInfo.class_code}/sessions/${session.session_id}`)} class="btn-secondary">Cancel</a>
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
	.form-group-full-row { grid-column: 1 / -1; }
	.form-group label { font-size: 0.8rem; font-weight: 600; color: #374151; }

	.input { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	.input:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }

	.duration-input { display: flex; gap: 0.5rem; }
	.duration-input .input { flex: 1; }
	.help-text { font-size: 0.75rem; color: #9ca3af; }

	.checkbox-label { display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; font-weight: 500; color: #374151; cursor: pointer; margin-bottom: 1.25rem; }
	.checkbox-label input { width: 1rem; height: 1rem; cursor: pointer; }

	.form-actions { display: flex; gap: 1rem; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.75rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 600; font-size: 1rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.75rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 1rem; display: inline-block; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	@media (max-width: 768px) {
		.form-grid { grid-template-columns: 1fr; }
	}
</style>
