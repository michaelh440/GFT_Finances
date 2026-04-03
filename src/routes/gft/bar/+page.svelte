<!-- src/routes/gft/bar/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { canDataEntry } from '$lib/permissions';

	/** @type {any} */
	export let data;

	$: user = data.user;
	$: barItems = data.barItems || [];

	/** @type {Record<string, any[]>} */
	$: itemsByCategory = barItems.reduce((/** @type {Record<string, any[]>} */ acc, item) => {
		const cat = item.category || 'Other';
		if (!acc[cat]) acc[cat] = [];
		acc[cat].push(item);
		return acc;
	}, {});

	$: categories = Object.keys(itemsByCategory).sort();
</script>

<svelte:head>
	<title>Bar Items | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Bar Items</h1>
		<div class="header-actions">
			{#if canDataEntry(user, 'gft')}
				<a href={resolve('/gft/bar/new')} class="btn-primary">Add Item</a>
			{/if}
		</div>
	</header>

	{#if barItems.length === 0}
		<div class="empty-state">No bar items found. Add your first item to get started.</div>
	{:else}
		<div class="classes-content">
			{#each categories as category (category)}
				<div class="track-section">
					<h2 class="track-title">{category}</h2>
					<table>
						<thead>
							<tr>
								<th>Code</th>
								<th>Item Name</th>
								<th>Status</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each itemsByCategory[category] as item (item.item_code)}
								<tr class:inactive={!item.is_active}>
									<td>
										<a href={resolve(`/gft/bar/${item.item_code}`)} class="class-code">{item.item_code}</a>
									</td>
									<td>{item.item_name}</td>
									<td>
										<span class="status-badge" class:active={item.is_active}>
											{item.is_active ? 'Active' : 'Inactive'}
										</span>
									</td>
									<td>
										<div class="actions">
											<a href={resolve(`/gft/bar/${item.item_code}`)} class="btn-action">View</a>
											{#if canDataEntry(user, 'gft')}
												<a href={resolve(`/gft/bar/${item.item_code}/edit`)} class="btn-action">Edit</a>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
	header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; }
	.header-actions { display: flex; gap: 0.75rem; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }

	.classes-content { display: flex; flex-direction: column; gap: 2rem; }
	.track-section { background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); overflow: hidden; }
	.track-title { font-size: 1.25rem; font-weight: 600; color: #1a202c; padding: 1rem 1.5rem; background-color: #f9fafb; border-bottom: 2px solid #e5e7eb; margin: 0; }

	table { width: 100%; border-collapse: collapse; }
	thead { background-color: #f9fafb; }
	th { padding: 0.75rem 1rem; text-align: center; font-weight: 600; color: #374151; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #e5e7eb; }
	td { padding: 0.75rem 1rem; border-top: 1px solid #f3f4f6; text-align: center; vertical-align: middle; font-size: 0.9rem; color: #1a202c; }
	tr:hover { background-color: #f9fafb; }
	tr.inactive { opacity: 0.5; }

	.class-code { font-family: monospace; font-weight: 600; color: #6366f1; background-color: #f3f4f6; padding: 0.25rem 0.5rem; border-radius: 0.25rem; font-size: 0.85rem; text-decoration: none; }
	.class-code:hover { text-decoration: underline; }

	.status-badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }

	.actions { display: flex; gap: 0.5rem; justify-content: center; }
	.btn-action { background-color: #e5e7eb; color: #374151; padding: 0.375rem 0.75rem; border-radius: 0.375rem; text-decoration: none; font-size: 0.8rem; font-weight: 500; transition: background-color 0.2s; }
	.btn-action:hover { background-color: #d1d5db; }

	.empty-state { text-align: center; padding: 3rem; color: #6b7280; font-size: 1.125rem; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }

	@media (max-width: 768px) {
		.track-section { overflow-x: auto; }
		table { display: table; min-width: 500px; }
		th, td { padding: 0.5rem; font-size: 0.85rem; white-space: nowrap; }
	}
</style>
