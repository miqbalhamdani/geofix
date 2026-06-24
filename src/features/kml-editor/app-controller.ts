import * as turf from '@turf/turf';
import L from 'leaflet';
import {
  type ParsedKml,
  type Placemark,
  type Ring,
  closeRing,
  latLngsToRing,
  openRing,
  parseKml,
  ringToLatLngs
} from './kml-parser';
import { buildKml } from './kml-builder';

let map: L.Map | null = null;
let polygonLayer: L.Polygon | null = null;
let vertexMarkers: L.Marker[] = [];

export function initKmlEditorApp(): void {
  const fileInput = getElement<HTMLInputElement>('kml-file-input');
  const dropzone = getElement<HTMLDivElement>('kml-dropzone');
  const placemarkRow = getElement<HTMLDivElement>('placemark-selector-row');
  const placemarkSelect = getElement<HTMLSelectElement>('placemark-select');
  const attributesContainer = getElement<HTMLDivElement>('kml-attributes');
  const emptyState = getElement<HTMLDivElement>('kml-empty-state');
  const updateButton = getElement<HTMLButtonElement>('kml-update-btn');
  const downloadButton = getElement<HTMLButtonElement>('kml-download-btn');
  const errorBox = getElement<HTMLDivElement>('kml-error');
  const fileNameLabel = getElement<HTMLSpanElement>('kml-file-name');
  const areaValue = getElement<HTMLSpanElement>('kml-area');
  const perimeterValue = getElement<HTMLSpanElement>('kml-perimeter');
  const zoomInButton = getElement<HTMLButtonElement>('kml-zoom-in-btn');
  const zoomOutButton = getElement<HTMLButtonElement>('kml-zoom-out-btn');
  const recenterButton = getElement<HTMLButtonElement>('kml-recenter-btn');

  let parsed: ParsedKml | null = null;
  let placemarks: Placemark[] = [];
  let activeIndex = 0;

  const mapInstance = ensureMap();
  zoomInButton.addEventListener('click', () => mapInstance.zoomIn());
  zoomOutButton.addEventListener('click', () => mapInstance.zoomOut());
  recenterButton.addEventListener('click', () => fitToActivePolygon());

  function loadFile(file: File): void {
    hideError(errorBox);

    if (!/\.kml$/i.test(file.name)) {
      showError(errorBox, 'Please choose a file with a .kml extension.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        parsed = parseKml(String(reader.result ?? ''));
        placemarks = parsed.placemarks;
        activeIndex = 0;
        fileNameLabel.textContent = file.name;
        populatePlacemarkSelector(placemarkSelect, placemarkRow, placemarks);
        renderActivePlacemark();
        emptyState.classList.add('hidden');
        updateButton.disabled = false;
        downloadButton.disabled = false;
      } catch (error) {
        resetState();
        showError(errorBox, error instanceof Error ? error.message : 'Failed to parse the KML file.');
      }
    };
    reader.onerror = () => showError(errorBox, 'Could not read the selected file.');
    reader.readAsText(file);
  }

  function resetState(): void {
    parsed = null;
    placemarks = [];
    activeIndex = 0;
    attributesContainer.innerHTML = '';
    placemarkRow.classList.add('hidden');
    emptyState.classList.remove('hidden');
    updateButton.disabled = true;
    downloadButton.disabled = true;
    clearPolygon();
    areaValue.textContent = '—';
    perimeterValue.textContent = '—';
  }

  function renderActivePlacemark(): void {
    const placemark = placemarks[activeIndex];
    if (!placemark) {
      return;
    }

    renderAttributes(attributesContainer, placemark, (key, value) => {
      placemark.attributes[key] = value;
    });
    renderPolygon(placemark, updateMetrics);
    updateMetrics();
  }

  function updateMetrics(): void {
    const placemark = placemarks[activeIndex];
    if (!placemark || placemark.rings.length === 0) {
      areaValue.textContent = '—';
      perimeterValue.textContent = '—';
      return;
    }

    areaValue.textContent = formatArea(placemark.rings);
    perimeterValue.textContent = formatPerimeter(placemark.rings[0]);
  }

  function fitToActivePolygon(): void {
    if (polygonLayer) {
      const bounds = polygonLayer.getBounds();
      if (bounds.isValid()) {
        ensureMap().fitBounds(bounds.pad(0.2));
      }
    }
  }

  // Upload: file picker + drag and drop.
  dropzone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    if (file) {
      loadFile(file);
    }
  });

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.add('bg-surface-variant');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropzone.classList.remove('bg-surface-variant');
    });
  });
  dropzone.addEventListener('drop', (event) => {
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      loadFile(file);
    }
  });

  placemarkSelect.addEventListener('change', () => {
    activeIndex = Number(placemarkSelect.value) || 0;
    renderActivePlacemark();
  });

  // Commit the current map vertices back into the active placemark and refresh.
  updateButton.addEventListener('click', () => {
    commitVertices(placemarks[activeIndex]);
    renderActivePlacemark();
  });

  downloadButton.addEventListener('click', () => {
    if (!parsed || placemarks.length === 0) {
      return;
    }
    commitVertices(placemarks[activeIndex]);
    downloadKml(buildKml(parsed), fileNameLabel.textContent || 'polygon.kml');
  });

  resetState();
}

