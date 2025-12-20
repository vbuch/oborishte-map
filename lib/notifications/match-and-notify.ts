#!/usr/bin/env node

import dotenv from "dotenv";
import { resolve } from "node:path";
import type { Firestore } from "firebase-admin/firestore";
import type { Messaging } from "firebase-admin/messaging";
import * as turf from "@turf/turf";
import {
  Message,
  Interest,
  NotificationMatch,
  NotificationSubscription,
} from "../types";

// Load environment variables
dotenv.config({ path: resolve(process.cwd(), ".env.local") });

interface MatchResult {
  messageId: string;
  userId: string;
  interestId: string;
  distance: number;
}

/**
 * Convert Firestore timestamp to ISO string
 */
function convertTimestamp(timestamp: any): string {
  if (timestamp?._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  return timestamp || new Date().toISOString();
}

/**
 * Get all unprocessed messages (messages not yet matched with user interests)
 */
async function getUnprocessedMessages(adminDb: Firestore): Promise<Message[]> {
  console.log("📨 Fetching unprocessed messages...");

  const messagesRef = adminDb.collection("messages");
  const matchesRef = adminDb.collection("notificationMatches");

  // Get all messages
  const messagesSnapshot = await messagesRef.orderBy("createdAt", "desc").get();

  // Get all message IDs that have been processed
  const matchesSnapshot = await matchesRef.select("messageId").get();
  const processedMessageIds = new Set<string>();
  matchesSnapshot.forEach((doc) => {
    const data = doc.data();
    if (data.messageId) {
      processedMessageIds.add(data.messageId);
    }
  });

  // Filter out messages that have already been processed
  const unprocessedMessages: Message[] = [];
  messagesSnapshot.forEach((doc) => {
    if (!processedMessageIds.has(doc.id)) {
      const data = doc.data();
      unprocessedMessages.push({
        id: doc.id,
        text: data.text,
        geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
        createdAt: convertTimestamp(data.createdAt),
      });
    }
  });

  console.log(`   ✅ Found ${unprocessedMessages.length} unprocessed messages`);
  console.log(`   ℹ️  Already processed: ${processedMessageIds.size} messages`);

  return unprocessedMessages;
}

/**
 * Get all user interests
 */
async function getAllInterests(adminDb: Firestore): Promise<Interest[]> {
  console.log("📍 Fetching user interests...");

  const interestsRef = adminDb.collection("interests");
  const snapshot = await interestsRef.get();

  const interests: Interest[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    interests.push({
      id: doc.id,
      userId: data.userId,
      coordinates: data.coordinates,
      radius: data.radius,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
    });
  });

  console.log(
    `   ✅ Found ${interests.length} interests from ${
      new Set(interests.map((i) => i.userId)).size
    } users`
  );

  return interests;
}

/**
 * Check if a message's GeoJSON features intersect with a user's interest circle
 */
function matchMessageToInterest(
  message: Message,
  interest: Interest
): { matches: boolean; distance: number | null } {
  if (!message.geoJson?.features || message.geoJson.features.length === 0) {
    return { matches: false, distance: null };
  }

  const interestPoint = turf.point([
    interest.coordinates.lng,
    interest.coordinates.lat,
  ]);
  const interestCircle = turf.circle(
    interestPoint,
    interest.radius / 1000, // Convert meters to kilometers
    { units: "kilometers" }
  );

  let minDistance: number | null = null;

  for (const feature of message.geoJson.features) {
    try {
      // Check if feature intersects with interest circle
      const intersects = turf.booleanIntersects(feature, interestCircle);

      if (intersects) {
        // Calculate distance to get the closest point using pointToLineDistance or centroid
        let distance: number;
        if (feature.geometry.type === "Point") {
          distance = turf.distance(
            interestPoint,
            feature.geometry.coordinates,
            { units: "meters" }
          );
        } else {
          // For LineString and Polygon, calculate distance to centroid
          const centroid = turf.centroid(feature);
          distance = turf.distance(interestPoint, centroid, {
            units: "meters",
          });
        }

        if (minDistance === null || distance < minDistance) {
          minDistance = distance;
        }
      }
    } catch (error) {
      console.warn(`   ⚠️  Error checking intersection for feature:`, error);
    }
  }

  return { matches: minDistance !== null, distance: minDistance };
}

/**
 * Match unprocessed messages with user interests
 */
