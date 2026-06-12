-- ═══════════════════════════════════════════════════════════════
--  30 — Indexes (search performance)
-- ═══════════════════════════════════════════════════════════════

-- Semantic search: HNSW over embeddings (cosine distance).
CREATE INDEX ix_chunks_embedding
    ON ontology.chunks
    USING hnsw (embedding vector_cosine_ops);

-- Fuzzy / typo-tolerant entity title search (pairs with Meilisearch).
CREATE INDEX ix_entities_title_trgm
    ON ontology.entities
    USING gin (title gin_trgm_ops);

-- Property bag queries (e.g. find by phone number inside JSONB).
CREATE INDEX ix_entities_props
    ON ontology.entities
    USING gin (properties jsonb_path_ops);

-- Common lookups.
CREATE INDEX ix_entities_type      ON ontology.entities(object_type);
CREATE INDEX ix_entities_time      ON ontology.entities(occurred_at);
CREATE INDEX ix_entities_geo       ON ontology.entities(lat, lng);
CREATE INDEX ix_rel_source         ON ontology.relationships(source_id);
CREATE INDEX ix_rel_target         ON ontology.relationships(target_id);
CREATE INDEX ix_chunks_source      ON ontology.chunks(source_id);
CREATE INDEX ix_audit_object       ON ontology.audit_log(object_type, object_id);

-- Hybrid-search helper: combine vector distance + trgm similarity in
-- the app layer, then re-rank. (No single SQL index spans both.)
