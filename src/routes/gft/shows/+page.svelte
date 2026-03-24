<!-- src/routes/shows/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { canDataEntry } from '$lib/permissions';

	/**
	 * @typedef {Object} ShowItem
	 * @property {string} show_code
	 * @property {string} show_name
	 * @property {string} format
	 * @property {string} audience_type
	 * @property {string} day_of_week
	 * @property {number} standard_ticket_price
	 * @property {string} description
	 * @property {boolean} is_active
	 * @property {string} created_at
	 * @property {string} updated_at
	 */

	/** @type {any} */
	export let data;

	$: user = data.user;
	$: shows = data.shows;

	// Group shows by format
	/** @type {Record<string, ShowItem[]>} */
	$: showsByFormat = shows.reduce((/** @type {Record<string, ShowItem[]>} */ acc, show) => {
		const format = show.format || 'Uncategorized';
		if (!acc[format]) {
			acc[format] = [];
		}
		acc[format].push(show);
		return acc;
	}, /** @type {Record<string, ShowItem[]>} */ ({}));

	$: formats = Object.keys(showsByFormat).sort();

	/**
	 * @param {number} amount
	 * @returns {string}
	 */
	function formatCurrency(amount) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD'
		}).format(amount);
	}
</script>

<svelte:head>
	<title>Live Shows | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Good Friends Theater - Live Shows</h1>
		<div class="header-actions">
			{#if canDataEntry(user, 'gft')}
				<a href={resolve(/** @type {any} */ ('/gft/shows/new'))} class="btn-primary">Add Show</a>
			{/if}
		</div>
	</header>

	<div class="shows-content">
		{#if shows.length === 0}
			<p class="empty-state">No shows found. Add your first show to get started.</p>
		{:else}
			{#each formats as format (format)}
				<div class="format-section">
					<h2 class="format-title">{format}</h2>

					<table>
						<colgroup>
							<col class="col-code" />
							<col class="col-name" />
							<col class="col-audience" />
							<col class="col-day" />
							<col class="col-price" />
							<col class="col-status" />
							<col class="col-actions" />
						</colgroup>
						<thead>
							<tr>
								<th>Show Code</th>
								<th>Show Name</th>
								<th>Audience</th>
								<th>Day</th>
								<th>Ticket Price</th>
								<th>Status</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each showsByFormat[format] as show (show.show_code)}
								<tr class:inactive={!show.is_active}>
									<td><span class="show-code">{show.show_code}</span></td>
									<td>{show.show_name}</td>
									<td>
										{#if show.audience_type}
											<span class="audience-badge">{show.audience_type}</span>
										{:else}
											<span class="empty-value">—</span>
										{/if}
									</td>
									<td>{show.day_of_week || '—'}</td>
									<td>
										{#if show.standard_ticket_price > 0}
											{formatCurrency(show.standard_ticket_price)}
										{:else}
											<span class="empty-value">—</span>
										{/if}
									</td>
									<td>
										<span class="status-badge" class:active={show.is_active}>
											{show.is_active ? 'Active' : 'Inactive'}
										</span>
									</td>
									<td>
										<div class="actions">
											<a href={resolve(/** @type {any} */ (`/gft/shows/${show.show_code}`))} class="btn-action">View</a>
											{#if canDataEntry(user, 'gft')}
												<a
													href={resolve(/** @type {any} */ (`/gft/shows/${show.show_code}/edit`))}
													class="btn-action">Edit</a
												>
											{/if}
										</div>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.container {
		max-width: 1400px;
		margin: 0 auto;
		padding: 2rem;
	}

	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 2rem;
	}

	h1 {
		font-size: 2rem;
		font-weight: 700;
		color: #1a202c;
	}

	.header-actions {
		display: flex;
		gap: 0.75rem;
	}
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }

	.shows-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.format-section {
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	.format-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: #1a202c;
		padding: 1rem 1.5rem;
		background-color: #f9fafb;
		border-bottom: 2px solid #e5e7eb;
		margin: 0;
	}

	/* Fixed column widths so all tables align */
	table {
		width: 100%;
		border-collapse: collapse;
		table-layout: fixed;
	}

	.col-code {
		width: 12%;
	}
	.col-name {
		width: 25%;
	}
	.col-audience {
		width: 13%;
	}
	.col-day {
		width: 12%;
	}
	.col-price {
		width: 12%;
	}
	.col-status {
		width: 10%;
	}
	.col-actions {
		width: 16%;
	}

	thead {
		background-color: #f9fafb;
	}

	th {
		padding: 0.75rem 1rem;
		text-align: center;
		font-weight: 600;
		color: #374151;
		font-size: 0.8rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		border-bottom: 1px solid #e5e7eb;
	}

	td {
		padding: 0.75rem 1rem;
		border-top: 1px solid #f3f4f6;
		text-align: center;
		vertical-align: middle;
		font-size: 0.9rem;
		color: #1a202c;
	}

	tr:hover {
		background-color: #f9fafb;
	}

	tr.inactive {
		opacity: 0.5;
	}

	.show-code {
		font-family: monospace;
		font-weight: 600;
		color: #6366f1;
		background-color: #f3f4f6;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.85rem;
	}

	.audience-badge {
		display: inline-block;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.8rem;
		font-weight: 500;
		background-color: #fef3c7;
		color: #92400e;
	}

	.empty-value {
		color: #9ca3af;
	}

	.status-badge {
		display: inline-block;
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.8rem;
		font-weight: 500;
		background-color: #fee2e2;
		color: #991b1b;
	}

	.status-badge.active {
		background-color: #dcfce7;
		color: #166534;
	}

	.actions {
		display: flex;
		gap: 0.5rem;
		justify-content: center;
	}

	.btn-action {
		background-color: #e5e7eb;
		color: #374151;
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		text-decoration: none;
		font-size: 0.8rem;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.btn-action:hover {
		background-color: #d1d5db;
	}

	.empty-state {
		text-align: center;
		padding: 3rem;
		color: #6b7280;
		font-size: 1.125rem;
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
	}

	@media (max-width: 1024px) {
		header {
			flex-direction: column;
			align-items: flex-start;
			gap: 1rem;
		}

		.header-actions {
			flex-wrap: wrap;
		}

		table {
			font-size: 0.85rem;
		}

		th,
		td {
			padding: 0.5rem 0.5rem;
		}
	}
</style>
