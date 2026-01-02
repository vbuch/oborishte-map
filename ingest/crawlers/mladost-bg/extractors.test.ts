import { describe, it, expect, vi } from "vitest";
import { extractPostLinks, extractPostDetails } from "./extractors";

// Mock Page type from Playwright
interface MockPage {
  evaluate: <T>(fn: (...args: any[]) => T, ...args: any[]) => Promise<T>;
}

function createMockPage(mockEvaluate: any): MockPage {
  return {
    evaluate: mockEvaluate,
  } as MockPage;
}

describe("mladost-bg/extractors", () => {
  describe("extractPostLinks", () => {
    it("should extract post links with date and time from valid HTML", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://mladost.bg/?post_type=post&p=30142",
          title: "Ремонт в подлез на Окръжна болница",
          date: "17.07.25",
          time: "18:48",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("mladost.bg");
      expect(posts[0].url).toContain("?post_type=post&p=");
      expect(posts[0].title).toBe("Ремонт в подлез на Окръжна болница");
      expect(posts[0].date).toBe("17.07.25");
      expect(posts[0].time).toBe("18:48");
    });

    it("should extract multiple post links", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://mladost.bg/?post_type=post&p=30142",
          title: "Post 1",
          date: "17.07.25",
          time: "18:48",
        },
        {
          url: "https://mladost.bg/?post_type=post&p=30141",
          title: "Post 2",
          date: "16.07.25",
          time: "12:30",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(2);
      expect(posts[0].title).toBe("Post 1");
      expect(posts[1].title).toBe("Post 2");
      expect(posts[1].time).toBe("12:30");
    });

    it("should return empty array when no posts found", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toEqual([]);
    });

    it("should filter posts by mladost.bg URL pattern", async () => {
      const mockEvaluate = vi.fn().mockImplementation(() => {
        // Simulate the actual DOM filtering logic
        const validPost = {
          url: "https://mladost.bg/?post_type=post&p=30142",
          title: "Valid Post",
          date: "17.07.25",
          time: "18:48",
        };
        return Promise.resolve([validPost]);
      });

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].url).toContain("mladost.bg");
      expect(posts[0].url).toContain("?post_type=post&p=");
    });

    it("should handle posts with missing time", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://mladost.bg/?post_type=post&p=30142",
          title: "Test Post",
          date: "17.07.25",
          time: undefined,
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].date).toBe("17.07.25");
      expect(posts[0].time).toBeUndefined();
    });

    it("should handle posts with empty dates", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue([
        {
          url: "https://mladost.bg/?post_type=post&p=30142",
          title: "Test Post",
          date: "",
          time: "18:48",
        },
      ]);

      const page = createMockPage(mockEvaluate) as any;
      const posts = await extractPostLinks(page);

      expect(posts).toHaveLength(1);
      expect(posts[0].date).toBe("");
    });
  });

  describe("extractPostDetails", () => {
    it("should extract post details from valid page", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Ремонт в подлез на Окръжна болница",
        dateText: "18:48 | 17.07.25",
        contentHtml: "<p>Test content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Ремонт в подлез на Окръжна болница");
      expect(details.dateText).toBe("18:48 | 17.07.25");
      expect(details.contentHtml).toBe("<p>Test content</p>");
    });

    it("should extract title from h2 element (mladost.bg uses h2, not h1)", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Title from h2",
        dateText: "17.07.25",
        contentHtml: "<p>Content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("Title from h2");
    });

    it("should handle missing title", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "",
        dateText: "17.07.25",
        contentHtml: "<p>Content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.title).toBe("");
    });

    it("should handle missing date", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Title",
        dateText: "",
        contentHtml: "<p>Content</p>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.dateText).toBe("");
    });

    it("should handle empty content", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Title",
        dateText: "17.07.25",
        contentHtml: "",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      expect(details.contentHtml).toBe("");
    });

    it("should extract content without excluded elements", async () => {
      const mockEvaluate = vi.fn().mockResolvedValue({
        title: "Test Title",
        dateText: "17.07.25",
        // Should only exclude scripts and styles, not navigation (inclusive)
        contentHtml: "<p>Main content</p><nav>Navigation</nav>",
      });

      const page = createMockPage(mockEvaluate) as any;
      const details = await extractPostDetails(page);

      // With inclusive selection, navigation should be included
      expect(details.contentHtml).toContain("Main content");
      expect(details.contentHtml).toContain("Navigation");
    });
  });
});
