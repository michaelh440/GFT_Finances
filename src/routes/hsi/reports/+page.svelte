<!-- src/routes/hsi/reports/+page.svelte - Add debugging -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Chart from 'chart.js/auto';

  /**
   * @typedef {Object} ClassItem
   * @property {string} class_code
   * @property {string} class_name
   * @property {string} class_type
   * @property {string} student_type
   * @property {number} standard_price
   * @property {string} track
   * @property {string} description
   * @property {boolean} is_active
   */

  /**
   * @typedef {Object} Summary
   * @property {string} class_code
   * @property {string} summary_month
   * @property {number} summary_year
   * @property {number} registrations
   * @property {number} revenue
   */

  /** @type {{ classes: ClassItem[], summaries: Summary[] }} */
  export let data;

  let selectedClassCode = 'all';
  let selectedTrack = 'all';
  /** @type {Record<string, Chart>} */
  let charts = {};
  let mounted = false;

  // Year filter states
  /** @type {number[]} */
  let availableYears = [];
  /** @type {number[]} */
  let selectedYearsMonthly = [];
  let selectedYearMoM = new Date().getFullYear();
  
  // Debug logs
  $: if (browser) {
    console.log('Total summaries:', data.summaries.length);
    console.log('Sample summaries:', data.summaries.slice(0, 5));
    console.log('Filtered data length:', filteredData.length);
    console.log('Available years:', availableYears);
    console.log('Selected years for monthly:', selectedYearsMonthly);
  }
  
  onMount(() => {
    mounted = true;
  });
  
  // Get unique tracks from data
  $: uniqueTracks = [...new Set(data.classes.map(c => c.track).filter(Boolean))].sort();
  
  $: filteredData = getFilteredData(selectedClassCode, selectedTrack, data.summaries);
  
  // Extract available years from data
  $: {
    if (filteredData && filteredData.length > 0) {
      const years = [...new Set(filteredData.map(s => {
        const year = new Date(s.summary_month).getFullYear();
        return year;
      }))];
      
      availableYears = years.sort((a, b) => b - a);
      
      console.log('Years found in data:', years);
      console.log('Available years sorted:', availableYears);
      
      // Initialize selected years if empty or if available years changed
      if (selectedYearsMonthly.length === 0) {
        // Select up to 4 most recent years to ensure 2026 is included
        selectedYearsMonthly = availableYears.slice(0, Math.min(4, availableYears.length));
        console.log('Initial selected years:', selectedYearsMonthly);
      } else {
        // Make sure selected years still exist in available years
        selectedYearsMonthly = selectedYearsMonthly.filter(y => availableYears.includes(y));
        
        // If we filtered out all years, reset to defaults
        if (selectedYearsMonthly.length === 0) {
          selectedYearsMonthly = availableYears.slice(0, Math.min(4, availableYears.length));
        }
      }
      
      // Ensure selectedYearMoM is valid
      if (!availableYears.includes(selectedYearMoM)) {
        selectedYearMoM = availableYears[0] || new Date().getFullYear();
      }
    }
  }
  
  $: chartData = processChartData(filteredData, selectedYearsMonthly, selectedYearMoM);
  
  /**
   * @param {string} classCode
   * @param {string} trackId
   * @param {Summary[]} summaries
   * @returns {Summary[]}
   */
  function getFilteredData(classCode, trackId, summaries) {
    let filtered = summaries;

    // Filter by class
    if (classCode !== 'all') {
      filtered = filtered.filter(s => s.class_code === classCode);
    }

    // Filter by track
    if (trackId !== 'all') {
      const classCodesInTrack = data.classes
        .filter(c => c.track === trackId)
        .map(c => c.class_code);
      filtered = filtered.filter(s => classCodesInTrack.includes(s.class_code));
    }

    return filtered;
  }

  /**
   * @param {number} year
   */
  function toggleYear(year) {
    if (selectedYearsMonthly.includes(year)) {
      selectedYearsMonthly = selectedYearsMonthly.filter(y => y !== year);
    } else {
      selectedYearsMonthly = [...selectedYearsMonthly, year].sort((a, b) => a - b);
    }
  }

  /**
   * @typedef {Object} MonthData
   * @property {number} registrations
   * @property {number} revenue
   */

  /**
   * @param {Summary[]} summaries
   * @param {number[]} yearsFilter
   * @param {number} momYear
   */
  function processChartData(summaries, yearsFilter, momYear) {
    if (!summaries || summaries.length === 0) {
      console.log('No summaries to process');
      return {
        monthlyRegistrations: { labels: [], datasets: [] },
        monthlyRevenue: { labels: [], datasets: [] },
        momRegistrations: { labels: [], datasets: [] },
        momRevenue: { labels: [], datasets: [] },
        ytdRegistrations: { labels: [], datasets: [] },
        ytdRevenue: { labels: [], datasets: [] }
      };
    }

    // Group data by year
    /** @type {Record<number, MonthData[]>} */
    const dataByYear = {};
    summaries.forEach(summary => {
      const date = new Date(summary.summary_month);
      const year = date.getFullYear();
      const month = date.getMonth();

      if (!dataByYear[year]) {
        dataByYear[year] = Array(12).fill(null).map(() => ({ registrations: 0, revenue: 0 }));
      }

      // Add to existing values (for aggregating multiple classes)
      dataByYear[year][month].registrations += summary.registrations;
      dataByYear[year][month].revenue += summary.revenue;
    });

    console.log('Data by year:', dataByYear);
    console.log('Years to filter:', yearsFilter);

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    // Filter years for monthly charts - sort ascending for better visual order
    const filteredYears = yearsFilter.filter(year => dataByYear[year]).sort((a, b) => a - b);

    console.log('Filtered years for charts:', filteredYears);

    // 1. Monthly Registrations by Year (Bar Chart)
    const monthlyRegistrations = {
      labels: months,
      datasets: filteredYears.map((year, index) => ({
        label: year.toString(),
        data: dataByYear[year].map((/** @type {MonthData} */ d) => d.registrations),
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 1
      }))
    };

    console.log('Monthly registrations datasets:', monthlyRegistrations.datasets);

    // 2. Monthly Revenue by Year (Bar Chart)
    const monthlyRevenue = {
      labels: months,
      datasets: filteredYears.map((year, index) => ({
        label: year.toString(),
        data: dataByYear[year].map((/** @type {MonthData} */ d) => d.revenue),
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 1
      }))
    };

    // 3. Month over Month Registrations (selected year)
    /** @type {MonthData[]} */
    const momYearData = dataByYear[momYear] || Array(12).fill(null).map(() => ({ registrations: 0, revenue: 0 }));
    /** @type {number[]} */
    const momRegistrationsData = [];
    for (let i = 1; i < 12; i++) {
      const current = momYearData[i].registrations;
      const previous = momYearData[i - 1].registrations;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      momRegistrationsData.push(change);
    }

    const momRegistrations = {
      labels: months.slice(1),
      datasets: [{
        label: 'Month over Month % Change',
        data: momRegistrationsData,
        backgroundColor: momRegistrationsData.map(v => v >= 0 ? '#10b981' : '#ef4444'),
      }]
    };

    // 4. Month over Month Revenue (selected year)
    /** @type {number[]} */
    const momRevenueData = [];
    for (let i = 1; i < 12; i++) {
      const current = momYearData[i].revenue;
      const previous = momYearData[i - 1].revenue;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      momRevenueData.push(change);
    }

    const momRevenue = {
      labels: months.slice(1),
      datasets: [{
        label: 'Month over Month % Change',
        data: momRevenueData,
        backgroundColor: momRevenueData.map(v => v >= 0 ? '#10b981' : '#ef4444'),
      }]
    };

    // 5. YTD Registrations Comparison
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();
    /** @type {MonthData[]} */
    const currentYearData = dataByYear[currentYear] || Array(12).fill(null).map(() => ({ registrations: 0, revenue: 0 }));
    const ytdCurrentYear = currentYearData.slice(0, currentMonth + 1).reduce((/** @type {number} */ sum, /** @type {MonthData} */ d) => sum + d.registrations, 0);
    /** @type {MonthData[]} */
    const lastYearData = dataByYear[currentYear - 1] || Array(12).fill(null).map(() => ({ registrations: 0, revenue: 0 }));
    const ytdLastYear = lastYearData.slice(0, currentMonth + 1).reduce((/** @type {number} */ sum, /** @type {MonthData} */ d) => sum + d.registrations, 0);

    const ytdRegistrations = {
      labels: [`${currentYear - 1} YTD`, `${currentYear} YTD`],
      datasets: [{
        label: 'YTD Registrations',
        data: [ytdLastYear, ytdCurrentYear],
        backgroundColor: ['#6b7280', '#3b82f6'],
      }]
    };

    // 6. YTD Revenue Comparison
    const ytdCurrentYearRevenue = currentYearData.slice(0, currentMonth + 1).reduce((/** @type {number} */ sum, /** @type {MonthData} */ d) => sum + d.revenue, 0);
    const ytdLastYearRevenue = lastYearData.slice(0, currentMonth + 1).reduce((/** @type {number} */ sum, /** @type {MonthData} */ d) => sum + d.revenue, 0);
    
    const ytdRevenue = {
      labels: [`${currentYear - 1} YTD`, `${currentYear} YTD`],
      datasets: [{
        label: 'YTD Revenue',
        data: [ytdLastYearRevenue, ytdCurrentYearRevenue],
        backgroundColor: ['#6b7280', '#10b981'],
      }]
    };
    
    return {
      monthlyRegistrations,
      monthlyRevenue,
      momRegistrations,
      momRevenue,
      ytdRegistrations,
      ytdRevenue
    };
  }
  
  /**
   * @param {number} value
   * @returns {string}
   */
  function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  /**
   * @param {string} canvasId
   * @param {import('chart.js').ChartConfiguration} config
   */
  function createChart(canvasId, config) {
    if (!browser || !mounted) return;

    const ctx = /** @type {HTMLCanvasElement | null} */ (document.getElementById(canvasId));
    if (!ctx) return;

    // Destroy existing chart if it exists
    if (charts[canvasId]) {
      charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, config);
  }
  
  $: if (browser && mounted && chartData) {
    setTimeout(() => {
      // Monthly Registrations (Bar Chart)
      createChart('monthlyRegistrationsChart', {
        type: 'bar',
        data: chartData.monthlyRegistrations,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Monthly Registrations by Year' }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
      
      // Monthly Revenue (Bar Chart)
      createChart('monthlyRevenueChart', {
        type: 'bar',
        data: chartData.monthlyRevenue,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Monthly Revenue by Year' },
            tooltip: {
              callbacks: {
                label: function(/** @type {any} */ context) {
                  return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(/** @type {any} */ value) {
                  return formatCurrency(value);
                }
              }
            }
          }
        }
      });

      // Month over Month Registrations
      createChart('momRegistrationsChart', {
        type: 'bar',
        data: chartData.momRegistrations,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: `Month over Month Registration Growth (%) - ${selectedYearMoM}` }
          },
          scales: {
            y: {
              ticks: {
                callback: function(/** @type {any} */ value) {
                  return value + '%';
                }
              }
            }
          }
        }
      });

      // Month over Month Revenue
      createChart('momRevenueChart', {
        type: 'bar',
        data: chartData.momRevenue,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: `Month over Month Revenue Growth (%) - ${selectedYearMoM}` }
          },
          scales: {
            y: {
              ticks: {
                callback: function(/** @type {any} */ value) {
                  return value + '%';
                }
              }
            }
          }
        }
      });
      
      // YTD Registrations
      createChart('ytdRegistrationsChart', {
        type: 'bar',
        data: chartData.ytdRegistrations,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Year-to-Date Registrations Comparison' }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });
      
      // YTD Revenue
      createChart('ytdRevenueChart', {
        type: 'bar',
        data: chartData.ytdRevenue,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: 'Year-to-Date Revenue Comparison' },
            tooltip: {
              callbacks: {
                label: function(/** @type {any} */ context) {
                  return formatCurrency(context.parsed.y);
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                callback: function(/** @type {any} */ value) {
                  return formatCurrency(value);
                }
              }
            }
          }
        }
      });
    }, 100);
  }
