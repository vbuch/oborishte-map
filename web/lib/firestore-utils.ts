/**
 * Shared Firestore utility functions
 */

/**
 * Convert Firestore timestamp to ISO string
 */
export function convertTimestamp(timestamp: any): string {
  if (timestamp?._seconds !== undefined) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  return timestamp || new Date().toISOString();
}
