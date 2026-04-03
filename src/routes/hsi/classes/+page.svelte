<!-- src/routes/hsi/classes/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { canDataEntry } from '$lib/permissions';

	/**
	 * @typedef {Object} ClassItem
	 * @property {string} class_code
	 * @property {string} class_name
	 * @property {string} class_type
	 * @property {string} student_type
	 * @property {number} standard_price
	 * @property {string} track
	 * @property {string} description
	 * @property {boolean} is_active
	 * @property {string} created_at
	 * @property {string} updated_at
	 */

	/** @type {any} */
	export let data;

	$: user = data.user;
	$: classes = data.classes;

	// Group classes by track
	/** @type {Record<string, ClassItem[]>} */
	$: classesByTrack = classes.reduce(
		(/** @type {Record<string, ClassItem[]>} */ acc, classItem) => {
			const track = classItem.track || 'Uncategorized';
			if (!acc[track]) {
				acc[track] = [];
			}
			acc[track].push(classItem);
			return acc;
		},
		{}
	);

	$: tracks = Object.keys(classesByTrack).sort();

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
	<title>HSI Classes | StageLedger</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Houston School of Improv - Classes</h1>
		<div class="header-actions">
			{#if canDataEntry(user, 'hsi')}
				<a href={resolve('/hsi/classes/new')} class="btn-primary">Add Class</a>
			{/if}
			<a href={resolve('/hsi')} class="btn-secondary">Back to HSI Dashboard</a>
		</div>
	</header>

	<div class="classes-content">
		{#if classes.length === 0}
			<p class="empty-state">No classes found. Add your first class to get started.</p>
		{:else}
			{#each tracks as track (track)}
				<div class="track-section">
					<h2 class="track-title">{track}</h2>

					<table>
						<colgroup>
							<col class="col-code" />
							<col class="col-name" />
							<col class="col-type" />
							<col class="col-student" />
							<col class="col-price" />
							<col class="col-status" />
							<col class="col-actions" />
						</colgroup>
						<thead>
							<tr>
								<th>Class Code</th>
								<th>Class Name</th>
								<th>Type</th>
								<th>Student Type</th>
								<th>Standard Price</th>
								<th>Status</th>
								<th>Actions</th>
							</tr>
						</thead>
						<tbody>
							{#each classesByTrack[track] as classItem (classItem.class_code)}
								<tr class:inactive={!classItem.is_active}>
									<td><span class="class-code">{classItem.class_code}</span></td>
									<td>{classItem.class_name}</td>
									<td>{classItem.class_type}</td>
									<td>{classItem.student_type}</td>
									<td>{formatCurrency(classItem.standard_price)}</td>
									<td>
										<span class="status-badge" class:active={classItem.is_active}>
											{classItem.is_active ? 'Active' : 'Inactive'}
										</span>
									</td>
									<td>
										<div class="actions">
											<a href={resolve(`/hsi/classes/${classItem.class_code}`)} class="btn-action"
												>View</a
											>
											{#if canDataEntry(user, 'hsi')}
												<a
													href={resolve(`/hsi/classes/${classItem.class_code}/edit`)}
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
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }

	.classes-content {
		display: flex;
		flex-direction: column;
		gap: 2rem;
	}

	.track-section {
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		overflow: hidden;
	}

	.track-title {
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
	.col-type {
		width: 15%;
	}
	.col-student {
		width: 13%;
	}
	.col-price {
		width: 12%;
	}
	.col-status {
		width: 10%;
	}
	.col-actions {
		width: 13%;
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

	.class-code {
		font-family: monospace;
		font-weight: 600;
		color: #6366f1;
		background-color: #f3f4f6;
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.85rem;
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

	@media (max-width: 768px) {
		.track-section {
			overflow-x: auto;
		}

		table {
			table-layout: auto;
			min-width: 600px;
			display: table;
		}

		colgroup {
			display: none;
		}

		th, td {
			padding: 0.5rem;
			font-size: 0.8rem;
			white-space: nowrap;
		}
	}
</style>
