<!-- src/routes/hsi/reports/+page.svelte -->
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

  /**
   * @typedef {Object} MonthData
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

  // 4-month rolling filter states
  let selectedMonth4M = new Date().getMonth(); // 0-11
  /** @type {number[]} */
  let selectedYears4M = [];

  onMount(() => {
    mounted = true;
  });

  // Get unique tracks from data
  $: uniqueTracks = [...new Set(data.classes.map((/** @type {ClassItem} */ c) => c.track).filter(Boolean))].sort();
  
  $: filteredData = getFilteredData(selectedClassCode, selectedTrack, data.summaries);
  
  // Extract available years from data
  $: {
    if (filteredData && filteredData.length > 0) {
      const years = [...new Set(filteredData.map((/** @type {Summary} */ s) => s.summary_year))].filter(y => y >= 2023 && y <= 2027);
      
      availableYears = years.sort((a, b) => b - a);
      
      // Initialize selected years if empty
      if (selectedYearsMonthly.length === 0) {
        selectedYearsMonthly = availableYears.slice(0, Math.min(4, availableYears.length));
      } else {
        selectedYearsMonthly = selectedYearsMonthly.filter(y => availableYears.includes(y));
        if (selectedYearsMonthly.length === 0) {
          selectedYearsMonthly = availableYears.slice(0, Math.min(4, availableYears.length));
        }
      }
      
      // Initialize 4-month rolling years
      if (selectedYears4M.length === 0) {
        selectedYears4M = availableYears.slice(0, Math.min(3, availableYears.length));
      } else {
        selectedYears4M = selectedYears4M.filter(y => availableYears.includes(y));
        if (selectedYears4M.length === 0) {
          selectedYears4M = availableYears.slice(0, Math.min(3, availableYears.length));
        }
      }
      
      // Ensure selectedYearMoM is valid
      if (!availableYears.includes(selectedYearMoM)) {
        selectedYearMoM = availableYears[0] || new Date().getFullYear();
      }
    }
  }
  
  $: chartData = processChartData(filteredData, selectedYearsMonthly, selectedYearMoM, selectedMonth4M, selectedYears4M);
  
  /**
   * @param {string} classCode
   * @param {string} trackId
   * @param {Summary[]} summaries
   * @returns {Summary[]}
   */
  function getFilteredData(classCode, trackId, summaries) {
    let filtered = summaries;

    if (classCode !== 'all') {
      filtered = filtered.filter(s => s.class_code === classCode);
    }

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
   * @param {number} year
   */
  function toggleYear4M(year) {
    if (selectedYears4M.includes(year)) {
      selectedYears4M = selectedYears4M.filter(y => y !== year);
    } else {
      selectedYears4M = [...selectedYears4M, year].sort((a, b) => a - b);
    }
  }

  /**
   * @param {Summary[]} summaries
   * @param {number[]} yearsFilter
   * @param {number} momYear
   * @param {number} month4M
   * @param {number[]} years4M
   */
  function processChartData(summaries, yearsFilter, momYear, month4M, years4M) {
    if (!summaries || summaries.length === 0) {
      return {
        monthlyRegistrations: { labels: [], datasets: [] },
        monthlyRevenue: { labels: [], datasets: [] },
        fourMonthRegistrations: { labels: [], datasets: [] },
        fourMonthRevenue: { labels: [], datasets: [] },
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
      const year = summary.summary_year;
      const date = new Date(summary.summary_month + 'T12:00:00');
      const month = date.getMonth();

      if (year < 2023 || year > 2027) return;

      if (!dataByYear[year]) {
        dataByYear[year] = Array(12).fill(null).map(() => ({ registrations: 0, revenue: 0 }));
      }

      dataByYear[year][month].registrations += summary.registrations;
      dataByYear[year][month].revenue += summary.revenue;
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    // Filter years for monthly charts
    const filteredYears = yearsFilter.filter(year => dataByYear[year]).sort((a, b) => a - b);

    // 1. Monthly Registrations by Year
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

    // 2. Monthly Revenue by Year
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

    // 3. 4-Month Rolling Registrations
    const filteredYears4M = years4M.filter(year => dataByYear[year]).sort((a, b) => a - b);
    /** @type {number[]} */
    const monthIndices = [];
    /** @type {string[]} */
    const monthLabels = [];
    for (let i = 3; i >= 0; i--) {
      const idx = (month4M - i + 12) % 12;
      monthIndices.push(idx);
      monthLabels.push(months[idx]);
    }

    const fourMonthRegistrations = {
      labels: monthLabels,
      datasets: filteredYears4M.map((year, index) => ({
        label: year.toString(),
        data: monthIndices.map(idx => dataByYear[year][idx].registrations),
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 1
      }))
    };

    // 4. 4-Month Rolling Revenue
    const fourMonthRevenue = {
      labels: monthLabels,
      datasets: filteredYears4M.map((year, index) => ({
        label: year.toString(),
        data: monthIndices.map(idx => dataByYear[year][idx].revenue),
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 1
      }))
    };

    // 5. Month over Month Registrations (including January)
    /** @type {MonthData[]} */
    const momYearData = dataByYear[momYear] || Array(12).fill(null).map(() => ({ registrations: 0, revenue: 0 }));
    /** @type {MonthData[]} */
    const prevYearData = dataByYear[momYear - 1] || Array(12).fill(null).map(() => ({ registrations: 0, revenue: 0 }));
    const momRegistrationsData = [];
    
    // January: compare to December of previous year
    const janCurrent = momYearData[0].registrations;
    const decPrevious = prevYearData[11].registrations;
    const janChange = decPrevious > 0 ? ((janCurrent - decPrevious) / decPrevious) * 100 : 0;
    momRegistrationsData.push(janChange);
    
    // February through December: compare to previous month of same year
    for (let i = 1; i < 12; i++) {
      const current = momYearData[i].registrations;
      const previous = momYearData[i - 1].registrations;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      momRegistrationsData.push(change);
    }
    
    const momRegistrations = {
      labels: months,
      datasets: [{
        label: 'Month over Month % Change',
        data: momRegistrationsData,
        backgroundColor: momRegistrationsData.map(v => v >= 0 ? '#10b981' : '#ef4444'),
      }]
    };
    
    // 6. Month over Month Revenue (including January)
    const momRevenueData = [];
    
    // January: compare to December of previous year
    const janRevCurrent = momYearData[0].revenue;
    const decRevPrevious = prevYearData[11].revenue;
    const janRevChange = decRevPrevious > 0 ? ((janRevCurrent - decRevPrevious) / decRevPrevious) * 100 : 0;
    momRevenueData.push(janRevChange);
    
    // February through December: compare to previous month of same year
    for (let i = 1; i < 12; i++) {
      const current = momYearData[i].revenue;
      const previous = momYearData[i - 1].revenue;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      momRevenueData.push(change);
    }
    
    const momRevenue = {
      labels: months,
      datasets: [{
        label: 'Month over Month % Change',
        data: momRevenueData,
        backgroundColor: momRevenueData.map(v => v >= 0 ? '#10b981' : '#ef4444'),
      }]
    };
    
    // 7. YTD Registrations - Cumulative totals by month
    const currentYear = new Date().getFullYear();
    /** @type {MonthData[]} */
    const currentYearData = dataByYear[currentYear] || Array(12).fill(null).map(() => ({ registrations: 0, revenue: 0 }));
    /** @type {MonthData[]} */
    const lastYearData = dataByYear[currentYear - 1] || Array(12).fill(null).map(() => ({ registrations: 0, revenue: 0 }));
    
    // Calculate cumulative sums for registrations
    const currentYearCumulative = [];
    const lastYearCumulative = [];
    let currentYearSum = 0;
    let lastYearSum = 0;
    
    for (let i = 0; i < 12; i++) {
      currentYearSum += currentYearData[i].registrations;
      lastYearSum += lastYearData[i].registrations;
      currentYearCumulative.push(currentYearSum);
      lastYearCumulative.push(lastYearSum);
    }
    
    const ytdRegistrations = {
      labels: months,
      datasets: [
        {
          label: `${currentYear - 1}`,
          data: lastYearCumulative,
          backgroundColor: '#6b7280',
          borderColor: '#6b7280',
          borderWidth: 1
        },
        {
          label: `${currentYear}`,
          data: currentYearCumulative,
          backgroundColor: '#3b82f6',
          borderColor: '#3b82f6',
          borderWidth: 1
        }
      ]
    };
    
    // 8. YTD Revenue - Cumulative totals by month
    const currentYearRevenueCumulative = [];
    const lastYearRevenueCumulative = [];
    let currentYearRevenueSum = 0;
    let lastYearRevenueSum = 0;
    
    for (let i = 0; i < 12; i++) {
      currentYearRevenueSum += currentYearData[i].revenue;
      lastYearRevenueSum += lastYearData[i].revenue;
      currentYearRevenueCumulative.push(currentYearRevenueSum);
      lastYearRevenueCumulative.push(lastYearRevenueSum);
    }
    
    const ytdRevenue = {
      labels: months,
      datasets: [
        {
          label: `${currentYear - 1}`,
          data: lastYearRevenueCumulative,
          backgroundColor: '#6b7280',
          borderColor: '#6b7280',
          borderWidth: 1
        },
        {
          label: `${currentYear}`,
          data: currentYearRevenueCumulative,
          backgroundColor: '#10b981',
          borderColor: '#10b981',
          borderWidth: 1
        }
      ]
    };
    
    return {
      monthlyRegistrations,
      monthlyRevenue,
      fourMonthRegistrations,
      fourMonthRevenue,
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

    if (charts[canvasId]) {
      charts[canvasId].destroy();
    }

    charts[canvasId] = new Chart(ctx, config);
  }
  
  $: if (browser && mounted && chartData) {
    setTimeout(() => {
      // Monthly Registrations
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
      
      // Monthly Revenue
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

      // 4-Month Rolling Registrations
      createChart('fourMonthRegistrationsChart', {
        type: 'bar',
        data: chartData.fourMonthRegistrations,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: '4-Month Rolling Registrations' }
          },
          scales: {
            y: { beginAtZero: true }
          }
        }
      });

      // 4-Month Rolling Revenue
      createChart('fourMonthRevenueChart', {
        type: 'bar',
        data: chartData.fourMonthRevenue,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: '4-Month Rolling Revenue' },
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
            legend: { position: 'top' },
            title: { display: true, text: 'Year-to-Date Cumulative Registrations' }
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
            legend: { position: 'top' },
            title: { display: true, text: 'Year-to-Date Cumulative Revenue' },
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
    <!--a href="/hsi" class="btn-secondary">Back to Classes</a-->
  </header>
  
  <!-- Global Filters -->
  <div class="filter-section">
    <div class="filter-row">
      <div class="filter-group">
        <label for="classSelect">Class Filter:</label>
        <select id="classSelect" bind:value={selectedClassCode} class="filter-select">
          <option value="all">All Classes</option>
          {#each data.classes as classItem}
            <option value={classItem.class_code}>
              {classItem.class_name}
            </option>
          {/each}
        </select>
      </div>
      
      <div class="filter-group">
        <label for="trackSelect">Track Filter:</label>
        <select id="trackSelect" bind:value={selectedTrack} class="filter-select">
          <option value="all">All Tracks</option>
          {#each uniqueTracks as track}
            <option value={track}>{track}</option>
          {/each}
        </select>
      </div>
    </div>
  </div>
  
  {#if browser && mounted}
    <!-- Monthly Charts Section -->
    <section class="chart-section">
      <h2 class="section-title">Monthly Analysis</h2>
      
      <div class="filter-section">
        <div class="filter-group">
          <label>Years to Display:</label>
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
      </div>
      
      <div class="charts-grid">
        <div class="chart-card">
          <canvas id="monthlyRegistrationsChart"></canvas>
        </div>
        <div class="chart-card">
          <canvas id="monthlyRevenueChart"></canvas>
        </div>
      </div>
    </section>
    
    <!-- 4-Month Rolling Section -->
    <section class="chart-section">
      <h2 class="section-title">4-Month Rolling Window</h2>
      
      <div class="filter-section">
        <div class="filter-row">
          <div class="filter-group">
            <label for="monthSelect4M">Ending Month:</label>
            <select id="monthSelect4M" bind:value={selectedMonth4M} class="filter-select">
              <option value={0}>January</option>
              <option value={1}>February</option>
              <option value={2}>March</option>
              <option value={3}>April</option>
              <option value={4}>May</option>
              <option value={5}>June</option>
              <option value={6}>July</option>
              <option value={7}>August</option>
              <option value={8}>September</option>
              <option value={9}>October</option>
              <option value={10}>November</option>
              <option value={11}>December</option>
            </select>
          </div>
          
          <div class="filter-group">
            <label>Years to Display:</label>
            <div class="year-checkboxes">
              {#each availableYears as year}
                <label class="checkbox-label">
                  <input
                    type="checkbox"
                    checked={selectedYears4M.includes(year)}
                    on:change={() => toggleYear4M(year)}
                  />
                  <span>{year}</span>
                </label>
              {/each}
            </div>
          </div>
        </div>
      </div>
      
      <div class="charts-grid">
        <div class="chart-card">
          <canvas id="fourMonthRegistrationsChart"></canvas>
        </div>
        <div class="chart-card">
          <canvas id="fourMonthRevenueChart"></canvas>
        </div>
      </div>
    </section>
    
    <!-- Month over Month Section -->
    <section class="chart-section">
      <h2 class="section-title">Month over Month Growth</h2>
      
      <div class="filter-section">
        <div class="filter-group">
          <label for="momYearSelect">Year:</label>
          <select id="momYearSelect" bind:value={selectedYearMoM} class="filter-select">
            {#each availableYears as year}
              <option value={year}>{year}</option>
            {/each}
          </select>
        </div>
      </div>
      
      <div class="charts-grid">
        <div class="chart-card">
          <canvas id="momRegistrationsChart"></canvas>
        </div>
        <div class="chart-card">
          <canvas id="momRevenueChart"></canvas>
        </div>
      </div>
    </section>
    
    <!-- YTD Section -->
    <section class="chart-section">
      <h2 class="section-title">Year-to-Date Comparison</h2>
      
      <div class="charts-grid">
        <div class="chart-card">
          <canvas id="ytdRegistrationsChart"></canvas>
        </div>
        <div class="chart-card">
          <canvas id="ytdRevenueChart"></canvas>
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
  
  .filter-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem;
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
    .filter-row {
      grid-template-columns: 1fr;
      gap: 1rem;
    }
    
    .charts-grid {
      grid-template-columns: 1fr;
    }
    
    .filter-group {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>