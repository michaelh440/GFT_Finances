<!-- src/routes/corp/engagements/[id]/+page.svelte -->
<script>
  import { enhance } from '$app/forms';
  /** @type {any} */
  export let data;

  let editing = false;
  let { engagement: e, contacts } = data;

  const fmt = (/** @type {any} */ n) => n == null ? '—' : '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2 });

  const TYPES = [
    ['corporate_training', 'Corporate Training'],
    ['private_show_gft',   'Private Show @ GFT'],
    ['roadshow',           'Roadshow'],
    ['space_rental',       'Space Rental'],
    ['school_nonprofit',   'School / Nonprofit'],
    ['other',              'Other'],
  ];

  const PIPELINES = [
    ['none',                 'None'],
    ['lm_emailed',           'LM / Emailed'],
    ['proposal_in_progress', 'Proposal In Progress'],
    ['active_due',           'Active & Due'],
    ['benji_follow_up',      'Benji Follow Up'],
    ['paid_2026',            'Paid 2026'],
  ];

  const CONTRACTS = [
    ['needs_sending', 'Needs Sending'],
    ['sent',          'Sent'],
    ['viewed',        'Viewed'],
    ['signed',        'Signed'],
  ];

  function audienceStr(/** @type {any} */ eng) {
    if (eng.audience_size_min == null) return '—';
    const approx = eng.audience_size_approx ? '~' : '';
    if (eng.audience_size_min === eng.audience_size_max) return approx + eng.audience_size_min;
    return `${eng.audience_size_min}–${eng.audience_size_max}`;
  }
</script>

