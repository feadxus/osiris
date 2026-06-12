/**
 * ═══════════════════════════════════════════════════════════════
 *  OSIRIS — Foundry Store Layer (Barrel Exports)
 *  Central data access layer for OSIRIS persistence.
 *
 *  Steps2 improvement: All data operations go through this store
 *  layer instead of localStorage/flat files. Falls back to
 *  in-memory when Postgres is unavailable.
 * ═══════════════════════════════════════════════════════════════
 */

export {
  initDB,
  query,
  graphQuery,
  isDBAvailable,
  closeDB,
  getPool,
} from './db';

export {
  ensureStore as ensureEntityStore,
  getEntities,
  getEntity,
  upsertEntity,
  deleteEntity,
  getRelationships,
  createRelationship,
  deleteRelationship,
  getGraph,
  expandEntity,
  runCrossReference,
} from './entity-store';

export {
  ensurePinStore,
  getPins,
  getPin,
  upsertPin,
  upsertPins,
  deletePin,
  deletePins,
  clearExpiredPins,
} from './pin-store';
