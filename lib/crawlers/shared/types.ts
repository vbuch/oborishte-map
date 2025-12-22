export interface BaseSourceDocument {
  url: string;
  datePublished: string;
  title: string;
  message: string;
  sourceType: string;
  crawledAt: Date;
}

export interface SourceDocumentWithGeoJson extends BaseSourceDocument {
  geoJson: any;
}