<div class="page-header">
  <div>
    <a href="/corp/engagements" class="back">← All Engagements</a>
    <h1>{e.title ?? '(untitled)'}</h1>
    {#if e.company_name}
      <p class="sub">
        <a href="/corp/contacts/{e.corp_contact_id}">{e.company_name}</a>
        {#if e.first_name || e.last_name}
          · {[e.first_name, e.last_name].filter(Boolean).join(' ')}
        {/if}
      </p>
    {/if}
  </div>
  <div class="header-actions">
    {#if e.is_archived}<span class="badge archived">Archived</span>{/if}
    <button on:click={() => editing = !editing} class="btn-secondary">
      {editing ? 'Cancel' : 'Edit'}
    </button>
  </div>
</div>

{#if editing}
  <form method="POST" action="?/updateEngagement" use:enhance class="edit-form">
    <div class="form-grid">
      <label>Title
        <input name="title" value={e.title ?? ''} />
      </label>
      <label>Company
        <select name="corp_contact_id">
          <option value="">— None —</option>
          {#each contacts as c}
            <option value={c.corp_contact_id} selected={c.corp_contact_id === e.corp_contact_id}>
              {c.company_name ?? [c.first_name, c.last_name].filter(Boolean).join(' ')}
            </option>
          {/each}
        </select>
      </label>
      <label>Engagement Type
        <select name="engagement_type">
          {#each TYPES as [v,l]}
            <option value={v} selected={v === e.engagement_type}>{l}</option>
          {/each}
        </select>
      </label>
      <label>Pipeline Status
        <select name="pipeline_status">
          {#each PIPELINES as [v,l]}
            <option value={v} selected={v === e.pipeline_status}>{l}</option>
          {/each}
        </select>
      </label>
      <label>Contract Status
        <select name="contract_status">
          <option value="">— None —</option>
          {#each CONTRACTS as [v,l]}
            <option value={v} selected={v === e.contract_status}>{l}</option>
          {/each}
        </select>
      </label>
      <label>Engagement Date
        <input type="date" name="engagement_date" value={e.engagement_date ?? ''} />
      </label>
      <label>End Date
        <input type="date" name="end_date" value={e.end_date ?? ''} />
      </label>
      <label>Audience Min
        <input type="number" name="audience_size_min" value={e.audience_size_min ?? ''} />
      </label>
      <label>Audience Max
        <input type="number" name="audience_size_max" value={e.audience_size_max ?? ''} />
      </label>
      <label>Amount Paid
        <input type="number" step="0.01" name="amount_paid" value={e.amount_paid ?? ''} />
      </label>
    </div>
    <label class="checkbox-label">
      <input type="checkbox" name="audience_size_approx" checked={e.audience_size_approx} />
      Audience size is approximate
    </label>
    <label class="checkbox-label">
      <input type="checkbox" name="is_archived" checked={e.is_archived} />
      Archived
    </label>
    <label class="full">Notes
      <textarea name="notes" rows="4">{e.notes ?? ''}</textarea>
    </label>
    <button type="submit" class="btn-primary">Save Changes</button>
  </form>

{:else}
  <div class="info-grid">
    <div class="info-block">
      <h3>Engagement Details</h3>
      <dl>
        <dt>Type</dt>         <dd>{e.engagement_type?.replace(/_/g,' ') ?? '—'}</dd>
        <dt>Date</dt>         <dd>{e.engagement_date ?? '—'}</dd>
        <dt>End Date</dt>     <dd>{e.end_date ?? '—'}</dd>
        <dt>Audience</dt>     <dd>{audienceStr(e)}</dd>
        <dt>Revenue</dt>      <dd>{fmt(e.amount_paid)}</dd>
      </dl>
    </div>
    <div class="info-block">
      <h3>Status</h3>
      <dl>
        <dt>Pipeline</dt>   <dd>{e.pipeline_status?.replace(/_/g,' ') ?? '—'}</dd>
        <dt>Contract</dt>   <dd>{e.contract_status?.replace(/_/g,' ') ?? '—'}</dd>
        <dt>Archived</dt>   <dd>{e.is_archived ? 'Yes' : 'No'}</dd>
      </dl>
    </div>
  </div>

  {#if e.notes}
    <div class="notes-block">
      <h3>Notes</h3>
      <p>{e.notes}</p>
    </div>
  {/if}

  {#if e.dubsado_project_title && e.dubsado_project_title !== e.title}
    <p class="dubsado-ref">Original Dubsado title: <em>{e.dubsado_project_title}</em></p>
  {/if}
{/if}

<style>
  .page-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 1.5rem; }
  .back { font-size: 0.85rem; color: #555; text-decoration: none; display: block; margin-bottom: 0.25rem; }
  .back:hover { text-decoration: underline; }
  h1 { margin: 0 0 0.1rem; }
  .sub { margin: 0; color: #666; font-size: 0.95rem; }
  .sub a { color: #2563eb; text-decoration: none; }
  .sub a:hover { text-decoration: underline; }
  .header-actions { display: flex; align-items: center; gap: 0.75rem; }
  .badge.archived { background: #f3f4f6; color: #6b7280; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.8rem; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.5rem; }
  .info-block h3 { margin: 0 0 0.75rem; font-size: 0.85rem; color: #444; text-transform: uppercase; letter-spacing: 0.05em; }
  dl { display: grid; grid-template-columns: 120px 1fr; gap: 0.4rem 1rem; font-size: 0.9rem; margin: 0; }
  dt { color: #666; font-weight: 500; }
  dd { margin: 0; }
  .notes-block { margin-bottom: 1.5rem; }
  .notes-block h3 { margin: 0 0 0.5rem; font-size: 0.85rem; color: #444; text-transform: uppercase; letter-spacing: 0.05em; }
  .notes-block p { margin: 0; font-size: 0.9rem; line-height: 1.6; }
  .dubsado-ref { font-size: 0.8rem; color: #999; }
  .edit-form { max-width: 800px; }
  .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem 1.5rem; margin-bottom: 1rem; }
  label { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #555; }
  label.full { grid-column: 1 / -1; }
  input, select, textarea { padding: 0.35rem 0.6rem; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; }
  textarea { resize: vertical; }
  .checkbox-label { flex-direction: row; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem; }
  .btn-primary { margin-top: 0.75rem; padding: 0.4rem 1rem; background: #2563eb; color: white; border-radius: 4px; font-size: 0.9rem; border: none; cursor: pointer; }
  .btn-secondary { padding: 0.4rem 1rem; background: white; border: 1px solid #ccc; border-radius: 4px; font-size: 0.9rem; cursor: pointer; }

  @media (max-width: 768px) {
    header { flex-direction: column; align-items: stretch; gap: 0.75rem; }
    .info-grid { grid-template-columns: 1fr; }
    .form-grid { grid-template-columns: 1fr; }
  }
</style>