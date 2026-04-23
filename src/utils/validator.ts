import type { Feature, GeoJsonProperties, MultiPolygon, Position, Polygon } from 'geojson';
import {
  booleanClockwise,
  booleanPointInPolygon,
  booleanValid,
  kinks,
  lineString,
  point,
  polygon,
  simplify
} from '@turf/turf';

export type ValidationIssue = {
  type: string;
  message: string;
  status: 'error' | 'warning' | 'info';
};

export type ValidationResult = {
  isValid: boolean;
  issues: ValidationIssue[];
};

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
        message: `Polygon ${polygonIndex + 1} has an invalid outer ring.`
      });
      return;
    }

    polygonCoordinates.forEach((ring, ringIndex) => {
      if (!isRingClosed(ring)) {
        issues.push({
          type: 'not_closed',
          status: 'error',
          message: `Polygon ${polygonIndex + 1}, ring ${ringIndex + 1} is not closed.`
        });
      }

      if (ring.length >= 4) {
        const isClockwise = booleanClockwise(lineString(ring));
        if (ringIndex === 0 && isClockwise) {
          issues.push({
            type: 'orientation',
            status: 'warning',
            message: `Polygon ${polygonIndex + 1} outer ring should be counter-clockwise.`
          });
        }

        if (ringIndex > 0 && !isClockwise) {
          issues.push({
            type: 'orientation',
            status: 'warning',
            message: `Polygon ${polygonIndex + 1} hole ring ${ringIndex + 1} should be clockwise.`
          });
        }
      }
    });

    for (let i = 1; i < polygonCoordinates.length; i += 1) {
      const ring = polygonCoordinates[i];
      if (!ring || ring.length < 4 || !outerRing) {
        continue;
      }

      const samplePoint = point(ring[0]);
      const shell = polygon([outerRing]);
      if (!booleanPointInPolygon(samplePoint, shell)) {
        issues.push({
          type: 'hole_structure',
          status: 'error',
          message: `Polygon ${polygonIndex + 1} has a hole outside its outer ring.`
        });
      }
    }
  });

  const simplified = simplify(feature, { tolerance: 0, highQuality: true, mutate: false });
  const kinkFeatures = kinks(simplified).features;
  if (kinkFeatures.length > 0) {
    issues.push({
      type: 'self_intersection',
      status: 'error',
      message: `Detected ${kinkFeatures.length} self-intersection point(s).`
    });
  }

  if (!booleanValid(feature)) {
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

function isRingClosed(ring: Position[]): boolean {
  if (ring.length < 2) {
    return false;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1];
}
