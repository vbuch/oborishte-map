import { FieldValue } from "firebase-admin/firestore";

/**
 * Process fields for Firestore storage
 * - Converts Date objects to Firestore server timestamps
 * - Stringifies complex objects (extractedData, geoJson, messageFilter)
 * - Passes through primitives unchanged
 */
export function processFieldsForFirestore(
  fields: Record<string, any>
): Record<string, any> {
  const processedFields: Record<string, any> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value instanceof Date) {
      processedFields[key] = FieldValue.serverTimestamp();
    } else if (typeof value === "object" && value !== null) {
      // Stringify objects (extractedData, geoJson, messageFilter)
      processedFields[key] = JSON.stringify(value);
    } else {
      processedFields[key] = value;
    }
  }
  return processedFields;
}
