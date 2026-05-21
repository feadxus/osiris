const FALLBACK_MAP_VIEW = {
  latitude: 42.70,
  longitude: 25.48,
  zoom: 6.5,
};

function readNumber(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) return fallback;
  return parsed;
}

export const DEFAULT_MAP_VIEW = {
  latitude: readNumber(
    process.env.NEXT_PUBLIC_OSIRIS_DEFAULT_MAP_LATITUDE,
    FALLBACK_MAP_VIEW.latitude,
    -90,
    90,
  ),
  longitude: readNumber(
    process.env.NEXT_PUBLIC_OSIRIS_DEFAULT_MAP_LONGITUDE,
    FALLBACK_MAP_VIEW.longitude,
    -180,
    180,
  ),
  zoom: readNumber(
    process.env.NEXT_PUBLIC_OSIRIS_DEFAULT_MAP_ZOOM,
    FALLBACK_MAP_VIEW.zoom,
    1.5,
    18,
  ),
};
