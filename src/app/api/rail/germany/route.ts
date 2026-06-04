import { NextResponse } from 'next/server';
import {
  DB_TRANSPORT_REST_URL,
  fetchGermanyRailInfrastructure,
  fetchGermanyRailOperations,
  OVERPASS_INTERPRETER_URL,
  staticGermanyRailInfrastructure,
  GERMANY_RAIL_HUBS,
  type RailStationOperationStatus,
} from '@/lib/integrations/rail-germany';
import { disabledSourceStatus, errorSourceStatus, okSourceStatus } from '@/lib/integrations/source-metadata';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const limit = clampNumber(Number(searchParams.get('limit') || 160), 1, 500);
  const includeOverpass = searchParams.get('overpass') === 'true';
  const includeOperations = searchParams.get('operations') !== 'false';
  const operationHubLimit = clampNumber(Number(searchParams.get('operationHubs') || 4), 1, GERMANY_RAIL_HUBS.length);
  const departuresPerHub = clampNumber(Number(searchParams.get('departures') || 8), 1, 20);

  let infrastructure = staticGermanyRailInfrastructure();
  let overpassError: string | null = null;
  let operationStatuses: RailStationOperationStatus[] = [];
  let operationErrors: string[] = [];

  if (includeOverpass) {
    try {
      const overpassInfrastructure = await fetchGermanyRailInfrastructure(limit);
      if (overpassInfrastructure.length > 0) {
        infrastructure = mergeInfrastructure(overpassInfrastructure, infrastructure);
      }
    } catch (error) {
      overpassError = error instanceof Error ? error.message : String(error);
    }
  }

  const stations = infrastructure.filter(item => item.kind !== 'line' && typeof item.lat === 'number' && typeof item.lng === 'number');
  const lines = infrastructure.filter(item => item.kind === 'line' && item.geometry);
  if (includeOperations) {
    const operations = await fetchGermanyRailOperations(GERMANY_RAIL_HUBS.slice(0, operationHubLimit), departuresPerHub);
    operationStatuses = operations.statuses;
    operationErrors = operations.errors;
  }

  return NextResponse.json({
    infrastructure,
    stations,
    lines,
    operations: {
      enabled: includeOperations,
      stationStatus: operationStatuses,
      stats: {
        monitored_hubs: operationHubLimit,
        loaded_hubs: operationStatuses.length,
        delayed_hubs: operationStatuses.filter(station => station.status === 'delayed' || station.status === 'severe').length,
        delayed_departures: operationStatuses.reduce((sum, station) => sum + station.delayedDepartures + station.severeDepartures, 0),
        cancelled_departures: operationStatuses.reduce((sum, station) => sum + station.cancelledDepartures, 0),
        platform_changes: operationStatuses.reduce((sum, station) => sum + station.platformChanges, 0),
      },
    },
    stats: {
      total: infrastructure.length,
      facilities: stations.length,
      lines: lines.length,
      infrastructure_only: !includeOperations,
      operations_enabled: includeOperations,
    },
    partial: Boolean(overpassError) || operationErrors.length > 0,
    sources: {
      overpass: overpassError
        ? errorSourceStatus('OpenStreetMap/Overpass', `${overpassError}; returned static German rail hubs`, OVERPASS_INTERPRETER_URL)
        : includeOverpass
          ? okSourceStatus('OpenStreetMap/Overpass', OVERPASS_INTERPRETER_URL)
          : disabledSourceStatus('OpenStreetMap/Overpass', 'Using fast static German rail infrastructure fallback; pass overpass=true for live OSM enrichment.', OVERPASS_INTERPRETER_URL),
      dbTransportRest: !includeOperations
        ? disabledSourceStatus('db.transport.rest', 'Live rail operations disabled for infrastructure-only response; omit operations=false to monitor departures.', DB_TRANSPORT_REST_URL)
        : operationErrors.length > 0
          ? errorSourceStatus('db.transport.rest', `${operationStatuses.length}/${operationHubLimit} hubs loaded`, DB_TRANSPORT_REST_URL)
          : okSourceStatus('db.transport.rest', DB_TRANSPORT_REST_URL),
    },
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': includeOperations
        ? 'public, s-maxage=120, stale-while-revalidate=300'
        : 'public, s-maxage=86400, stale-while-revalidate=86400',
    },
  });
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function mergeInfrastructure<T extends { id: string }>(primary: T[], fallback: T[]): T[] {
  const ids = new Set(primary.map(item => item.id));
  return [...primary, ...fallback.filter(item => !ids.has(item.id))];
}
