-- Add is_active column to corp_contacts (defaults to true for all existing contacts)
ALTER TABLE corp_contacts ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;
