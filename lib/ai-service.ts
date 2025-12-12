import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY || '');

export async function extractAddresses(text: string): Promise<string[]> {
  try {
    // Sanitize input to prevent prompt injection
    const sanitizedText = text.replace(/[\n\r]/g, ' ').trim();
    if (!sanitizedText || sanitizedText.length > 5000) {
      console.error('Invalid text length for address extraction');
      return [];
    }

    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const prompt = `Extract all addresses from the following text. Focus on addresses in Sofia, Bulgaria, especially in the Oborishte district. Return only the addresses as a JSON array of strings, with no additional text or explanation. If no addresses are found, return an empty array [].

Text: ${sanitizedText}

Return format: ["address1", "address2", ...]`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseText = response.text();

    // Parse the JSON response
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const addresses = JSON.parse(jsonMatch[0]);
      return addresses.filter((addr: string) => addr && addr.trim().length > 0);
    }

    return [];
  } catch (error) {
    console.error('Error extracting addresses:', error);
    return [];
  }
}
