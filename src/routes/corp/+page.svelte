<!-- src/routes/+page.svelte -->
<script>
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>StageLedger</title>
</svelte:head>

<div class="home">
	<div class="hero">
		<div class="logo-container">
			<div class="logo-placeholder">
				<span class="logo-icon">💼</span>
				<h1>Corporate Business</h1>
				<p class="tagline">''</p>
			</div>
		</div>

		<div class="quick-links">
			<h2>Quick Access</h2>
			<div class="link-grid">
				<a href={resolve('/corp/companies')} class="quick-card">
					<span class="card-icon">🏢</span>
					<span class="card-label">Companies</span>
					<span class="card-desc">Manage Corporate Companies</span>

				</a>
				<a href={resolve('/corp/contacts')} class="quick-card">
					<span class="card-icon">👥</span>
					<span class="card-label">Contacts</span>
					<span class="card-desc">Manage Corporate Contacts</span>
				</a>
				<a href={resolve('/corp/engagements')} class="quick-card">
					<span class="card-icon">⚡</span>
					<span class="card-label">Engagements</span>
					<span class="card-desc">Manage Corporate Engagements</span>
				</a>
				<a href={resolve('/corp/reports')} class="quick-card">
					<span class="card-icon">📊</span>
					<span class="card-label">Reports</span>
					<span class="card-desc">Corporate Reports</span>
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
