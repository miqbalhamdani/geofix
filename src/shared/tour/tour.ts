import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export function startTour(): void {
  const driverObj = driver({
    showProgress: true,
    animate: true,
    overlayColor: 'rgba(0,0,0,0.6)',
    stagePadding: 8,
    stageRadius: 8,
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Done',
    steps: [
      {
        element: '#input-section',
        popover: {
          title: 'Step 1 of 4 — Input & Validation',
          description:
            '<b>Input Geometry</b>: Paste your polygon as GeoJSON or WKT into the text area.<br><br>' +
            '<b>Check Polygon</b>: Click the <em>Check Polygon</em> button to parse and validate the geometry.',
          side: 'right',
          align: 'start',
        },
      },
      {
        element: '#validate-map-row',
        popover: {
          title: 'Step 2 of 4 — Validation & Map',
          description:
            '<b>Validation Status</b>: A detailed list of geometry issues (orientation, self-intersection, closure, holes) is shown here.<br><br>' +
            '<b>Map</b>: Your polygon is rendered on the map automatically so you can visually inspect it.',
          side: 'top',
          align: 'center',
        },
      },
      {
        element: '#output-section',
        popover: {
          title: 'Step 3 of 4 — Repair & Export',
          description:
            '<b>Repaired Output</b>: The fixed polygon appears here after repair.<br><br>' +
            '<b>Fix Polygon</b>: Automatically corrects orientation, closure, and self-intersections.<br><br>' +
            '<b>To GeoJSON / To WKT / To KML</b>: Convert and export the result in your preferred format.',
          side: 'left',
          align: 'start',
        },
      },
      {
        element: '#guide-slider',
        popover: {
          title: 'Step 4 of 4 — Geometry Standards Guide',
          description:
            'Reference cards explaining GeoJSON (RFC 7946) and PostGIS geometry rules — orientation, winding order, hole structure, and more.',
          side: 'top',
          align: 'center',
        },
      },
    ],
  });

  driverObj.drive();
}
