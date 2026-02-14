<!-- src/routes/hsi/registrations/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Chart from 'chart.js/auto';

  /**
   * @typedef {Object} FunnelData
   * @property {number} ct1_total
   * @property {number} ct1_to_ct2
   * @property {number} ct1_not_ct2
   * @property {number} ct2_total
   * @property {number} ct2_to_ct3
   * @property {number} ct2_not_ct3
   * @property {number} ct3_total
   * @property {number} ct3_to_agt1
   * @property {number} ct3_not_agt1
   * @property {number} agt1_total
   */

  /**
   * @typedef {Object} MonthlyFunnelRecord
   * @property {string} class_code
   * @property {string} reg_month
   * @property {number} did_not_continue
   * @property {number} continued
   */

  /** @type {{ funnel: FunnelData | null, monthlyFunnel: MonthlyFunnelRecord[] }} */
  export let data;

  /** @type {Record<string, Chart>} */
  let charts = {};
  let mounted = false;
  /** @type {string | number} */
  let selectedYear = 'all';

  onMount(() => {
    mounted = true;
  });

  // Available years from monthly data
  $: availableYears = (() => {
    if (!data.monthlyFunnel || data.monthlyFunnel.length === 0) return [];
    const years = [...new Set(data.monthlyFunnel.map(r => {
      return new Date(r.reg_month + 'T12:00:00').getFullYear();
    }))].filter(y => y >= 2012 && y <= 2027);
    return years.sort((a, b) => b - a);
  })();

  // Filter monthly data by year
  $: filteredMonthly = (() => {
    if (!data.monthlyFunnel) return [];
    if (selectedYear === 'all') return data.monthlyFunnel;
    return data.monthlyFunnel.filter(r => {
      const year = new Date(r.reg_month + 'T12:00:00').getFullYear();
      return year === Number(selectedYear);
    });
  })();

  // Process monthly data for charts
  $: monthlyChartData = (() => {
    if (!filteredMonthly || filteredMonthly.length === 0) {
      return { ct1: { labels: [], stopped: [], continued: [] }, ct2: { labels: [], stopped: [], continued: [] }, ct3: { labels: [], stopped: [], continued: [] } };
    }

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    /**
     * @param {string} classCode
     */
    function buildMonthlyData(classCode) {
      const classData = filteredMonthly.filter(r => r.class_code === classCode);
      
      if (selectedYear === 'all') {
        // Group by year-month
        const sorted = classData.sort((a, b) => a.reg_month.localeCompare(b.reg_month));
        return {
          labels: sorted.map(r => {
            const d = new Date(r.reg_month + 'T12:00:00');
            return months[d.getMonth()] + ' ' + d.getFullYear();
          }),
          stopped: sorted.map(r => r.did_not_continue),
          continued: sorted.map(r => r.continued)
        };
      } else {
        // Group by month within selected year
        const byMonth = Array(12).fill(null).map(() => ({ stopped: 0, continued: 0 }));
        classData.forEach(r => {
          const month = new Date(r.reg_month + 'T12:00:00').getMonth();
          byMonth[month].stopped += r.did_not_continue;
          byMonth[month].continued += r.continued;
        });
        return {
          labels: months,
          stopped: byMonth.map(m => m.stopped),
          continued: byMonth.map(m => m.continued)
        };
      }
    }

    return {
      ct1: buildMonthlyData('CT1'),
      ct2: buildMonthlyData('CT2'),
      ct3: buildMonthlyData('CT3')
    };
  })();

  /**
   * @param {string} canvasId
   * @param {import('chart.js').ChartConfiguration} config
   */
  function createChart(canvasId, config) {
    if (!browser || !mounted) return;
    const ctx = /** @type {HTMLCanvasElement | null} */ (document.getElementById(canvasId));
    if (!ctx) return;
    if (charts[canvasId]) {
      charts[canvasId].destroy();
    }
    charts[canvasId] = new Chart(ctx, config);
  }

  $: if (browser && mounted && data.funnel) {
    const funnel = data.funnel;
    setTimeout(() => {
      // Overall funnel chart
      createChart('funnelChart', {
        type: 'bar',
        data: {
          labels: ['CT1 → CT2', 'CT2 → CT3', 'CT3 → AGT1'],
          datasets: [
            {
              label: 'Did Not Continue',
              data: [funnel.ct1_not_ct2, funnel.ct2_not_ct3, funnel.ct3_not_agt1],
              backgroundColor: '#ef4444'
            },
            {
              label: 'Continued',
              data: [funnel.ct1_to_ct2, funnel.ct2_to_ct3, funnel.ct3_to_agt1],
              backgroundColor: '#10b981'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Student Progression Funnel (All Time)' }
          },
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true }
          }
        }
      });

      // Conversion rate chart
      const ct1Rate = funnel.ct1_total > 0 ? (funnel.ct1_to_ct2 / funnel.ct1_total * 100) : 0;
      const ct2Rate = funnel.ct2_total > 0 ? (funnel.ct2_to_ct3 / funnel.ct2_total * 100) : 0;
      const ct3Rate = funnel.ct3_total > 0 ? (funnel.ct3_to_agt1 / funnel.ct3_total * 100) : 0;

      createChart('conversionChart', {
        type: 'bar',
        data: {
          labels: ['CT1 → CT2', 'CT2 → CT3', 'CT3 → AGT1'],
          datasets: [{
            label: 'Conversion Rate',
            data: [ct1Rate, ct2Rate, ct3Rate],
            backgroundColor: ['#3b82f6', '#8b5cf6', '#f59e0b']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Conversion Rate Between Levels (%)' },
            tooltip: {
              callbacks: {
                label: function(/** @type {any} */ context) {
                  return context.parsed.y.toFixed(1) + '%';
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              max: 100,
              ticks: {
                callback: function(/** @type {any} */ value) { return value + '%'; }
              }
            }
          }
        }
      });
    }, 100);
  }

  // Monthly charts - reactive to year filter
  $: if (browser && mounted && monthlyChartData) {
    setTimeout(() => {
      const yearLabel = selectedYear === 'all' ? 'All Time' : selectedYear;

      // CT1 monthly
      createChart('monthlyCT1Chart', {
        type: 'bar',
        data: {
          labels: monthlyChartData.ct1.labels,
          datasets: [
            {
              label: 'Did Not Take CT2',
              data: monthlyChartData.ct1.stopped,
              backgroundColor: '#ef4444'
            },
            {
              label: 'Continued to CT2',
              data: monthlyChartData.ct1.continued,
              backgroundColor: '#10b981'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: `CT1 Students - Continued to CT2 (${yearLabel})` }
          },
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true }
          }
        }
      });

      // CT2 monthly
      createChart('monthlyCT2Chart', {
        type: 'bar',
        data: {
          labels: monthlyChartData.ct2.labels,
          datasets: [
            {
              label: 'Did Not Take CT3',
              data: monthlyChartData.ct2.stopped,
              backgroundColor: '#ef4444'
            },
            {
              label: 'Continued to CT3',
              data: monthlyChartData.ct2.continued,
              backgroundColor: '#10b981'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: `CT2 Students - Continued to CT3 (${yearLabel})` }
          },
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true }
          }
        }
      });

      // CT3 monthly
      createChart('monthlyCT3Chart', {
        type: 'bar',
        data: {
          labels: monthlyChartData.ct3.labels,
          datasets: [
            {
              label: 'Did Not Take AGT1',
              data: monthlyChartData.ct3.stopped,
              backgroundColor: '#ef4444'
            },
            {
              label: 'Continued to AGT1',
              data: monthlyChartData.ct3.continued,
              backgroundColor: '#10b981'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: `CT3 Students - Continued to AGT1 (${yearLabel})` }
          },
          scales: {
            x: { stacked: true },
            y: { stacked: true, beginAtZero: true }
          }
        }
      });
    }, 150);
  }
