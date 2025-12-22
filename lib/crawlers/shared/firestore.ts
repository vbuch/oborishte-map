import type { Firestore } from "firebase-admin/firestore";
import type { BaseSourceDocument } from "./types";

/**
 * Encode URL to a safe Firestore document ID
 */
export function encodeDocumentId(url: string): string {
  return Buffer.from(url).toString("base64").replaceAll(/[/+=]/g, "_");
}

/**
 * Check if a URL has already been processed
 * @throws Error if Firestore operation fails
 */
export async function isUrlProcessed(
  url: string,
  adminDb: Firestore
): Promise<boolean> {
  const docId = encodeDocumentId(url);
  const docRef = adminDb.collection("sources").doc(docId);
  const doc = await docRef.get();
  return doc.exists;
}

/**
 * Save source document to Firestore
 * @throws Error if save operation fails
 */
export async function saveSourceDocument<T extends BaseSourceDocument>(
  doc: T,
  adminDb: Firestore,
  options?: {
    transformData?: (doc: T) => Record<string, any>;
    logSuccess?: boolean;
  }
): Promise<void> {
  const docId = encodeDocumentId(doc.url);
  const docRef = adminDb.collection("sources").doc(docId);

  const data = options?.transformData
    ? options.transformData(doc)
    : { ...doc, crawledAt: new Date(doc.crawledAt) };

  await docRef.set(data);

  if (options?.logSuccess !== false) {
    console.log(`✅ Saved document: ${doc.title.substring(0, 50)}...`);
  }
}

/**
 * Save source document to Firestore only if it doesn't already exist
 * @returns true if saved, false if already exists
 * @throws Error if Firestore operations fail
 */
export async function saveSourceDocumentIfNew<T extends BaseSourceDocument>(
  doc: T,
  adminDb: Firestore,
  options?: Parameters<typeof saveSourceDocument<T>>[2]
): Promise<boolean> {
  const exists = await isUrlProcessed(doc.url, adminDb);
  if (exists) {
    return false;
  }
  await saveSourceDocument(doc, adminDb, options);
  return true;
}
