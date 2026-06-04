import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeOpenMeteoForecast } from './forecast.ts';

test('normalizes Open-Meteo current and hourly forecast into risk summary', () => {
  const result = normalizeOpenMeteoForecast({
    latitude: 52.52,
    longitude: 13.42,
    current: {
      time: '2026-06-04T08:45',
      temperature_2m: 19.9,
      wind_speed_10m: 11.8,
      precipitation: 0,
      rain: 0,
      weather_code: 80,
    },
    hourly: {
      time: ['2026-06-04T09:00', '2026-06-04T10:00'],
      precipitation_probability: [20, 90],
      wind_speed_10m: [10, 45],
      wind_gusts_10m: [20, 80],
    },
  });

  assert.equal(result.lat, 52.52);
  assert.equal(result.lng, 13.42);
  assert.equal(result.risk.level, 'high');
  assert.equal(result.risk.maxPrecipitationProbability, 90);
  assert.equal(result.source.provider, 'Open-Meteo');
});
