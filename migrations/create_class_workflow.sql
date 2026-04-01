-- Create class_workflow table (mirrors corp_workflow pattern)
CREATE TABLE IF NOT EXISTS class_workflow (
  workflow_id   SERIAL PRIMARY KEY,
  category      VARCHAR(50)  NOT NULL,  -- 'class_type', 'student_type', 'duration_unit'
  value         VARCHAR(100) NOT NULL,  -- machine-readable value stored in classes table
  label         VARCHAR(200) NOT NULL,  -- human-readable label for UI
  sort_order    INTEGER      NOT NULL DEFAULT 0,
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(category, value)
);

-- Seed class_type values
INSERT INTO class_workflow (category, value, label, sort_order) VALUES
  ('class_type', '8 week class',  '8 Week Class',   1),
  ('class_type', '1 day workshop','1 Day Workshop',  2),
  ('class_type', 'intensive',     'Intensive',       3),
  ('class_type', 'private',       'Private',         4),
  ('class_type', 'audition',      'Audition',        5),
  ('class_type', 'conservatory',  'Conservatory',    6)
ON CONFLICT (category, value) DO NOTHING;

-- Seed student_type values
INSERT INTO class_workflow (category, value, label, sort_order) VALUES
  ('student_type', 'adult',              'Adult',              1),
  ('student_type', 'minor',              'Minor',              2),
  ('student_type', 'high school league', 'High School League', 3),
  ('student_type', 'child',              'Child',              4)
ON CONFLICT (category, value) DO NOTHING;

-- Seed duration_unit values
INSERT INTO class_workflow (category, value, label, sort_order) VALUES
  ('duration_unit', 'minutes', 'Minutes', 1),
  ('duration_unit', 'hours',   'Hours',   2),
  ('duration_unit', 'days',    'Days',    3),
  ('duration_unit', 'weeks',   'Weeks',   4)
ON CONFLICT (category, value) DO NOTHING;
