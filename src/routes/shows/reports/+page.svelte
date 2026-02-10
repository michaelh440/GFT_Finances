<!-- src/routes/shows/reports/+page.svelte -->
<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import Chart from 'chart.js/auto';

  /**
   * @typedef {Object} ShowItem
   * @property {string} show_code
   * @property {string} show_name
   * @property {string} format
   * @property {string} audience_type
   * @property {string} day_of_week
   * @property {number} standard_ticket_price
   * @property {string} description
   * @property {boolean} is_active
   */

  /**
   * @typedef {Object} Summary
   * @property {string} show_code
   * @property {string} summary_month
   * @property {number} summary_year
   * @property {number} tickets_sold
   * @property {number} revenue
   */

  /**
   * @typedef {Object} MonthData
   * @property {number} tickets_sold
   * @property {number} revenue
   */

  /** @type {{ shows: ShowItem[], summaries: Summary[] }} */
  export let data;

  let selectedShowCode = 'all';
  let selectedFormat = 'all';
  let selectedAudience = 'all';
  let selectedDay = 'all';
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

  // Get unique filter values from data
  $: uniqueFormats = [...new Set(data.shows.map((/** @type {ShowItem} */ s) => s.format).filter(Boolean))].sort();
  $: uniqueAudiences = [...new Set(data.shows.map((/** @type {ShowItem} */ s) => s.audience_type).filter(Boolean))].sort();
  $: uniqueDays = [...new Set(data.shows.map((/** @type {ShowItem} */ s) => s.day_of_week).filter(Boolean))].sort();
  
  $: filteredData = getFilteredData(selectedShowCode, selectedFormat, selectedAudience, selectedDay, data.summaries);
  
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
   * @param {string} showCode
   * @param {string} format
   * @param {string} audience
   * @param {string} day
   * @param {Summary[]} summaries
   * @returns {Summary[]}
   */
  function getFilteredData(showCode, format, audience, day, summaries) {
    let filtered = summaries;

    if (showCode !== 'all') {
      filtered = filtered.filter(s => s.show_code === showCode);
    }

    if (format !== 'all') {
      const showCodesInFormat = data.shows
        .filter(s => s.format === format)
        .map(s => s.show_code);
      filtered = filtered.filter(s => showCodesInFormat.includes(s.show_code));
    }

    if (audience !== 'all') {
      const showCodesInAudience = data.shows
        .filter(s => s.audience_type === audience)
        .map(s => s.show_code);
      filtered = filtered.filter(s => showCodesInAudience.includes(s.show_code));
    }

    if (day !== 'all') {
      const showCodesOnDay = data.shows
        .filter(s => s.day_of_week === day)
        .map(s => s.show_code);
      filtered = filtered.filter(s => showCodesOnDay.includes(s.show_code));
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
   * @typedef {Object} ShowMonthData
   * @property {number} tickets
   * @property {number} revenue
   */

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
        monthlyTickets: { labels: [], datasets: [] },
        monthlyRevenue: { labels: [], datasets: [] },
        fourMonthTickets: { labels: [], datasets: [] },
        fourMonthRevenue: { labels: [], datasets: [] },
        momTickets: { labels: [], datasets: [] },
        momRevenue: { labels: [], datasets: [] },
        ytdTickets: { labels: [], datasets: [] },
        ytdRevenue: { labels: [], datasets: [] }
      };
    }

    // Group data by year
    /** @type {Record<number, ShowMonthData[]>} */
    const dataByYear = {};
    summaries.forEach(summary => {
      const year = summary.summary_year;
      const date = new Date(summary.summary_month + 'T12:00:00');
      const month = date.getMonth();

      if (year < 2023 || year > 2027) return;

      if (!dataByYear[year]) {
        dataByYear[year] = Array(12).fill(null).map(() => ({ tickets: 0, revenue: 0 }));
      }

      dataByYear[year][month].tickets += summary.tickets_sold;
      dataByYear[year][month].revenue += summary.revenue;
    });

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

    // Filter years for monthly charts
    const filteredYears = yearsFilter.filter(year => dataByYear[year]).sort((a, b) => a - b);

    // 1. Monthly Tickets by Year
    const monthlyTickets = {
      labels: months,
      datasets: filteredYears.map((year, index) => ({
        label: year.toString(),
        data: dataByYear[year].map((/** @type {ShowMonthData} */ d) => d.tickets),
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
        data: dataByYear[year].map((/** @type {ShowMonthData} */ d) => d.revenue),
        backgroundColor: colors[index % colors.length],
        borderColor: colors[index % colors.length],
        borderWidth: 1
      }))
    };

    // 3. 4-Month Rolling Tickets
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

    const fourMonthTickets = {
      labels: monthLabels,
      datasets: filteredYears4M.map((year, index) => ({
        label: year.toString(),
        data: monthIndices.map(idx => dataByYear[year][idx].tickets),
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
    
    // 5. Month over Month Tickets
    /** @type {ShowMonthData[]} */
    const momYearData = dataByYear[momYear] || Array(12).fill(null).map(() => ({ tickets: 0, revenue: 0 }));
    /** @type {ShowMonthData[]} */
    const prevYearData = dataByYear[momYear - 1] || Array(12).fill(null).map(() => ({ tickets: 0, revenue: 0 }));
    const momTicketsData = [];
    
    // January: compare to December of previous year
    const janCurrent = momYearData[0].tickets;
    const decPrevious = prevYearData[11].tickets;
    const janChange = decPrevious > 0 ? ((janCurrent - decPrevious) / decPrevious) * 100 : 0;
    momTicketsData.push(janChange);
    
    // February through December
    for (let i = 1; i < 12; i++) {
      const current = momYearData[i].tickets;
      const previous = momYearData[i - 1].tickets;
      const change = previous > 0 ? ((current - previous) / previous) * 100 : 0;
      momTicketsData.push(change);
    }
    
    const momTickets = {
      labels: months,
      datasets: [{
        label: 'Month over Month % Change',
        data: momTicketsData,
        backgroundColor: momTicketsData.map(v => v >= 0 ? '#10b981' : '#ef4444'),
      }]
    };
    
    // 6. Month over Month Revenue
    const momRevenueData = [];
    
    const janRevCurrent = momYearData[0].revenue;
    const decRevPrevious = prevYearData[11].revenue;
    const janRevChange = decRevPrevious > 0 ? ((janRevCurrent - decRevPrevious) / decRevPrevious) * 100 : 0;
    momRevenueData.push(janRevChange);
    
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
    
    // 7. YTD Tickets
    const currentYear = new Date().getFullYear();
    /** @type {ShowMonthData[]} */
    const currentYearData = dataByYear[currentYear] || Array(12).fill(null).map(() => ({ tickets: 0, revenue: 0 }));
    /** @type {ShowMonthData[]} */
    const lastYearData = dataByYear[currentYear - 1] || Array(12).fill(null).map(() => ({ tickets: 0, revenue: 0 }));
    
    const currentYearCumulative = [];
    const lastYearCumulative = [];
    let currentYearSum = 0;
    let lastYearSum = 0;
    
    for (let i = 0; i < 12; i++) {
      currentYearSum += currentYearData[i].tickets;
      lastYearSum += lastYearData[i].tickets;
      currentYearCumulative.push(currentYearSum);
      lastYearCumulative.push(lastYearSum);
    }
    
    const ytdTickets = {
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
    
    // 8. YTD Revenue
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
      monthlyTickets,
      monthlyRevenue,
      fourMonthTickets,
      fourMonthRevenue,
      momTickets,
      momRevenue,
      ytdTickets,
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
      // Monthly Tickets
      createChart('monthlyTicketsChart', {
        type: 'bar',
        data: chartData.monthlyTickets,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Monthly Tickets Sold by Year' }
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

      // 4-Month Rolling Tickets
      createChart('fourMonthTicketsChart', {
        type: 'bar',
        data: chartData.fourMonthTickets,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: '4-Month Rolling Tickets Sold' }
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

      // Month over Month Tickets
      createChart('momTicketsChart', {
        type: 'bar',
        data: chartData.momTickets,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: `Month over Month Ticket Growth (%) - ${selectedYearMoM}` }
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

      // YTD Tickets
      createChart('ytdTicketsChart', {
        type: 'bar',
        data: chartData.ytdTickets,
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Year-to-Date Cumulative Tickets Sold' }
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
  <title>Show Reports | B&C Financial Tracker</title>
</svelte:head>

<div class="container">
  <header>
    <div>
      <h1>Live Show Reports</h1>
      <p class="subtitle">Visual analysis of show performance and trends</p>
    </div>
    <a href="/shows" class="btn-secondary">Back to Shows</a>
  </header>
  
  <!-- Global Filters -->
  <div class="filter-section">
    <div class="filter-row">
      <div class="filter-group">
        <label for="showSelect">Show:</label>
        <select id="showSelect" bind:value={selectedShowCode} class="filter-select">
          <option value="all">All Shows</option>
          {#each data.shows as show}
            <option value={show.show_code}>
              {show.show_name}
            </option>
          {/each}
        </select>
      </div>
      
      <div class="filter-group">
        <label for="formatSelect">Format:</label>
        <select id="formatSelect" bind:value={selectedFormat} class="filter-select">
          <option value="all">All Formats</option>
          {#each uniqueFormats as format}
            <option value={format}>{format}</option>
          {/each}
        </select>
      </div>
    </div>
    
    <div class="filter-row" style="margin-top: 1rem;">
      <div class="filter-group">
        <label for="audienceSelect">Audience:</label>
        <select id="audienceSelect" bind:value={selectedAudience} class="filter-select">
          <option value="all">All Audiences</option>
          {#each uniqueAudiences as audience}
            <option value={audience}>{audience}</option>
          {/each}
        </select>
      </div>
      
      <div class="filter-group">
        <label for="daySelect">Day of Week:</label>
        <select id="daySelect" bind:value={selectedDay} class="filter-select">
          <option value="all">All Days</option>
          {#each uniqueDays as day}
            <option value={day}>{day}</option>
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
          <canvas id="monthlyTicketsChart"></canvas>
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
          <canvas id="fourMonthTicketsChart"></canvas>
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
          <canvas id="momTicketsChart"></canvas>
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
          <canvas id="ytdTicketsChart"></canvas>
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