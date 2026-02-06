<!-- src/routes/+layout.svelte -->
<script>
  import './app.css';
</script>

<div class="app">
  <nav>
    <div class="nav-content">
      <a href="/" class="logo">B&C Financial Tracker</a>
      <div class="nav-links">
        <a href="/hsi">HSI Classes</a>
        <!-- Add more links as you build other sections -->
      </div>
    </div>
  </nav>
  
  <main>
    <slot />
  </main>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
    background-color: #f9fafb;
  }
  
  .app {
    min-height: 100vh;
  }
  
  nav {
    background-color: white;
    border-bottom: 1px solid #e5e7eb;
    padding: 1rem 0;
  }
  
  .nav-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .logo {
    font-size: 1.25rem;
    font-weight: 700;
    color: #1a202c;
    text-decoration: none;
  }
  
  .nav-links {
    display: flex;
    gap: 2rem;
  }
  
  .nav-links a {
    color: #4b5563;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
  }
  
  .nav-links a:hover {
    color: #1a202c;
  }
  
  main {
    min-height: calc(100vh - 80px);
  }
</style>