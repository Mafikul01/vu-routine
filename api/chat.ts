import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rawKey = process.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : undefined;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    const { model, contents, systemInstruction } = req.body;

    const response = await ai.models.generateContent({
      model: model || 'gemini-3-flash-preview',
      contents,
      config: {
        systemInstruction,
      }
    });

    res.status(200).json({ text: response.text });
  } catch (error: unknown) {
    console.error("Gemini Serverless Error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate content";
    res.status(500).json({ error: message });
  }
}
