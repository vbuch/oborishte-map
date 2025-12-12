import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { join } from 'path';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

// Read the prompt template once at module load time
let promptTemplate: string;
try {
  promptTemplate = readFileSync(
    join(process.cwd(), 'lib', 'prompts', 'data-extraction.md'),
    'utf-8'
  );
} catch (error) {
  console.error('Failed to load prompt template:', error);
  throw new Error('Prompt template file not found');
}

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

    // Construct the prompt by appending the sanitized message to the template
    const prompt = promptTemplate + sanitizedMessage;

    // Make request to Gemini API
    const response = await ai.models.generateContent({
      model: process.env.GOOGLE_AI_MODEL!,
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
