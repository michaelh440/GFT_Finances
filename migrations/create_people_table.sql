-- ============================================================
-- Phase 1: Create the customers master contact table
-- ============================================================

-- Master identity record — single source of truth for contact info
CREATE TABLE IF NOT EXISTS customers (
    customer_id SERIAL PRIMARY KEY,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(50),
    mobile_phone VARCHAR(50),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(100),
    vbo_account_ids TEXT[] DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for matching during imports
CREATE INDEX IF NOT EXISTS idx_customers_email_lower ON customers (LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) != '';
CREATE INDEX IF NOT EXISTS idx_customers_name_lower ON customers (LOWER(TRIM(first_name)), LOWER(TRIM(last_name))) WHERE first_name IS NOT NULL AND last_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_vbo_ids ON customers USING GIN (vbo_account_ids);

-- Add customer_id FK to students, patrons, corp_contacts
ALTER TABLE students ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(customer_id);
ALTER TABLE patrons ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(customer_id);
ALTER TABLE corp_contacts ADD COLUMN IF NOT EXISTS customer_id INTEGER REFERENCES customers(customer_id);

-- Indexes on the FK columns
CREATE INDEX IF NOT EXISTS idx_students_customer_id ON students (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patrons_customer_id ON patrons (customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_corp_contacts_customer_id ON corp_contacts (customer_id) WHERE customer_id IS NOT NULL;