</script>

<svelte:head>
  <title>Registration Funnel | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <div>
      <h1>Registration Funnel</h1>
      <p class="subtitle">Student progression through class levels</p>
    </div>
    <a href="/hsi" class="btn-secondary">Back to Classes</a>
  </header>

  {#if browser && mounted && data.funnel}
    <!-- Summary Cards -->
    <div class="summary-cards">
      <div class="card">
        <div class="card-label">CT1 Students</div>
        <div class="card-value">{data.funnel.ct1_total}</div>
      </div>
      <div class="card">
        <div class="card-label">CT2 Students</div>
        <div class="card-value">{data.funnel.ct2_total}</div>
      </div>
      <div class="card">
        <div class="card-label">CT3 Students</div>
        <div class="card-value">{data.funnel.ct3_total}</div>
      </div>
      <div class="card">
        <div class="card-label">AGT1 Students</div>
        <div class="card-value">{data.funnel.agt1_total}</div>
      </div>
    </div>

    <!-- Overall Funnel Section -->
    <section class="chart-section">
      <h2 class="section-title">Overall Progression</h2>

      <div class="charts-grid">
        <div class="chart-card">
          <canvas id="funnelChart"></canvas>
        </div>
        <div class="chart-card">
          <canvas id="conversionChart"></canvas>
        </div>
      </div>
    </section>

    <!-- Monthly Breakdown Section -->
    <section class="chart-section">
      <h2 class="section-title">Monthly Breakdown</h2>

      <div class="filter-section">
        <div class="filter-group">
          <label for="yearSelect">Year:</label>
          <select id="yearSelect" bind:value={selectedYear} class="filter-select">
            <option value="all">All Years</option>
            {#each availableYears as year}
              <option value={year}>{year}</option>
            {/each}
          </select>
        </div>
      </div>

      <div class="charts-grid-single">
        <div class="chart-card chart-wide">
          <canvas id="monthlyCT1Chart"></canvas>
        </div>
        <div class="chart-card chart-wide">
          <canvas id="monthlyCT2Chart"></canvas>
        </div>
        <div class="chart-card chart-wide">
          <canvas id="monthlyCT3Chart"></canvas>
        </div>
      </div>
    </section>
  {:else}
    <div class="loading">Loading charts...</div>
  {/if}
</div>

<style>
  .container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 2rem;
  }

  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 2rem;
  }

  h1 {
    font-size: 2rem;
    font-weight: 700;
    color: #1a202c;
    margin: 0 0 0.5rem 0;
  }

  .subtitle {
    color: #6b7280;
    margin: 0;
  }

  .summary-cards {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1.5rem;
    margin-bottom: 2rem;
  }

  .card {
    background: white;
    padding: 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    text-align: center;
  }

  .card-label {
    font-size: 0.875rem;
    font-weight: 600;
    color: #6b7280;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .card-value {
    font-size: 2rem;
    font-weight: 700;
    color: #1a202c;
  }

  .chart-section {
    margin-bottom: 3rem;
  }

  .section-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1a202c;
    margin: 0 0 1rem 0;
  }

  .filter-section {
    background: white;
    padding: 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
  }

  .filter-group {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .filter-group label {
    font-weight: 600;
    color: #374151;
    white-space: nowrap;
  }

  .filter-select {
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 1rem;
    min-width: 200px;
    background-color: white;
  }

  .filter-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }

  .charts-grid-single {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
  }

  .chart-card {
    background: white;
    padding: 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    height: 400px;
  }

  .chart-wide {
    height: 350px;
  }

  canvas {
    max-height: 100%;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #6b7280;
    font-size: 1.125rem;
  }

  .btn-secondary {
    background-color: #e5e7eb;
    color: #374151;
    padding: 0.75rem 1.5rem;
    border-radius: 0.5rem;
    border: none;
    font-weight: 500;
    font-size: 1rem;
    cursor: pointer;
    text-decoration: none;
    display: inline-block;
    transition: background-color 0.2s;
  }

  .btn-secondary:hover {
    background-color: #d1d5db;
  }

  @media (max-width: 1024px) {
    .summary-cards {
      grid-template-columns: repeat(2, 1fr);
    }

    .charts-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 768px) {
    .summary-cards {
      grid-template-columns: 1fr;
    }
  }
</style>