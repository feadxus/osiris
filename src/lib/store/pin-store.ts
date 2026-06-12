/**
 * ═══════════════════════════════════════════════════════════════
 *  OSIRIS — Intel Pins Persistent Store
 *  Replaces localStorage with API-backed persistence
 *  Falls back to in-memory when DB unavailable
 *
 *  Steps2-inspired improvements:
 *  - Durable pin storage with Postgres backend
 *  - Search/filter/sort at the API level
 *  - Server-side expiry cleanup
 * ═══════════════════════════════════════════════════════════════
 */

import { query, isDBAvailable, initDB } from './db';
import { IntelPin, PinSeverity, PinCategory } from '../intel-pins';

// ── In-Memory Fallback ──

let memPins: IntelPin[] = [];

// ── Initialisation ──

let initialized = false;

export async function ensurePinStore(): Promise<void> {
  if (initialized) return;
  initialized = true;

  const avail = await initDB();
  if (!avail) {
    console.log('[PinStore] Using in-memory fallback');
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS intel_pins (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      lat REAL NOT NULL,
      lng REAL NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      category TEXT NOT NULL DEFAULT 'general',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      linked_entity TEXT,
      linked_entity_type TEXT,
      tags TEXT[] DEFAULT '{}'
    )
  `);

  await query('CREATE INDEX IF NOT EXISTS idx_pins_severity ON intel_pins(severity)');
  await query('CREATE INDEX IF NOT EXISTS idx_pins_category ON intel_pins(category)');
  await query('CREATE INDEX IF NOT EXISTS idx_pins_location ON intel_pins(lat, lng)');
  await query('CREATE INDEX IF NOT EXISTS idx_pins_expires ON intel_pins(expires_at)');
  await query('CREATE INDEX IF NOT EXISTS idx_pins_tags ON intel_pins USING GIN(tags)');

  console.log('[PinStore] DB tables ready');
}

// ── CRUD Operations ──

/**
 * Get all non-expired pins with optional filters.
 */
export async function getPins(options?: {
  severity?: PinSeverity;
  category?: PinCategory;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<{ pins: IntelPin[]; total: number }> {
  await ensurePinStore();

  if (!isDBAvailable()) {
    // In-memory: filter + dedupe expired
    const now = Date.now();
    let filtered = memPins.filter(p => !p.expiresAt || p.expiresAt > now);
    if (options?.severity) filtered = filtered.filter(p => p.severity === options.severity);
    if (options?.category) filtered = filtered.filter(p => p.category === options.category);
    if (options?.search) {
      const q = options.search.toLowerCase();
      filtered = filtered.filter(p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    const total = filtered.length;
    const limit = options?.limit || 500;
    const offset = options?.offset || 0;
    return { pins: filtered.slice(offset, offset + limit), total };
  }

  // DB: use database filtering
  const conditions: string[] = ['(expires_at IS NULL OR expires_at > NOW())'];
  const params: any[] = [];
  let idx = 1;

  if (options?.severity) {
    conditions.push(`severity = $${idx++}`);
    params.push(options.severity);
  }
  if (options?.category) {
    conditions.push(`category = $${idx++}`);
    params.push(options.category);
  }
  if (options?.search) {
    conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx} OR $${idx} = ANY(tags))`);
    params.push(`%${options.search}%`);
    idx++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;
  const limit = options?.limit || 500;
  const offset = options?.offset || 0;

  const countResult = await query(`SELECT COUNT(*) as total FROM intel_pins ${where}`, params);
  const total = countResult?.rows?.[0]?.total || 0;

  const result = await query(
    `SELECT * FROM intel_pins ${where} ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`,
    [...params, limit, offset]
  );

  return {
    pins: (result?.rows || []).map(rowToPin),
    total,
  };
}

/**
 * Get a single pin by ID.
 */
export async function getPin(id: string): Promise<IntelPin | null> {
  await ensurePinStore();

  if (!isDBAvailable()) {
    return memPins.find(p => p.id === id) || null;
  }

  const result = await query('SELECT * FROM intel_pins WHERE id = $1', [id]);
  if (!result?.rows?.length) return null;
  return rowToPin(result.rows[0]);
}