async function matchMessagesWithInterests(
  messages: Message[],
  interests: Interest[]
): Promise<MatchResult[]> {
  console.log("\n🔍 Matching messages with interests...");

  const matches: MatchResult[] = [];

  for (const message of messages) {
    if (!message.id || !message.geoJson) {
      continue;
    }

    for (const interest of interests) {
      if (!interest.id) {
        continue;
      }

      const { matches: isMatch, distance } = matchMessageToInterest(
        message,
        interest
      );

      if (isMatch && distance !== null) {
        matches.push({
          messageId: message.id,
          userId: interest.userId,
          interestId: interest.id,
          distance,
        });
        console.log(
          `   ✅ Match: Message ${message.id.substring(
            0,
            8
          )} → User ${interest.userId.substring(
            0,
            8
          )} → Interest ${interest.id.substring(0, 8)} (${Math.round(
            distance
          )}m)`
        );
      }
    }
  }

  console.log(`\n   📊 Total matches found: ${matches.length}`);

  return matches;
}

/**
 * Deduplicate matches - one notification per user per message
 */
function deduplicateMatches(matches: MatchResult[]): MatchResult[] {
  console.log("\n🔄 Deduplicating matches...");

  const dedupedMap = new Map<string, MatchResult>();

  for (const match of matches) {
    const key = `${match.userId}-${match.messageId}`;
    const existing = dedupedMap.get(key);

    // Keep the match with the smallest distance
    if (!existing || match.distance < existing.distance) {
      dedupedMap.set(key, match);
    }
  }

  const deduped = Array.from(dedupedMap.values());
  console.log(
    `   ✅ After deduplication: ${deduped.length} matches (removed ${
      matches.length - deduped.length
    } duplicates)`
  );

  return deduped;
}

/**
 * Store notification matches in Firestore
 */
async function storeNotificationMatches(
  adminDb: Firestore,
  matches: MatchResult[]
): Promise<void> {
  console.log("\n💾 Storing notification matches...");

  const matchesRef = adminDb.collection("notificationMatches");
  const now = new Date();

  for (const match of matches) {
    await matchesRef.add({
      userId: match.userId,
      messageId: match.messageId,
      interestId: match.interestId,
      distance: match.distance,
      matchedAt: now,
      notified: false,
    });
  }

  console.log(`   ✅ Stored ${matches.length} matches`);
}

/**
 * Get unnotified matches
 */
async function getUnnotifiedMatches(
  adminDb: Firestore
): Promise<NotificationMatch[]> {
  console.log("\n🔔 Fetching unnotified matches...");

  const matchesRef = adminDb.collection("notificationMatches");
  const snapshot = await matchesRef.where("notified", "==", false).get();

  const matches: NotificationMatch[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    matches.push({
      id: doc.id,
      userId: data.userId,
      messageId: data.messageId,
      interestId: data.interestId,
      matchedAt: convertTimestamp(data.matchedAt),
      notified: data.notified || false,
      notifiedAt: data.notifiedAt
        ? convertTimestamp(data.notifiedAt)
        : undefined,
      distance: data.distance,
    });
  });

  console.log(`   ✅ Found ${matches.length} unnotified matches`);

  return matches;
}

/**
 * Get user subscriptions
 */
async function getUserSubscriptions(
  adminDb: Firestore,
  userId: string
): Promise<NotificationSubscription[]> {
  const subscriptionsRef = adminDb.collection("notificationSubscriptions");
  const snapshot = await subscriptionsRef.where("userId", "==", userId).get();

  const subscriptions: NotificationSubscription[] = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    subscriptions.push({
      id: doc.id,
      userId: data.userId,
      token: data.token,
      endpoint: data.endpoint,
      createdAt: convertTimestamp(data.createdAt),
      updatedAt: convertTimestamp(data.updatedAt),
      deviceInfo: data.deviceInfo,
    });
  });

  return subscriptions;
}

/**
 * Send push notification
 */
