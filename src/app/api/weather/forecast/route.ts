import { NextResponse } from 'next/server';
import { fetchOpenMeteoForecast } from '@/lib/integrations/forecast';
import {
  errorSourceStatus,
  okSourceStatus,
} from '@/lib/integrations/source-metadata';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get('lat'));
  const lng = Number(searchParams.get('lng') ?? searchParams.get('lon'));

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: 'Missing or invalid lat/lng parameters' }, { status: 400 });
  }

  try {
    const forecast = await fetchOpenMeteoForecast(lat, lng);
    return NextResponse.json({
      forecast,
      timestamp: new Date().toISOString(),
      sources: {
        open_meteo: okSourceStatus('Open-Meteo', 'https://api.open-meteo.com/v1/forecast'),
      },
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=1800, stale-while-revalidate=3600' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Open-Meteo forecast failed';
    return NextResponse.json({
      forecast: null,
      timestamp: new Date().toISOString(),
      sources: {
        open_meteo: errorSourceStatus('Open-Meteo', message, 'https://api.open-meteo.com/v1/forecast'),
      },
      error: message,
    }, { status: 502 });
  }
}
