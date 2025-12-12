import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    // Validate message
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Invalid message parameter' },
        { status: 400 }
      );
    }

    // Validate message length
    if (message.length > 5000) {
      return NextResponse.json(
        { error: 'Message is too long (max 5000 characters)' },
        { status: 400 }
      );
    }

    // Sanitize input to prevent prompt injection
    const sanitizedMessage = message.replace(/[\n\r]/g, ' ').trim();

    // Construct the prompt using the provided template
    const prompt = `You are a data extraction specialist. Your task is to extract location, time, and responsible entity information from a single official announcement message.

Output Format:
Return only a single JSON object with the following structure:
- responsible_entity: (string) The name of the person or entity making the announcement (e.g., "Example Example" or "„Топлофикация София" ЕАД").
- pins: (array of strings) All single addresses, street names with numbers, and intersections.
- streets: (array of objects) All references to a street or road section being closed/affected from one point to another.
- timespan: (array of objects) All date and time ranges mentioned.

Normalization Rules:
- Address Normalization: Add ", Sofia, Bulgaria" to all addresses, street names, and location points (including 'from' and 'to' points) if the city/country is missing.
- Intersection Normalization: Normalize any street intersections found as 'Street 1, Sofia, Bulgaria & Boulevard 22, Sofia, Bulgaria' and place them in the pins array.
- Street Section Normalization: For sections of a street closed/affected, use the streets array. Each object must contain the keys street, from, and to. The values for all three keys must be normalized addresses.
- Timespan Normalization: Format all date/time ranges as an array of objects: {"start": "DD.MM.YYYY HH:MM", "end": "DD.MM.YYYY HH:MM"}. Use "24:00" for midnight if specified, otherwise use the extracted time.

Message to Process:
${sanitizedMessage}`;

    // Make request to Gemini API
    const response = await ai.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: prompt,
    });
    const responseText = response.text || '';

    // Log the response from Gemini API
    console.log('Gemini API Response:', responseText);

    return NextResponse.json({ 
      success: true,
      response: responseText 
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing AI request:', error);
    return NextResponse.json(
      { error: 'Failed to process AI request' },
      { status: 500 }
    );
  }
}
