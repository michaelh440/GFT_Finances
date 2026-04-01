-- Add company_size column to corp_companies
ALTER TABLE corp_companies ADD COLUMN IF NOT EXISTS company_size VARCHAR(50);
