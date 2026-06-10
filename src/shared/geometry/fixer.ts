import type { Feature, GeoJsonProperties, MultiPolygon, Polygon, Position } from 'geojson';
import {
  area,
  booleanClockwise,
  booleanPointInPolygon,
  point,
  polygon,
  rewind,
  unkinkPolygon
} from '@turf/turf';

export type FixResult = {
  fixedFeature: Feature<Polygon | MultiPolygon, GeoJsonProperties>;
  notes: string[];
};

export function fixPolygonFeature(
  feature: Feature<Polygon | MultiPolygon, GeoJsonProperties>
): FixResult {
  const notes: string[] = [];
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;

  const fixedPolygons = polygons
    .map((coordinates, polygonIndex) => {
      const cleanedRings = coordinates
        .map((ring) => normalizeRing(ring))
        .filter((ring) => ring.length >= 4);

      if (cleanedRings.length === 0) {
        notes.push(`Polygon ${polygonIndex + 1} was removed because all rings were invalid.`);
        return null;
      }

      const shell = enforceRingOrientation(cleanedRings[0], false);
      const holes = cleanedRings
        .slice(1)
        .map((ring) => enforceRingOrientation(ring, true))
        .filter((ring) => {
          const inside = booleanPointInPolygon(point(ring[0]), polygon([shell]));
          if (!inside) {
            notes.push(`Dropped a hole outside polygon ${polygonIndex + 1}.`);
          }
          return inside;
        });

      return [shell, ...holes];
    })
    .filter((item): item is Position[][] => Boolean(item));

  let fixedFeature: Feature<Polygon | MultiPolygon, GeoJsonProperties> = {
    type: 'Feature',
    properties: { ...feature.properties },
    geometry:
      feature.geometry.type === 'Polygon'
        ? {
            type: 'Polygon',
            coordinates: fixedPolygons[0] ?? []
          }
        : {
            type: 'MultiPolygon',
            coordinates: fixedPolygons
          }
  };

  const unkinked = unkinkPolygon(fixedFeature);
  if (unkinked.features.length > 1) {
    notes.push(`Resolved self-intersections by splitting into ${unkinked.features.length} polygons.`);
    const largest = [...unkinked.features].sort((a, b) => area(b) - area(a))[0];
    fixedFeature = {
      type: 'Feature',
      properties: { ...fixedFeature.properties },
      geometry: largest.geometry as Polygon
    };
  } else if (unkinked.features.length === 1) {
    fixedFeature = {
      type: 'Feature',
      properties: { ...fixedFeature.properties },
      geometry: unkinked.features[0].geometry as Polygon
    };
  }

  fixedFeature = rewind(fixedFeature, { mutate: false, reverse: false }) as Feature<
    Polygon | MultiPolygon,
    GeoJsonProperties
  >;

  return { fixedFeature, notes };
}

function normalizeRing(inputRing: Position[]): Position[] {
  const deduped = inputRing.reduce<Position[]>((acc, current) => {
    const previous = acc[acc.length - 1];
    if (!previous || previous[0] !== current[0] || previous[1] !== current[1]) {
      acc.push([current[0], current[1]]);
    }
    return acc;
  }, []);

  if (deduped.length === 0) {
    return deduped;
  }

  const first = deduped[0];
  const last = deduped[deduped.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    deduped.push([first[0], first[1]]);
  }

  return deduped;
}

function enforceRingOrientation(ring: Position[], shouldBeClockwise: boolean): Position[] {
  if (ring.length < 4) {
    return ring;
  }

  const isClockwise = booleanClockwise({ type: 'LineString', coordinates: ring });
  if (isClockwise === shouldBeClockwise) {
    return ring;
  }

  return [...ring].reverse();
}
