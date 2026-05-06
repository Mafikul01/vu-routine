import { GoogleGenAI } from '@google/genai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Gemini API key is not configured on the server." });
    }
    
    const ai = new GoogleGenAI({ apiKey });
    const { model, contents, systemInstruction } = req.body;

    const response = await ai.models.generateContent({
      model: model || 'gemini-1.5-flash',
      contents,
      config: {
        systemInstruction,
      }
    });

    res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error("Gemini Serverless Error:", error);
    res.status(500).json({ error: error.message || "Failed to generate content" });
  }
}
