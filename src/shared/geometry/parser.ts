import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  Geometry,
  MultiPolygon,
  Polygon
} from 'geojson';
import wellknown from 'wellknown';

export type InputFormat = 'geojson' | 'wkt' | 'kml';

export type ParsedPolygonInput = {
  format: InputFormat;
  feature: Feature<Polygon | MultiPolygon, GeoJsonProperties>;
};

export function parsePolygonInput(rawText: string): ParsedPolygonInput {
  const text = rawText.trim();
  if (!text) {
    throw new Error('Input is empty. Paste a WKT or GeoJSON polygon.');
  }

  const jsonCandidate = tryParseJson(text);
  if (jsonCandidate !== null) {
    const geometry = extractPolygonGeometry(jsonCandidate);
    if (!geometry) {
      throw new Error('GeoJSON must contain a Polygon or MultiPolygon geometry.');
    }

    return {
      format: 'geojson',
      feature: {
        type: 'Feature',
        properties: {},
        geometry
      }
    };
  }

  const wktGeometry = (wellknown as any).parse(text) as Geometry | null;
  if (!wktGeometry || (wktGeometry.type !== 'Polygon' && wktGeometry.type !== 'MultiPolygon')) {
    throw new Error('WKT must describe a POLYGON or MULTIPOLYGON geometry.');
  }

  return {
    format: 'wkt',
    feature: {
      type: 'Feature',
      properties: {},
      geometry: wktGeometry
    }
  };
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractPolygonGeometry(value: unknown): Polygon | MultiPolygon | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const maybeGeoJson = value as {
    type?: string;
    geometry?: Geometry;
    features?: Feature[];
  };

  if (maybeGeoJson.type === 'Polygon' || maybeGeoJson.type === 'MultiPolygon') {
    return maybeGeoJson as Polygon | MultiPolygon;
  }

  if (maybeGeoJson.type === 'Feature' && maybeGeoJson.geometry) {
    const geometry = maybeGeoJson.geometry;
    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      return geometry;
    }
  }

  if (maybeGeoJson.type === 'FeatureCollection' && Array.isArray(maybeGeoJson.features)) {
    const firstPolygon = (maybeGeoJson as FeatureCollection).features.find((feature) => {
      const geometry = feature.geometry;
      return geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon';
    });

    if (firstPolygon?.geometry && (firstPolygon.geometry.type === 'Polygon' || firstPolygon.geometry.type === 'MultiPolygon')) {
      return firstPolygon.geometry;
    }
  }

  return null;
}
