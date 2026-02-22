-- Full-text search index on MarketJob for fast search across title, company, description
-- Uses GIN index with to_tsvector for PostgreSQL full-text search

-- Add a generated tsvector column
ALTER TABLE "MarketJob" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("company", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("location", '')), 'C') ||
    setweight(to_tsvector('english', coalesce(left("description", 2000), '')), 'D')
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS "MarketJob_searchVector_idx" ON "MarketJob" USING GIN ("searchVector");
