<!-- src/routes/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>B&C Entertainment | Financial Tracker</title>
</svelte:head>

<div class="home">
	<div class="hero">
		<div class="logo-container">
			<div class="logo-placeholder">
				<span class="logo-icon">💼</span>
				<h1>Good Friend Theater</h1>
				<p class="tagline">''</p>
			</div>
		</div>

		<div class="quick-links">
			<h2>Quick Access</h2>
			<div class="link-grid">
				<a href={resolve(/** @type {any} */ ('/shows'))} class="quick-card">
					<span class="card-icon">🎭</span>
					<span class="card-label">Shows</span>
					<span class="card-desc">Manage Shows</span>
				</a>
				<a href={resolve(/** @type {any} */ ('/patrons'))} class="quick-card">
					<span class="card-icon">👥</span>
					<span class="card-label">Patrons</span>
					<span class="card-desc">Manage Patrons</span>
				</a>
				<!--a href={resolve('/hsi/students')} class="quick-card">
					<span class="card-icon">👥</span>
					<span class="card-label">Students</span>
					<span class="card-desc">Manage HSI Students</span>
				</a>
				<a href={resolve('/hsi/teachers')} class="quick-card">
					<span class="card-icon">👨‍🏫</span>
					<span class="card-label">Teachers</span>
					<span class="card-desc">Manage HSI Teachers</span>
				</a-->
				<a href={resolve(/** @type {any} */ ('/shows/reports'))} class="quick-card">
					<span class="card-icon">📊</span>
					<span class="card-label">Reports</span>
					<span class="card-desc">Show Reports</span>
				</a>
			</div>
		</div>
	</div>
</div>

<style>
	.home {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		padding: 2rem;
	}

	.hero {
		text-align: center;
		max-width: 700px;
		width: 100%;
	}

	.logo-container {
		margin-bottom: 3rem;
	}

	.logo-placeholder {
		background: white;
		border-radius: 1rem;
		padding: 3rem;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -2px rgba(0, 0, 0, 0.1);
	}

	.logo-icon {
		font-size: 4rem;
		display: block;
		margin-bottom: 1rem;
	}

	.logo-placeholder h1 {
		font-size: 2.25rem;
		font-weight: 700;
		color: #1e293b;
		margin: 0 0 0.5rem 0;
	}

	.tagline {
		color: #64748b;
		font-size: 1rem;
		margin: 0;
	}

	.quick-links h2 {
		font-size: 1.1rem;
		font-weight: 600;
		color: #6b7280;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		margin-bottom: 1rem;
	}

	.link-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
	}

	.quick-card {
		background: white;
		border-radius: 0.75rem;
		padding: 1.5rem 1rem;
		text-decoration: none;
		box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
		transition: all 0.2s;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.quick-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.quick-card.disabled {
		opacity: 0.5;
		pointer-events: none;
	}

	.card-icon {
		font-size: 2rem;
	}

	.card-label {
		font-size: 1.1rem;
		font-weight: 700;
		color: #1e293b;
	}

	.card-desc {
		font-size: 0.75rem;
		color: #64748b;
		text-align: center;
	}

	@media (max-width: 600px) {
		.link-grid {
			grid-template-columns: repeat(2, 1fr);
		}

		.logo-placeholder {
			padding: 2rem;
		}

		.logo-placeholder h1 {
			font-size: 1.75rem;
		}
	}
</style>
