-- Add start_time and end_time to class_sessions
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS start_time TIME;
ALTER TABLE class_sessions ADD COLUMN IF NOT EXISTS end_time TIME;
