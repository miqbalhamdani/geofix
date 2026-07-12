import type { GeoJsonProperties } from 'geojson';
import type { EudrGeometry } from './types';
import type { ValidationIssue } from './validator';

export const COORD_DECIMALS = 6;
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const POINT_DEFAULT_AREA_HA = 4;

export const EUDR_PROPERTIES = ['ProducerName', 'ProducerCountry', 'ProductionPlace', 'Area'] as const;

const CANONICAL_BY_LOWERCASE = new Map<string, string>(
  EUDR_PROPERTIES.map((name) => [name.toLowerCase(), name])
);

// ISO 3166-1 alpha-2 officially assigned codes.
export const ISO2_COUNTRY_CODES = new Set([
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AO', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX', 'AZ',
  'BA', 'BB', 'BD', 'BE', 'BF', 'BG', 'BH', 'BI', 'BJ', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BW', 'BY', 'BZ', 'CA', 'CC', 'CD', 'CF', 'CG', 'CH', 'CI', 'CK', 'CL', 'CM', 'CN',
  'CO', 'CR', 'CU', 'CV', 'CW', 'CX', 'CY', 'CZ', 'DE', 'DJ', 'DK', 'DM', 'DO', 'DZ', 'EC', 'EE',
  'EG', 'EH', 'ER', 'ES', 'ET', 'FI', 'FJ', 'FK', 'FM', 'FO', 'FR', 'GA', 'GB', 'GD', 'GE', 'GF',
  'GG', 'GH', 'GI', 'GL', 'GM', 'GN', 'GP', 'GQ', 'GR', 'GS', 'GT', 'GU', 'GW', 'GY', 'HK', 'HM',
  'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO', 'IQ', 'IR', 'IS', 'IT', 'JE', 'JM',
  'JO', 'JP', 'KE', 'KG', 'KH', 'KI', 'KM', 'KN', 'KP', 'KR', 'KW', 'KY', 'KZ', 'LA', 'LB', 'LC',
  'LI', 'LK', 'LR', 'LS', 'LT', 'LU', 'LV', 'LY', 'MA', 'MC', 'MD', 'ME', 'MF', 'MG', 'MH', 'MK',
  'ML', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MR', 'MS', 'MT', 'MU', 'MV', 'MW', 'MX', 'MY', 'MZ', 'NA',
  'NC', 'NE', 'NF', 'NG', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG',
  'PH', 'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU', 'RW',
  'SA', 'SB', 'SC', 'SD', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SL', 'SM', 'SN', 'SO', 'SR', 'SS',
  'ST', 'SV', 'SX', 'SY', 'SZ', 'TC', 'TD', 'TF', 'TG', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TN', 'TO',
  'TR', 'TT', 'TV', 'TW', 'TZ', 'UA', 'UG', 'UM', 'US', 'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI',
  'VN', 'VU', 'WF', 'WS', 'YE', 'YT', 'ZA', 'ZM', 'ZW'
]);

export function validateEudrProperties(
  properties: GeoJsonProperties,
  geometryType: EudrGeometry['type']
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const props = properties ?? {};

  for (const key of Object.keys(props)) {
    const canonical = CANONICAL_BY_LOWERCASE.get(key.toLowerCase());
    if (canonical && canonical !== key) {
      issues.push({
        type: 'property_case',
        status: 'warning',
        eudrErrorCode: 9,
        message: `Property "${key}" is not recognized by EUDR — property names are case-sensitive. Use "${canonical}" instead.`
      });
    }
  }

  const producerCountry = props.ProducerCountry;
  if (producerCountry !== undefined && (typeof producerCountry !== 'string' || !ISO2_COUNTRY_CODES.has(producerCountry))) {
    issues.push({
      type: 'invalid_producer_country',
      status: 'error',
      eudrErrorCode: 12,
      message: `ProducerCountry "${String(producerCountry)}" is not a valid ISO 3166-1 alpha-2 code (e.g. "BR", "ID").`
    });
  }

  const areaValue = props.Area;
  if (areaValue !== undefined && typeof areaValue !== 'number') {
    issues.push({
      type: 'invalid_area_type',
      status: 'error',
      eudrErrorCode: 14,
      message: `Area must be a number, not ${JSON.stringify(areaValue)} — EUDR reads a quoted value like "3" as area 0.`
    });
  }

  if (!Object.keys(props).some((key) => key.toLowerCase() === 'productionplace')) {
    issues.push({
      type: 'missing_production_place',
      status: 'info',
      message: 'ProductionPlace is not set. EUDR recommends providing it to name the production place.'
    });
  }

  if ((geometryType === 'Point' || geometryType === 'MultiPoint') && areaValue === undefined) {
    issues.push({
      type: 'point_default_area',
      status: 'info',
      message: `No Area set for this point — the EUDR system will default it to ${POINT_DEFAULT_AREA_HA} hectares.`
    });
  }

  return issues;
}

export function fixEudrProperties(properties: GeoJsonProperties): {
  fixed: GeoJsonProperties;
  notes: string[];
} {
  const notes: string[] = [];
  const fixed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(properties ?? {})) {
    const canonical = CANONICAL_BY_LOWERCASE.get(key.toLowerCase()) ?? key;
    if (canonical !== key) {
      notes.push(`Renamed property "${key}" to "${canonical}" (EUDR property names are case-sensitive).`);
    }

    let fixedValue: unknown = value;
    if (canonical === 'Area' && typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
      fixedValue = Number(value);
      notes.push(`Converted Area from string "${value}" to number ${fixedValue} (EUDR reads quoted values as area 0).`);
    }

    fixed[canonical] = fixedValue;
  }

  return { fixed, notes };
}
