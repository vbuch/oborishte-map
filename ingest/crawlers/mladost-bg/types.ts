import { BaseSourceDocument } from "../shared/types";

export interface SourceDocument extends BaseSourceDocument {
  sourceType: "mladost-bg";
}

export interface PostLink {
  url: string;
  title: string;
  date: string;
  time?: string;
}
