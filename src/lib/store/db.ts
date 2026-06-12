/**
 * ═══════════════════════════════════════════════════════════════
 *  OSIRIS — Foundry Database Connection Layer
 *  Manages Postgres connection with pgvector + Apache AGE
 *  Graceful fallback when DB is unavailable (in-memory mode)
 * ═══════════════════════════════════════════════════════════════
 *
 * Architecture:
 * - Uses the `pg` npm package (pure JS, no native deps)
 * - Auto-detects DB availability → falls back to ephemeral in-memory store
 * - AGE (Apache AGE) graph queries use the `ag_catalog` for Cypher-like traversal
 * - pgvector similarity searches use the `vector` extension with cosine distance
 */

import { Pool, PoolConfig, QueryResult } from 'pg';

// ── Connection Config ──

let pool: Pool | null = null;
let dbAvailable = false;
let dbCheckDone = false;

interface DBConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

function getDBConfig(): DBConfig | null {
  const url = process.env.DATABASE_URL || '';
  if (url) {
    try {
      const u = new URL(url);
      return {
        host: u.hostname || 'localhost',
        port: parseInt(u.port || '5432', 10),
        database: u.pathname.replace(/^\//, '') || 'osiris',
        user: decodeURIComponent(u.username || 'osiris'),
        password: decodeURIComponent(u.password || 'osiris_pass'),
      };
    } catch { /* fall through to defaults */ }
  }
  // Fall back to individual env vars or defaults
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'osiris',
    user: process.env.DB_USER || 'osiris',
    password: process.env.DB_PASSWORD || 'osiris_pass',
  };
}

/**
 * Initialize the database connection pool.
 * Tests connectivity on first call — sets `dbAvailable` flag.
 */
export async function initDB(): Promise<boolean> {
  if (dbCheckDone) return dbAvailable;
  dbCheckDone = true;

  const config = getDBConfig();
  if (!config) {
    console.warn('[OsirisDB] No database config found — running in in-memory mode');
    return false;
  }

  try {
    const poolConfig: PoolConfig = {
      host: config.host,
      port: config.port,
      database: config.database,
      user: config.user,
      password: config.password,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };

    pool = new Pool(poolConfig);

    // Quick connectivity test
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();

    dbAvailable = true;
    console.log(`[OsirisDB] Connected to Postgres at ${config.host}:${config.port}/${config.database}`);
    return true;
  } catch (err) {
    console.warn('[OsirisDB] Postgres unavailable — running in in-memory mode:', (err as Error).message);
    pool = null;
    return false;
  }
}

/**
 * Execute a SQL query. Returns null if DB is unavailable.
 */
export async function query(
  text: string,
  params?: any[]
): Promise<QueryResult<any> | null> {
  if (!pool || !dbAvailable) return null;
  try {
    return await pool.query(text, params);
  } catch (err) {
    console.error('[OsirisDB] Query error:', (err as Error).message);
    return null;
  }
}

/**
 * Execute a graph query via Apache AGE's ag_catalog.
 * AGE wraps Cypher queries as SQL functions:
 *   SELECT * FROM cypher('osiris_graph', $$ MATCH (n) RETURN n $$) AS (n agtype);
 */
export async function graphQuery(
  cypher: string,
  graphName: string = 'osiris_graph'
): Promise<any[]> {
  const sql = `SELECT * FROM cypher('${graphName}', $$ ${cypher} $$) AS (result agtype)`;
  const result = await query(sql);
  if (!result) return [];
  return result.rows.map(r => r.result);
}

/**
 * Get the pool instance for direct use.
 */
export function getPool(): Pool | null {
  return pool;
}

/**
 * Check if the database is currently available.
 */
export function isDBAvailable(): boolean {
  return dbAvailable;
}

/**
 * Close the pool (for shutdown / testing).
 */
export async function closeDB(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    dbAvailable = false;
    dbCheckDone = false;
  }
}

// Auto-init on first import in server context (pre-warm for faster first request)
if (typeof window === 'undefined' && process.env.NODE_ENV !== 'test') {
  initDB().catch(() => {});
}