</script>

<svelte:head>
  <title>HSI Reports | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <div>
      <h1>HSI Class Reports</h1>
      <p class="subtitle">Visual analysis of class performance and trends</p>
    </div>
    <a href="/hsi" class="btn-secondary">Back to Classes</a>
  </header>
  
  <!-- Add debug info section -->
  {#if browser}
    <div class="debug-info" style="background: #f0f0f0; padding: 1rem; margin-bottom: 1rem; border-radius: 0.5rem;">
      <strong>Debug Info:</strong>
      <div>Total Summaries: {data.summaries.length}</div>
      <div>Filtered Data: {filteredData.length}</div>
      <div>Available Years: {availableYears.join(', ')}</div>
      <div>Selected Years: {selectedYearsMonthly.join(', ')}</div>
      <div>2026 Data Count: {data.summaries.filter(s => new Date(s.summary_month).getFullYear() === 2026).length}</div>
    </div>
  {/if}
  
  <div class="filter-section">
    <div class="filter-group">
      <label for="classSelect">Select Class:</label>
      <select id="classSelect" bind:value={selectedClassCode} class="class-select">
        <option value="all">All Classes</option>
        {#each data.classes as classItem}
          <option value={classItem.class_code}>
            {classItem.class_name}
          </option>
        {/each}
      </select>
    </div>
    
    <div class="filter-divider"></div>
    
    <div class="filter-group">
      <label for="trackSelect">Filter by Track:</label>
      <select id="trackSelect" bind:value={selectedTrack} class="track-select">
        <option value="all">All Tracks</option>
        {#each uniqueTracks as track}
          <option value={track}>{track}</option>
        {/each}
      </select>
    </div>
    
    <div class="filter-divider"></div>
    
    <div class="filter-group">
      <label>Monthly Charts - Years to Display:</label>
      <div class="year-checkboxes">
        {#each availableYears as year}
          <label class="checkbox-label">
            <input
              type="checkbox"
              checked={selectedYearsMonthly.includes(year)}
              on:change={() => toggleYear(year)}
            />
            <span>{year}</span>
          </label>
        {/each}
      </div>
    </div>
    
    <div class="filter-divider"></div>
    
    <div class="filter-group">
      <label for="momYearSelect">Month over Month - Year:</label>
      <select id="momYearSelect" bind:value={selectedYearMoM} class="year-select">
        {#each availableYears as year}
          <option value={year}>{year}</option>
        {/each}
      </select>
    </div>
  </div>
  
  {#if browser && mounted}
    <div class="charts-grid">
      <!-- Monthly Registrations by Year -->
      <div class="chart-card">
        <canvas id="monthlyRegistrationsChart"></canvas>
      </div>
      
      <!-- Monthly Revenue by Year -->
      <div class="chart-card">
        <canvas id="monthlyRevenueChart"></canvas>
      </div>
      
      <!-- Month over Month Registrations -->
      <div class="chart-card">
        <canvas id="momRegistrationsChart"></canvas>
      </div>
      
      <!-- Month over Month Revenue -->
      <div class="chart-card">
        <canvas id="momRevenueChart"></canvas>
      </div>
      
      <!-- YTD Registrations Comparison -->
      <div class="chart-card small">
        <canvas id="ytdRegistrationsChart"></canvas>
      </div>
      
      <!-- YTD Revenue Comparison -->
      <div class="chart-card small">
        <canvas id="ytdRevenueChart"></canvas>
      </div>
    </div>
  {:else}
    <div class="loading">Loading charts...</div>
  {/if}
</div>

<!-- Styles remain the same as before -->
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
  
  .filter-section {
    background: white;
    padding: 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    margin-bottom: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .filter-group {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .filter-group label {
    font-weight: 600;
    color: #374151;
  }
  
  .filter-divider {
    height: 1px;
    background-color: #e5e7eb;
    margin: 0.5rem 0;
  }
  
  .class-select,
  .track-select,
  .year-select {
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 1rem;
    min-width: 200px;
    background-color: white;
  }
  
  .class-select:focus,
  .track-select:focus,
  .year-select:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }
  
  .year-checkboxes {
    display: flex;
    gap: 1rem;
    flex-wrap: wrap;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    font-weight: normal;
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background-color: white;
    transition: all 0.2s;
  }
  
  .checkbox-label:hover {
    background-color: #f9fafb;
    border-color: #3b82f6;
  }
  
  .checkbox-label input[type="checkbox"] {
    cursor: pointer;
    width: 1rem;
    height: 1rem;
  }
  
  .checkbox-label input[type="checkbox"]:checked + span {
    color: #3b82f6;
    font-weight: 600;
  }
  
  .charts-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
  }
  
  .chart-card {
    background: white;
    padding: 1.5rem;
    border-radius: 0.5rem;
    box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    height: 400px;
  }
  
  .chart-card.small {
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
    .charts-grid {
      grid-template-columns: 1fr;
    }
    
    .filter-group {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>