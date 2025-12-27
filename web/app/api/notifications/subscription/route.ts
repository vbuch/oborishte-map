import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { NotificationSubscription } from "@/lib/types";
import { verifyAuthToken } from "@/lib/verifyAuthToken";
import { convertTimestamp } from "@/lib/firestore-utils";

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

// DELETE - Remove a specific notification subscription by token
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    // Get token from query parameters
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    if (!token) {
      return NextResponse.json(
        { error: "Token parameter is required" },
        { status: 400 }
      );
    }

    const subscriptionsRef = adminDb.collection("notificationSubscriptions");
    const snapshot = await subscriptionsRef
      .where("userId", "==", userId)
      .where("token", "==", token)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "Subscription not found" },
        { status: 404 }
      );
    }

    // Delete the subscription
    await snapshot.docs[0].ref.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting subscription:", error);
    return NextResponse.json(
      { error: "Failed to delete subscription" },
      { status: 500 }
    );
  }
}
