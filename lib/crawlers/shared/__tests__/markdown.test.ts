import { describe, it, expect } from "vitest";
import { createTurndownService, htmlToMarkdown } from "../markdown";

describe("markdown utilities", () => {
  describe("createTurndownService", () => {
    it("should create a TurndownService instance with default options", () => {
      const service = createTurndownService();
      expect(service).toBeDefined();
      expect(service.turndown).toBeTypeOf("function");
    });

    it("should create a TurndownService with custom options", () => {
      const service = createTurndownService({
        headingStyle: "setext",
        codeBlockStyle: "indented",
      });
      expect(service).toBeDefined();
    });
  });

  describe("htmlToMarkdown", () => {
    it("should convert simple HTML to markdown", () => {
      const html = "<p>Hello world</p>";
      const markdown = htmlToMarkdown(html);

      expect(markdown).toBe("Hello world");
    });

    it("should convert headings to markdown", () => {
      const html = "<h1>Title</h1><p>Content</p>";
      const markdown = htmlToMarkdown(html);

      expect(markdown).toContain("# Title");
      expect(markdown).toContain("Content");
    });

    it("should convert links to markdown", () => {
      const html = '<a href="https://example.com">Link</a>';
      const markdown = htmlToMarkdown(html);

      expect(markdown).toBe("[Link](https://example.com)");
    });

    it("should convert lists to markdown", () => {
      const html = "<ul><li>Item 1</li><li>Item 2</li></ul>";
      const markdown = htmlToMarkdown(html);

      expect(markdown).toContain("*   Item 1");
      expect(markdown).toContain("*   Item 2");
    });

    it("should handle complex HTML", () => {
      const html = `
        <h2>Heading</h2>
        <p>Paragraph with <strong>bold</strong> and <em>italic</em> text.</p>
        <ul>
          <li>List item 1</li>
          <li>List item 2</li>
        </ul>
      `;
      const markdown = htmlToMarkdown(html);

      expect(markdown).toContain("## Heading");
      expect(markdown).toContain("**bold**");
      expect(markdown).toContain("_italic_");
      expect(markdown).toContain("*   List item 1");
    });

    it("should use custom TurndownService when provided", () => {
      const customService = createTurndownService({
        headingStyle: "atx",
      });
      const html = "<h1>Title</h1>";
      const markdown = htmlToMarkdown(html, customService);

      expect(markdown).toContain("# Title");
    });
  });
});
