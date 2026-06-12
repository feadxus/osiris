/**
 * ════════════════════════════════════════════════════════════════
 *  OSIRIS — Intel Pins API
 *  Server-side persistence for intelligence pins
 *  Replaces localStorage with durable storage (Postgres or in-memory)
 *
 *  Steps2 improvement: Durable pin storage with server-side
 *  expiry cleanup, search/filter, and batch operations.
 * ════════════════════════════════════════════════════════════════
 */

import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

let store: typeof import('@/lib/store/pin-store') | null = null;

async function getStore() {
  if (!store) {
    store = await import('@/lib/store/pin-store');
  }
  return store;
}

/**
 * GET /api/pins
 * List pins with optional filters.
 *
 * Query params:
 *   severity  - Filter by severity (info|watch|alert|critical)
 *   category  - Filter by category (observation|threat|infrastructure|source|general)
 *   search    - Full-text search across title, description, tags
 *   limit     - Max results
 *   offset    - Pagination offset
 *   clear-expired - If 'true', removes expired pins first
 */
export async function GET(req: NextRequest) {
  try {
    const s = await getStore();
    const { searchParams } = new URL(req.url);

    // Clear expired pins if requested
    if (searchParams.get('clear-expired') === 'true') {
      await s.clearExpiredPins();
    }

    const result = await s.getPins({
      severity: (searchParams.get('severity') as any) || undefined,
      category: (searchParams.get('category') as any) || undefined,
      search: searchParams.get('search') || undefined,
      limit: parseInt(searchParams.get('limit') || '500', 10),
      offset: parseInt(searchParams.get('offset') || '0', 10),
    });

    return NextResponse.json(result);
  } catch (e: any) {
    console.error('[Pins] GET error:', e.message);
    return NextResponse.json({ error: e.message, pins: [], total: 0 }, { status: 500 });
  }
}

/**
 * POST /api/pins
 * Create or update pins.
 *
 * Body:
 *   Single pin: { id?, title, lat, lng, severity, category, ... }
 *   Batch:      { action: 'batch', pins: [...] }
 *   Export:     { action: 'export' } — returns GeoJSON
 *   Import:     { action: 'import', geoJson: "..." } — imports from GeoJSON
 */
export async function POST(req: NextRequest) {
  try {
    const s = await getStore();
    const body = await req.json();
    const action = body.action || 'single';

    switch (action) {
      case 'batch': {
        const pins = body.pins || [];
        const results = await s.upsertPins(pins);
        return NextResponse.json({ success: true, pins: results, count: results.length });
      }

      case 'import': {
        // Import from GeoJSON
        const { importPinsGeoJSON } = await import('@/lib/intel-pins');
        const geoJson = body.geoJson || body.geojson || '';
        const imported = importPinsGeoJSON(geoJson);
        const results = await s.upsertPins(imported);
        return NextResponse.json({ success: true, pins: results, count: results.length });
      }

      case 'single':
      default: {
        const { generateId } = await import('@/lib/intel-pins');
        const pin = {
          id: body.id || generateId(),
          title: body.title || 'Untitled Pin',
          description: body.description || '',
          lat: body.lat,
          lng: body.lng,
          severity: body.severity || 'info',
          category: body.category || 'general',
          createdAt: body.createdAt || Date.now(),
          updatedAt: Date.now(),
          expiresAt: body.expiresAt,
          linkedEntity: body.linkedEntity,
          linkedEntityType: body.linkedEntityType,
          tags: body.tags || [],
        };

        // Validate required fields
        if (typeof pin.lat !== 'number' || typeof pin.lng !== 'number') {
          return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
        }

        const result = await s.upsertPin(pin);
        return NextResponse.json({ success: true, pin: result });
      }
    }
  } catch (e: any) {
    console.error('[Pins] POST error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/**
 * DELETE /api/pins?id=xxx
 * Delete a pin or batch of pins.
 *
 * Query params:
 *   id      - Single pin ID to delete
 *   ids     - Comma-separated list of IDs to delete
 *   clear-expired - If 'true', removes all expired pins
 */
export async function DELETE(req: NextRequest) {
  try {
    const s = await getStore();
    const { searchParams } = new URL(req.url);

    if (searchParams.get('clear-expired') === 'true') {
      const count = await s.clearExpiredPins();
      return NextResponse.json({ success: true, deleted: count });
    }

    const id = searchParams.get('id');
    if (id) {
      const deleted = await s.deletePin(id);
      return NextResponse.json({ success: deleted });
    }

    const ids = searchParams.get('ids');
    if (ids) {
      const idList = ids.split(',').map(x => x.trim()).filter(Boolean);
      const count = await s.deletePins(idList);
      return NextResponse.json({ success: true, deleted: count });
    }

    return NextResponse.json({ error: 'Missing id query param' }, { status: 400 });
  } catch (e: any) {
    console.error('[Pins] DELETE error:', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