async function sendPushNotification(
  messaging: Messaging,
  subscription: NotificationSubscription,
  message: Message,
  match: NotificationMatch
): Promise<{ success: boolean; error?: string }> {
  try {
    const messagePreview =
      message.text.length > 100
        ? message.text.substring(0, 100) + "..."
        : message.text;

    const distanceText = match.distance
      ? ` (${Math.round(match.distance)}m от вашия район)`
      : "";

    await messaging.send({
      token: subscription.token,
      notification: {
        title: "Ново съобщение в Обориште",
        body: `${messagePreview}${distanceText}`,
      },
      data: {
        messageId: match.messageId,
        interestId: match.interestId,
        matchId: match.id || "",
        url: `${
          process.env.NEXT_PUBLIC_APP_URL || "https://oborishte-map.vercel.app"
        }/?messageId=${match.messageId}`,
      },
      webpush: {
        fcmOptions: {
          link: `${
            process.env.NEXT_PUBLIC_APP_URL ||
            "https://oborishte-map.vercel.app"
          }/?messageId=${match.messageId}`,
        },
      },
    });

    return { success: true };
  } catch (error) {
    console.error(`   ❌ Failed to send notification:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Send notifications for matches
 */
async function sendNotifications(
  adminDb: Firestore,
  messaging: Messaging,
  matches: NotificationMatch[]
): Promise<void> {
  console.log("\n📤 Sending notifications...");

  const messagesRef = adminDb.collection("messages");
  const matchesRef = adminDb.collection("notificationMatches");

  let successCount = 0;
  let errorCount = 0;

  // Group matches by userId-messageId to send only one notification per user per message
  const notificationMap = new Map<string, NotificationMatch>();
  for (const match of matches) {
    const key = `${match.userId}-${match.messageId}`;
    const existing = notificationMap.get(key);
    // Keep the match with the smallest distance
    if (
      !existing ||
      (match.distance &&
        (!existing.distance || match.distance < existing.distance))
    ) {
      notificationMap.set(key, match);
    }
  }

  const uniqueMatches = Array.from(notificationMap.values());
  console.log(
    `   ℹ️  Sending ${uniqueMatches.length} unique notifications (deduplicated from ${matches.length} matches)`
  );

  // Track which matches were processed to mark them all as notified
  const allMatchIds = matches
    .map((m) => m.id)
    .filter((id): id is string => !!id);

  for (const match of uniqueMatches) {
    if (!match.id) {
      continue;
    }

    // Get message details
    const messageDoc = await messagesRef.doc(match.messageId).get();
    if (!messageDoc.exists) {
      console.warn(`   ⚠️  Message ${match.messageId} not found`);
      continue;
    }

    const messageData = messageDoc.data();
    const message: Message = {
      id: messageDoc.id,
      text: messageData?.text || "",
      geoJson: messageData?.geoJson
        ? JSON.parse(messageData.geoJson)
        : undefined,
      createdAt: convertTimestamp(messageData?.createdAt),
    };

    // Get user subscriptions
    const subscriptions = await getUserSubscriptions(adminDb, match.userId);

    if (subscriptions.length === 0) {
      console.log(
        `   ⏭️  No subscriptions for user ${match.userId.substring(0, 8)}`
      );
      continue;
    }

    // Send to the first active subscription (one notification per user per message)
    const subscription = subscriptions[0];
    const result = await sendPushNotification(
      messaging,
      subscription,
      message,
      match
    );

    if (result.success) {
      successCount++;
      console.log(
        `   ✅ Sent to user ${match.userId.substring(
          0,
          8
        )} for message ${match.messageId.substring(0, 8)}`
      );
    } else {
      errorCount++;
    }
  }

  // Mark all related matches as notified
  console.log(`\n   📝 Marking ${allMatchIds.length} matches as notified...`);
  for (const matchId of allMatchIds) {
    await matchesRef.doc(matchId).update({
      notified: true,
      notifiedAt: new Date(),
    });
  }

  console.log(`\n   📊 Notifications sent: ${successCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
}

/**
 * Initialize Firebase Admin
 */
async function initFirebase(): Promise<{
  adminDb: Firestore;
  messaging: Messaging;
}> {
  const firebaseAdmin = await import("../firebase-admin");
  const { getMessaging } = await import("firebase-admin/messaging");

  return {
    adminDb: firebaseAdmin.adminDb,
    messaging: getMessaging(firebaseAdmin.adminApp),
  };
}

/**
 * Main function
 */
export async function main(): Promise<void> {
  console.log("🔔 Starting notification matching and sending...\n");

  const { adminDb, messaging } = await initFirebase();

  // Step 1: Get unprocessed messages
  const unprocessedMessages = await getUnprocessedMessages(adminDb);

  if (unprocessedMessages.length === 0) {
    console.log("\n✨ No new messages to process");
    return;
  }

  // Step 2: Get all user interests
  const interests = await getAllInterests(adminDb);

  if (interests.length === 0) {
    console.log("\n✨ No user interests configured");
    return;
  }

  // Step 3: Match messages with interests
  const matches = await matchMessagesWithInterests(
    unprocessedMessages,
    interests
  );

  if (matches.length === 0) {
    console.log("\n✨ No matches found");
    return;
  }

  // Step 4: Deduplicate matches
  const dedupedMatches = deduplicateMatches(matches);

  // Step 5: Store matches in Firestore
  await storeNotificationMatches(adminDb, dedupedMatches);

  // Step 6: Get all unnotified matches (including ones we just stored)
  const unnotifiedMatches = await getUnnotifiedMatches(adminDb);

  if (unnotifiedMatches.length === 0) {
    console.log("\n✨ No unnotified matches to send");
    return;
  }

  // Step 7: Send notifications
  await sendNotifications(adminDb, messaging, unnotifiedMatches);

  console.log("\n✅ Notification processing complete!\n");
}

// Run the script only when executed directly
if (require.main === module) {
  // eslint-disable-next-line unicorn/prefer-top-level-await
  void (async () => {
    try {
      await main();
    } catch (error) {
      console.error("\n❌ Fatal error:", error);
      process.exit(1);
    }
  })();
}