/** Sync the current draggable marker positions into the placemark's outer ring. */
function commitVertices(placemark: Placemark | undefined): void {
  if (!placemark || vertexMarkers.length === 0) {
    return;
  }
  placemark.rings[0] = closeRing(latLngsToRing(vertexMarkers.map((marker) => marker.getLatLng())));
}

function ensureMap(): L.Map {
  if (map) {
    return map;
  }

  map = L.map('kml-map', {
    zoomControl: false,
    attributionControl: false
  }).setView([20, 0], 2);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  return map;
}

function renderPolygon(placemark: Placemark, onVertexMove: () => void): void {
  const mapInstance = ensureMap();
  clearPolygon();

  if (placemark.rings.length === 0) {
    return;
  }

  const latLngRings = placemark.rings.map((ring) => ringToLatLngs(ring));

  polygonLayer = L.polygon(latLngRings, {
    color: '#1c1b1b',
    fillColor: '#c8c6c5',
    fillOpacity: 0.35,
    weight: 2
  }).addTo(mapInstance);

  // Draggable vertices on the outer ring only; drop the duplicate closing
  // vertex so it does not get a second marker stacked on the first.
  const outerRing = openRing(placemark.rings[0]);
  vertexMarkers = ringToLatLngs(outerRing).map((latLng, vertexIndex) => {
    const marker = L.marker(latLng, {
      draggable: true,
      icon: vertexIcon(),
      title: `V${vertexIndex + 1}`
    }).addTo(mapInstance);

    marker.on('drag', () => {
      redrawPolygonFromMarkers();
      onVertexMove();
    });

    return marker;
  });

  const bounds = polygonLayer.getBounds();
  if (bounds.isValid()) {
    mapInstance.fitBounds(bounds.pad(0.2));
  }
}

function redrawPolygonFromMarkers(): void {
  if (!polygonLayer) {
    return;
  }
  const outer = vertexMarkers.map((marker) => marker.getLatLng());
  const existing = polygonLayer.getLatLngs() as L.LatLng[][];
  const holes = existing.slice(1);
  polygonLayer.setLatLngs([outer, ...holes]);
}

function vertexIcon(): L.DivIcon {
  return L.divIcon({
    className: '',
    html: '<div class="w-3 h-3 bg-primary rounded-full border-2 border-surface shadow-md"></div>',
    iconSize: [12, 12],
    iconAnchor: [6, 6]
  });
}

function clearPolygon(): void {
  if (polygonLayer) {
    polygonLayer.remove();
    polygonLayer = null;
  }
  vertexMarkers.forEach((marker) => marker.remove());
  vertexMarkers = [];
}

function renderAttributes(
  container: HTMLDivElement,
  placemark: Placemark,
  onChange: (key: string, value: string) => void
): void {
  container.innerHTML = '';

  const entries = Object.entries(placemark.attributes);
  if (entries.length === 0) {
    const note = document.createElement('p');
    note.className = 'text-xs text-secondary';
    note.textContent = 'This placemark has no ExtendedData attributes.';
    container.appendChild(note);
    return;
  }

  entries.forEach(([key, value]) => {
    const field = document.createElement('div');
    field.className = 'flex flex-col gap-xs';

    const label = document.createElement('label');
    label.className = 'font-label-caps text-secondary';
    label.textContent = key;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.className =
      'bg-surface border border-outline-variant rounded-lg px-sm py-xs font-mono-label text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none';
    input.addEventListener('input', () => onChange(key, input.value));

    field.appendChild(label);
    field.appendChild(input);
    container.appendChild(field);
  });
}

function populatePlacemarkSelector(
  select: HTMLSelectElement,
  row: HTMLDivElement,
  placemarks: Placemark[]
): void {
  select.innerHTML = '';
  placemarks.forEach((placemark, index) => {
    const option = document.createElement('option');
    option.value = String(index);
    option.textContent = placemark.name;
    select.appendChild(option);
  });
  select.value = '0';

  row.classList.toggle('hidden', placemarks.length <= 1);
}

function formatArea(rings: Ring[]): string {
  const polygon = turf.polygon([closeRing(rings[0]), ...rings.slice(1).map(closeRing)]);
  const squareMeters = turf.area(polygon);

  if (squareMeters >= 1_000_000) {
    return `${(squareMeters / 1_000_000).toFixed(2)} km²`;
  }
  if (squareMeters >= 10_000) {
    return `${(squareMeters / 10_000).toFixed(2)} ha`;
  }
  return `${squareMeters.toFixed(1)} m²`;
}

function formatPerimeter(outerRing: Ring): string {
  const line = turf.lineString(closeRing(outerRing));
  const kilometers = turf.length(line, { units: 'kilometers' });

  if (kilometers >= 1) {
    return `${kilometers.toFixed(2)} km`;
  }
  return `${(kilometers * 1000).toFixed(1)} m`;
}

function downloadKml(content: string, originalName: string): void {
  const blob = new Blob([content], { type: 'application/vnd.google-earth.kml+xml' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = toEditedFileName(originalName);
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function toEditedFileName(originalName: string): string {
  const base = originalName.replace(/\.kml$/i, '');
  return `${base || 'polygon'}-edited.kml`;
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
