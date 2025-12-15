import { NextRequest, NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";
import { extractAddresses } from "@/lib/ai-service";
import {
  geocodeAddresses,
  geocodeIntersectionsForStreets,
} from "@/lib/geocoding-router";
import { convertToGeoJSON } from "@/lib/geojson-service";
import { Message } from "@/lib/types";
import { FieldValue } from "firebase-admin/firestore";
import { GEOCODING_ALGO } from "@/lib/config";

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

    // Step 1: Extract structured data using Google AI (pins and street sections)
    const extractedData = await extractAddresses(text);

    // Step 2: Geocode based on the configured algorithm
    let addresses;
    let preGeocodedMap = new Map<string, { lat: number; lng: number }>();

    if (
      GEOCODING_ALGO === "google_directions" ||
      GEOCODING_ALGO === "overpass"
    ) {
      // Directions/Overpass-based approach: handle pins and streets separately
      addresses = [];

      // Geocode pins (simple addresses)
      if (extractedData?.pins) {
        for (const pin of extractedData.pins) {
          const geocoded = await geocodeAddresses([pin.address]);
          addresses.push(...geocoded);
          // Add to map
          geocoded.forEach((addr) => {
            preGeocodedMap.set(addr.originalText, addr.coordinates);
          });
        }
      }

      // Geocode street intersections for the geojson service
      if (extractedData?.streets) {
        const streetGeocodedMap = await geocodeIntersectionsForStreets(
          extractedData.streets
        );
        // Merge into preGeocodedMap
        streetGeocodedMap.forEach((coords, key) => {
          preGeocodedMap.set(key, coords);
        });
      }
    } else {
      // Traditional approach: collect all addresses and geocode
      const addressesToGeocode = new Set<string>();

      if (extractedData) {
        // Add pin addresses
        extractedData.pins.forEach((pin) => {
          addressesToGeocode.add(pin.address);
        });

        // Add street endpoint addresses (from and to)
        extractedData.streets.forEach((street) => {
          addressesToGeocode.add(street.from);
          addressesToGeocode.add(street.to);
        });
      }

      console.log(
        `Collected ${addressesToGeocode.size} unique addresses to geocode`
      );

      // Geocode all addresses in one batch
      addresses = await geocodeAddresses(Array.from(addressesToGeocode));
      console.log(
        `Successfully geocoded ${addresses.length}/${addressesToGeocode.size} addresses`
      );

      // Build map
      addresses.forEach((addr) => {
        preGeocodedMap.set(addr.originalText, addr.coordinates);
      });
    }

    // Step 3: Convert to GeoJSON using pre-geocoded addresses
    let geoJson = undefined;
    if (extractedData) {
      try {
        geoJson = await convertToGeoJSON(extractedData, preGeocodedMap);
        console.log(
          `Generated GeoJSON with ${geoJson.features.length} features`
        );
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
