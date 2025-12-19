import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { NotificationSubscription } from "@/lib/types";
import { verifyAuthToken } from "@/lib/messageIngest/helpers";

// Helper to convert Firestore timestamp to ISO string
function convertTimestamp(timestamp: any): string {
  if (timestamp?._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  return timestamp || new Date().toISOString();
}

// GET - Check if user has a valid subscription
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const subscriptionsRef = adminDb.collection("notificationSubscriptions");
    const snapshot = await subscriptionsRef
      .where("userId", "==", userId)
      .limit(1)
      .get();

    const hasSubscription = !snapshot.empty;

    return NextResponse.json({ hasSubscription });
  } catch (error) {
    console.error("Error checking subscription:", error);
    return NextResponse.json(
      { error: "Failed to check subscription" },
      { status: 500 }
    );
  }
}

// POST - Create or update notification subscription
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const body = await request.json();
    const { token, endpoint, deviceInfo } = body;

    if (!token || !endpoint) {
      return NextResponse.json(
        { error: "Token and endpoint are required" },
        { status: 400 }
      );
    }

    const subscriptionsRef = adminDb.collection("notificationSubscriptions");

    // Check if subscription already exists for this user
    const existingSnapshot = await subscriptionsRef
      .where("userId", "==", userId)
      .where("token", "==", token)
      .limit(1)
      .get();

    const now = new Date();

    if (!existingSnapshot.empty) {
      // Update existing subscription
      const docId = existingSnapshot.docs[0].id;
      await subscriptionsRef.doc(docId).update({
        endpoint,
        deviceInfo: deviceInfo || {},
        updatedAt: now,
      });

      const updatedDoc = await subscriptionsRef.doc(docId).get();
      const data = updatedDoc.data();

      const subscription: NotificationSubscription = {
        id: updatedDoc.id,
        userId: data?.userId,
        token: data?.token,
        endpoint: data?.endpoint,
        createdAt: convertTimestamp(data?.createdAt),
        updatedAt: convertTimestamp(data?.updatedAt),
        deviceInfo: data?.deviceInfo,
      };

      return NextResponse.json(subscription);
    }

    // Create new subscription
    const docRef = await subscriptionsRef.add({
      userId,
      token,
      endpoint,
      deviceInfo: deviceInfo || {},
      createdAt: now,
      updatedAt: now,
    });

    const subscription: NotificationSubscription = {
      id: docRef.id,
      userId,
      token,
      endpoint,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      deviceInfo: deviceInfo || {},
    };

    return NextResponse.json(subscription);
  } catch (error) {
    console.error("Error creating subscription:", error);
    return NextResponse.json(
      { error: "Failed to create subscription" },
      { status: 500 }
    );
  }
}

// DELETE - Remove notification subscription
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const subscriptionsRef = adminDb.collection("notificationSubscriptions");
    const snapshot = await subscriptionsRef.where("userId", "==", userId).get();

    // Delete all subscriptions for this user
    const batch = adminDb.batch();
    snapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });
    await batch.commit();

    return NextResponse.json({ success: true, deleted: snapshot.size });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return NextResponse.json(
      { error: "Failed to delete subscription" },
      { status: 500 }
    );
  }
}
