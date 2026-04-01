-- Add summary column to corp_companies
ALTER TABLE corp_companies ADD COLUMN IF NOT EXISTS summary TEXT;
