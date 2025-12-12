import { NextRequest, NextResponse } from 'next/server';
import { collection, addDoc, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { extractAddresses } from '@/lib/ai-service';
import { geocodeAddresses } from '@/lib/geocoding-service';
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

    // Extract addresses using Google AI
    const addressTexts = await extractAddresses(text);

    // Geocode the extracted addresses
    const addresses = await geocodeAddresses(addressTexts);

    // Store the message in Firestore
    const messagesRef = collection(db, 'messages');
    const docRef = await addDoc(messagesRef, {
      text,
      addresses,
      createdAt: Timestamp.now(),
    });

    const newMessage: Message = {
      id: docRef.id,
      text,
      addresses,
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

