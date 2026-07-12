import type {
  Feature,
  GeoJsonProperties,
  Geometry,
  MultiPolygon,
  Polygon,
  Position
} from 'geojson';
import wellknown from 'wellknown';
import type { EudrGeometry, InputFormat, InputShape, ParsedGeoInput } from './types';

export type { InputFormat, ParsedGeoInput } from './types';

export type ParsedPolygonInput = {
  format: InputFormat;
  feature: Feature<Polygon | MultiPolygon, GeoJsonProperties>;
};

const SUPPORTED_TYPES = new Set(['Point', 'MultiPoint', 'Polygon', 'MultiPolygon']);
const REJECTED_TYPES = new Set(['LineString', 'MultiLineString']);

export function parseGeoInput(rawText: string): ParsedGeoInput {
  const text = rawText.trim();
  if (!text) {
    throw new Error('Input is empty. Paste a WKT or GeoJSON geometry.');
  }

  const parseNotes: string[] = [];

  const jsonCandidate = tryParseJson(text);
  if (jsonCandidate !== null) {
    validateCrsMember(jsonCandidate);
    const { features, inputShape } = extractFeatures(jsonCandidate, parseNotes);
    return {
      format: 'geojson',
      collection: { type: 'FeatureCollection', features },
      inputShape,
      parseNotes
    };
  }

  const wktGeometry = (wellknown as any).parse(text) as Geometry | null;
  if (!wktGeometry) {
    throw new Error('Input is not valid GeoJSON or WKT.');
  }

  const wktFeatures = geometryToFeatures(wktGeometry, {}, parseNotes);
  if (wktFeatures.length === 0) {
    throw new Error(
      'WKT must describe a POINT, MULTIPOINT, POLYGON or MULTIPOLYGON — LINESTRING geometries are not accepted by the EUDR system (EUDR error #5).'
    );
  }

  return {
    format: 'wkt',
    collection: { type: 'FeatureCollection', features: wktFeatures },
    inputShape: 'geometry',
    parseNotes
  };
}

/**
 * Backwards-compatible single-polygon parser used by the overlap page.
 * Picks the first Polygon/MultiPolygon feature of the input.
 */
export function parsePolygonInput(rawText: string): ParsedPolygonInput {
  const parsed = parseGeoInput(rawText);
  const polygonFeature = parsed.collection.features.find(
    (feature) => feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon'
  );

  if (!polygonFeature) {
    throw new Error('Input must contain a Polygon or MultiPolygon geometry.');
  }

  return {
    format: parsed.format,
    feature: polygonFeature as Feature<Polygon | MultiPolygon, GeoJsonProperties>
  };
}

function tryParseJson(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function validateCrsMember(value: unknown): void {
  const crs = (value as { crs?: { properties?: { name?: string } } }).crs;
  if (!crs) {
    return;
  }

  const name = crs.properties?.name ?? '';
  const isWgs84 = /CRS84|4326|WGS\s*84/i.test(name);
  if (!isWgs84) {
    throw new Error(
      `Unsupported CRS "${name}". EUDR only accepts WGS84 (EPSG:4326) with longitude,latitude in decimal degrees.`
    );
  }
}

function extractFeatures(
  value: unknown,
  parseNotes: string[]
): { features: Feature<EudrGeometry, GeoJsonProperties>[]; inputShape: InputShape } {
  if (!value || typeof value !== 'object') {
    throw new Error('GeoJSON must be an object with a "type" member.');
  }

  const maybeGeoJson = value as {
    type?: string;
    geometry?: Geometry;
    geometries?: Geometry[];
    properties?: GeoJsonProperties;
    features?: Feature[];
  };

  if (maybeGeoJson.type === 'FeatureCollection') {
    if (!Array.isArray(maybeGeoJson.features)) {
      throw new Error('FeatureCollection is missing its "features" array.');
    }

    const features = maybeGeoJson.features.flatMap((feature, index) => {
      if (!feature?.geometry) {
        parseNotes.push(`Skipped feature ${index + 1}: it has no geometry.`);
        return [];
      }
      return geometryToFeatures(feature.geometry, feature.properties ?? {}, parseNotes, index + 1);
    });

    if (features.length === 0) {
      throw new Error(
        'FeatureCollection contains no supported geometry. EUDR accepts Point, MultiPoint, Polygon and MultiPolygon only.'
      );
    }

    return { features, inputShape: 'featurecollection' };
  }

  if (maybeGeoJson.type === 'Feature') {
    if (!maybeGeoJson.geometry) {
      throw new Error('Feature is missing its "geometry" member.');
    }

    const features = geometryToFeatures(maybeGeoJson.geometry, maybeGeoJson.properties ?? {}, parseNotes);
    if (features.length === 0) {
      throw rejectedGeometryError(maybeGeoJson.geometry.type);
    }

    return { features, inputShape: 'feature' };
  }

  if (maybeGeoJson.type && (SUPPORTED_TYPES.has(maybeGeoJson.type) || REJECTED_TYPES.has(maybeGeoJson.type) || maybeGeoJson.type === 'GeometryCollection')) {
    const features = geometryToFeatures(maybeGeoJson as unknown as Geometry, {}, parseNotes);
    if (features.length === 0) {
      throw rejectedGeometryError(maybeGeoJson.type);
    }

    return { features, inputShape: 'geometry' };
  }

  throw new Error(
    'GeoJSON must contain a Point, MultiPoint, Polygon or MultiPolygon geometry (as geometry, Feature or FeatureCollection).'
  );
}

function geometryToFeatures(
  geometry: Geometry,
  properties: GeoJsonProperties,
  parseNotes: string[],
  featureNumber?: number
): Feature<EudrGeometry, GeoJsonProperties>[] {
  if (geometry.type === 'GeometryCollection') {
    return geometry.geometries.flatMap((member) => geometryToFeatures(member, properties, parseNotes, featureNumber));
  }

  const label = featureNumber ? `feature ${featureNumber}` : 'geometry';

  if (REJECTED_TYPES.has(geometry.type)) {
    parseNotes.push(
      `Skipped ${label}: ${geometry.type} geometries are not accepted by the EUDR system (EUDR error #5).`
    );
    return [];
  }

  if (!SUPPORTED_TYPES.has(geometry.type)) {
    parseNotes.push(`Skipped ${label}: unsupported geometry type "${geometry.type}".`);
    return [];
  }

  const normalized = normalizePointCoordinates(geometry as EudrGeometry, parseNotes, label);

  return [
    {
      type: 'Feature',
      properties: { ...properties },
      geometry: normalized
    }
  ];
}

function normalizePointCoordinates(geometry: EudrGeometry, parseNotes: string[], label: string): EudrGeometry {
  if (geometry.type === 'Point' && Array.isArray((geometry.coordinates as unknown[])[0])) {
    const nested = geometry.coordinates as unknown as Position[];
    parseNotes.push(
      `Flattened nested Point coordinates on ${label}: EUDR expects a flat [longitude, latitude] array, not an array of arrays (EUDR error #14).`
    );
    return { type: 'Point', coordinates: nested[0] };
  }

  return geometry;
}

function rejectedGeometryError(type: string | undefined): Error {
  if (type && REJECTED_TYPES.has(type)) {
    return new Error(
      `${type} geometries are not accepted by the EUDR system (EUDR error #5). Use Point, MultiPoint, Polygon or MultiPolygon.`
    );
  }

  return new Error('GeoJSON must contain a Point, MultiPoint, Polygon or MultiPolygon geometry.');
}
