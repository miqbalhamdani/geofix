/**
 * Serialize the edited document back into KML matching the source layout
 * (Schema with typed SimpleFields, a Folder wrapping the placemarks, a per
 * placemark Style, and compact single-line Polygon geometry).
 */

import { DEFAULT_STYLE, type ParsedKml, type Placemark, type Ring, closeRing } from './kml-parser';

export function buildKml(parsed: ParsedKml): string {
  const { schema, folderName, placemarks } = parsed;

  const placemarkBlocks = placemarks.map((placemark) => placemarkToKml(placemark, schema.id)).join('\n');

  return [
    '<?xml version="1.0" encoding="utf-8" ?>',
    '<kml xmlns="http://www.opengis.net/kml/2.2">',
    '<Document id="root_doc">',
    schemaToKml(schema),
    `<Folder><name>${escapeXml(folderName)}</name>`,
    placemarkBlocks,
    '</Folder>',
    '</Document></kml>',
    ''
  ].join('\n');
}

function schemaToKml(schema: { id: string; name: string; fields: { name: string; type: string }[] }): string {
  const fields = schema.fields
    .map((field) => `\t<SimpleField name="${escapeXml(field.name)}" type="${escapeXml(field.type)}"></SimpleField>`)
    .join('\n');

  return `<Schema name="${escapeXml(schema.name)}" id="${escapeXml(schema.id)}">\n${fields}\n</Schema>`;
}

function placemarkToKml(placemark: Placemark, schemaId: string): string {
  const lines: string[] = ['  <Placemark>'];

  if (placemark.hasExplicitName) {
    lines.push(`\t<name>${escapeXml(placemark.name)}</name>`);
  }

  lines.push(`\t${placemark.styleXml ?? DEFAULT_STYLE}`);
  lines.push(extendedDataToKml(placemark, schemaId));
  lines.push(`      ${polygonToKml(placemark.rings)}`);
  lines.push('  </Placemark>');

  return lines.join('\n');
}

function extendedDataToKml(placemark: Placemark, schemaId: string): string {
  const simpleData = Object.entries(placemark.attributes)
    .map(([key, value]) => `\t\t<SimpleData name="${escapeXml(key)}">${escapeXml(value)}</SimpleData>`)
    .join('\n');

  return `\t<ExtendedData><SchemaData schemaUrl="#${escapeXml(schemaId)}">\n${simpleData}\n\t</SchemaData></ExtendedData>`;
}

function polygonToKml(rings: Ring[]): string {
  const [outerRing, ...holeRings] = rings;
  const outer = ringToBoundary(outerRing, 'outerBoundaryIs');
  const holes = holeRings.map((ring) => ringToBoundary(ring, 'innerBoundaryIs')).join('');

  return `<Polygon>${outer}${holes}</Polygon>`;
}

function ringToBoundary(ring: Ring, boundaryTag: 'outerBoundaryIs' | 'innerBoundaryIs'): string {
  // A LinearRing must be closed (first position repeated as the last) or
  // downstream consumers (e.g. MySQL ST_GEOMFROMTEXT) reject the geometry.
  const coordinates = closeRing(ring)
    .map((position) => position.join(','))
    .join(' ');
  return `<${boundaryTag}><LinearRing><coordinates>${coordinates}</coordinates></LinearRing></${boundaryTag}>`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
