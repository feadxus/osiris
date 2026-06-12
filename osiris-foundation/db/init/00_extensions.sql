-- ═══════════════════════════════════════════════════════════════
--  00 — Extensions
--  Relational + Vector + Graph + fuzzy text, all in one database.
-- ═══════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy / similarity text search
CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector: semantic embeddings
CREATE EXTENSION IF NOT EXISTS age;        -- Apache AGE: openCypher graph

-- Convenience: a dedicated schema for the ontology backbone so it
-- never collides with app tables or AGE's ag_catalog.
CREATE SCHEMA IF NOT EXISTS ontology;
