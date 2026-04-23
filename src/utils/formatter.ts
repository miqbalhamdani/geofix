import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson';
import wellknown from 'wellknown';
import type { InputFormat } from './parser';

export function formatPolygonOutput(
  feature: Feature<Polygon | MultiPolygon, GeoJsonProperties>,
  format: InputFormat
): string {
  if (format === 'wkt') {
    return (wellknown as any).stringify(feature.geometry);
  }

  return JSON.stringify(feature, null, 2);
}
