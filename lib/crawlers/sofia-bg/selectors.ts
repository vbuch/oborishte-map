/**
 * CSS selectors for scraping sofia.bg repairs page
 */
export const SELECTORS = {
  // Index page selectors
  INDEX: {
    // Each article card on the listing page
    POST_CONTAINER: ".col-lg-6.pl-3.pr-2.pb-3",
    // Link to individual article
    POST_LINK: 'a[href^="https://www.sofia.bg/w/"]',
    // Date on listing
    POST_DATE: "span.date, .date",
    // Title on listing
    POST_TITLE: ".news-title p, .news-title",
    // Description/excerpt on listing
    POST_DESC: ".desc p, .desc",
  },

  // Individual post page selectors
  POST: {
    // Main content container - component-paragraph holds the article content
    CONTENT: ".component-paragraph, #main-content, .portlet-body",
    // Title element - first component-paragraph div contains the title
    TITLE: ".component-paragraph, h1, .news-title",
    // Date element
    DATE: '.date, time, [class*="date"]',
  },
};
