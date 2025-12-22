import { BaseSourceDocument } from "../shared/types";

export interface SourceDocument extends BaseSourceDocument {
  sourceType: "sofia-bg";
}

export interface PostLink {
  url: string;
  title: string;
  date: string;
}
