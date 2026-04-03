-- Indexes to speed up VBO sync matching between students and patrons
CREATE INDEX IF NOT EXISTS idx_students_email_lower ON students (LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) != '';
CREATE INDEX IF NOT EXISTS idx_patrons_email_lower ON patrons (LOWER(TRIM(email))) WHERE email IS NOT NULL AND TRIM(email) != '';
CREATE INDEX IF NOT EXISTS idx_students_name_lower ON students (LOWER(TRIM(first_name)), LOWER(TRIM(last_name))) WHERE first_name IS NOT NULL AND last_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_patrons_name_lower ON patrons (LOWER(TRIM(first_name)), LOWER(TRIM(last_name))) WHERE first_name IS NOT NULL AND last_name IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_vbo ON students (vbo_account_id) WHERE vbo_account_id IS NOT NULL AND TRIM(vbo_account_id) != '';
CREATE INDEX IF NOT EXISTS idx_patrons_vbo ON patrons (vbo_account_id) WHERE vbo_account_id IS NOT NULL AND TRIM(vbo_account_id) != '';
