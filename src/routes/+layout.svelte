<!-- src/routes/+layout.svelte -->
<script>
	import { page } from '$app/stores';
	import { base } from '$app/paths';

	// Navigation structure
	const navSections = [
		{
			id: 'hsi',
			label: 'HSI',
			fullName: 'Houston School of Improv',
			icon: '🎭',
			basePath: '/hsi',
			children: [
				{ label: 'Classes', href: '/hsi/classes' },
				{ label: 'Students', href: '/hsi/students' },
				{ label: 'Teachers', href: '/hsi/teachers' },
				{ label: 'Enter Registrations', href: '/hsi/enter_class_registrations' },
				{ label: 'Registration Funnel', href: '/hsi/registrations' },
				{ label: 'Enter Monthly Summary', href: '/hsi/enter_monthly_summary' },
				{ label: 'Class Financial Reports', href: '/hsi/reports' }
				
			]
		},
		{
			id: 'gft',
			label: 'GFT',
			fullName: 'Good Friends Theater',
			icon: '🎪',
			basePath: '/shows',
			children: [
				{ label: 'Shows', href: '/shows' },
				{ label: 'Patrons', href: '/shows/patrons' },
				{ label: 'Ticket Purchases', href: '/shows/ticket_purchases' },
				{ label: 'Enter New Shows', href: '/shows/enter_new_shows' },
				{ label: 'Enter Ticket Purchases', href: '/shows/ticket_purchases/enter_ticket_purchases' },
				{ label: 'Enter Monthly Summary', href: '/shows/enter_monthly_summary' },
				{ label: 'Shows Financial Reports', href: '/shows/reports' }
			]
		},
		{
			id: 'csz',
			label: 'CSz',
			fullName: 'ComedySportz Houston',
			icon: '⚡',
			basePath: '/csz',
			children: [{ label: 'Coming Soon', href: '#' }]
		},
		{
			id: 'corp',
			label: 'Corp',
			fullName: 'Corporate',
			icon: '💼',
			basePath: '/corp',
			children: [{ label: 'Coming Soon', href: '#' }]
		}
	];

	// Admin sub-sections (each expandable independently)
	const adminSubSections = [
		{
			id: 'admin-hsi',
			label: 'HSI',
			basePath: '/admin/hsi',
			children: 
			[
				{ label: 'Promotions', href: '/promotions' }	
			
			]
		},
		{
			id: 'admin-gft',
			label: 'GFT',
			basePath: '/admin/gft',
			children: [{ label: 'Coming Soon', href: '#' }]
		},
		{
			id: 'admin-csz',
			label: 'CSz',
			basePath: '/admin/csz',
			children: [{ label: 'Coming Soon', href: '#' }]
		},
		{
			id: 'admin-corp',
			label: 'Corp',
			basePath: '/admin/corp',
			children: [{ label: 'Coming Soon', href: '#' }]
		}
	];

	// Track which sections are expanded (covers both main nav + admin sub-sections)
	/** @type {Record<string, boolean>} */
	let expandedSections = {};

	// Whether the admin parent group is expanded
	let adminExpanded = false;

	// Auto-expand the section matching the current path
	$: {
		const path = $page.url.pathname;
		navSections.forEach((section) => {
			if (path.startsWith(section.basePath)) {
				expandedSections[section.id] = true;
			}
		});
		// Auto-expand admin if path starts with /admin
		if (path.startsWith('/admin')) {
			adminExpanded = true;
			adminSubSections.forEach((sub) => {
				if (path.startsWith(sub.basePath)) {
					expandedSections[sub.id] = true;
				}
			});
		}
	}

	/** @param {string} id */
	function toggleSection(id) {
		expandedSections[id] = !expandedSections[id];
		expandedSections = expandedSections; // trigger reactivity
	}

	function toggleAdmin() {
		adminExpanded = !adminExpanded;
	}

	/** @param {string} href */
	function isActive(href) {
		return $page.url.pathname === href;
	}

	/** @param {string} basePath */
	function isSectionActive(basePath) {
		return $page.url.pathname.startsWith(basePath);
	}

	let sidebarCollapsed = false;
</script>

<div class="app-layout" class:sidebar-collapsed={sidebarCollapsed}>
	<!-- Sidebar -->
	<aside class="sidebar">
		<div class="sidebar-header">
			<a href="{base}/" class="logo-link">
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
			{#each navSections as section (section.id)}
				<div class="nav-section" class:active={isSectionActive(section.basePath)}>
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
						<ul class="nav-children">
							{#each section.children as child, i (i)}
								<li>
									<a
										href="{base}{child.href}"
										class="nav-child-link"
										class:active={isActive(child.href)}
										class:disabled={child.href === '#'}
									>
										{child.label}
									</a>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}

			<!-- Divider -->
			{#if !sidebarCollapsed}
				<div class="nav-divider"></div>
			{/if}

			<!-- Admin Section -->
			<div class="nav-section" class:active={isSectionActive('/admin')}>
				<button
					class="nav-section-header"
					class:expanded={adminExpanded}
					on:click={toggleAdmin}
					title={sidebarCollapsed ? 'Admin' : ''}
				>
					<span class="nav-icon">⚙️</span>
					{#if !sidebarCollapsed}
						<span class="nav-label">Admin</span>
						<span class="nav-full-name">Administration</span>
						<span class="nav-chevron">{adminExpanded ? '▾' : '›'}</span>
					{/if}
				</button>

				{#if adminExpanded && !sidebarCollapsed}
					<div class="admin-subsections">
						{#each adminSubSections as sub (sub.id)}
							<div class="admin-sub">
								<button
									class="admin-sub-header"
									class:expanded={expandedSections[sub.id]}
									class:active={isSectionActive(sub.basePath)}
									on:click={() => toggleSection(sub.id)}
								>
									<span class="admin-sub-label">{sub.label}</span>
									<span class="admin-sub-chevron">{expandedSections[sub.id] ? '▾' : '›'}</span>
								</button>

								{#if expandedSections[sub.id]}
									<ul class="nav-children admin-children">
										{#each sub.children as child, i (i)}
											<li>
												<a
													href="{base}{child.href}"
													class="nav-child-link"
													class:active={isActive(child.href)}
													class:disabled={child.href === '#'}
												>
													{child.label}
												</a>
											</li>
										{/each}
									</ul>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
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

	.nav-children {
		list-style: none;
		padding: 0.25rem 0;
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

	/* Admin Sub-sections */
	.admin-subsections {
		padding: 0.25rem 0;
	}

	.admin-sub {
		margin-bottom: 0.1rem;
	}

	.admin-sub-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: 100%;
		padding: 0.35rem 1rem 0.35rem 3.25rem;
		border: none;
		background: none;
		color: #94a3b8;
		font-size: 0.85rem;
		cursor: pointer;
		text-align: left;
		transition: all 0.15s;
	}

	.admin-sub-header:hover {
		color: white;
		background-color: #334155;
	}

	.admin-sub-header.active {
		color: #cbd5e1;
	}

	.admin-sub-header.expanded {
		color: #e2e8f0;
	}

	.admin-sub-label {
		font-weight: 500;
	}

	.admin-sub-chevron {
		font-size: 0.75rem;
		color: #64748b;
	}

	.admin-children .nav-child-link {
		padding-left: 4.25rem;
		font-size: 0.8rem;
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