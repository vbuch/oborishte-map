import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock firebase-admin before importing helpers
vi.mock("@/lib/firebase-admin", () => ({
  adminAuth: {
    verifyIdToken: vi.fn(),
  },
}));

import { validateMessageText, verifyAuthToken } from "@/lib/pipeline/helpers";
import { adminAuth } from "@/lib/firebase-admin";

describe(validateMessageText, () => {
  it("should not throw for valid text", () => {
    expect(() => validateMessageText("Valid message")).not.toThrow();
  });

  it("should throw error for null text", () => {
    expect(() => validateMessageText(null)).toThrow("Invalid message text");
  });

  it("should throw error for undefined text", () => {
    expect(() => validateMessageText(undefined)).toThrow(
      "Invalid message text"
    );
  });

  it("should throw error for empty string", () => {
    expect(() => validateMessageText("")).toThrow("Invalid message text");
  });

  it("should throw error for non-string text", () => {
    expect(() => validateMessageText(123)).toThrow("Invalid message text");
    expect(() => validateMessageText({})).toThrow("Invalid message text");
    expect(() => validateMessageText([])).toThrow("Invalid message text");
  });

  it("should throw error for text longer than 5000 characters", () => {
    const longText = "a".repeat(5001);
    expect(() => validateMessageText(longText)).toThrow(
      "Message text is too long (max 5000 characters)"
    );
  });

  it("should accept text with exactly 5000 characters", () => {
    const maxText = "a".repeat(5000);
    expect(() => validateMessageText(maxText)).not.toThrow();
  });

  it("should accept text with less than 5000 characters", () => {
    const shortText = "a".repeat(4999);
    expect(() => validateMessageText(shortText)).not.toThrow();
  });

  it("should accept text with special characters", () => {
    expect(() =>
      validateMessageText("Hello 世界! 🌍 #test @user")
    ).not.toThrow();
  });
});

describe(verifyAuthToken, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should throw error for null auth header", async () => {
    await expect(verifyAuthToken(null)).rejects.toThrow("Missing auth token");
  });

  it("should throw error for auth header without Bearer prefix", async () => {
    await expect(verifyAuthToken("InvalidToken")).rejects.toThrow(
      "Missing auth token"
    );
  });

  it("should throw error for empty auth header", async () => {
    await expect(verifyAuthToken("")).rejects.toThrow("Missing auth token");
  });

  it("should return user info for valid token", async () => {
    const mockDecodedToken = {
      uid: "user-123",
      email: "test@example.com",
    };

    vi.mocked(adminAuth.verifyIdToken).mockResolvedValue(
      mockDecodedToken as any
    );

    const result = await verifyAuthToken("Bearer valid-token");

    expect(result).toEqual({
      userId: "user-123",
      userEmail: "test@example.com",
    });
    expect(adminAuth.verifyIdToken).toHaveBeenCalledWith("valid-token");
  });

  it("should handle user without email", async () => {
    const mockDecodedToken = {
      uid: "user-123",
      email: null,
    };

    vi.mocked(adminAuth.verifyIdToken).mockResolvedValue(
      mockDecodedToken as any
    );

    const result = await verifyAuthToken("Bearer valid-token");

    expect(result).toEqual({
      userId: "user-123",
      userEmail: null,
    });
  });

  it("should throw error for invalid token", async () => {
    vi.mocked(adminAuth.verifyIdToken).mockRejectedValue(
      new Error("Token verification failed")
    );

    await expect(verifyAuthToken("Bearer invalid-token")).rejects.toThrow(
      "Invalid auth token"
    );
  });
});
