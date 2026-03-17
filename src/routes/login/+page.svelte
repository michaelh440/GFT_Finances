<!-- src/routes/login/+page.svelte -->
<script>
	import { enhance } from '$app/forms';

	export let data;
	export let form;

	let submitting = false;
</script>

<svelte:head>
	<title>Login | B&C Financial Tracker</title>
</svelte:head>

<div class="login-wrapper">
	<div class="login-card">
		<div class="login-header">
			<h1>B&C Financial Tracker</h1>
			<p>Sign in to your account</p>
		</div>

		{#if form?.error}
			<div class="error-banner">{form.error}</div>
		{/if}

		<form method="POST" use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				submitting = false;
				await update();
			};
		}}>
			<input type="hidden" name="redirect" value={data.redirectTo} />

			<div class="form-group">
				<label for="email">Email</label>
				<input
					type="email"
					id="email"
					name="email"
					value={form?.email || ''}
					placeholder="you@example.com"
					required
					autocomplete="email"
				/>
			</div>

			<div class="form-group">
				<label for="password">Password</label>
				<input
					type="password"
					id="password"
					name="password"
					placeholder="••••••••"
					required
					autocomplete="current-password"
				/>
			</div>

			<button type="submit" class="btn-login" disabled={submitting}>
				{submitting ? 'Signing in...' : 'Sign In'}
			</button>
		</form>
	</div>
</div>

<style>
	.login-wrapper {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f3f4f6;
		padding: 1rem;
	}

	.login-card {
		background: white;
		padding: 2.5rem;
		border-radius: 0.75rem;
		box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
		width: 100%;
		max-width: 400px;
	}

	.login-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.login-header h1 {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1a202c;
		margin: 0 0 0.25rem 0;
	}

	.login-header p {
		color: #6b7280;
		margin: 0;
		font-size: 0.9rem;
	}

	.error-banner {
		background: #fef2f2;
		border: 1px solid #fecaca;
		color: #991b1b;
		padding: 0.75rem 1rem;
		border-radius: 0.5rem;
		margin-bottom: 1.5rem;
		font-size: 0.9rem;
		text-align: center;
	}

	.form-group {
		margin-bottom: 1.25rem;
	}

	.form-group label {
		display: block;
		font-size: 0.8rem;
		font-weight: 600;
		color: #374151;
		margin-bottom: 0.35rem;
	}

	.form-group input {
		width: 100%;
		padding: 0.65rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.375rem;
		font-size: 0.95rem;
		color: #1a202c;
		box-sizing: border-box;
	}

	.form-group input:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	.btn-login {
		width: 100%;
		padding: 0.75rem;
		background: #3b82f6;
		color: white;
		border: none;
		border-radius: 0.5rem;
		font-size: 1rem;
		font-weight: 600;
		cursor: pointer;
		margin-top: 0.5rem;
	}

	.btn-login:hover { background: #2563eb; }
	.btn-login:disabled { background: #93c5fd; cursor: not-allowed; }
</style>