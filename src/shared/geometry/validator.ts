import type { Feature, FeatureCollection, GeoJsonProperties, MultiPolygon, Position, Polygon } from 'geojson';
import {
  booleanClockwise,
  booleanValid,
  kinks,
  lineString,
  simplify
} from '@turf/turf';
import { COORD_DECIMALS, validateEudrProperties } from './eudr';
import type { EudrGeometry } from './types';

export type ValidationIssue = {
  type: string;
  message: string;
  status: 'error' | 'warning' | 'info';
  featureIndex?: number;
  eudrErrorCode?: number;
};

export type ValidationResult = {
  isValid: boolean;
  issues: ValidationIssue[];
};

export function validateGeoCollection(
  collection: FeatureCollection<EudrGeometry, GeoJsonProperties>
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const multipleFeatures = collection.features.length > 1;

  collection.features.forEach((feature, index) => {
    const featureIssues: ValidationIssue[] = [];
    const geometry = feature.geometry;

    featureIssues.push(...validateCoordinateRange(geometry));

    if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
      featureIssues.push(
        ...validatePolygonFeature(feature as Feature<Polygon | MultiPolygon, GeoJsonProperties>).issues
      );
    }

    featureIssues.push(...validateEudrProperties(feature.properties, geometry.type));

    featureIssues.forEach((issue) => {
      issues.push(multipleFeatures ? { ...issue, featureIndex: index } : issue);
    });
  });

  return {
    isValid: !issues.some((issue) => issue.status === 'error'),
    issues
  };
}

export function validatePolygonFeature(
  feature: Feature<Polygon | MultiPolygon, GeoJsonProperties>
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const polygons = feature.geometry.type === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;

  polygons.forEach((polygonCoordinates, polygonIndex) => {
    const outerRing = polygonCoordinates[0];
    if (!outerRing || outerRing.length < 4) {
      issues.push({
        type: 'invalid_geometry',
        status: 'error',
        eudrErrorCode: 4,
        message: `Polygon ${polygonIndex + 1} has an invalid outer ring (at least 4 coordinate pairs are required).`
      });
      return;
    }

    if (polygonCoordinates.length > 1) {
      issues.push({
        type: 'interior_ring',
        status: 'error',
        eudrErrorCode: 15,
        message: `Polygon ${polygonIndex + 1} has ${polygonCoordinates.length - 1} interior ring(s). EUDR does not accept holes/doughnut polygons — only the outer boundary is read. Fix will remove interior rings; submit holes as separate polygons.`
      });
    }

    if (!isRingClosed(outerRing)) {
      issues.push({
        type: 'not_closed',
        status: 'error',
        eudrErrorCode: 4,
        message: `Polygon ${polygonIndex + 1} is not closed (first and last coordinate pairs must match).`
      });
    }

    if (outerRing.length >= 4 && booleanClockwise(lineString(outerRing))) {
      issues.push({
        type: 'orientation',
        status: 'warning',
        message: `Polygon ${polygonIndex + 1} outer ring should be counter-clockwise.`
      });
    }

    if (hasDuplicateAtPrecision(outerRing)) {
      issues.push({
        type: 'duplicate_points',
        status: 'warning',
        eudrErrorCode: 7,
        message: `Polygon ${polygonIndex + 1} has consecutive coordinates that become duplicates after rounding to ${COORD_DECIMALS} decimals (EUDR rounds coordinates to ${COORD_DECIMALS} decimals).`
      });
    }

    if (isRingCollinear(outerRing)) {
      issues.push({
        type: 'collinear_ring',
        status: 'error',
        eudrErrorCode: 6,
        message: `Polygon ${polygonIndex + 1} coordinates form a straight line — the polygon has no area.`
      });
    }
  });

  try {
    const simplified = simplify(feature, { tolerance: 0, highQuality: true, mutate: false });
    const kinkFeatures = kinks(simplified).features;
    if (kinkFeatures.length > 0) {
      issues.push({
        type: 'self_intersection',
        status: 'error',
        eudrErrorCode: 1,
        message: `Detected ${kinkFeatures.length} self-intersection point(s) — figure-eight shapes and crossing lines are rejected by EUDR.`
      });
    }
  } catch {
    // kinks/simplify can throw on degenerate rings; other checks already flag those.
  }

  try {
    if (!booleanValid(feature)) {
      issues.push({
        type: 'invalid_geometry',
        status: 'error',
        message: 'Geometry failed validity checks.'
      });
    }
  } catch {
    issues.push({
      type: 'invalid_geometry',
      status: 'error',
      message: 'Geometry failed validity checks.'
    });
  }

  return {
    isValid: !issues.some((issue) => issue.status === 'error'),
    issues
  };
}

function validateCoordinateRange(geometry: EudrGeometry): ValidationIssue[] {
  const positions = collectPositions(geometry);
  const outOfRange = positions.filter(([lon, lat]) => lon < -180 || lon > 180 || lat < -90 || lat > 90);

  if (outOfRange.length === 0) {
    return [];
  }

  const swapWouldFix = positions.every(([lon, lat]) => lat >= -180 && lat <= 180 && lon >= -90 && lon <= 90);
  const hint = swapWouldFix
    ? ' The coordinates may be in latitude,longitude order — EUDR requires longitude,latitude.'
    : '';

  return [
    {
      type: 'coordinate_range',
      status: 'error',
      eudrErrorCode: 11,
      message: `${outOfRange.length} coordinate(s) are outside the valid range (longitude ±180, latitude ±90).${hint}`
    }
  ];
}

function collectPositions(geometry: EudrGeometry): Position[] {
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'MultiPoint':
      return geometry.coordinates;
    case 'Polygon':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
  }
}

function hasDuplicateAtPrecision(ring: Position[]): boolean {
  for (let i = 1; i < ring.length; i += 1) {
    const previous = ring[i - 1];
    const current = ring[i];
    const isClosingPair = i === ring.length - 1 && ring.length > 2;
    if (
      !isClosingPair &&
      previous[0].toFixed(COORD_DECIMALS) === current[0].toFixed(COORD_DECIMALS) &&
      previous[1].toFixed(COORD_DECIMALS) === current[1].toFixed(COORD_DECIMALS)
    ) {
      return true;
    }
  }

  return false;
}

function isRingCollinear(ring: Position[]): boolean {
  const unique = ring.filter((position, index) => {
    const previous = ring[index - 1];
    return !previous || previous[0] !== position[0] || previous[1] !== position[1];
  });

  if (unique.length < 3) {
    return true;
  }

  const [ax, ay] = unique[0];
  const [bx, by] = unique[1];
  for (let i = 2; i < unique.length; i += 1) {
    const [cx, cy] = unique[i];
    const cross = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(cross) > 1e-12) {
      return false;
    }
  }

  return true;
}

function isRingClosed(ring: Position[]): boolean {
  if (ring.length < 2) {
    return false;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}
