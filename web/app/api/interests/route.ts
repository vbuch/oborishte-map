import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { Interest } from "@/lib/types";
import { verifyAuthToken } from "@/lib/verifyAuthToken";
import { convertTimestamp } from "@/lib/firestore-utils";

// Constants
const MIN_RADIUS = 100; // meters
const MAX_RADIUS = 1000; // meters
const DEFAULT_RADIUS = 500; // meters

// Helper to validate radius
function validateRadius(radius: number): number {
  if (typeof radius !== "number" || Number.isNaN(radius)) {
    return DEFAULT_RADIUS;
  }
  return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, radius));
}

// GET - Fetch all interests for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const interestsRef = adminDb.collection("interests");

    // Query without orderBy initially to avoid index requirement
    // Firestore will prompt to create index on first run with orderBy
    let snapshot;
    try {
      snapshot = await interestsRef
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();
    } catch (indexError) {
      // If index doesn't exist, fall back to query without orderBy
      snapshot = await interestsRef.where("userId", "==", userId).get();
    }

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

    // Sort in JavaScript if we couldn't sort in query
    interests.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA; // descending
    });

    return NextResponse.json({ interests });
  } catch (error) {
    console.error("[GET /api/interests] Error:", error);

    if (
      error instanceof Error &&
      (error.message === "Missing auth token" ||
        error.message === "Invalid auth token")
    ) {
      return NextResponse.json(
        { error: `Unauthorized - ${error.message}` },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch interests" },
      { status: 500 }
    );
  }
}

// POST - Create a new interest
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const body = await request.json();
    const { coordinates, radius } = body;

    // Validate coordinates
    if (
      !coordinates ||
      typeof coordinates.lat !== "number" ||
      typeof coordinates.lng !== "number"
    ) {
      return NextResponse.json(
        { error: "Invalid coordinates" },
        { status: 400 }
      );
    }

    // Validate and sanitize radius
    const validatedRadius = validateRadius(radius);

    const now = new Date();
    const interestData = {
      userId,
      coordinates: {
        lat: coordinates.lat,
        lng: coordinates.lng,
      },
      radius: validatedRadius,
      createdAt: now,
      updatedAt: now,
    };

    const interestsRef = adminDb.collection("interests");
    const docRef = await interestsRef.add(interestData);

    const newInterest: Interest = {
      id: docRef.id,
      ...interestData,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return NextResponse.json({ interest: newInterest }, { status: 201 });
  } catch (error) {
    console.error("Error creating interest:", error);

    if (
      error instanceof Error &&
      (error.message === "Missing auth token" ||
        error.message === "Invalid auth token")
    ) {
      return NextResponse.json(
        { error: `Unauthorized - ${error.message}` },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create interest" },
      { status: 500 }
    );
  }
}

// DELETE - Delete an interest by ID
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const { searchParams } = new URL(request.url);
    const interestId = searchParams.get("id");

    if (!interestId) {
      return NextResponse.json(
        { error: "Interest ID is required" },
        { status: 400 }
      );
    }

    const interestRef = adminDb.collection("interests").doc(interestId);
    const doc = await interestRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Interest not found" },
        { status: 404 }
      );
    }

    const data = doc.data();
    if (data?.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized - You can only delete your own interests" },
        { status: 403 }
      );
    }

    await interestRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting interest:", error);

    if (
      error instanceof Error &&
      (error.message === "Missing auth token" ||
        error.message === "Invalid auth token")
    ) {
      return NextResponse.json(
        { error: `Unauthorized - ${error.message}` },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to delete interest" },
      { status: 500 }
    );
  }
}

// PATCH - Update an interest (move or change radius)
export async function PATCH(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const { userId } = await verifyAuthToken(authHeader);

    const body = await request.json();
    const { id, coordinates, radius } = body;

    if (!id) {
      return NextResponse.json(
        { error: "Interest ID is required" },
        { status: 400 }
      );
    }

    const interestRef = adminDb.collection("interests").doc(id);
    const doc = await interestRef.get();

    if (!doc.exists) {
      return NextResponse.json(
        { error: "Interest not found" },
        { status: 404 }
      );
    }

    const data = doc.data();
    if (data?.userId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized - You can only update your own interests" },
        { status: 403 }
      );
    }

    const updates: any = {
      updatedAt: new Date(),
    };

    // Update coordinates if provided
    if (coordinates) {
      if (
        typeof coordinates.lat !== "number" ||
        typeof coordinates.lng !== "number"
      ) {
        return NextResponse.json(
          { error: "Invalid coordinates" },
          { status: 400 }
        );
      }
      updates.coordinates = {
        lat: coordinates.lat,
        lng: coordinates.lng,
      };
    }

    // Update radius if provided
    if (radius !== undefined) {
      updates.radius = validateRadius(radius);
    }

    await interestRef.update(updates);

    // Fetch updated document
    const updatedDoc = await interestRef.get();
    const updatedData = updatedDoc.data();

    const updatedInterest: Interest = {
      id: updatedDoc.id,
      userId: updatedData!.userId,
      coordinates: updatedData!.coordinates,
      radius: updatedData!.radius,
      createdAt: convertTimestamp(updatedData!.createdAt),
      updatedAt: convertTimestamp(updatedData!.updatedAt),
    };

    return NextResponse.json({ interest: updatedInterest });
  } catch (error) {
    console.error("Error updating interest:", error);

    if (
      error instanceof Error &&
      (error.message === "Missing auth token" ||
        error.message === "Invalid auth token")
    ) {
      return NextResponse.json(
        { error: `Unauthorized - ${error.message}` },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update interest" },
      { status: 500 }
    );
  }
}
