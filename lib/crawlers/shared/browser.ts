import { chromium, Browser, Page } from "playwright";

/**
 * Launch a new browser instance
 */
export async function launchBrowser(options?: {
  headless?: boolean;
  timeout?: number;
}): Promise<Browser> {
  return chromium.launch({
    headless: options?.headless ?? true,
    timeout: options?.timeout,
  });
}

/**
 * Create a new page in the browser
 */
export async function createPage(
  browser: Browser,
  options?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
  }
): Promise<Page> {
  return browser.newPage();
}

/**
 * Fetch page content with a temporary browser instance
 */
export async function fetchPageContent(
  url: string,
  options?: {
    waitUntil?: "load" | "domcontentloaded" | "networkidle";
    timeout?: number;
  }
): Promise<string> {
  const browser = await launchBrowser({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, {
      waitUntil: options?.waitUntil ?? "networkidle",
      timeout: options?.timeout,
    });
    return await page.content();
  } finally {
    await browser.close();
  }
}
