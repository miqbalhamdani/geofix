# FEATURE: Polygon Format Conversion

Add 3 new buttons beside "Fix Polygon":

- Convert to GeoJSON
- Convert to WKT
- Convert to KML

---

# BEHAVIOR RULES (STRICT)

1. Source of data:

- If user HAS clicked "Fix Polygon":
  → Use OUTPUT polygon as source

- If user has NOT clicked "Fix Polygon":
  → Use INPUT polygon as source

---

2. Conversion behavior:

- Convert to GeoJSON:
  → Output MUST be GeoJSON

- Convert to WKT:
  → Output MUST be WKT

- Convert to KML:
  → Output MUST be KML string format

---

3. Output handling:

- Always update OUTPUT textarea
- Do NOT modify input textarea
- Preserve valid geometry structure

---

# IMPLEMENTATION DETAILS

## Add buttons (reuse existing UI style)

Example:

<button id="convert-geojson-btn">To GeoJSON</button>
<button id="convert-wkt-btn">To WKT</button>
<button id="convert-kml-btn">To KML</button>

Place beside:
- Fix Polygon button

## ERROR HANDLING

- If no input → show message
- If parsing fails → show error
- Do NOT crash UI

---

## IMPORTANT RULES

- DO NOT break existing Fix Polygon flow
- DO NOT duplicate parsing logic
- ALWAYS use GeoJSON as internal format