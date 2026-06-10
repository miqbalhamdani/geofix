import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson';
import L from 'leaflet';
import { formatPolygonOutput } from '../../shared/geometry/formatter';
import { fixPolygonFeature } from '../../shared/geometry/fixer';
import { parsePolygonInput, type InputFormat } from '../../shared/geometry/parser';
import { type ValidationIssue, validatePolygonFeature } from '../../shared/geometry/validator';

type PolygonFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties>;

let map: L.Map | null = null;
let polygonLayer: L.GeoJSON | null = null;

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

  let currentFeature: PolygonFeature | null = null;
  let currentFormat: InputFormat | null = null;
  let hasFixedOutput = false;

  const mapInstance = ensureMap();
  zoomInButton.addEventListener('click', () => mapInstance.zoomIn());
  zoomOutButton.addEventListener('click', () => mapInstance.zoomOut());

  checkButton.addEventListener('click', () => {
    hideError(errorBox);
    try {
      const parsed = parsePolygonInput(input.value);
      currentFeature = parsed.feature;
      currentFormat = parsed.format;
      hasFixedOutput = false;

      const validation = validatePolygonFeature(parsed.feature);
      setValidationState(validationBadge, validation.issues);
      formatBadge.textContent = parsed.format.toUpperCase();
      output.value = formatPolygonOutput(parsed.feature, parsed.format);
      renderIssues(issueList, validation.issues);
      renderOnMap(parsed.feature);
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
      const parsed = currentFeature && currentFormat ? { feature: currentFeature, format: currentFormat } : parsePolygonInput(input.value);
      const fixed = fixPolygonFeature(parsed.feature);
      const validation = validatePolygonFeature(fixed.fixedFeature);

      currentFeature = fixed.fixedFeature;
      currentFormat = parsed.format;
      hasFixedOutput = true;
      setValidationState(validationBadge, validation.issues);
      formatBadge.textContent = parsed.format.toUpperCase();
      output.value = formatPolygonOutput(fixed.fixedFeature, parsed.format);

      const fixNotes = fixed.notes.map((note) => ({
        type: 'fix',
        status: 'info' as const,
        message: note
      }));
      renderIssues(issueList, [...validation.issues, ...fixNotes]);
      renderOnMap(fixed.fixedFeature);
    } catch (error) {
      showError(errorBox, error instanceof Error ? error.message : 'Unable to fix polygon.');
    }
  });

  clearButton.addEventListener('click', () => {
    input.value = '';
    output.value = '';
    currentFeature = null;
    currentFormat = null;
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
      output.value = formatPolygonOutput(source.feature, targetFormat);
      formatBadge.textContent = targetFormat.toUpperCase();
    } catch (error) {
      showError(errorBox, error instanceof Error ? error.message : 'Unable to convert polygon.');
    }
  }

  function getConversionSource(): { feature: PolygonFeature; format: InputFormat } {
    if (hasFixedOutput && currentFeature && currentFormat) {
      return {
        feature: currentFeature,
        format: currentFormat
      };
    }

    const parsed = parsePolygonInput(input.value);
    return {
      feature: parsed.feature,
      format: parsed.format
    };
  }
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

function renderOnMap(feature: PolygonFeature): void {
  const mapInstance = ensureMap();

  if (polygonLayer) {
    polygonLayer.remove();
    polygonLayer = null;
  }

  polygonLayer = L.geoJSON(feature as any, {
    style: {
      color: '#1c1b1b',
      fillColor: '#c8c6c5',
      fillOpacity: 0.35,
      weight: 2
    }
  }).addTo(mapInstance);

  const bounds = polygonLayer.getBounds();
  if (bounds.isValid()) {
    mapInstance.fitBounds(bounds.pad(0.15));
  }
}

function clearMapLayer(): void {
  if (polygonLayer) {
    polygonLayer.remove();
    polygonLayer = null;
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
        <p class="text-xs text-secondary">Run check on a polygon to see detailed status.</p>
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

    card.className = `flex items-start gap-sm p-3 rounded-lg ${cardTone}`;
    card.innerHTML = `
      <span class="material-symbols-outlined ${iconColor}">${icon}</span>
      <div>
        <p class="font-body-sm text-on-surface font-semibold">${formatIssueTitle(issue.type)}</p>
        <p class="text-xs text-secondary">${issue.message}</p>
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
