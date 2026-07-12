import L from 'leaflet';
import { formatGeoOutput } from '../../shared/geometry/formatter';
import { fixGeoCollection } from '../../shared/geometry/fixer';
import { parseGeoInput } from '../../shared/geometry/parser';
import { MAX_FILE_BYTES } from '../../shared/geometry/eudr';
import type { InputFormat, ParsedGeoInput } from '../../shared/geometry/types';
import { type ValidationIssue, validateGeoCollection } from '../../shared/geometry/validator';

let map: L.Map | null = null;
let geometryLayer: L.GeoJSON | null = null;

export function initPolygonFixApp(): void {
  const input = getElement<HTMLTextAreaElement>('polygon-input');
  const output = getElement<HTMLTextAreaElement>('polygon-output');
  const checkButton = getElement<HTMLButtonElement>('check-btn');
  const clearButton = getElement<HTMLButtonElement>('clear-input-btn');
  const fixButton = getElement<HTMLButtonElement>('fix-btn');
  const convertGeoJsonButton = getElement<HTMLButtonElement>('convert-geojson-btn');
  const convertWktButton = getElement<HTMLButtonElement>('convert-wkt-btn');
  const convertKmlButton = getElement<HTMLButtonElement>('convert-kml-btn');
  const copyButton = getElement<HTMLButtonElement>('copy-btn');
  const issueList = getElement<HTMLDivElement>('issue-list');
  const validationBadge = getElement<HTMLSpanElement>('validation-badge');
  const formatBadge = getElement<HTMLSpanElement>('output-format');
  const errorBox = getElement<HTMLDivElement>('global-error');
  const zoomInButton = getElement<HTMLButtonElement>('zoom-in-btn');
  const zoomOutButton = getElement<HTMLButtonElement>('zoom-out-btn');

  let currentParsed: ParsedGeoInput | null = null;
  let hasFixedOutput = false;

  const mapInstance = ensureMap();
  zoomInButton.addEventListener('click', () => mapInstance.zoomIn());
  zoomOutButton.addEventListener('click', () => mapInstance.zoomOut());

  checkButton.addEventListener('click', () => {
    hideError(errorBox);
    try {
      const parsed = parseGeoInput(input.value);
      currentParsed = parsed;
      hasFixedOutput = false;

      const validation = validateGeoCollection(parsed.collection);
      const issues = [
        ...checkInputSize(input.value),
        ...parseNotesToIssues(parsed.parseNotes),
        ...validation.issues
      ];

      setValidationState(validationBadge, issues);
      formatBadge.textContent = parsed.format.toUpperCase();
      output.value = formatGeoOutput(parsed.collection, parsed.inputShape, parsed.format);
      renderIssues(issueList, issues);
      renderOnMap(parsed);
    } catch (error) {
      showError(errorBox, error instanceof Error ? error.message : 'Failed to parse input geometry.');
      renderIssues(issueList, []);
      setValidationState(validationBadge, []);
      output.value = '';
      clearMapLayer();
    }
  });

  fixButton.addEventListener('click', () => {
    hideError(errorBox);
    try {
      const parsed = currentParsed ?? parseGeoInput(input.value);
      const fixed = fixGeoCollection(parsed.collection);
      const fixedParsed: ParsedGeoInput = { ...parsed, collection: fixed.fixedCollection };
      const validation = validateGeoCollection(fixed.fixedCollection);

      currentParsed = fixedParsed;
      hasFixedOutput = true;
      formatBadge.textContent = parsed.format.toUpperCase();
      output.value = formatGeoOutput(fixed.fixedCollection, parsed.inputShape, parsed.format);

      const fixNotes = fixed.notes.map((note) => ({
        type: 'fix',
        status: 'info' as const,
        message: note
      }));
      const issues = [...parseNotesToIssues(parsed.parseNotes), ...validation.issues];
      setValidationState(validationBadge, issues);
      renderIssues(issueList, [...issues, ...fixNotes]);
      renderOnMap(fixedParsed);
    } catch (error) {
      showError(errorBox, error instanceof Error ? error.message : 'Unable to fix geometry.');
    }
  });

  clearButton.addEventListener('click', () => {
    input.value = '';
    output.value = '';
    currentParsed = null;
    hasFixedOutput = false;
    renderIssues(issueList, []);
    setValidationState(validationBadge, []);
    formatBadge.textContent = 'N/A';
    hideError(errorBox);
    clearMapLayer();
  });

  copyButton.addEventListener('click', async () => {
    if (!output.value) {
      return;
    }

    await navigator.clipboard.writeText(output.value);
    copyButton.classList.add('bg-surface-container');
    setTimeout(() => copyButton.classList.remove('bg-surface-container'), 700);
  });

  convertGeoJsonButton.addEventListener('click', () => {
    convertTo('geojson');
  });

  convertWktButton.addEventListener('click', () => {
    convertTo('wkt');
  });

  convertKmlButton.addEventListener('click', () => {
    convertTo('kml');
  });

  function convertTo(targetFormat: InputFormat): void {
    hideError(errorBox);
    try {
      const source = getConversionSource();
      output.value = formatGeoOutput(source.collection, source.inputShape, targetFormat);
      formatBadge.textContent = targetFormat.toUpperCase();

      const hasProperties = source.collection.features.some(
        (feature) => Object.keys(feature.properties ?? {}).length > 0
      );
      if (targetFormat === 'wkt' && hasProperties) {
        showError(errorBox, 'Note: WKT cannot carry feature properties (ProducerName, Area, ...) — they were omitted from the output.');
      }
    } catch (error) {
      showError(errorBox, error instanceof Error ? error.message : 'Unable to convert geometry.');
    }
  }

  function getConversionSource(): ParsedGeoInput {
    if (hasFixedOutput && currentParsed) {
      return currentParsed;
    }

    return parseGeoInput(input.value);
  }
}

