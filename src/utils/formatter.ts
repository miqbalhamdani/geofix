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

  if (format === 'kml') {
    return toKml(feature.geometry);
  }

  return JSON.stringify(feature, null, 2);
}

function toKml(geometry: Polygon | MultiPolygon): string {
  const placemarkBody =
    geometry.type === 'Polygon'
      ? polygonToKml(geometry.coordinates)
      : `<MultiGeometry>${geometry.coordinates.map((polygonCoords) => polygonToKml(polygonCoords)).join('')}</MultiGeometry>`;

  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n  <Placemark>\n    ${placemarkBody}\n  </Placemark>\n</kml>`;
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
