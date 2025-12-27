import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { NotificationSubscription } from "@/lib/types";
import { verifyAuthToken } from "@/lib/verifyAuthToken";
import { convertTimestamp } from "@/lib/firestore-utils";

// GET - Fetch all subscriptions for the user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const subscriptionsRef = adminDb.collection("notificationSubscriptions");
    const snapshot = await subscriptionsRef.where("userId", "==", userId).get();

    const subscriptions: NotificationSubscription[] = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          userId: data.userId,
          token: data.token,
          endpoint: data.endpoint,
          createdAt: convertTimestamp(data.createdAt),
          updatedAt: convertTimestamp(data.updatedAt),
          deviceInfo: data.deviceInfo || {},
        };
      })
      .sort((a, b) => {
        // Sort by createdAt descending (newest first)
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      });

    return NextResponse.json(subscriptions);
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscriptions" },
      { status: 500 }
    );
  }
}

// DELETE - Remove all notification subscriptions for the user
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
    console.error("Error deleting subscriptions:", error);
    return NextResponse.json(
      { error: "Failed to delete subscriptions" },
      { status: 500 }
    );
  }
}
