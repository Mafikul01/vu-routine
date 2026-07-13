import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rawGeminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const geminiKey = rawGeminiKey ? rawGeminiKey.trim() : undefined;

    const { contents, systemInstruction } = req.body;

    const apiKey = geminiKey?.replace(/\s+/g, '').replace(/^[`'"]+|[`'"]+$/g, '');
    if (!apiKey || apiKey.length < 10) {
      console.warn("[Vercel Serverless] API key is missing or invalid");
      return res.status(500).json({ error: "Server Error: Unable to complete your request. Please try again later." });
    }

    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });

    const config: Record<string, unknown> = {
      temperature: 0.7,
    };
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    let currentModel = 'gemini-3.5-flash';
    let response;
    try {
      response = await ai.models.generateContent({
        model: currentModel,
        contents: contents as { role: string; parts: { text: string }[] }[],
        config,
      });
    } catch (geminiError) {
      console.warn(`[Vercel Serverless] Primary model ${currentModel} failed. Trying fallback to gemini-3.1-flash-lite...`, geminiError);
      currentModel = 'gemini-3.1-flash-lite';
      response = await ai.models.generateContent({
        model: currentModel,
        contents: contents as { role: string; parts: { text: string }[] }[],
        config,
      });
    }

    const aiText = response?.text || "No response received from Gemini.";
    return res.status(200).json({ text: aiText });

  } catch (error: unknown) {
    console.error("Serverless API Error:", error);
    res.status(500).json({ error: "Server Error: Unable to complete your request. Please try again later." });
  }
}
