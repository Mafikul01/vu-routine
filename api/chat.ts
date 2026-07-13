import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rawOpenRouterKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
    const rawGeminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    const openRouterKey = rawOpenRouterKey ? rawOpenRouterKey.trim() : undefined;
    const geminiKey = rawGeminiKey ? rawGeminiKey.trim() : undefined;

    const { model, contents, systemInstruction } = req.body;

    // Use native Gemini if we have a Gemini key and it starts with AIzaSy, or if we have a Gemini key but no OpenRouter key.
    const useNativeGemini = !!(geminiKey && (geminiKey.startsWith('AIzaSy') || !openRouterKey));

    if (useNativeGemini) {
      const apiKey = geminiKey!.replace(/\s+/g, '').replace(/^[`'"]+|[`'"]+$/g, '');
      if (!apiKey || apiKey.length < 10) {
        return res.status(401).json({ error: "Gemini API key is invalid. Please ensure GEMINI_API_KEY is configured correctly." });
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
        console.warn(`[Vercel Serverless] Primary model ${currentModel} failed. Trying fallback to gemini-2.0-flash...`, geminiError);
        currentModel = 'gemini-2.0-flash';
        response = await ai.models.generateContent({
          model: currentModel,
          contents: contents as { role: string; parts: { text: string }[] }[],
          config,
        });
      }

      const aiText = response?.text || "No response received from Gemini.";
      return res.status(200).json({ text: aiText });

    } else {
      // Use OpenRouter
      const apiKey = (openRouterKey || geminiKey)?.trim();
      if (!apiKey) {
        return res.status(401).json({ error: "API key is not configured. Please add GEMINI_API_KEY or OPENROUTER_API_KEY in your Vercel project settings." });
      }

      const targetModel = model || 'google/gemini-2.5-flash';

      // Convert Gemini format to OpenAI format
      const messages: { role: string; content: string }[] = [];
      if (systemInstruction) {
        messages.push({ role: 'system', content: systemInstruction });
      }
      if (Array.isArray(contents)) {
        for (const item of contents) {
          const text = item.parts?.[0]?.text || '';
          const role = item.role === 'model' ? 'assistant' : 'user';
          messages.push({ role, content: text });
        }
      }

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://vu-routine-app.vercel.app',
          'X-OpenRouter-Title': 'VU Routine App',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: targetModel,
          messages,
          temperature: 0.7,
          max_tokens: 1500,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("OpenRouter Serverless API error response:", errorText);
        return res.status(response.status).json({ error: `OpenRouter API error: ${response.status} - ${errorText}` });
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: {
            content?: string;
          };
        }>;
      };

      const aiText = data.choices?.[0]?.message?.content || "No response received from OpenRouter.";
      return res.status(200).json({ text: aiText });
    }

  } catch (error: unknown) {
    console.error("Serverless API Error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate content";
    res.status(500).json({ error: message });
  }
}
