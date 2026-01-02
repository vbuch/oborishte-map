/**
 * Parse Bulgarian date format (DD.MM.YYYY or DD/MM/YYYY) to ISO string
 */
export function parseBulgarianDate(dateStr: string): string {
  try {
    // Format: "19.12.2025" or "19/12/2025"
    // Handle both dot and slash separators
    const normalized = dateStr.trim().replace(/\//g, ".");
    const parts = normalized.split(".");
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

/**
 * Parse Bulgarian date-time format "DD.MM.YYYY HH:MM" to Date object
 *
 * @param dateStr - Date string in Bulgarian format (e.g., "29.12.2025 10:51")
 * @returns Date object in local timezone
 * @throws Error if date string is invalid
 */
export function parseBulgarianDateTime(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== "string") {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  const trimmed = dateStr.trim();

  // Expected format: "DD.MM.YYYY HH:MM"
  const match = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);

  if (!match) {
    throw new Error(
      `Date string does not match Bulgarian format "DD.MM.YYYY HH:MM": ${dateStr}`
    );
  }

  const [, day, month, year, hour, minute] = match;

  // Parse components (months are 0-indexed in JavaScript Date)
  const parsedDay = Number.parseInt(day, 10);
  const parsedMonth = Number.parseInt(month, 10) - 1; // 0-indexed
  const parsedYear = Number.parseInt(year, 10);
  const parsedHour = Number.parseInt(hour, 10);
  const parsedMinute = Number.parseInt(minute, 10);

  // Validate ranges
  if (parsedMonth < 0 || parsedMonth > 11) {
    throw new Error(`Invalid month: ${month}`);
  }

  if (parsedDay < 1 || parsedDay > 31) {
    throw new Error(`Invalid day: ${day}`);
  }

  if (parsedHour < 0 || parsedHour > 23) {
    throw new Error(`Invalid hour: ${hour}`);
  }

  if (parsedMinute < 0 || parsedMinute > 59) {
    throw new Error(`Invalid minute: ${minute}`);
  }

  // Create date in local timezone (assumed to be Europe/Sofia)
  const date = new Date(
    parsedYear,
    parsedMonth,
    parsedDay,
    parsedHour,
    parsedMinute,
    0,
    0
  );

  // Check if date is valid (e.g., not 31st February)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date: ${dateStr}`);
  }

  // Verify the parsed date matches input (catches invalid dates like Feb 31)
  if (
    date.getDate() !== parsedDay ||
    date.getMonth() !== parsedMonth ||
    date.getFullYear() !== parsedYear
  ) {
    throw new Error(`Invalid date (out of range): ${dateStr}`);
  }

  return date;
}

/**
 * Parse Bulgarian short date format with 2-digit year (DD.MM.YY) to ISO string
 * Optionally combines with time (HH:MM)
 *
 * @param dateStr - Date string in format "DD.MM.YY" (e.g., "17.07.25")
 * @param timeStr - Optional time string in format "HH:MM" (e.g., "18:48")
 * @returns ISO date string
 *
 * @example
 * parseShortBulgarianDateTime("17.07.25", "18:48") // "2025-07-17T18:48:00.000Z" (in Sofia timezone)
 * parseShortBulgarianDateTime("17.07.25") // "2025-07-17T00:00:00.000Z" (in Sofia timezone)
 */
export function parseShortBulgarianDateTime(
  dateStr: string,
  timeStr?: string
): string {
  try {
    // Format: "DD.MM.YY" optionally with "HH:MM"
    const normalized = dateStr.trim().replace(/\//g, ".");
    const parts = normalized.split(".");

    if (parts.length === 3) {
      const [day, month, shortYear] = parts;

      // Convert 2-digit year to 4-digit year (always assume 20XX)
      const year = `20${shortYear}`;

      // Parse time if provided
      let hour = "00";
      let minute = "00";
      if (timeStr) {
        const timeParts = timeStr.trim().split(":");
        if (timeParts.length === 2) {
          hour = timeParts[0].padStart(2, "0");
          minute = timeParts[1].padStart(2, "0");
        }
      }

      // Create date in local timezone (assumed to be Europe/Sofia)
      const date = new Date(
        Number.parseInt(year, 10),
        Number.parseInt(month, 10) - 1, // 0-indexed months
        Number.parseInt(day, 10),
        Number.parseInt(hour, 10),
        Number.parseInt(minute, 10),
        0,
        0
      );

      if (!Number.isNaN(date.getTime())) {
        return date.toISOString();
      }
    }

    console.warn(
      `⚠️ Unable to parse short date: ${dateStr} ${
        timeStr || ""
      }, using current date`
    );
    return new Date().toISOString();
  } catch (error) {
    console.error(
      `❌ Error parsing short date: ${dateStr} ${timeStr || ""}`,
      error
    );
    return new Date().toISOString();
  }
}

/**
 * Format date for display in Bulgarian format
 *
 * @param date - Date object to format
 * @returns Formatted string "DD.MM.YYYY HH:MM"
 */
export function formatBulgarianDateTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");

  return `${day}.${month}.${year} ${hour}:${minute}`;
}
