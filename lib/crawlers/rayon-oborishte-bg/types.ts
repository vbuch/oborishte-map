import { BaseSourceDocument } from "../shared/types";

export interface SourceDocument extends BaseSourceDocument {
  sourceType: "rayon-oborishte-bg";
}

export interface PostLink {
  url: string;
  title: string;
  date: string;
}
