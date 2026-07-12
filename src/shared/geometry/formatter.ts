import type { Feature, FeatureCollection, GeoJsonProperties, GeometryCollection, MultiPolygon, Polygon } from 'geojson';
import wellknown from 'wellknown';
import type { EudrGeometry, InputFormat, InputShape } from './types';

export function formatGeoOutput(
  collection: FeatureCollection<EudrGeometry, GeoJsonProperties>,
  inputShape: InputShape,
  format: InputFormat
): string {
  const features = collection.features;

  if (format === 'wkt') {
    if (features.length === 1) {
      return (wellknown as any).stringify(features[0].geometry);
    }

    const geometryCollection: GeometryCollection = {
      type: 'GeometryCollection',
      geometries: features.map((feature) => feature.geometry)
    };
    return (wellknown as any).stringify(geometryCollection);
  }

  if (format === 'kml') {
    return toKml(features);
  }

  if (inputShape === 'featurecollection' || features.length > 1) {
    return JSON.stringify(collection, null, 2);
  }

  return JSON.stringify(features[0], null, 2);
}

export function formatPolygonOutput(
  feature: Feature<Polygon | MultiPolygon, GeoJsonProperties>,
  format: InputFormat
): string {
  return formatGeoOutput({ type: 'FeatureCollection', features: [feature] }, 'feature', format);
}

function toKml(features: Feature<EudrGeometry, GeoJsonProperties>[]): string {
  const placemarks = features
    .map((feature) => `  <Placemark>\n${extendedDataToKml(feature.properties)}    ${geometryToKml(feature.geometry)}\n  </Placemark>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n${placemarks}\n</Document>\n</kml>`;
}

function extendedDataToKml(properties: GeoJsonProperties): string {
  const entries = Object.entries(properties ?? {}).filter(([, value]) => value !== undefined && value !== null);
  if (entries.length === 0) {
    return '';
  }

  const data = entries
    .map(([key, value]) => `      <Data name="${escapeXml(key)}"><value>${escapeXml(String(value))}</value></Data>`)
    .join('\n');

  return `    <ExtendedData>\n${data}\n    </ExtendedData>\n`;
}

function geometryToKml(geometry: EudrGeometry): string {
  switch (geometry.type) {
    case 'Point':
      return `<Point><coordinates>${geometry.coordinates.join(',')}</coordinates></Point>`;
    case 'MultiPoint':
      return `<MultiGeometry>${geometry.coordinates
        .map((position) => `<Point><coordinates>${position.join(',')}</coordinates></Point>`)
        .join('')}</MultiGeometry>`;
    case 'Polygon':
      return polygonToKml(geometry.coordinates);
    case 'MultiPolygon':
      return `<MultiGeometry>${geometry.coordinates.map((polygonCoords) => polygonToKml(polygonCoords)).join('')}</MultiGeometry>`;
  }
}

function polygonToKml(coordinates: number[][][]): string {
  const [outerRing, ...holeRings] = coordinates;
  const outer = ringToCoordinatesTag(outerRing, 'outerBoundaryIs');
  const holes = holeRings.map((ring) => ringToCoordinatesTag(ring, 'innerBoundaryIs')).join('');

  return `<Polygon>${outer}${holes}</Polygon>`;
}

function ringToCoordinatesTag(ring: number[][], boundaryTag: 'outerBoundaryIs' | 'innerBoundaryIs'): string {
  const kmlCoordinates = ring.map((position) => position.join(',')).join(' ');
  return `<${boundaryTag}><LinearRing><coordinates>${kmlCoordinates}</coordinates></LinearRing></${boundaryTag}>`;
}

function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
