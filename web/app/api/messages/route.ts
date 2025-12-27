import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Message, Timespan } from "@/lib/types";
import { convertTimestamp } from "@/lib/firestore-utils";

const INGEST_SOURCE = "web-interface";
const DEFAULT_RELEVANCE_DAYS = 7;

/**
 * Parse a timespan end date string in format "DD.MM.YYYY HH:MM" to Date object
 */
function parseTimespanDate(dateStr: string): Date | null {
  try {
    // Expected format: "DD.MM.YYYY HH:MM"
    const regex = /^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/;
    const parts = regex.exec(dateStr);
    if (!parts) return null;

    const [, day, month, year, hours, minutes] = parts;
    return new Date(
      Number.parseInt(year),
      Number.parseInt(month) - 1, // JS months are 0-indexed
      Number.parseInt(day),
      Number.parseInt(hours),
      Number.parseInt(minutes)
    );
  } catch {
    return null;
  }
}

/**
 * Check if a message is still relevant based on its timespans or creation date
 */
function isMessageRelevant(message: Message, cutoffDate: Date): boolean {
  // If message has extracted data with timespans, check them
  if (message.extractedData) {
    const extractedData = message.extractedData;
    const allTimespans: Timespan[] = [];

    // Collect all timespans from pins
    if (extractedData.pins) {
      extractedData.pins.forEach((pin) => {
        if (pin.timespans && Array.isArray(pin.timespans)) {
          allTimespans.push(...pin.timespans);
        }
      });
    }

    // Collect all timespans from streets
    if (extractedData.streets) {
      extractedData.streets.forEach((street) => {
        if (street.timespans && Array.isArray(street.timespans)) {
          allTimespans.push(...street.timespans);
        }
      });
    }

    // If we have timespans, check if any end date is after cutoff
    if (allTimespans.length > 0) {
      return allTimespans.some((timespan) => {
        if (!timespan.end) return false;
        const endDate = parseTimespanDate(timespan.end);
        return endDate && endDate >= cutoffDate;
      });
    }
  }

  // No timespans found - use createdAt date
  const createdAt = new Date(message.createdAt);
  return createdAt >= cutoffDate;
}

export async function GET() {
  try {
    // Get relevance period from environment
    const relevanceDays = process.env.MESSAGE_RELEVANCE_DAYS
      ? Number.parseInt(process.env.MESSAGE_RELEVANCE_DAYS, 10)
      : DEFAULT_RELEVANCE_DAYS;

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - relevanceDays);

    // Use Admin SDK for reading messages
    const messagesRef = adminDb.collection("messages");
    const snapshot = await messagesRef.orderBy("createdAt", "desc").get();

    const allMessages: Message[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      allMessages.push({
        id: doc.id,
        text: data.text,
        addresses: data.addresses ? JSON.parse(data.addresses) : [],
        extractedData: data.extractedData
          ? JSON.parse(data.extractedData)
          : undefined,
        geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
        createdAt: convertTimestamp(data.createdAt),
        crawledAt: data.crawledAt
          ? convertTimestamp(data.crawledAt)
          : undefined,
        finalizedAt: data.finalizedAt
          ? convertTimestamp(data.finalizedAt)
          : undefined,
        source: data.source,
        sourceUrl: data.sourceUrl,
      });
    });

    // Filter messages by relevance
    const relevantMessages = allMessages.filter((message) =>
      isMessageRelevant(message, cutoffDate)
    );

    // Include all messages with valid GeoJSON
    const messages = relevantMessages.filter((message) => {
      return message.geoJson !== null && message.geoJson !== undefined;
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Error fetching messages:", error);
    return NextResponse.json(
      { error: "Failed to fetch messages" },
      { status: 500 }
    );
  }
}
