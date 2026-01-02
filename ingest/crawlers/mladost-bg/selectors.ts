/**
 * CSS selectors for scraping mladost.bg
 */
export const SELECTORS = {
  // Index page selectors
  INDEX: {
    // Each article card on the listing page
    POST_CONTAINER: ".news",
    // Link to individual post
    POST_LINK: 'a[href*="?post_type=post&p="]',
    // Date on listing (format: DD.MM.YY)
    POST_DATE: "span.date, .date",
    // Time on listing (format: HH:MM)
    POST_TIME: "span.time, .time",
    // Title on listing
    POST_TITLE: "h5.news-title, h4.news-title, .news-title",
  },

  // Individual post page selectors
  POST: {
    // Main content area (inclusive selection)
    CONTENT: ".section-content, article, .entry-content, main",
    // Title (mladost uses h2, not h1)
    TITLE: "h2, .news-title, h1",
    // Date with time on detail page
    DATE: ".news-date-time, time, .date",
  },
} as const;
