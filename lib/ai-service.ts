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

export async function extractAddresses(text: string): Promise<string[]> {
  try {
    // Validate message
    if (!text || typeof text !== 'string') {
      console.error('Invalid text parameter for address extraction');
      return [];
    }

    // Validate message length
    if (text.length > 5000) {
      console.error('Text is too long for address extraction (max 5000 characters)');
      return [];
    }

    // Sanitize input to prevent prompt injection
    const sanitizedText = text.replace(/[\n\r]/g, ' ').trim();

    // Construct the prompt by appending the sanitized message to the template
    const prompt = promptTemplate + sanitizedText;

    // Make request to Gemini API
    const response = await ai.models.generateContent({
      model: process.env.GOOGLE_AI_MODEL!,
      contents: prompt,
    });
    const responseText = response.text || '';

    // Log the response from Gemini API after address extraction
    console.log('Address extraction completed. AI Response:', responseText);

    // Parse the JSON response to extract pins array
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsedResponse = JSON.parse(jsonMatch[0]);
      // Extract pins array from the structured response
      const pins = parsedResponse.pins || [];
      return pins.filter((addr: string) => addr && addr.trim().length > 0);
    }

    return [];
  } catch (error) {
    console.error('Error extracting addresses:', error);
    return [];
  }
}
