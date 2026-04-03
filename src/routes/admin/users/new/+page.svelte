<!-- src/routes/admin/users/new/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {any} */
	export let data;
	/** @type {any} */
	export let form;

	$: isNew = true;

	$: email = form?.values?.email ?? '';
	$: first_name = form?.values?.first_name ?? '';
	$: last_name = form?.values?.last_name ?? '';
	$: display_name = form?.values?.display_name ?? '';
	$: is_super_admin = form?.values?.is_super_admin ?? false;
	$: hsi_role = form?.values?.hsi_role ?? 'none';
	$: gft_role = form?.values?.gft_role ?? 'none';
	$: csz_role = form?.values?.csz_role ?? 'none';
	$: corp_role = form?.values?.corp_role ?? 'none';

	const roleOptions = [
		{ value: 'none', label: 'No Access' },
		{ value: 'viewer', label: 'Viewer' },
		{ value: 'data_entry', label: 'Data Entry' },
		{ value: 'manager', label: 'Manager' }
	];

	const areas = [
		{ key: 'hsi_role', label: 'HSI (Classes)', desc: 'High School Improv program' },
		{ key: 'gft_role', label: 'GFT (Shows)', desc: 'Good Friend Theater shows' },
		{ key: 'csz_role', label: 'CSZ (ComedySportz)', desc: 'ComedySportz shows' },
		{ key: 'corp_role', label: 'Corp (Corporate)', desc: 'Corporate events & bookings' }
	];

	/** @type {Record<string, any>} */
	$: roleValues = { hsi_role, gft_role, csz_role, corp_role };

	let submitting = false;
</script>

<svelte:head>
	<title>Add New User | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<a href="{base}/admin/users" class="back-link">← Back to Users</a>
		<h1>Add New User</h1>
	</header>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<form method="POST" use:enhance={() => {
		submitting = true;
		return async ({ update }) => { submitting = false; await update(); };
	}}>
		<div class="card">
			<h2>Account Details</h2>
			<div class="form-grid">
				<div class="form-group">
					<label for="first_name">First Name <span class="req">*</span></label>
					<input type="text" id="first_name" name="first_name" value={first_name} required />
				</div>
				<div class="form-group">
					<label for="last_name">Last Name <span class="req">*</span></label>
					<input type="text" id="last_name" name="last_name" value={last_name} required />
				</div>
				<div class="form-group">
					<label for="email">Email <span class="req">*</span></label>
					<input type="email" id="email" name="email" value={email} required />
				</div>
				<div class="form-group">
					<label for="display_name">Display Name</label>
					<input type="text" id="display_name" name="display_name" value={display_name} placeholder="Optional" />
				</div>
				<div class="form-group">
					<label for="password">Password <span class="req">*</span></label>
					<input type="password" id="password" name="password" placeholder="Min 8 characters" minlength="8" required />
				</div>
			</div>
		</div>

		<div class="card">
			<h2>Permissions</h2>

			<div class="super-admin-toggle">
				<label class="check-label">
					<input type="checkbox" name="is_super_admin" value="true" checked={is_super_admin}
						on:change={(e) => { is_super_admin = /** @type {HTMLInputElement} */ (e.target).checked; }} />
					<span class="super-label">Super Admin</span>
					<span class="super-desc">Full access to all areas and user management</span>
				</label>
			</div>

			{#if !is_super_admin}
				<div class="role-matrix">
					<div class="role-matrix-header">
						<div class="area-col">Area</div>
						{#each roleOptions as opt}
							<div class="role-col">{opt.label}</div>
						{/each}
					</div>
					{#each areas as area}
						<div class="role-matrix-row">
							<div class="area-col">
								<span class="area-name">{area.label}</span>
								<span class="area-desc">{area.desc}</span>
							</div>
							{#each roleOptions as opt}
								<div class="role-col">
									<input type="radio" name={area.key} value={opt.value}
										checked={roleValues[area.key] === opt.value} />
								</div>
							{/each}
						</div>
					{/each}
				</div>
			{:else}
				<input type="hidden" name="hsi_role" value="manager" />
				<input type="hidden" name="gft_role" value="manager" />
				<input type="hidden" name="csz_role" value="manager" />
				<input type="hidden" name="corp_role" value="manager" />
				<p class="super-note">Super admins have full access to all areas.</p>
			{/if}
		</div>

		<div class="form-actions">
			<a href="{base}/admin/users" class="btn-secondary">Cancel</a>
			<button type="submit" class="btn-primary" disabled={submitting}>
				{submitting ? 'Creating...' : 'Create User'}
			</button>
		</div>
	</form>
</div>

<style>
	.container { max-width: 800px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	h2 { font-size: 1.1rem; font-weight: 600; color: #1a202c; margin: 0 0 1rem 0; }

	.error-banner { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-size: 0.9rem; }

	.card { background: white; padding: 1.5rem; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 1.5rem; }

	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; }
	.form-group { display: flex; flex-direction: column; gap: 0.3rem; }
	.form-group label { font-size: 0.8rem; font-weight: 600; color: #374151; }
	.req { color: #ef4444; }
	.form-group input, .form-group select { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; }
	.form-group input:focus, .form-group select:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }

	.super-admin-toggle { margin-bottom: 1.25rem; padding: 1rem; background: #f5f3ff; border-radius: 0.5rem; border: 1px solid #e9d5ff; }
	.check-label { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; cursor: pointer; }
	.check-label input { accent-color: #7c3aed; cursor: pointer; width: 18px; height: 18px; }
	.super-label { font-weight: 600; color: #7c3aed; font-size: 0.95rem; }
	.super-desc { font-size: 0.8rem; color: #6b7280; }
	.super-note { color: #6b7280; font-size: 0.85rem; font-style: italic; margin: 0; }

	.role-matrix { border: 1px solid #e5e7eb; border-radius: 0.5rem; overflow: hidden; }
	.role-matrix-header { display: grid; grid-template-columns: 1fr repeat(4, 100px); background: #f9fafb; border-bottom: 2px solid #e5e7eb; padding: 0.6rem 0; }
	.role-matrix-header .area-col { padding-left: 1rem; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; }
	.role-matrix-header .role-col { text-align: center; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; }
	.role-matrix-row { display: grid; grid-template-columns: 1fr repeat(4, 100px); padding: 0.75rem 0; border-bottom: 1px solid #f3f4f6; align-items: center; }
	.role-matrix-row:last-child { border-bottom: none; }
	.role-matrix-row:hover { background: #f9fafb; }
	.role-matrix-row .area-col { padding-left: 1rem; }
	.area-name { display: block; font-weight: 500; color: #1a202c; font-size: 0.9rem; }
	.area-desc { display: block; font-size: 0.75rem; color: #9ca3af; }
	.role-matrix-row .role-col { text-align: center; }
	.role-matrix-row .role-col input { accent-color: #3b82f6; cursor: pointer; width: 16px; height: 16px; }

	.form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; }
	.btn-primary { background: #3b82f6; color: white; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; }
	.btn-primary:hover { background: #2563eb; }
	.btn-primary:disabled { background: #93c5fd; cursor: not-allowed; }
	.btn-secondary { background: #e5e7eb; color: #374151; padding: 0.6rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; }
	.btn-secondary:hover { background: #d1d5db; }

	@media (max-width: 768px) {
		.form-grid { grid-template-columns: 1fr; }
		.role-matrix-header, .role-matrix-row { grid-template-columns: 1fr repeat(4, 70px); }
	}
</style>