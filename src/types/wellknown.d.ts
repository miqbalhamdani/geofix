declare module 'wellknown' {
  import type { Geometry } from 'geojson';

  const wellknown: {
    parse(input: string): Geometry | null;
    stringify(input: Geometry): string;
  };

  export default wellknown;
}
