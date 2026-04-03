-- Create bar_items reference table
CREATE TABLE IF NOT EXISTS bar_items (
    item_code VARCHAR(50) PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL DEFAULT 'Other',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create monthly_bar_summary table for tracking bar/concession sales
CREATE TABLE IF NOT EXISTS monthly_bar_summary (
    item_code VARCHAR(50) NOT NULL REFERENCES bar_items(item_code),
    summary_month DATE NOT NULL,
    summary_year INTEGER NOT NULL,
    units_sold INTEGER NOT NULL DEFAULT 0,
    revenue NUMERIC(12, 2) NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (item_code, summary_month)
);

-- Index for year-based filtering
CREATE INDEX IF NOT EXISTS idx_monthly_bar_summary_year ON monthly_bar_summary (summary_year);
