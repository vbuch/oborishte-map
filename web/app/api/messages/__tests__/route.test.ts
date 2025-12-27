import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

// Mock the firebase-admin module
vi.mock("@/lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(),
  },
}));

// Mock the messageIngest module
vi.mock("@/lib/messageIngest", () => ({
  verifyAuthToken: vi.fn(),
  validateMessageText: vi.fn(),
  messageIngest: vi.fn(),
}));

// Helper to create mock GeoJSON for testing
const createMockGeoJson = () => ({
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [23.3394, 42.7035],
      },
      properties: {},
    },
  ],
});

// Helper to create Firebase mock structure
const setupFirebaseMock = async (mockMessages: any[]) => {
  const { adminDb } = await import("@/lib/firebase-admin");

  const mockSnapshot = {
    forEach: vi.fn((callback) => {
      mockMessages.forEach((doc) => callback(doc));
    }),
  };

  const mockQuery = {
    get: vi.fn().mockResolvedValue(mockSnapshot),
  };

  const mockCollection = {
    orderBy: vi.fn().mockReturnValue(mockQuery),
  };

  vi.mocked(adminDb.collection).mockReturnValue(mockCollection as any);
};

describe("GET /api/messages - Date Filtering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variable
    delete process.env.MESSAGE_RELEVANCE_DAYS;
  });

  it("should filter out messages with all timespans expired", async () => {
    // Create mock data - one message with expired timespans, one with current
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Format dates as DD.MM.YYYY HH:MM
    const formatDate = (date: Date) => {
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}.${month}.${year} 08:00`;
    };

    const mockMessages = [
      {
        id: "msg1",
        data: () => ({
          text: "Old disruption",
          extractedData: JSON.stringify({
            responsible_entity: "Test",
            pins: [
              {
                address: "ул. Тест 1",
                timespans: [
                  { start: "01.01.2024 08:00", end: "01.01.2024 18:00" },
                ],
              },
            ],
            streets: [],
          }),
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: new Date("2024-01-01").getTime() / 1000 },
        }),
      },
      {
        id: "msg2",
        data: () => ({
          text: "Current disruption",
          extractedData: JSON.stringify({
            responsible_entity: "Test",
            pins: [
              {
                address: "ул. Тест 2",
                timespans: [
                  {
                    start: formatDate(yesterday),
                    end: formatDate(tomorrow),
                  },
                ],
              },
            ],
            streets: [],
          }),
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: yesterday.getTime() / 1000 },
        }),
      },
    ];

    await setupFirebaseMock(mockMessages);

    const response = await GET();
    const data = await response.json();

    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].id).toBe("msg2");
  });

  it("should show messages without timespans if they are within MESSAGE_RELEVANCE_DAYS", async () => {
    // Set relevance to 30 days
    process.env.MESSAGE_RELEVANCE_DAYS = "30";

    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 40); // 40 days ago

    const mockMessages = [
      {
        id: "msg1",
        data: () => ({
          text: "Recent message without timespans",
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: recentDate.getTime() / 1000 },
        }),
      },
      {
        id: "msg2",
        data: () => ({
          text: "Old message without timespans",
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: oldDate.getTime() / 1000 },
        }),
      },
    ];

    await setupFirebaseMock(mockMessages);

    const response = await GET();
    const data = await response.json();

    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].id).toBe("msg1");
  });

  it("should show message if at least one timespan is still relevant", async () => {
    const mockMessages = [
      {
        id: "msg1",
        data: () => ({
          text: "Mixed timespans",
          extractedData: JSON.stringify({
            responsible_entity: "Test",
            pins: [
              {
                address: "ул. Тест 1",
                timespans: [
                  { start: "01.01.2024 08:00", end: "01.01.2024 18:00" }, // expired
                ],
              },
            ],
            streets: [
              {
                street: "ул. Тест",
                from: "кръстовище А",
                to: "кръстовище Б",
                timespans: [
                  { start: "19.12.2025 08:00", end: "25.12.2025 18:00" }, // current
                ],
              },
            ],
          }),
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: new Date("2024-01-01").getTime() / 1000 },
        }),
      },
    ];

    await setupFirebaseMock(mockMessages);

    const response = await GET();
    const data = await response.json();

    expect(data.messages).toHaveLength(1);
    expect(data.messages[0].id).toBe("msg1");
  });

  it("should use default 7 days when MESSAGE_RELEVANCE_DAYS is not set", async () => {
    const date5DaysAgo = new Date();
    date5DaysAgo.setDate(date5DaysAgo.getDate() - 5);

    const mockMessages = [
      {
        id: "msg1",
        data: () => ({
          text: "Message from 5 days ago",
          geoJson: JSON.stringify(createMockGeoJson()),
          createdAt: { _seconds: date5DaysAgo.getTime() / 1000 },
        }),
      },
    ];

    await setupFirebaseMock(mockMessages);

    const response = await GET();
    const data = await response.json();

    // Should be included because it's within 7 days
    expect(data.messages).toHaveLength(1);
  });
});
