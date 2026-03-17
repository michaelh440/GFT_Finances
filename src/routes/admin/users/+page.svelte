<!-- src/routes/admin/users/+page.svelte -->
<script>
	import { base } from '$app/paths';

	export let data;

	const roleLabels = { none: '—', viewer: 'Viewer', data_entry: 'Data Entry', manager: 'Manager' };
	const roleBadgeClass = { none: '', viewer: 'badge-view', data_entry: 'badge-entry', manager: 'badge-mgr' };

	function formatDate(d) {
		if (!d) return '—';
		const dt = new Date(d);
		return isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
	}
</script>

<svelte:head>
	<title>User Management | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href="{base}/" class="back-link">← Back to Home</a>
			<h1>User Management</h1>
			<p class="subtitle">{data.users.length} user{data.users.length !== 1 ? 's' : ''}</p>
		</div>
		<a href="{base}/admin/users/new" class="btn-primary">+ Add User</a>
	</header>

	<div class="table-wrapper">
		<table>
			<thead>
				<tr>
					<th>Name</th>
					<th>Email</th>
					<th>HSI</th>
					<th>GFT</th>
					<th>CSZ</th>
					<th>Corp</th>
					<th>Status</th>
					<th>Last Login</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each data.users as user}
					<tr class:inactive={!user.is_active}>
						<td>
							<div class="user-name">{user.first_name} {user.last_name}</div>
							{#if user.is_super_admin}<span class="super-badge">Super Admin</span>{/if}
						</td>
						<td class="email-cell">{user.email}</td>
						<td><span class="role-badge {roleBadgeClass[user.hsi_role]}">{roleLabels[user.hsi_role]}</span></td>
						<td><span class="role-badge {roleBadgeClass[user.gft_role]}">{roleLabels[user.gft_role]}</span></td>
						<td><span class="role-badge {roleBadgeClass[user.csz_role]}">{roleLabels[user.csz_role]}</span></td>
						<td><span class="role-badge {roleBadgeClass[user.corp_role]}">{roleLabels[user.corp_role]}</span></td>
						<td>
							<span class="status-badge" class:active={user.is_active}>{user.is_active ? 'Active' : 'Inactive'}</span>
						</td>
						<td class="date-cell">{formatDate(user.last_login_at)}</td>
						<td><a href="{base}/admin/users/{user.user_id}/edit" class="btn-edit">Edit</a></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	.subtitle { color: #6b7280; margin: 0.25rem 0 0 0; }

	.btn-primary { background: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; margin-top: 1.5rem; display: inline-block; }
	.btn-primary:hover { background: #2563eb; }

	.table-wrapper { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	thead { background: #f9fafb; }
	th { padding: 0.6rem 0.75rem; text-align: left; font-weight: 600; color: #374151; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.03em; border-bottom: 2px solid #e5e7eb; }
	td { padding: 0.6rem 0.75rem; border-bottom: 1px solid #f3f4f6; font-size: 0.85rem; vertical-align: middle; }
	tr:hover { background: #f9fafb; }
	tr.inactive { opacity: 0.5; }

	.user-name { font-weight: 500; color: #1a202c; }
	.email-cell { color: #6b7280; }
	.date-cell { color: #6b7280; font-size: 0.8rem; }
	.super-badge { font-size: 0.65rem; font-weight: 600; color: #9333ea; background: #f3e8ff; padding: 0.1rem 0.4rem; border-radius: 0.2rem; margin-left: 0.25rem; }

	.role-badge { font-size: 0.75rem; padding: 0.15rem 0.4rem; border-radius: 0.25rem; font-weight: 500; }
	.badge-view { background: #dbeafe; color: #1e40af; }
	.badge-entry { background: #fef3c7; color: #92400e; }
	.badge-mgr { background: #dcfce7; color: #166534; }

	.status-badge { font-size: 0.75rem; padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 500; background: #fee2e2; color: #991b1b; }
	.status-badge.active { background: #dcfce7; color: #166534; }

	.btn-edit { font-size: 0.8rem; color: #3b82f6; text-decoration: none; font-weight: 500; }
	.btn-edit:hover { text-decoration: underline; }

	@media (max-width: 768px) {
		header { flex-direction: column; gap: 1rem; }
		th, td { padding: 0.4rem 0.5rem; font-size: 0.8rem; }
	}
</style>