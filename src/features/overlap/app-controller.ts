import type { Feature, GeoJsonProperties, MultiPolygon, Polygon } from 'geojson';
import L from 'leaflet';
import { detectPolygonOverlap, type OverlapResult } from './overlap-detector';
import { parsePolygonInput } from '../../shared/geometry/parser';
import { validatePolygonFeature } from '../../shared/geometry/validator';

type PolygonFeature = Feature<Polygon | MultiPolygon, GeoJsonProperties>;

let map: L.Map | null = null;
let polygonALayer: L.GeoJSON | null = null;
let polygonBLayer: L.GeoJSON | null = null;

export function initPolygonOverlapApp(): void {
  const inputA = getElement<HTMLTextAreaElement>('polygon-a-input');
  const inputB = getElement<HTMLTextAreaElement>('polygon-b-input');
  const formatABadge = getElement<HTMLSpanElement>('format-a-badge');
  const formatBBadge = getElement<HTMLSpanElement>('format-b-badge');
  const checkButton = getElement<HTMLButtonElement>('check-overlap-btn');
  const clearButton = getElement<HTMLButtonElement>('clear-overlap-btn');
  const overlapDetectedWrapper = getElement<HTMLSpanElement>('overlap-detected-wrapper');
  const overlapDetectedValue = getElement<HTMLSpanElement>('overlap-detected-value');
  const overlapDetectedIcon = getElement<HTMLSpanElement>('overlap-detected-icon');
  const overlapAreaValue = getElement<HTMLSpanElement>('overlap-area-value');
  const overlapPercentageValue = getElement<HTMLSpanElement>('overlap-percentage-value');
  const intersectionCoordinates = getElement<HTMLDivElement>('intersection-coordinates');
  const errorBox = getElement<HTMLDivElement>('global-error-overlap');
  const zoomInButton = getElement<HTMLButtonElement>('overlap-zoom-in-btn');
  const zoomOutButton = getElement<HTMLButtonElement>('overlap-zoom-out-btn');

  const mapInstance = ensureMap();
  zoomInButton.addEventListener('click', () => mapInstance.zoomIn());
  zoomOutButton.addEventListener('click', () => mapInstance.zoomOut());

  checkButton.addEventListener('click', () => {
    hideError(errorBox);

    try {
      if (!inputA.value.trim()) {
        throw new Error('Polygon A input is empty.');
      }

      if (!inputB.value.trim()) {
        throw new Error('Polygon B input is empty.');
      }

      const parsedA = parsePolygonInput(inputA.value);
      const parsedB = parsePolygonInput(inputB.value);
      const validationA = validatePolygonFeature(parsedA.feature);
      const validationB = validatePolygonFeature(parsedB.feature);

      formatABadge.textContent = parsedA.format.toUpperCase();
      formatBBadge.textContent = parsedB.format.toUpperCase();

      renderOnMap(parsedA.feature, parsedB.feature);

      const hasValidationErrors =
        validationA.issues.some((issue) => issue.status === 'error') ||
        validationB.issues.some((issue) => issue.status === 'error');

      if (hasValidationErrors) {
        resetSpatialPanel(overlapDetectedWrapper, overlapDetectedValue, overlapDetectedIcon, overlapAreaValue, overlapPercentageValue, intersectionCoordinates);
        showError(errorBox, buildValidationErrorMessage(validationA.issues.map((issue) => issue.message), validationB.issues.map((issue) => issue.message)));
        return;
      }

      const overlapResult = detectPolygonOverlap(parsedA.feature, parsedB.feature);
      populateSpatialPanel(
        overlapResult,
        overlapDetectedWrapper,
        overlapDetectedValue,
        overlapDetectedIcon,
        overlapAreaValue,
        overlapPercentageValue,
        intersectionCoordinates
      );
    } catch (error) {
      showError(errorBox, error instanceof Error ? error.message : 'Failed to evaluate overlap.');
      resetSpatialPanel(overlapDetectedWrapper, overlapDetectedValue, overlapDetectedIcon, overlapAreaValue, overlapPercentageValue, intersectionCoordinates);
      clearMapLayers();
    }
  });

  clearButton.addEventListener('click', () => {
    inputA.value = '';
    inputB.value = '';
    formatABadge.textContent = 'N/A';
    formatBBadge.textContent = 'N/A';
    resetSpatialPanel(overlapDetectedWrapper, overlapDetectedValue, overlapDetectedIcon, overlapAreaValue, overlapPercentageValue, intersectionCoordinates);
    hideError(errorBox);
    clearMapLayers();
  });

  resetSpatialPanel(overlapDetectedWrapper, overlapDetectedValue, overlapDetectedIcon, overlapAreaValue, overlapPercentageValue, intersectionCoordinates);
}

