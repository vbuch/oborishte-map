import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { extractAddresses } from '@/lib/ai-service';
import { geocodeAddresses } from '@/lib/geocoding-service';
import { convertToGeoJSON } from '@/lib/geojson-service';
import { Message } from '@/lib/types';

function convertTimestamp(timestamp: any): string {
  if (timestamp?.toDate) {
    return timestamp.toDate().toISOString();
  }
  return timestamp || new Date().toISOString();
}

export async function GET() {
  try {
    const messagesRef = collection(db, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);

    const messages: Message[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      messages.push({
        id: doc.id,
        text: data.text,
        addresses: data.addresses || [],
        extractedData: data.extractedData || undefined,
        geoJson: data.geoJson || undefined,
        createdAt: convertTimestamp(data.createdAt),
      });
    });

    return NextResponse.json({ messages });
  } catch (error) {
    console.error('Error fetching messages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message text' },
        { status: 400 }
      );
    }

    // Validate text length
    if (text.length > 5000) {
      return NextResponse.json(
        { error: 'Message text is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Extract structured data using Google AI
    const extractedData = await extractAddresses(text);

    // Get all address texts from pins array for geocoding
    const addressTexts = extractedData?.pins || [];

    // Geocode the extracted addresses
    const addresses = await geocodeAddresses(addressTexts);

    // Convert to GeoJSON if we have extracted data
    let geoJson = undefined;
    if (extractedData) {
      try {
        geoJson = await convertToGeoJSON(extractedData);
      } catch (error) {
        console.error('Error converting to GeoJSON:', error);
        // Continue without GeoJSON if conversion fails
      }
    }

    // Store the message in Firestore
    const messagesRef = collection(db, 'messages');
    const docRef = await addDoc(messagesRef, {
      text,
      addresses,
      extractedData,
      geoJson,
      createdAt: Timestamp.now(),
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
    console.error('Error creating message:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}

