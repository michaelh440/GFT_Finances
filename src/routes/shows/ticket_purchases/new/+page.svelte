<!-- src/routes/shows/tickets/new/+page.svelte -->
<script>
	import { base } from '$app/paths';
	import { enhance } from '$app/forms';

	/** @type {{ shows: any[], patrons: any[] }} */
	export let data;
	export let form;

	$: patron_id = form?.values?.patron_id ?? '';
	$: show_code = form?.values?.show_code ?? '';
	$: show_date = form?.values?.show_date ?? '';
	$: tickets_purchased = form?.values?.tickets_purchased ?? 1;
	$: amount_paid = form?.values?.amount_paid ?? 0;
	$: purchase_date = form?.values?.purchase_date ?? new Date().toISOString().split('T')[0];
	$: payment_method = form?.values?.payment_method ?? '';
	$: notes = form?.values?.notes ?? '';

	// Group shows by format for dropdown
	$: showsByFormat = data.shows.reduce((/** @type {Record<string, any[]>} */ acc, s) => {
		const fmt = s.format || 'Other';
		if (!acc[fmt]) acc[fmt] = [];
		acc[fmt].push(s);
		return acc;
	}, {});
	$: formats = Object.keys(showsByFormat).sort();

	// Auto-calculate amount when show or ticket count changes
	$: selectedShow = data.shows.find((s) => s.show_code === show_code);
	function autoCalc() {
		if (selectedShow && tickets_purchased > 0) {
			amount_paid = selectedShow.standard_ticket_price * tickets_purchased;
		}
	}
</script>

<svelte:head>
	<title>Record Ticket Purchase | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
	<header>
		<div>
			<a href="{base}/shows/patrons" class="back-link">← Back to Patrons</a>
			<h1>Record Ticket Purchase</h1>
		</div>
	</header>

	{#if form?.error}
		<div class="error-banner">{form.error}</div>
	{/if}

	<div class="form-card">
		<form method="POST" use:enhance>
			<div class="form-grid">
				<div class="form-group">
					<label for="patron_id">Patron <span class="required">*</span></label>
					<select id="patron_id" name="patron_id" bind:value={patron_id} required>
						<option value="">Select a patron...</option>
						{#each data.patrons as patron (patron.patron_id)}
							<option value={patron.patron_id}>
								{patron.last_name}, {patron.first_name}
								{patron.email ? `(${patron.email})` : ''}
							</option>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="show_code">Show <span class="required">*</span></label>
					<select id="show_code" name="show_code" bind:value={show_code} on:change={autoCalc} required>
						<option value="">Select a show...</option>
						{#each formats as fmt (fmt)}
							<optgroup label={fmt}>
								{#each showsByFormat[fmt] as s (s.show_code)}
									<option value={s.show_code}>{s.show_name}</option>
								{/each}
							</optgroup>
						{/each}
					</select>
				</div>

				<div class="form-group">
					<label for="show_date">Show Date <span class="required">*</span></label>
					<input type="date" id="show_date" name="show_date" bind:value={show_date} required />
				</div>

				<div class="form-group">
					<label for="purchase_date">Purchase Date</label>
					<input type="date" id="purchase_date" name="purchase_date" bind:value={purchase_date} />
				</div>

				<div class="form-group">
					<label for="tickets_purchased">Tickets <span class="required">*</span></label>
					<input
						type="number"
						id="tickets_purchased"
						name="tickets_purchased"
						bind:value={tickets_purchased}
						on:change={autoCalc}
						min="1"
						required
					/>
				</div>

				<div class="form-group">
					<label for="amount_paid">Amount Paid</label>
					<div class="price-input">
						<span class="price-prefix">$</span>
						<input
							type="number"
							id="amount_paid"
							name="amount_paid"
							bind:value={amount_paid}
							min="0"
							step="0.01"
						/>
					</div>
				</div>

				<div class="form-group">
					<label for="payment_method">Payment Method</label>
					<select id="payment_method" name="payment_method" bind:value={payment_method}>
						<option value="">— Select —</option>
						<option value="Cash">Cash</option>
						<option value="Card">Card</option>
						<option value="Online">Online</option>
						<option value="Comp">Comp</option>
					</select>
				</div>

				<div class="form-group">
					<!-- spacer -->
				</div>

				<div class="form-group full-width">
					<label for="notes">Notes</label>
					<textarea id="notes" name="notes" rows="2">{notes}</textarea>
				</div>
			</div>

			<div class="form-actions">
				<a href="{base}/shows/patrons" class="btn-secondary">Cancel</a>
				<button type="submit" class="btn-primary">Save Purchase</button>
			</div>
		</form>
	</div>
</div>

<style>
	.container { max-width: 800px; margin: 0 auto; padding: 2rem; }
	header { margin-bottom: 2rem; }
	.back-link { color: #6b7280; text-decoration: none; font-size: 0.875rem; display: inline-block; margin-bottom: 0.5rem; }
	.back-link:hover { color: #3b82f6; }
	h1 { font-size: 2rem; font-weight: 700; color: #1a202c; margin: 0; }
	.error-banner { background-color: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; font-size: 0.9rem; }
	.form-card { background: white; padding: 2rem; border-radius: 0.5rem; box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1); }
	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
	.form-group { display: flex; flex-direction: column; gap: 0.35rem; }
	.form-group.full-width { grid-column: 1 / -1; }
	label { font-size: 0.8rem; font-weight: 600; color: #374151; text-transform: uppercase; letter-spacing: 0.03em; }
	.required { color: #ef4444; }
	input, select, textarea { padding: 0.6rem 0.75rem; border: 1px solid #d1d5db; border-radius: 0.375rem; font-size: 0.95rem; color: #1a202c; background: white; transition: border-color 0.2s; }
	input:focus, select:focus, textarea:focus { outline: none; border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
	textarea { resize: vertical; font-family: inherit; }
	.price-input { display: flex; align-items: center; }
	.price-prefix { padding: 0.6rem 0.75rem; background-color: #f3f4f6; border: 1px solid #d1d5db; border-right: none; border-radius: 0.375rem 0 0 0.375rem; color: #6b7280; font-size: 0.95rem; }
	.price-input input { border-radius: 0 0.375rem 0.375rem 0; flex: 1; }
	.form-actions { display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid #f3f4f6; }
	.btn-primary { background-color: #3b82f6; color: white; padding: 0.6rem 1.5rem; border-radius: 0.5rem; border: none; font-weight: 500; font-size: 0.9rem; cursor: pointer; transition: background-color 0.2s; }
	.btn-primary:hover { background-color: #2563eb; }
	.btn-secondary { background-color: #e5e7eb; color: #374151; padding: 0.6rem 1.5rem; border-radius: 0.5rem; text-decoration: none; font-weight: 500; font-size: 0.9rem; transition: background-color 0.2s; }
	.btn-secondary:hover { background-color: #d1d5db; }
	@media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } }
</style>