import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson';
import { area, booleanContains, booleanEqual, booleanOverlap, booleanTouches, booleanWithin, featureCollection, intersect } from '@turf/turf';

type PolygonFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties>;

export type SpatialRelationship =
  | 'equal'
  | 'overlap'
  | 'contains'
  | 'within'
  | 'touches'
  | 'disjoint';

export type OverlapResult = {
  overlaps: boolean;
  relationship: SpatialRelationship;
  relationshipLabel: string;
  reason: string;
  overlapAreaSqMeters: number;
  overlapAreaLabel: string;
  overlapPercentage: number;
  overlapPercentageLabel: string;
  intersectionPoints: string[];
};

export function detectPolygonOverlap(first: PolygonFeature, second: PolygonFeature): OverlapResult {
  const relationship = classifyRelationship(first, second);
  const areaA = area(first);
  const areaB = area(second);
  const overlapGeometry = relationship.overlaps ? getOverlapGeometry(first, second) : null;
  const overlapAreaSqMeters = overlapGeometry ? area(overlapGeometry) : 0;
  const unionArea = Math.max(areaA + areaB - overlapAreaSqMeters, 0);
  const overlapPercentage = unionArea > 0 ? (overlapAreaSqMeters / unionArea) * 100 : 0;
  const intersectionPoints = overlapGeometry ? extractIntersectionPoints(overlapGeometry) : [];

  return toResult(relationship, overlapAreaSqMeters, overlapPercentage, intersectionPoints);
}

function classifyRelationship(first: PolygonFeature, second: PolygonFeature): Pick<OverlapResult, 'overlaps' | 'relationship' | 'relationshipLabel' | 'reason'> {
  if (booleanEqual(first, second)) {
    return {
      overlaps: true,
      relationship: 'equal',
      relationshipLabel: 'Equal',
      reason: 'Both polygons are geometrically equal, so they overlap fully.'
    };
  }

  if (booleanOverlap(first, second)) {
    return {
      overlaps: true,
      relationship: 'overlap',
      relationshipLabel: 'Overlap',
      reason: 'Polygons share interior area.'
    };
  }

  if (booleanContains(first, second)) {
    return {
      overlaps: true,
      relationship: 'contains',
      relationshipLabel: 'Contains',
      reason: 'Polygon A contains Polygon B.'
    };
  }

  if (booleanWithin(first, second)) {
    return {
      overlaps: true,
      relationship: 'within',
      relationshipLabel: 'Within',
      reason: 'Polygon A is within Polygon B.'
    };
  }

  if (booleanTouches(first, second)) {
    return {
      overlaps: false,
      relationship: 'touches',
      relationshipLabel: 'Touches',
      reason: 'Polygons only touch at boundaries, which is not considered overlap.'
    };
  }

  return {
    overlaps: false,
    relationship: 'disjoint',
    relationshipLabel: 'Disjoint',
    reason: 'Polygons do not share interior area (touching boundaries does not count as overlap).'
  };
}

function toResult(
  relationship: Pick<OverlapResult, 'overlaps' | 'relationship' | 'relationshipLabel' | 'reason'>,
  overlapAreaSqMeters: number,
  overlapPercentage: number,
  intersectionPoints: string[]
): OverlapResult {
  return {
    ...relationship,
    overlapAreaSqMeters,
    overlapAreaLabel: `${formatNumber(overlapAreaSqMeters)} m2`,
    overlapPercentage,
    overlapPercentageLabel: `${formatNumber(overlapPercentage)}%`,
    intersectionPoints
  };
}

function getOverlapGeometry(first: PolygonFeature, second: PolygonFeature): Feature<Polygon | MultiPolygon, GeoJsonProperties> | null {
  try {
    return intersect(featureCollection([first, second]));
  } catch {
    return null;
  }
}

function extractIntersectionPoints(feature: Feature<Polygon | MultiPolygon, GeoJsonProperties>): string[] {
  const unique = new Map<string, [number, number]>();

  if (feature.geometry.type === 'Polygon') {
    collectRingPoints(feature.geometry.coordinates[0], unique);
  } else {
    feature.geometry.coordinates.forEach((polygon) => {
      collectRingPoints(polygon[0], unique);
    });
  }

  return Array.from(unique.values())
    .slice(0, 12)
    .map(([x, y]) => `POINT (${formatCoordinate(x)}, ${formatCoordinate(y)})`);
}

function collectRingPoints(ring: number[][], unique: Map<string, [number, number]>): void {
  ring.forEach(([x, y], index) => {
    const isClosingPoint = index === ring.length - 1 && ring.length > 1 && x === ring[0][0] && y === ring[0][1];
    if (isClosingPoint) {
      return;
    }

    const key = `${x.toFixed(9)}:${y.toFixed(9)}`;
    if (!unique.has(key)) {
      unique.set(key, [x, y]);
    }
  });
}

function formatCoordinate(value: number): string {
  return Number(value.toFixed(6)).toString();
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}
