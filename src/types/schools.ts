export interface ElementarySchool {
  id: string;
  emacId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  positionAsOf: string;
  students: number;
  classes: number;
  specialStudents: number;
  specialClasses: number;
  grades: { grade: number; students: number; classes: number }[];
  studentsAsOf: string;
  disclosureYear: number;
  website: string;
  sourceUrl: string;
}

export interface SchoolZone {
  type: 'Feature';
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
  properties: { id: string; name: string; kind: 'single' | 'joint'; schoolIds: string[]; asOf: string; updatedAt: string };
}

export interface GwacheonSchools {
  version: string;
  checkedAt: string;
  sources: Record<string, { name: string; url: string; asOf?: string; publishedAt?: string }>;
  schools: ElementarySchool[];
  zones: { type: 'FeatureCollection'; features: SchoolZone[] };
}
