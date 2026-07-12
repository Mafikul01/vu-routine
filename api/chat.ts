import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rawKey = process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    const apiKey = rawKey ? rawKey.trim() : undefined;
    if (!apiKey) {
      return res.status(401).json({ error: "OpenRouter API key is not configured on the server. Please add OPENROUTER_API_KEY to your environment variables." });
    }
    
    const { model, contents, systemInstruction } = req.body;
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
    res.status(200).json({ text: aiText });
  } catch (error: unknown) {
    console.error("OpenRouter Serverless Error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate content";
    res.status(500).json({ error: message });
  }
}
