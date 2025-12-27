import { UAParser } from "ua-parser-js";

export interface ParsedUserAgent {
  browser: string;
  platform: string;
  displayName: string;
}

/**
 * Parse user agent string to extract browser and platform information
 * Uses ua-parser-js library for accurate parsing
 */
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  const parser = new UAParser(userAgent);
  const result = parser.getResult();

  // Extract browser name
  const browser = result.browser.name || "Unknown Browser";

  // Extract platform (OS + device type)
  let platform = "Unknown Platform";

  if (result.device.type === "mobile" || result.device.type === "tablet") {
    // Mobile/tablet device - show OS name
    platform = result.os.name || "Mobile";
  } else if (result.os.name) {
    // Desktop OS
    platform = result.os.name;
  }

  const displayName = `${browser} on ${platform}`;

  return {
    browser,
    platform,
    displayName,
  };
}
