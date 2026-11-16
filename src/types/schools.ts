export interface ElementarySchool {
  id: string;
  emacId: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  positionAsOf: string;
  students: number | null;
  classes: number | null;
  specialStudents: number | null;
  specialClasses: number | null;
  grades: { grade: number; students: number; classes: number }[];
  studentsAsOf: string;
  disclosureYear: number;
  website: string;
  sourceUrl: string;
}

export interface SchoolZone {
  type: 'Feature';
  geometry: { type: 'Polygon' | 'MultiPolygon'; coordinates: number[][][] | number[][][][] };
  properties: { id: string; name: string; kind: 'single' | 'joint' | 'oneway'; schoolIds: string[]; asOf: string; updatedAt: string;
    unavailableMembers?: { emacId: string; name: string; reason: string }[] };
}

export interface GwacheonSchools {
  version: string;
  checkedAt: string;
  sources: Record<string, { name: string; url: string; asOf?: string; publishedAt?: string }>;
  schools: ElementarySchool[];
  zones: { type: 'FeatureCollection'; features: SchoolZone[] };
}

export interface RegionalSchoolData extends GwacheonSchools {
  region: string;
  scope: string;
}

export interface ComplexFootprints {
  version: string;
  checkedAt: string;
  license: string;
  attribution: string;
  licenseUrl: string;
  scope: string;
  anchors: Record<string, { latitude: number; longitude: number }>;
  unavailable: Record<string, { status: string; reason: string; anchorSource?: string }>;
  collection: {
    type: 'FeatureCollection';
    features: { type: 'Feature'; geometry: SchoolZone['geometry']; properties: {
      complexId: string; name: string;
      sourceObjects: ({ type: 'way' | 'relation'; id: number; version: number; timestamp: string; name: string; url: string } | {
        type: 'official-parcel'; id: string; pnu: string; version: string; timestamp: string; name: string; url: string;
        provider: string; license: string; sourceCrs: string;
      })[];
    } }[];
  };
}