function checkInputSize(rawText: string): ValidationIssue[] {
  if (new Blob([rawText]).size <= MAX_FILE_BYTES) {
    return [];
  }

  return [
    {
      type: 'file_size',
      status: 'error',
      eudrErrorCode: 16,
      message: 'Input exceeds the 25 MB EUDR file size limit. Simplify polygons or split the submission into separate DDS files.'
    }
  ];
}

function parseNotesToIssues(parseNotes: string[]): ValidationIssue[] {
  return parseNotes.map((note) => ({
    type: 'parse_note',
    status: 'warning' as const,
    message: note
  }));
}

function ensureMap(): L.Map {
  if (map) {
    return map;
  }

  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([20, 0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  return map;
}

function renderOnMap(parsed: ParsedGeoInput): void {
  const mapInstance = ensureMap();

  if (geometryLayer) {
    geometryLayer.remove();
    geometryLayer = null;
  }

  geometryLayer = L.geoJSON(parsed.collection as any, {
    style: {
      color: '#1c1b1b',
      fillColor: '#c8c6c5',
      fillOpacity: 0.35,
      weight: 2
    },
    pointToLayer: (_feature, latlng) =>
      L.circleMarker(latlng, {
        radius: 6,
        color: '#1c1b1b',
        fillColor: '#c8c6c5',
        fillOpacity: 0.8,
        weight: 2
      })
  }).addTo(mapInstance);

  const bounds = geometryLayer.getBounds();
  if (bounds.isValid()) {
    mapInstance.fitBounds(bounds.pad(0.15));
  }
}

function clearMapLayer(): void {
  if (geometryLayer) {
    geometryLayer.remove();
    geometryLayer = null;
  }
}

function renderIssues(issueList: HTMLDivElement, issues: ValidationIssue[]): void {
  issueList.innerHTML = '';

  if (issues.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'flex items-start gap-sm p-3 bg-surface-container rounded-lg';
    empty.innerHTML = `
      <span class="material-symbols-outlined text-secondary">info</span>
      <div>
        <p class="font-body-sm text-on-surface font-semibold">No issues detected</p>
        <p class="text-xs text-secondary">Run check on a geometry to see detailed status.</p>
      </div>
    `;
    issueList.appendChild(empty);
    return;
  }

  issues.forEach((issue) => {
    const card = document.createElement('div');
    const cardTone =
      issue.status === 'error'
        ? 'bg-error-container/20 border border-error/10'
        : issue.status === 'warning'
          ? 'bg-surface-container border border-outline-variant'
          : 'bg-surface-container border border-outline-variant';

    const icon = issue.status === 'error' ? 'report' : issue.status === 'warning' ? 'warning' : 'check_circle';
    const iconColor = issue.status === 'error' ? 'text-error' : 'text-secondary';

    const featurePrefix = issue.featureIndex !== undefined ? `Feature ${issue.featureIndex + 1} — ` : '';
    const eudrBadge =
      issue.eudrErrorCode !== undefined
        ? `<span class="text-[10px] font-mono-label px-1.5 py-0.5 rounded bg-surface-container-high text-secondary border border-outline-variant">EUDR #${issue.eudrErrorCode}</span>`
        : '';

    card.className = `flex items-start gap-sm p-3 rounded-lg ${cardTone}`;
    card.innerHTML = `
      <span class="material-symbols-outlined ${iconColor}">${icon}</span>
      <div>
        <p class="font-body-sm text-on-surface font-semibold">${formatIssueTitle(issue.type)} ${eudrBadge}</p>
        <p class="text-xs text-secondary">${featurePrefix}${issue.message}</p>
      </div>
    `;
    issueList.appendChild(card);
  });
}

function setValidationState(badge: HTMLSpanElement, issues: ValidationIssue[]): void {
  const hasError = issues.some((issue) => issue.status === 'error');
  const hasWarning = issues.some((issue) => issue.status === 'warning');

  badge.className = 'text-xs font-mono-label px-2 py-1 rounded';

  if (hasError) {
    badge.textContent = 'INVALID';
    badge.classList.add('text-on-error-container', 'bg-error-container');
    return;
  }

  if (hasWarning) {
    badge.textContent = 'CHECKED';
    badge.classList.add('text-on-tertiary-fixed-variant', 'bg-tertiary-fixed');
    return;
  }

  badge.textContent = 'VALID';
  badge.classList.add('text-on-tertiary-fixed-variant', 'bg-tertiary-fixed');
}

function formatIssueTitle(type: string): string {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function showError(box: HTMLDivElement, message: string): void {
  box.textContent = message;
  box.classList.remove('hidden');
}

function hideError(box: HTMLDivElement): void {
  box.classList.add('hidden');
  box.textContent = '';
}

function getElement<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Expected element #${id} to exist.`);
  }

  return element as T;
}
