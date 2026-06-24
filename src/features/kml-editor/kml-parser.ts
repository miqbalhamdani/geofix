/**
 * KML parsing for the KML Polygon Editor.
 *
 * Unlike `shared/geometry/parser.ts` (which only extracts geometry and discards
 * attributes), this module keeps every `<SimpleData>` attribute so it can be
 * edited and written back out. Field names are never hardcoded. It also captures
 * the document-level <Schema>, the wrapping <Folder> name, and each placemark's
 * <Style> so the file can round-trip to the same structure on export.
 */

export type Ring = number[][]; // ordered list of [longitude, latitude] positions

export type SchemaField = {
  name: string;
  type: string;
};

export type KmlSchema = {
  /** Matches the `<Schema id>` and the `<SchemaData schemaUrl="#id">` reference. */
  id: string;
  name: string;
  fields: SchemaField[];
};

export type Placemark = {
  /** Display label; defaults to `Placemark N` when the source has no `<name>`. */
  name: string;
  /** Whether the source placemark carried an explicit `<name>` (controls export). */
  hasExplicitName: boolean;
  attributes: Record<string, string>;
  /** Raw `<Style>…</Style>` markup preserved from the source, if any. */
  styleXml?: string;
  /** First ring is the outer boundary; the rest are holes. */
  rings: Ring[];
};

export type ParsedKml = {
  schema: KmlSchema;
  folderName: string;
  placemarks: Placemark[];
};

const DEFAULT_SCHEMA_ID = 'geofix_schema';
const DEFAULT_STYLE =
  '<Style><LineStyle><color>ff0000ff</color></LineStyle><PolyStyle><fill>0</fill></PolyStyle></Style>';

/**
 * Parse a KML document into editable placemarks plus the surrounding structure.
 *
 * Throws a friendly error for invalid KML, missing placemarks, a placemark
 * without a polygon, or empty coordinates.
 */
export function parseKml(xmlText: string): ParsedKml {
  const text = xmlText.trim();
  if (!text) {
    throw new Error('The KML file is empty.');
  }

  const doc = new DOMParser().parseFromString(text, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Invalid KML: the file could not be parsed as XML.');
  }

  const placemarkNodes = Array.from(doc.getElementsByTagName('Placemark'));
  if (placemarkNodes.length === 0) {
    throw new Error('No <Placemark> found in this KML file.');
  }

  const placemarks = placemarkNodes
    .map((node, index) => parsePlacemark(node, index))
    .filter((placemark) => placemark.rings.length > 0);

  if (placemarks.length === 0) {
    throw new Error('No polygon geometry found in any placemark.');
  }

  const schema = parseSchema(doc, placemarks);
  const folderName = firstTextOf(doc.getElementsByTagName('Folder')[0], 'name') ?? schema.name;

  return { schema, folderName, placemarks };
}

function parsePlacemark(node: Element, index: number): Placemark {
  const explicitName = firstTextOf(node, 'name');

  const attributes: Record<string, string> = {};
  Array.from(node.getElementsByTagName('SimpleData')).forEach((simpleData) => {
    const key = simpleData.getAttribute('name');
    if (key) {
      attributes[key] = (simpleData.textContent ?? '').trim();
    }
  });

  const styleNode = node.getElementsByTagName('Style')[0];
  const styleXml = styleNode ? new XMLSerializer().serializeToString(styleNode) : undefined;

  return {
    name: explicitName ?? `Placemark ${index + 1}`,
    hasExplicitName: explicitName !== null,
    attributes,
    styleXml,
    rings: parsePolygonRings(node)
  };
}

/**
 * Build the document schema: reuse the source `<Schema>` when present, otherwise
 * synthesize one from the first placemark's attributes with inferred field types.
 */
function parseSchema(doc: Document, placemarks: Placemark[]): KmlSchema {
  const schemaNode = doc.getElementsByTagName('Schema')[0];
  if (schemaNode) {
    const id = schemaNode.getAttribute('id') ?? DEFAULT_SCHEMA_ID;
    const name = schemaNode.getAttribute('name') ?? id;
    const fields = Array.from(schemaNode.getElementsByTagName('SimpleField'))
      .map((field) => ({
        name: field.getAttribute('name') ?? '',
        type: field.getAttribute('type') ?? 'string'
      }))
      .filter((field) => field.name);

    if (fields.length > 0) {
      return { id, name, fields };
    }
  }

  const fields = Object.entries(placemarks[0]?.attributes ?? {}).map(([name, value]) => ({
    name,
    type: inferFieldType(value)
  }));

  return { id: DEFAULT_SCHEMA_ID, name: DEFAULT_SCHEMA_ID, fields };
}

function inferFieldType(value: string): string {
  if (/^-?\d+$/.test(value)) {
    return 'int';
  }
  if (/^-?\d*\.\d+$/.test(value)) {
    return 'float';
  }
  return 'string';
}

/**
 * Extract polygon rings from the first `<Polygon>` of a placemark.
 * Returns an empty array when there is no polygon (caller decides how to react).
 */
function parsePolygonRings(node: Element): Ring[] {
  const polygon = node.getElementsByTagName('Polygon')[0];
  if (!polygon) {
    return [];
  }

  const rings: Ring[] = [];

  const outer = polygon.getElementsByTagName('outerBoundaryIs')[0];
  if (outer) {
    rings.push(parseCoordinates(coordinatesText(outer)));
  }

  Array.from(polygon.getElementsByTagName('innerBoundaryIs')).forEach((inner) => {
    rings.push(parseCoordinates(coordinatesText(inner)));
  });

  if (rings.length === 0 || rings[0].length === 0) {
    throw new Error('A polygon was found but its <coordinates> are empty.');
  }

  return rings;
}

function coordinatesText(boundary: Element): string {
  return (boundary.getElementsByTagName('coordinates')[0]?.textContent ?? '').trim();
}

/**
 * Parse a KML `<coordinates>` string (`lon,lat[,alt] lon,lat[,alt] …`) into a
 * ring of `[longitude, latitude]` positions. Altitude is discarded.
 */
function parseCoordinates(raw: string): Ring {
  if (!raw) {
    return [];
  }

  return raw
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
    .map((token) => {
      const [lon, lat] = token.split(',').map(Number);
      return [lon, lat];
    })
    .filter(([lon, lat]) => Number.isFinite(lon) && Number.isFinite(lat));
}

function firstTextOf(node: Element | undefined, tagName: string): string | null {
  if (!node) {
    return null;
  }
  const child = node.getElementsByTagName(tagName)[0];
  const value = child?.textContent?.trim();
  return value ? value : null;
}

export { DEFAULT_STYLE };

/** Ensure a ring is explicitly closed (first position repeated as the last). */
export function closeRing(ring: Ring): Ring {
  if (ring.length < 3) {
    return ring;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring;
  }
  return [...ring, [first[0], first[1]]];
}

/** Drop the trailing closing position so each vertex maps to one editable marker. */
export function openRing(ring: Ring): Ring {
  if (ring.length < 2) {
    return ring;
  }
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }
  return ring;
}

/** Convert a ring of `[lon, lat]` positions into Leaflet `[lat, lon]` pairs. */
export function ringToLatLngs(ring: Ring): [number, number][] {
  return ring.map(([lon, lat]) => [lat, lon]);
}

/** Convert Leaflet `[lat, lng]` pairs back into a ring of `[lon, lat]` positions. */
export function latLngsToRing(latLngs: { lat: number; lng: number }[]): Ring {
  return latLngs.map(({ lat, lng }) => [lng, lat]);
}
