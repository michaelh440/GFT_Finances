<!-- src/routes/hsi/tracks/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
	import { canDataEntry, canManage } from '$lib/permissions';

	/** @type {any} */
	export let data;

	$: user = data.user;
	$: tracks = data.tracks || [];
</script>

<svelte:head>
	<title>Class Tracks | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<h1>Class Tracks</h1>
		<div class="header-actions">
			{#if canManage(user, 'hsi')}
				<a href={resolve('/hsi/tracks/new')} class="btn-primary">Add Track</a>
			{/if}
		</div>
	</header>

	{#if tracks.length === 0}
		<p class="empty-state">No tracks found. Add your first track to get started.</p>
	{:else}
		<div class="tracks-grid">
			{#each tracks as track (track.track_id)}
				<div class="track-card" class:inactive={!track.is_active}>
					<div class="track-header">
						<h2>{track.track_name}</h2>
						<span class="status-badge" class:active={track.is_active}>
							{track.is_active ? 'Active' : 'Inactive'}
						</span>
					</div>
					{#if track.description}
						<p class="track-description">{track.description}</p>
					{/if}
					<div class="track-stats">
						<span class="stat">
							<strong>{track.active_class_count}</strong> active {track.active_class_count === 1 ? 'class' : 'classes'}
						</span>
						{#if track.class_count !== track.active_class_count}
							<span class="stat muted">
								{track.class_count} total
							</span>
						{/if}
					</div>
					<div class="track-actions">
						<a href={resolve(`/hsi/tracks/${track.track_id}`)} class="btn-action">View</a>
						{#if canManage(user, 'hsi')}
							<a href={resolve(`/hsi/tracks/${track.track_id}?edit=1`)} class="btn-action">Edit</a>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.container { max-width: 1200px; margin: 0 auto; padding: 2rem; }

	header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }

	.header-actions { display: flex; gap: 0.75rem; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.25rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }

	.tracks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem; }

	.track-card {
		background: white;
		border-radius: 0.5rem;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		transition: box-shadow 0.2s;
	}
	.track-card:hover { box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
	.track-card.inactive { opacity: 0.6; }

	.track-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; }
	.track-header h2 { font-size: 1.15rem; font-weight: 600; color: #1a202c; margin: 0; }

	.status-badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 500; background-color: #fee2e2; color: #991b1b; white-space: nowrap; }
	.status-badge.active { background-color: #dcfce7; color: #166534; }

	.track-description { font-size: 0.875rem; color: #6b7280; line-height: 1.4; margin: 0; }

	.track-stats { display: flex; gap: 1rem; font-size: 0.85rem; }
	.stat { color: #374151; }
	.stat.muted { color: #9ca3af; }

	.track-actions { display: flex; gap: 0.5rem; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid #f3f4f6; }
	.btn-action { background-color: #e5e7eb; color: #374151; padding: 0.375rem 0.75rem; border-radius: 0.375rem; text-decoration: none; font-size: 0.8rem; font-weight: 500; transition: background-color 0.2s; }
	.btn-action:hover { background-color: #d1d5db; }

	.empty-state { text-align: center; padding: 3rem; color: #6b7280; font-size: 1.125rem; background: white; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }

	@media (max-width: 768px) {
		header { flex-direction: column; align-items: flex-start; gap: 1rem; }
		.tracks-grid { grid-template-columns: 1fr; }
	}
</style>