function ensureMap(): L.Map {
  if (map) {
    return map;
  }

  map = L.map('overlap-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([20, 0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  return map;
}

function renderOnMap(featureA: PolygonFeature, featureB: PolygonFeature): void {
  const mapInstance = ensureMap();
  clearMapLayers();

  polygonALayer = L.geoJSON(featureA as any, {
    style: {
      color: '#0052cc',
      fillColor: '#4c9aff',
      fillOpacity: 0.28,
      weight: 2.5
    }
  }).addTo(mapInstance);

  polygonBLayer = L.geoJSON(featureB as any, {
    style: {
      color: '#cc5500',
      fillColor: '#ffb366',
      fillOpacity: 0.28,
      weight: 2.5
    }
  }).addTo(mapInstance);

  const combinedBounds = L.latLngBounds([]);
  if (polygonALayer.getBounds().isValid()) {
    combinedBounds.extend(polygonALayer.getBounds());
  }
  if (polygonBLayer.getBounds().isValid()) {
    combinedBounds.extend(polygonBLayer.getBounds());
  }

  if (combinedBounds.isValid()) {
    mapInstance.fitBounds(combinedBounds.pad(0.15));
  }
}

function clearMapLayers(): void {
  if (polygonALayer) {
    polygonALayer.remove();
    polygonALayer = null;
  }

  if (polygonBLayer) {
    polygonBLayer.remove();
    polygonBLayer = null;
  }
}

function populateSpatialPanel(
  overlapResult: OverlapResult,
  overlapDetectedWrapper: HTMLSpanElement,
  overlapDetectedValue: HTMLSpanElement,
  overlapDetectedIcon: HTMLSpanElement,
  overlapAreaValue: HTMLSpanElement,
  overlapPercentageValue: HTMLSpanElement,
  intersectionCoordinates: HTMLDivElement
): void {
  const hasOverlap = overlapResult.overlaps;
  overlapDetectedWrapper.className = hasOverlap ? 'font-bold text-error flex items-center gap-xs' : 'font-bold text-secondary flex items-center gap-xs';
  overlapDetectedValue.textContent = hasOverlap ? 'YES' : 'NO';
  overlapDetectedIcon.textContent = hasOverlap ? 'check_circle' : 'cancel';

  overlapAreaValue.textContent = overlapResult.overlapAreaLabel;
  overlapPercentageValue.textContent = overlapResult.overlapPercentageLabel;

  if (overlapResult.intersectionPoints.length === 0) {
    intersectionCoordinates.textContent = 'No intersection coordinates.';
    return;
  }

  intersectionCoordinates.innerHTML = overlapResult.intersectionPoints.join('<br/>');
}

function resetSpatialPanel(
  overlapDetectedWrapper: HTMLSpanElement,
  overlapDetectedValue: HTMLSpanElement,
  overlapDetectedIcon: HTMLSpanElement,
  overlapAreaValue: HTMLSpanElement,
  overlapPercentageValue: HTMLSpanElement,
  intersectionCoordinates: HTMLDivElement
): void {
  overlapDetectedWrapper.className = 'font-bold text-secondary flex items-center gap-xs';
  overlapDetectedValue.textContent = 'N/A';
  overlapDetectedIcon.textContent = 'help';
  overlapAreaValue.textContent = '0.00 m2';
  overlapPercentageValue.textContent = '0.00%';
  intersectionCoordinates.textContent = 'No intersection coordinates.';
}

function buildValidationErrorMessage(issuesA: string[], issuesB: string[]): string {
  const lines: string[] = [];

  if (issuesA.length > 0) {
    lines.push(`Polygon A: ${issuesA[0]}`);
  }

  if (issuesB.length > 0) {
    lines.push(`Polygon B: ${issuesB[0]}`);
  }

  return lines.join(' ') || 'Spatial relationship check skipped because one or both polygons are invalid.';
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
