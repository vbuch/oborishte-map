import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { extractAddresses } from "@/lib/ai-service";
import { geocodeAddresses } from "@/lib/geocoding-service";
import { convertToGeoJSON } from "@/lib/geojson-service";
import { Message } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";

function convertTimestamp(timestamp: any): string {
  // Handle Firestore Timestamp from Admin SDK
  if (timestamp?._seconds) {
    return new Date(timestamp._seconds * 1000).toISOString();
  }
  // Handle Firestore Timestamp from client SDK
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  return timestamp || new Date().toISOString();
}

export async function GET() {
  try {
    // Use Admin SDK for reading messages
    const messagesRef = adminDb.collection("messages");
    const snapshot = await messagesRef.orderBy("createdAt", "desc").get();

    const messages: Message[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        text: data.text,
        addresses: data.addresses ? JSON.parse(data.addresses) : [],
        extractedData: data.extractedData
          ? JSON.parse(data.extractedData)
          : undefined,
        geoJson: data.geoJson ? JSON.parse(data.geoJson) : undefined,
        createdAt: convertTimestamp(data.createdAt),
      });
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

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Unauthorized - Missing auth token" },
        { status: 401 }
      );
    }

    const token = authHeader.split("Bearer ")[1];
    let decodedToken;

    try {
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (error) {
      console.error("Error verifying auth token:", error);
      return NextResponse.json(
        { error: "Unauthorized - Invalid auth token" },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;
    const userEmail = decodedToken.email || null;

    const { text } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json(
        { error: "Invalid message text" },
        { status: 400 }
      );
    }

    // Validate text length
    if (text.length > 5000) {
      return NextResponse.json(
        { error: "Message text is too long (max 5000 characters)" },
        { status: 400 }
      );
    }

    // Extract structured data using Google AI
    const extractedData = await extractAddresses(text);

    // Get all address texts from pins array for geocoding
    const addressTexts = extractedData?.pins || [];

    // Geocode the extracted addresses
    const addresses = await geocodeAddresses(addressTexts);
    console.log("Geocoded addresses:", addresses);

    // Convert to GeoJSON if we have extracted data
    // Pass the geocoded addresses to avoid duplicate geocoding
    let geoJson = undefined;
    if (extractedData) {
      try {
        // Create a map of original text to coordinates for efficient lookup
        const geocodedMap = new Map(
          addresses.map((addr) => [
            addr.originalText,
            { lat: addr.coordinates.lat, lng: addr.coordinates.lng },
          ])
        );
        geoJson = await convertToGeoJSON(extractedData, geocodedMap);
        console.log("Generated GeoJSON:", geoJson);
      } catch (error) {
        console.error("Error converting to GeoJSON:", error);
        // Continue without GeoJSON if conversion fails
      }
    }

    // Store the message in Firestore using Admin SDK
    // Convert complex objects to strings to avoid Firestore nested entity issues
    const messagesRef = adminDb.collection("messages");
    const docRef = await messagesRef.add({
      text,
      addresses: addresses.length > 0 ? JSON.stringify(addresses) : null,
      extractedData: extractedData ? JSON.stringify(extractedData) : null,
      geoJson: geoJson ? JSON.stringify(geoJson) : null,
      userId,
      userEmail,
      createdAt: FieldValue.serverTimestamp(),
    });

    const newMessage: Message = {
      id: docRef.id,
      text,
      addresses,
      extractedData: extractedData || undefined,
      geoJson: geoJson || undefined,
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json({ message: newMessage }, { status: 201 });
  } catch (error) {
    console.error("Error creating message:", error);
    return NextResponse.json(
      { error: "Failed to create message" },
      { status: 500 }
    );
  }
}
