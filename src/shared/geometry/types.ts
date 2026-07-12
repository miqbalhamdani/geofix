import type {
  Feature,
  FeatureCollection,
  GeoJsonProperties,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon
} from 'geojson';

export type InputFormat = 'geojson' | 'wkt' | 'kml';

export type EudrGeometry = Point | MultiPoint | Polygon | MultiPolygon;

export type EudrFeature = Feature<EudrGeometry, GeoJsonProperties>;

export type InputShape = 'geometry' | 'feature' | 'featurecollection';

export type ParsedGeoInput = {
  format: InputFormat;
  collection: FeatureCollection<EudrGeometry, GeoJsonProperties>;
  inputShape: InputShape;
  parseNotes: string[];
};
