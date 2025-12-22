/**
 * Parse Bulgarian date format (DD.MM.YYYY) to ISO string
 */
export function parseBulgarianDate(dateStr: string): string {
  try {
    // Format: "19.12.2025" or "15.12.2025"
    const parts = dateStr.trim().split(".");
    if (parts.length === 3) {
      const [day, month, year] = parts;
      const date = new Date(`${year}-${month}-${day}`);
      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }
    console.warn(`⚠️ Unable to parse date: ${dateStr}, using current date`);
    return new Date().toISOString();
  } catch (error) {
    console.error(`❌ Error parsing date: ${dateStr}`, error);
    return new Date().toISOString();
  }
}
