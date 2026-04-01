<!-- src/routes/+layout.svelte -->
<script>
	import { page } from '$app/stores';
	import { resolve } from '$app/paths';
	import { hasPermission, canView, canDataEntry, canManage } from '$lib/permissions';
	import { afterNavigate } from '$app/navigation';
	import { onDestroy } from 'svelte';

	/** @type {any} */
	export let data;

	$: user = data?.user || $page.data?.user;

	// Manual store subscription — bypasses Svelte 5 auto-subscription issues
	let currentPath = '';
	const unsubscribePage = page.subscribe(($p) => {
		if ($p?.url?.pathname) currentPath = $p.url.pathname;
	});
	onDestroy(unsubscribePage);

	afterNavigate(({ to }) => {
		if (to?.url) currentPath = to.url.pathname;
	});

	// Toggle this to true to keep all nav sections expanded at all times
	const NAV_ALWAYS_EXPANDED = true;

	/**
	 * @typedef {{ label: string, href: string }} NavLink
	 * @typedef {{ tier: string, links: NavLink[] }} NavTier
	 * @typedef {{ id: string, label: string, fullName: string, icon: string, basePath: string, area: string, tiers: NavTier[] }} AreaSection
	 */

	/** @type {AreaSection[]} */
	const areaSections = [
		{
			id: 'hsi', label: 'HSI', fullName: 'Houston School of Improv', icon: '🎭',
			basePath: '/hsi', area: 'hsi',
			tiers: [
				{ tier: 'viewer', links: [
					{ label: 'Teachers', href: '/hsi/teachers' },
					{ label: 'Classes', href: '/hsi/classes' },
					{ label: 'Tracks', href: '/hsi/tracks' },
					{ label: 'Students', href: '/hsi/students' },
					{ label: 'Student Surveys', href: '/hsi/student_surveys' },
				]},
				{ tier: 'data_entry', links: [
					{ label: 'Enter Registrations', href: '/hsi/enter_class_registrations' },
					{ label: 'Update Student Phone', href: '/hsi/update_student_phone' },
					{ label: 'Enter Monthly Summary', href: '/hsi/enter_monthly_summary' },
				]},
				{ tier: 'manager', links: [
					{ label: 'Class Reports', href: '/hsi/reports' },
					{ label: 'Registration Funnel', href: '/hsi/registrations' },
					{ label: 'Geo Analytics', href: '/hsi/reports/student_geo_analytics' },
					{ label: 'Student ZIP Demographics', href: '/hsi/student_zip_demographics' },
				]},
				{ tier: 'admin', links: [
					{ label: 'Workflow Settings', href: '/hsi/workflows' },
				]},
			]
		},
		{
			id: 'gft', label: 'GFT', fullName: 'Good Friends Theater', icon: '🎪',
			basePath: '/gft', area: 'gft',
			tiers: [
				{ tier: 'viewer', links: [
					{ label: 'Shows', href: '/gft/shows' },
					{ label: 'Patrons', href: '/gft/patrons' },
					{ label: 'Ticket Purchases', href: '/gft/ticket_purchases' },
				]},
				{ tier: 'data_entry', links: [
					{ label: 'Enter Ticket Purchases', href: '/gft/ticket_purchases/enter_ticket_purchases' },
					{ label: 'Enter Monthly Summary', href: '/gft/enter_monthly_summary' },
				]},
				{ tier: 'manager', links: [
					{ label: 'Show Reports', href: '/gft/reports' },
					{ label: 'Combined Reporting', href: '/gft/reports/2026/combined_reporting' },
					{ label: 'Patron ZIP Analytics', href: '/gft/patrons/zip_analytics' },
				]},
				{ tier: 'admin', links: [
					{ label: 'Sync VBO Account IDs', href: '/data/sync_account_data' },
				]},
			]
		},
		{
			id: 'corp', label: 'Corp', fullName: 'Corporate', icon: '💼',
			basePath: '/corp', area: 'corp',
			tiers: [
				{ tier: 'viewer', links: [
					{ label: 'Companies', href: '/corp/companies' },
					{ label: 'Contacts', href: '/corp/contacts' },
					{ label: 'Engagements', href: '/corp/engagements' },
				]},
				{ tier: 'data_entry', links: [
					{ label: 'Import', href: '/corp/import' },
					{ label: 'Dedupe Contacts', href: '/corp/dedupe_contacts' },
					{ label: 'Dedupe Companies', href: '/corp/dedupe_companies' },
				]},
				{ tier: 'manager', links: [
					{ label: 'Corp Reports', href: '/corp/reports' },
				]},
				{ tier: 'admin', links: [
					{ label: 'Workflow Settings', href: '/corp/workflows' },
					{ label: 'Company Lookup', href: '/corp/website_sync' },
				]},
			]
		},
		{
			id: 'reviews', label: 'Reviews', fullName: 'Customer Reviews', icon: '⭐',
			basePath: '/reviews', area: 'hsi',
			tiers: [
				{ tier: 'viewer', links: [
					{ label: 'All Reviews', href: '/reviews' },
				]},
			]
		},
		{
			id: 'csz', label: 'CSz', fullName: 'ComedySportz Houston', icon: '⚡',
			basePath: '/csz', area: 'csz',
			tiers: [
				{ tier: 'viewer', links: [
					{ label: 'Coming Soon', href: '#' },
				]},
			]
		},
	];

	// Platform-wide admin section (super admin only)
	const platformAdminLinks = [
		{ label: 'View Users', href: '/admin/users' },
		{ label: 'Add Users', href: '/admin/users/new' },
		{ label: 'Audit Logs', href: '/admin/audit-log' },
	];

	// Tier labels for rendering sub-headers
	const TIER_LABELS = {
		viewer:     'Core',
		data_entry: 'Data Entry',
		manager:    'Reports',
		admin:      'Admin',
	};

	// Permission level required to see each tier
	const TIER_REQUIRED_LEVEL = {
		viewer:     'viewer',
		data_entry: 'data_entry',
		manager:    'manager',
		admin:      'manager',  // area admin visible to managers
	};

	/** @type {Record<string, boolean>} */
	let expandedSections = {};
	let adminExpanded = NAV_ALWAYS_EXPANDED;

	// Auto-expand
	$: {
		const path = currentPath;
		let changed = false;
		areaSections.forEach((section) => {
			if ((NAV_ALWAYS_EXPANDED || path.startsWith(section.basePath)) && !expandedSections[section.id]) {
				expandedSections[section.id] = true;
				changed = true;
			}
		});
		if (NAV_ALWAYS_EXPANDED || path.startsWith('/admin')) {
			adminExpanded = true;
		}
		if (changed) expandedSections = expandedSections;
	}

	/** @param {string} id */
	function toggleSection(id) {
		expandedSections[id] = !expandedSections[id];
		expandedSections = expandedSections;
	}

	function toggleAdmin() {
		adminExpanded = !adminExpanded;
	}

	/**
	 * Check if the current user can see an area at all.
	 * @param {AreaSection} section
	 */
	function canSeeArea(section) {
		if (!user) return false;
		if (user.is_super_admin) return true;
		return canView(user, section.area);
	}

	/**
	 * Check if the current user can see a tier within an area.
	 * @param {string} area
	 * @param {string} tier
	 */
	function canSeeTier(area, tier) {
		if (!user) return false;
		if (user.is_super_admin) return true;
		const requiredLevel = TIER_REQUIRED_LEVEL[tier] || 'viewer';
		return hasPermission(user, area, requiredLevel);
	}

	/** @type {AreaSection[]} */
	$: visibleAreas = areaSections.filter(s => canSeeArea(s));

	let sidebarCollapsed = false;
