import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI } from '@google/genai';

// In-memory response cache
// Persists during the lifetime of a specific serverless function instance execution context.
const responseCache = new Map<string, { text: string; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Wait function for backoff
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function generateWithRetry(ai: GoogleGenAI, currentModel: string, contents: any, config: any, retries: number = 3) {
  let attempt = 0;
  let delay = 1000;

  while (attempt <= retries) {
    try {
      const startTime = Date.now();
      const response = await ai.models.generateContent({
        model: currentModel,
        contents,
        config,
      });
      const duration = Date.now() - startTime;
      
      console.log(`[Vercel Serverless] Success | Model: ${currentModel} | Attempt: ${attempt + 1} | Response Time: ${duration}ms`);
      return response;
    } catch (error: any) {
      const isRetryable = error?.status === 429 || error?.status === 500 || error?.status === 503 || error?.message?.includes('RESOURCE_EXHAUSTED');
      
      if (isRetryable && attempt < retries) {
        attempt++;
        console.warn(`[Vercel Serverless] Retryable error | Model: ${currentModel} | Attempt: ${attempt} | HTTP Status: ${error?.status} | Error: ${error?.message} | Retrying in ${delay}ms...`);
        await sleep(delay);
        delay *= 2; // Exponential backoff
      } else {
        throw error;
      }
    }
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const rawGeminiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    const apiKey = rawGeminiKey?.trim().replace(/^[`'"]+|[`'"]+$/g, '');

    if (!apiKey || apiKey.length < 10) {
      console.warn("[Vercel Serverless] Error: API key is missing or invalid.");
      return res.status(500).json({ error: "Server Configuration Error: Invalid or missing API Key." });
    }

    const { contents, systemInstruction } = req.body;

    if (!contents || !Array.isArray(contents)) {
      return res.status(400).json({ error: "Invalid request format: 'contents' must be an array." });
    }

    // Cache Key Generation
    const cacheKey = JSON.stringify({ contents, systemInstruction });
    if (responseCache.has(cacheKey)) {
      const cached = responseCache.get(cacheKey)!;
      if (Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`[Vercel Serverless] Cache Hit | Serving response from memory.`);
        return res.status(200).json({ text: cached.text });
      } else {
        responseCache.delete(cacheKey);
      }
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

    let response;
    let currentModel = 'gemini-3.5-flash';
    
    try {
      response = await generateWithRetry(ai, currentModel, contents, config, 3);
    } catch (primaryError: any) {
      const isRetryable = primaryError?.status === 429 || primaryError?.status === 500 || primaryError?.status === 503 || primaryError?.message?.includes('RESOURCE_EXHAUSTED');
      console.warn(`[Vercel Serverless] Primary model ${currentModel} failed permanently with: ${primaryError?.message}. Is retryable error type: ${isRetryable}`);

      if (isRetryable) {
         currentModel = 'gemini-3.1-flash-lite';
         console.log(`[Vercel Serverless] Attempting fallback to model: ${currentModel}`);
         response = await generateWithRetry(ai, currentModel, contents, config, 2);
      } else {
        throw primaryError; // Re-throw non-retryable errors
      }
    }

    const aiText = response?.text || "No response received from Gemini.";
    
    // Save to cache
    responseCache.set(cacheKey, { text: aiText, timestamp: Date.now() });

    // Try logging token usage if available
    try {
       const metadata = response?.usageMetadata;
       if (metadata) {
          console.log(`[Vercel Serverless] Token Usage | Prompt Tokens: ${metadata.promptTokenCount} | Response Tokens: ${metadata.candidatesTokenCount}`);
       }
    } catch (e) {
      // Ignore missing token metadata
    }

    return res.status(200).json({ text: aiText });

  } catch (error: any) {
    console.error(`[Vercel Serverless] Final Error | HTTP Status: ${error?.status || 'Unknown'} | Error:`, error);
    
    let status = 500;
    let message = "Server Error: Unable to complete your request. Please try again later.";

    if (error?.status === 429 || error?.message?.includes('RESOURCE_EXHAUSTED')) {
      status = 429;
      message = "Quota Exceeded or Rate Limit Reached: The AI service is currently experiencing high demand. Please try again in a few minutes.";
    } else if (error?.status === 400) {
      status = 400;
      message = "Invalid Request: The AI service rejected the prompt format or content.";
    } else if (error?.status === 401 || error?.status === 403) {
      status = 500; // Do not leak auth issues to client
      message = "Configuration Error: Invalid API key setup. Please contact the administrator.";
    } else if (error?.message?.includes('fetch failed') || error?.message?.includes('network')) {
       status = 502;
       message = "Network Error: Could not connect to the AI service. Please try again.";
    }

    return res.status(status).json({ error: message });
  }
}
