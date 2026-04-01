-- Customer reviews from external platforms
CREATE TABLE IF NOT EXISTS customer_reviews (
  review_id          SERIAL PRIMARY KEY,
  -- External source info
  source             VARCHAR(50) NOT NULL,  -- 'google', 'yelp', 'tripadvisor', 'facebook', 'manual'
  source_review_id   TEXT,                  -- external platform's review ID (for dedup)
  source_url         TEXT,                  -- link to the original review

  -- Review content
  reviewer_name      TEXT,
  rating             NUMERIC(2,1),          -- e.g. 4.5 out of 5
  review_text        TEXT,
  review_date        DATE,

  -- Association (one or more can be set)
  class_code         VARCHAR(20) REFERENCES classes(class_code) ON DELETE SET NULL,
  session_id         INTEGER REFERENCES class_sessions(session_id) ON DELETE SET NULL,
  show_code          VARCHAR(20) REFERENCES shows(show_code) ON DELETE SET NULL,
  corp_company_id    INTEGER REFERENCES corp_companies(corp_company_id) ON DELETE SET NULL,
  corp_engagement_id INTEGER REFERENCES corp_engagements(corp_engagement_id) ON DELETE SET NULL,

  -- Metadata
  is_featured        BOOLEAN NOT NULL DEFAULT false,
  notes              TEXT,
  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  -- Prevent importing the same review twice from the same source
  UNIQUE(source, source_review_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_source ON customer_reviews(source);
CREATE INDEX IF NOT EXISTS idx_reviews_class ON customer_reviews(class_code);
CREATE INDEX IF NOT EXISTS idx_reviews_show ON customer_reviews(show_code);
CREATE INDEX IF NOT EXISTS idx_reviews_company ON customer_reviews(corp_company_id);
CREATE INDEX IF NOT EXISTS idx_reviews_date ON customer_reviews(review_date DESC);