</script>

<div class="app-layout" class:sidebar-collapsed={sidebarCollapsed}>
	<!-- Sidebar -->
	<aside class="sidebar">
		<div class="sidebar-header">
			<a href={resolve('/')} class="logo-link">
				{#if !sidebarCollapsed}
					<span class="logo-text">B&C Entertainment</span>
					<span class="logo-sub">Financial Tracker</span>
				{:else}
					<span class="logo-text-sm">B&C</span>
				{/if}
			</a>
			<button
				class="collapse-btn"
				on:click={() => (sidebarCollapsed = !sidebarCollapsed)}
				title={sidebarCollapsed ? 'Expand' : 'Collapse'}
			>
				{sidebarCollapsed ? '→' : '←'}
			</button>
		</div>

		<nav class="sidebar-nav">
			{#each visibleAreas as section (section.id)}
				<div class="nav-section" class:active={currentPath.startsWith(section.basePath)}>
					<button
						class="nav-section-header"
						class:expanded={expandedSections[section.id]}
						on:click={() => toggleSection(section.id)}
						title={sidebarCollapsed ? section.fullName : ''}
					>
						<span class="nav-icon">{section.icon}</span>
						{#if !sidebarCollapsed}
							<span class="nav-label">{section.label}</span>
							<span class="nav-full-name">{section.fullName}</span>
							<span class="nav-chevron">{expandedSections[section.id] ? '▾' : '›'}</span>
						{/if}
					</button>

					{#if expandedSections[section.id] && !sidebarCollapsed}
						{#each section.tiers as t (t.tier)}
							{#if canSeeTier(section.area, t.tier) && t.links.length > 0}
								<div class="tier-label">{TIER_LABELS[t.tier] || t.tier}</div>
								<ul class="nav-children">
									{#each t.links as link (link.href)}
										<li>
											<a
												href={link.href}
												data-sveltekit-reload
												class="nav-child-link"
												class:active={link.href !== '#' && (currentPath === link.href || currentPath.startsWith(link.href + '/'))}
												class:disabled={link.href === '#'}
											>
												{link.label}
											</a>
										</li>
									{/each}
								</ul>
							{/if}
						{/each}
					{/if}
				</div>
			{/each}

			<!-- Logout -->
			<div class="nav-section">
				<a href="/logout" data-sveltekit-reload class="nav-section-header logout-link">
					<span class="nav-icon">🚪</span>
					{#if !sidebarCollapsed}
						<span class="nav-label">Logout</span>
					{/if}
				</a>
			</div>

			<!-- Platform Admin (super admins only) -->
			{#if user?.is_super_admin}
				{#if !sidebarCollapsed}
					<div class="nav-divider"></div>
				{/if}

				<div class="nav-section" class:active={currentPath.startsWith('/admin')}>
					<button
						class="nav-section-header"
						class:expanded={adminExpanded}
						on:click={toggleAdmin}
						title={sidebarCollapsed ? 'Admin' : ''}
					>
						<span class="nav-icon">⚙️</span>
						{#if !sidebarCollapsed}
							<span class="nav-label">Admin</span>
							<span class="nav-full-name">Platform</span>
							<span class="nav-chevron">{adminExpanded ? '▾' : '›'}</span>
						{/if}
					</button>

					{#if adminExpanded && !sidebarCollapsed}
						<ul class="nav-children">
							{#each platformAdminLinks as link (link.href)}
								<li>
									<a
										href={link.href}
										data-sveltekit-reload
										class="nav-child-link"
										class:active={currentPath === link.href || currentPath.startsWith(link.href + '/')}
									>
										{link.label}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/if}
		</nav>
	</aside>

	<!-- Main Content -->
	<main class="main-content">
		<slot />

	</main>
</div>

<style>
	:global(*) {
		box-sizing: border-box;
		margin: 0;
		padding: 0;
	}

	:global(body) {
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
		background-color: #f3f4f6;
		color: #1a202c;
	}

	.app-layout {
		display: flex;
		min-height: 100vh;
	}

	/* Sidebar */
	.sidebar {
		width: 260px;
		background-color: #1e293b;
		color: #e2e8f0;
		display: flex;
		flex-direction: column;
		flex-shrink: 0;
		transition: width 0.2s ease;
		overflow-y: auto;
		position: sticky;
		top: 0;
		height: 100vh;
	}

	.sidebar-collapsed .sidebar {
		width: 64px;
	}

	.sidebar-header {
		padding: 1.25rem 1rem;
		border-bottom: 1px solid #334155;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}

	.logo-link {
		text-decoration: none;
		color: white;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.logo-text {
		font-size: 1.1rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.logo-text-sm {
		font-size: 1.1rem;
		font-weight: 700;
	}

	.logo-sub {
		font-size: 0.7rem;
		color: #94a3b8;
		text-transform: uppercase;
		letter-spacing: 0.1em;
		white-space: nowrap;
	}

	.collapse-btn {
		background: none;
		border: none;
		color: #94a3b8;
		font-size: 1rem;
		cursor: pointer;
		padding: 0.25rem;
		border-radius: 0.25rem;
		flex-shrink: 0;
	}

	.collapse-btn:hover {
		color: white;
		background-color: #334155;
	}

	/* Navigation */
	.sidebar-nav {
		padding: 0.75rem 0;
		flex: 1;
	}

	.nav-section {
		margin-bottom: 0.25rem;
	}

	.nav-section.active > .nav-section-header {
		background-color: #334155;
	}

	.nav-section-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		width: 100%;
		padding: 0.625rem 1rem;
		border: none;
		background: none;
		color: #cbd5e1;
		font-size: 0.9rem;
		cursor: pointer;
		text-align: left;
		transition: background-color 0.15s;
	}

	.nav-section-header:hover {
		background-color: #334155;
		color: white;
	}

	.nav-icon {
		font-size: 1.1rem;
		flex-shrink: 0;
		width: 1.5rem;
		text-align: center;
	}

	.nav-label {
		font-weight: 600;
		white-space: nowrap;
	}

	.nav-full-name {
		font-size: 0.75rem;
		color: #64748b;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
		flex: 1;
	}

	.nav-chevron {
		font-size: 0.8rem;
		color: #64748b;
		flex-shrink: 0;
		margin-left: auto;
	}

	.tier-label {
		padding: 0.3rem 1rem 0.15rem 3.25rem;
		font-size: 0.65rem;
		font-weight: 600;
		color: #64748b;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		margin-top: 0.35rem;
	}

	.nav-children {
		list-style: none;
		padding: 0.1rem 0;
	}

	.logout-link {
		text-decoration: none;
		color: #cbd5e1;
	}

	.nav-child-link {
		display: block;
		padding: 0.4rem 1rem 0.4rem 3.25rem;
		color: #94a3b8;
		text-decoration: none;
		font-size: 0.85rem;
		transition: all 0.15s;
		border-left: 2px solid transparent;
	}

	.nav-child-link:hover {
		color: white;
		background-color: #334155;
	}

	.nav-child-link.active {
		color: #60a5fa;
		background-color: #1e3a5f;
		border-left-color: #3b82f6;
		font-weight: 500;
	}

	.nav-child-link.disabled {
		color: #475569;
		cursor: not-allowed;
		pointer-events: none;
	}

	/* Divider */
	.nav-divider {
		height: 1px;
		background-color: #334155;
		margin: 0.75rem 1rem;
	}


	/* Main Content */
	.main-content {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
	}

	/* Responsive */
	@media (max-width: 768px) {
		.sidebar {
			width: 64px;
		}

		.sidebar .nav-label,
		.sidebar .nav-full-name,
		.sidebar .nav-chevron,
		.sidebar .nav-children,
		.sidebar .logo-text,
		.sidebar .logo-sub,
		.sidebar .nav-divider,
		.sidebar .admin-subsections {
			display: none;
		}

		.sidebar .logo-text-sm {
			display: inline;
		}
	}
</style>