/**
 * Create or update a pin.
 */
export async function upsertPin(pin: IntelPin): Promise<IntelPin> {
  await ensurePinStore();

  if (!isDBAvailable()) {
    const idx = memPins.findIndex(p => p.id === pin.id);
    if (idx >= 0) {
      memPins[idx] = { ...memPins[idx], ...pin, updatedAt: Date.now() };
    } else {
      memPins.push(pin);
    }
    return pin;
  }

  await query(
    `INSERT INTO intel_pins (id, title, description, lat, lng, severity, category, created_at, updated_at, expires_at, linked_entity, linked_entity_type, tags)
     VALUES ($1, $2, $3, $4, $5, $6, $7, to_timestamp($8::double precision / 1000), NOW(), 
             CASE WHEN $9 IS NOT NULL THEN to_timestamp($9::double precision / 1000) ELSE NULL END,
             $10, $11, $12::text[])
     ON CONFLICT (id) DO UPDATE SET
       title = EXCLUDED.title,
       description = EXCLUDED.description,
       lat = EXCLUDED.lat,
       lng = EXCLUDED.lng,
       severity = EXCLUDED.severity,
       category = EXCLUDED.category,
       updated_at = NOW(),
       expires_at = CASE WHEN EXCLUDED.expires_at IS NOT NULL THEN to_timestamp(EXTRACT(EPOCH FROM EXCLUDED.expires_at)) ELSE NULL END,
       linked_entity = EXCLUDED.linked_entity,
       linked_entity_type = EXCLUDED.linked_entity_type,
       tags = EXCLUDED.tags`,
    [
      pin.id, pin.title, pin.description, pin.lat, pin.lng,
      pin.severity, pin.category,
      pin.createdAt,
      pin.expiresAt || null,
      pin.linkedEntity || null,
      pin.linkedEntityType || null,
      pin.tags,
    ]
  );

  return pin;
}

/**
 * Batch upsert multiple pins.
 */
export async function upsertPins(pins: IntelPin[]): Promise<IntelPin[]> {
  const results: IntelPin[] = [];
  for (const pin of pins) {
    results.push(await upsertPin(pin));
  }
  return results;
}

/**
 * Delete a pin by ID.
 */
export async function deletePin(id: string): Promise<boolean> {
  await ensurePinStore();

  if (!isDBAvailable()) {
    const len = memPins.length;
    memPins = memPins.filter(p => p.id !== id);
    return memPins.length < len;
  }

  const result = await query('DELETE FROM intel_pins WHERE id = $1', [id]);
  return (result?.rowCount || 0) > 0;
}

/**
 * Delete multiple pins by IDs.
 */
export async function deletePins(ids: string[]): Promise<number> {
  await ensurePinStore();
  let deleted = 0;
  for (const id of ids) {
    if (await deletePin(id)) deleted++;
  }
  return deleted;
}

/**
 * Clear expired pins from the database.
 */
export async function clearExpiredPins(): Promise<number> {
  await ensurePinStore();

  if (!isDBAvailable()) {
    const now = Date.now();
    const before = memPins.length;
    memPins = memPins.filter(p => !p.expiresAt || p.expiresAt > now);
    return before - memPins.length;
  }

  const result = await query('DELETE FROM intel_pins WHERE expires_at IS NOT NULL AND expires_at < NOW()');
  return result?.rowCount || 0;
}

// ── Helpers ──

function rowToPin(row: any): IntelPin {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    lat: row.lat,
    lng: row.lng,
    severity: row.severity as PinSeverity,
    category: row.category as PinCategory,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now(),
    expiresAt: row.expires_at ? new Date(row.expires_at).getTime() : undefined,
    linkedEntity: row.linked_entity || undefined,
    linkedEntityType: row.linked_entity_type || undefined,
    tags: row.tags || [],
  };
}
