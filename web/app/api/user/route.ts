import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { verifyAuthToken } from "@/lib/verifyAuthToken";

// DELETE - Delete all user data and account
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    // Delete all user data from multiple collections using batch operations

    // 1. Delete all interests
    const interestsRef = adminDb.collection("interests");
    const interestsSnapshot = await interestsRef
      .where("userId", "==", userId)
      .get();

    const interestsBatch = adminDb.batch();
    interestsSnapshot.forEach((doc) => {
      interestsBatch.delete(doc.ref);
    });
    await interestsBatch.commit();

    // 2. Delete all notification subscriptions
    const subscriptionsRef = adminDb.collection("notificationSubscriptions");
    const subscriptionsSnapshot = await subscriptionsRef
      .where("userId", "==", userId)
      .get();

    const subscriptionsBatch = adminDb.batch();
    subscriptionsSnapshot.forEach((doc) => {
      subscriptionsBatch.delete(doc.ref);
    });
    await subscriptionsBatch.commit();

    // 3. Delete all notification matches
    const matchesRef = adminDb.collection("notificationMatches");
    const matchesSnapshot = await matchesRef
      .where("userId", "==", userId)
      .get();

    const matchesBatch = adminDb.batch();
    matchesSnapshot.forEach((doc) => {
      matchesBatch.delete(doc.ref);
    });
    await matchesBatch.commit();

    // 4. Delete the Firebase Auth user
    // This requires recent re-authentication on the client side (which we enforce in the UI)
    try {
      await adminAuth.deleteUser(userId);
    } catch (authError) {
      console.error("Error deleting Firebase Auth user:", authError);
      // Continue even if auth deletion fails - Firestore data is already deleted
    }

    return NextResponse.json({
      success: true,
      deleted: {
        interests: interestsSnapshot.size,
        subscriptions: subscriptionsSnapshot.size,
        matches: matchesSnapshot.size,
      },
    });
  } catch (error) {
    console.error("Error deleting user data:", error);
    return NextResponse.json(
      { error: "Failed to delete user data" },
      { status: 500 }
    );
  }
}
