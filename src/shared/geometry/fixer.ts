import type { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Polygon, Position } from 'geojson';
import { area, booleanClockwise, rewind, unkinkPolygon } from '@turf/turf';
import { COORD_DECIMALS, fixEudrProperties } from './eudr';
import type { EudrFeature, EudrGeometry } from './types';

export type FixResult = {
  fixedFeature: Feature<Polygon | MultiPolygon, GeoJsonProperties>;
  notes: string[];
};

export type CollectionFixResult = {
  fixedCollection: FeatureCollection<EudrGeometry, GeoJsonProperties>;
  notes: string[];
};

export function fixGeoCollection(
  collection: FeatureCollection<EudrGeometry, GeoJsonProperties>
): CollectionFixResult {
  const notes: string[] = [];
  const multipleFeatures = collection.features.length > 1;

  const fixedFeatures = collection.features.map((feature, index) => {
    const featureNotes: string[] = [];
    let fixed: EudrFeature;

    if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      const result = fixPolygonFeature(feature as Feature<Polygon | MultiPolygon, GeoJsonProperties>);
      featureNotes.push(...result.notes);
      fixed = result.fixedFeature;
    } else {
      const result = fixPointFeature(feature);
      featureNotes.push(...result.notes);
      fixed = result.fixedFeature;
    }

    const propertyFix = fixEudrProperties(fixed.properties);
    featureNotes.push(...propertyFix.notes);
    fixed = { ...fixed, properties: propertyFix.fixed };

    notes.push(...featureNotes.map((note) => (multipleFeatures ? `Feature ${index + 1} — ${note}` : note)));
    return fixed;
  });

  return {
    fixedCollection: { type: 'FeatureCollection', features: fixedFeatures },
    notes
  };
}

export function fixPolygonFeature(
  feature: Feature<Polygon | MultiPolygon, GeoJsonProperties>
): FixResult {
  const notes: string[] = [];
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;

  const fixedPolygons = polygons
    .map((coordinates, polygonIndex) => {
      if (coordinates.length > 1) {
        notes.push(
          `Removed ${coordinates.length - 1} interior ring(s) from polygon ${polygonIndex + 1}: EUDR does not accept holes — submit them as separate polygons.`
        );
      }

      const outerRing = coordinates[0] ? normalizeRing(coordinates[0], notes, polygonIndex) : [];
      if (outerRing.length < 4) {
        notes.push(`Polygon ${polygonIndex + 1} was removed because its outer ring was invalid.`);
        return null;
      }

      return [enforceRingOrientation(outerRing, false)];
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

  try {
    const unkinked = unkinkPolygon(fixedFeature);
    if (unkinked.features.length > 1) {
      notes.push(`Resolved self-intersections by splitting into ${unkinked.features.length} polygons and keeping the largest.`);
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
  } catch {
    notes.push('Skipped self-intersection repair: the geometry was too degenerate to process.');
  }

  fixedFeature = rewind(fixedFeature, { mutate: false, reverse: false }) as Feature<
    Polygon | MultiPolygon,
    GeoJsonProperties
  >;

  return { fixedFeature, notes };
}

function fixPointFeature(feature: EudrFeature): { fixedFeature: EudrFeature; notes: string[] } {
  const notes: string[] = [];
  const geometry = feature.geometry;

  if (geometry.type === 'Point') {
    return {
      fixedFeature: { ...feature, geometry: { type: 'Point', coordinates: roundPosition(geometry.coordinates) } },
      notes
    };
  }

  if (geometry.type === 'MultiPoint') {
    const rounded = geometry.coordinates.map(roundPosition);
    const deduped = rounded.filter((position, index) => {
      return !rounded.slice(0, index).some((other) => other[0] === position[0] && other[1] === position[1]);
    });

    if (deduped.length < rounded.length) {
      notes.push(`Removed ${rounded.length - deduped.length} duplicate point(s) at ${COORD_DECIMALS}-decimal precision.`);
    }

    return {
      fixedFeature: { ...feature, geometry: { type: 'MultiPoint', coordinates: deduped } },
      notes
    };
  }

  return { fixedFeature: feature, notes };
}

function normalizeRing(inputRing: Position[], notes: string[], polygonIndex: number): Position[] {
  const rounded = inputRing.map(roundPosition);

  const deduped = rounded.reduce<Position[]>((acc, current) => {
    const previous = acc[acc.length - 1];
    if (!previous || previous[0] !== current[0] || previous[1] !== current[1]) {
      acc.push([current[0], current[1]]);
    }
    return acc;
  }, []);

  if (deduped.length < rounded.length - closingPairOffset(rounded)) {
    notes.push(
      `Removed duplicate coordinates from polygon ${polygonIndex + 1} at ${COORD_DECIMALS}-decimal precision (EUDR rounds coordinates to ${COORD_DECIMALS} decimals).`
    );
  }

  if (deduped.length === 0) {
    return deduped;
  }

  const withoutCollinear = removeCollinearPoints(deduped);
  if (withoutCollinear.length < deduped.length) {
    notes.push(`Removed ${deduped.length - withoutCollinear.length} collinear point(s) from polygon ${polygonIndex + 1}.`);
  }

  const ring = withoutCollinear;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return ring;
}

function closingPairOffset(ring: Position[]): number {
  if (ring.length < 2) {
    return 0;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? 1 : 0;
}

function removeCollinearPoints(ring: Position[]): Position[] {
  if (ring.length < 3) {
    return ring;
  }

  const isClosed = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  const open = isClosed ? ring.slice(0, -1) : ring;

  const kept = open.filter((current, index) => {
    if (open.length <= 3) {
      return true;
    }

    const previous = open[(index - 1 + open.length) % open.length];
    const next = open[(index + 1) % open.length];
    const cross = (current[0] - previous[0]) * (next[1] - previous[1]) - (current[1] - previous[1]) * (next[0] - previous[0]);
    return Math.abs(cross) > 1e-12;
  });

  if (kept.length < 3) {
    return ring;
  }

  return isClosed ? [...kept, [kept[0][0], kept[0][1]]] : kept;
}

function roundPosition(position: Position): Position {
  return [Number(position[0].toFixed(COORD_DECIMALS)), Number(position[1].toFixed(COORD_DECIMALS))];
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
