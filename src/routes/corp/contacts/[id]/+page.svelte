<!-- src/routes/corp/contacts/[id]/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  export let data;

  let editing = false;
  $: contact     = data.contact;
  $: engagements = data.engagements ?? [];

  const fmt = n => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0 });

  const typeLabel = {
    corporate_training: 'Corporate Training',
    private_show_gft:   'Private Show @ GFT',
    roadshow:           'Roadshow',
    space_rental:       'Space Rental',
    school_nonprofit:   'School / Nonprofit',
    other:              'Other',
  };

  const pipelineLabel = {
    lm_emailed:          'LM / Emailed',
    proposal_in_progress:'Proposal In Progress',
    active_due:          'Active & Due',
    benji_follow_up:     'Benji Follow Up',
    paid_2026:           'Paid 2026',
    none:                '—',
  };

  const contractLabel = {
    needs_sending: 'Needs Sending',
    sent:          'Sent',
    viewed:        'Viewed',
    signed:        'Signed',
  };

  $: totalRevenue = engagements.reduce((s, e) => s + (e.amount_paid ?? 0), 0);
  $: paidCount    = engagements.filter(e => e.amount_paid).length;
</script>

<div class="container">
<div class="page-header">
  <div>
    <a href="/corp/contacts" class="back">← All Contacts</a>
    <h1>{contact.company_name ?? 'Unnamed Company'}</h1>
    <p class="sub">{[contact.first_name, contact.last_name].filter(Boolean).join(' ')}</p>
  </div>
  <button on:click={() => editing = !editing} class="btn-secondary">
    {editing ? 'Cancel' : 'Edit'}
  </button>
</div>

{#if editing}
  <form method="POST" action="?/updateContact" use:enhance class="edit-form">
    <div class="form-grid">
      <label>Company<input name="company_name" value={contact.company_name ?? ''} /></label>
      <label>First name<input name="first_name" value={contact.first_name ?? ''} /></label>
      <label>Last name<input name="last_name" value={contact.last_name ?? ''} /></label>
      <label>Email<input name="email" type="email" value={contact.email ?? ''} /></label>
      <label>Phone<input name="phone" value={contact.phone ?? ''} /></label>
      <label>Address<input name="address_line1" value={contact.address_line1 ?? ''} /></label>
      <label>Address 2<input name="address_line2" value={contact.address_line2 ?? ''} /></label>
      <label>City<input name="city" value={contact.city ?? ''} /></label>
      <label>State<input name="state" value={contact.state ?? ''} /></label>
      <label>Zip<input name="zip" value={contact.zip ?? ''} /></label>
      <label>Country<input name="country" value={contact.country ?? ''} /></label>
    </div>
    <button type="submit" class="btn-primary">Save Changes</button>
  </form>
{:else}
  <div class="info-grid">
    <div class="info-block">
      <h3>Contact Info</h3>
      <dl>
        <dt>Email</dt>    <dd>{contact.email       ?? '—'}</dd>
        <dt>Phone</dt>    <dd>{contact.phone        ?? '—'}</dd>
        <dt>Address</dt>  <dd>{[contact.address_line1, contact.address_line2, contact.city, contact.state, contact.zip].filter(Boolean).join(', ') || '—'}</dd>
      </dl>
    </div>
    <div class="info-block">
      <h3>Summary</h3>
      <dl>
        <dt>Engagements</dt> <dd>{engagements.length}</dd>
        <dt>Paid</dt>        <dd>{paidCount}</dd>
        <dt>Total Revenue</dt><dd>{fmt(totalRevenue || null)}</dd>
      </dl>
    </div>
  </div>
{/if}

<div class="section">
  <div class="section-header">
    <h2>Engagements</h2>
    <a href="/corp/engagements/new?contact={contact.corp_contact_id}" class="btn-primary small">+ Add Engagement</a>
  </div>

  {#if engagements.length === 0}
    <p class="empty">No engagements yet.</p>
  {:else}
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Title</th>
          <th>Type</th>
          <th>Pipeline</th>
          <th>Contract</th>
          <th class="num">Revenue</th>
        </tr>
      </thead>
      <tbody>
        {#each engagements as e (e.corp_engagement_id)}
          <tr class:archived={e.is_archived}>
            <td>{e.engagement_date ?? '—'}</td>
            <td>
              <a href="/corp/engagements/{e.corp_engagement_id}">
                {e.title ?? '(untitled)'}
              </a>
            </td>
            <td>{typeLabel[e.engagement_type] ?? e.engagement_type}</td>
            <td>{pipelineLabel[e.pipeline_status] ?? '—'}</td>
            <td>{contractLabel[e.contract_status] ?? '—'}</td>
            <td class="num">{fmt(e.amount_paid)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>
</div>

<style>
  .container { max-width: 1200px; margin: 0 auto; padding: 2rem; }
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; }
  .back { font-size: 0.85rem; color: #555; text-decoration: none; display: block; margin-bottom: 0.25rem; }
  .back:hover { text-decoration: underline; }
  h1 { margin: 0 0 0.1rem; }
  .sub { margin: 0; color: #666; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
  .info-block h3 { margin: 0 0 0.75rem; font-size: 0.95rem; color: #444; text-transform: uppercase; letter-spacing: 0.05em; }
  dl { display: grid; grid-template-columns: 120px 1fr; gap: 0.4rem 1rem; font-size: 0.9rem; margin: 0; }
  dt { color: #666; font-weight: 500; }
  dd { margin: 0; }
  .edit-form { margin-bottom: 2rem; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1.5rem; margin-bottom: 1rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #555; }
  input { padding: 0.35rem 0.6rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }
  .section { margin-top: 2rem; }
  .section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }
  h2 { margin: 0; font-size: 1.1rem; }
  table { width: 100%; border-collapse: collapse; font-size: 0.9rem; }
  th, td { padding: 0.5rem 0.75rem; text-align: left; border-bottom: 1px solid #eee; }
  th { background: #f8f8f8; font-weight: 600; }
  .num { text-align: right; }
  tr.archived td { color: #999; }
  a { color: inherit; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .btn-primary { padding: 0.4rem 1rem; background: #2563eb; color: white; border-radius: 4px; text-decoration: none; font-size: 0.9rem; border: none; cursor: pointer; }
  .btn-primary.small { font-size: 0.8rem; padding: 0.3rem 0.75rem; }
  .btn-secondary { padding: 0.4rem 1rem; background: white; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; cursor: pointer; }
  .empty { color: #888; font-style: italic; }
</style>