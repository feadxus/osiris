-- ═══════════════════════════════════════════════════════════════
--  20 — Graph layer (Apache AGE / openCypher)
--
--  This graph is the traversal + analytics mirror of the relational
--  entities/relationships tables. The app layer (Phase 1) writes a
--  node here whenever it inserts an entity, and an edge whenever it
--  inserts a relationship. You then run Cypher for pathfinding,
--  centrality, and community detection — the "find hidden links"
--  capability that makes this Gotham and not just a dashboard.
-- ═══════════════════════════════════════════════════════════════

LOAD 'age';
SET search_path = ag_catalog, "$user", public;

SELECT create_graph('osiris_graph');

-- Example shapes the app will use (commented — run from the app layer):
--
-- Create / upsert a node mirroring an ontology.entities row:
--   SELECT * FROM cypher('osiris_graph', $$
--     CREATE (e:Entity {uuid: '...', object_type: 'person', title: 'John Doe'})
--     RETURN e
--   $$) AS (e agtype);
--
-- Create an edge mirroring an ontology.relationships row:
--   SELECT * FROM cypher('osiris_graph', $$
--     MATCH (a:Entity {uuid: $src}), (b:Entity {uuid: $dst})
--     CREATE (a)-[r:LINK {link_type: 'owns', strength: 0.9}]->(b)
--     RETURN r
--   $$) AS (r agtype);
--
-- Shortest path between two entities (Gotham "show me the connection"):
--   SELECT * FROM cypher('osiris_graph', $$
--     MATCH p = shortestPath((a:Entity {uuid: $src})-[*..6]-(b:Entity {uuid: $dst}))
--     RETURN p
--   $$) AS (p agtype);
