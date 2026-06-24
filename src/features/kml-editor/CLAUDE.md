I want to build a web application for editing KML polygon data.

The app should work dynamically based on the uploaded KML file structure.

Main workflow:

1. User uploads a `.kml` file.
2. System parses the KML automatically.
3. System extracts all fields from `<ExtendedData><SchemaData><SimpleData>`.
4. The extracted fields should become dynamic editable input fields.
5. The fields are not fixed. For example:

   * One KML may contain `SUPPLIERID`, `FARMNR`, `HA_POLYGON`, `COMMOID`
   * Another KML may contain only `ENTITYID`
   * Another KML may contain completely different field names
6. System also extracts polygon coordinate data from the `<coordinates>` tag.
7. The polygon should be displayed on an interactive map.
8. User can update any extracted field value.
9. User can update polygon coordinates.
10. After user clicks “Update Data”, the polygon and data preview should refresh.
11. User can download the updated file again as a valid `.kml`.

Technical requirements:

* Use React or Next.js.
* Use Leaflet or Mapbox for the map.
* Parse KML using JavaScript.
* Dynamically read all `<SimpleData>` elements.
* Do not hardcode field names like `SUPPLIERID`, `FARMNR`, or `ENTITYID`.
* Store extracted attributes as key-value pairs, for example:

```js
{
  "SUPPLIERID": "F2206000026339",
  "FARMNR": "1",
  "HA_POLYGON": "3.50535190145",
  "COMMOID": "5",
  "STATUS_CHECK": "new"
}
```

or:

```js
{
  "ENTITYID": "ABC123"
}
```

* Generate form inputs dynamically from the extracted attribute object.
* Preserve original field names when exporting back to KML.
* Extract polygon coordinates from:

```xml
<Polygon>
  <outerBoundaryIs>
    <LinearRing>
      <coordinates>longitude,latitude longitude,latitude</coordinates>
    </LinearRing>
  </outerBoundaryIs>
</Polygon>
```

* Convert KML coordinates from `longitude,latitude` into map format `[latitude, longitude]`.
* Convert map coordinates back to KML format `longitude,latitude`.
* Support one or multiple placemarks if possible.
* Each placemark should have:

  * dynamic attributes
  * polygon coordinates
* Allow selecting a placemark if multiple placemarks exist.
* Include validation and error handling for:

  * invalid KML
  * missing polygon
  * missing ExtendedData
  * empty coordinates
* Add a “Download KML” button that exports the updated data as valid KML.

Please provide:

1. Recommended project structure.
2. Data model for dynamic KML attributes.
3. Data flow explanation.
4. KML parsing function.
5. Dynamic form component.
6. Map preview component.
7. KML export/generation function.
8. Full working React or Next.js example code.
9. Notes for handling multiple placemarks and different schemas.
