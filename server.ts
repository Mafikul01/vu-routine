import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { GoogleGenAI } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple rate-limiting map to prevent users from spamming requests too fast
const userLastRequestTimes = new Map<string, number>();

interface GeminiResponse {
  text?: string;
}

/**
 * Robust helper to query Gemini API with exponential backoff and jitter
 * if we run into 429 rate limit errors, quota limits, or 503 service unavailable errors.
 * If the preferred model fails completely, it will try falling back to the highly stable gemini-2.5-flash.
 */
async function generateContentWithRetry(
  ai: GoogleGenAI, 
  model: string, 
  contents: unknown, 
  config: Record<string, unknown>, 
  maxRetries = 3, 
  initialDelay = 1500
): Promise<GeminiResponse> {
  let currentModel = model;
  const delay = initialDelay;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await ai.models.generateContent({
        model: currentModel,
        contents: contents as { role: string; parts: { text: string }[] }[],
        config: config as Record<string, unknown>,
      });
    } catch (error: unknown) {
      console.error(`[Gemini API Attempt ${attempt}/${maxRetries} with ${currentModel} Failed]:`, error);
      
      const errStr = String(error).toLowerCase();
      const errObj = error as { status?: number; statusCode?: number };
      const status = errObj?.status || errObj?.statusCode;
      
      const isRateLimit = errStr.includes("429") || 
                          errStr.includes("resource_exhausted") || 
                          errStr.includes("quota") || 
                          errStr.includes("rate limit") || 
                          errStr.includes("limit") ||
                          status === 429;

      const isUnavailable = errStr.includes("503") ||
                            errStr.includes("unavailable") ||
                            errStr.includes("service unavailable") ||
                            errStr.includes("demand") ||
                            status === 503;
                          
      if ((isRateLimit || isUnavailable) && attempt < maxRetries) {
        // Exponential backoff with random jitter
        const backoffTime = delay * Math.pow(2, attempt - 1) * (0.8 + Math.random() * 0.4);
        console.warn(`[Gemini API] Retryable error hit (${isRateLimit ? 'Rate Limit' : 'Unavailable'}). Retrying in ${Math.round(backoffTime)}ms...`);
        await new Promise((resolve) => setTimeout(resolve, backoffTime));
        continue;
      }

      // If we failed with gemini-3.5-flash and have a fallback available, try gemini-2.0-flash
      if (currentModel === "gemini-3.5-flash") {
        console.warn(`[Gemini API] Primary model ${currentModel} failed. Falling back to stable gemini-2.0-flash...`);
        currentModel = "gemini-2.0-flash";
        // Reset attempts and try with fallback model
        return await ai.models.generateContent({
          model: currentModel,
          contents: contents as { role: string; parts: { text: string }[] }[],
          config: config as Record<string, unknown>,
        });
      }

      throw error;
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API to discover tabs from a Google Sheet URL
  app.get("/api/discover-tabs", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL is required" });
      }

      const sheetIdMatch = url.match(/[-\w]{25,}/);
      if (!sheetIdMatch) {
        return res.status(400).json({ error: "Invalid Google Sheet URL" });
      }
      const sheetId = sheetIdMatch[0];

      // Fetch the main edit page to get GIDs
      const response = await fetch(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
      const html = await response.text();

      // Extract tab names and GIDs from the JS metadata in the HTML
      const tabs: string[] = [];
      const tabDataRegex = /\{"name":"([^"]+)","sheetId":(\d+)\}/g;
      
      let match;
      while ((match = tabDataRegex.exec(html)) !== null) {
        tabs.push(match[1]);
      }

      const uniqueTabs = [...new Set(tabs)];
      
      res.json({ tabs: uniqueTabs });
    } catch (error) {
      console.error("Discovery API Error:", error);
      res.status(500).json({ error: "Failed to discover tabs" });
    }
  });

  // Proxy to fetch CSV bypassing CORS
  app.get("/api/proxy-csv", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).send("URL required");
      }
      const response = await fetch(url);
      const text = await response.text();
      res.send(text);
    } catch (error) {
      res.status(500).send("Proxy error");
    }
  });

  // Gemini Chat Proxy
  app.post("/api/chat", async (req, res) => {
    try {
      // Simple IP rate limiter to protect the endpoint from rapid spamming
      const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
      const now = Date.now();
      const lastRequest = userLastRequestTimes.get(String(ip)) || 0;
      if (now - lastRequest < 800) { // Cooldown of 800ms between requests from the same IP
        return res.status(429).json({ 
          error: "You are asking questions a bit too fast. Please wait a moment before sending another message." 
        });
      }
      userLastRequestTimes.set(String(ip), now);

      const rawKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.OPENROUTER_API_KEY || process.env.VITE_OPENROUTER_API_KEY;
      // Thorough sanitization: remove all whitespace and surrounding quotes/backticks
      const apiKey = rawKey?.replace(/\s+/g, '').replace(/^[`'"]+|[`'"]+$/g, '');
      
      if (!apiKey || apiKey.length < 10) {
        console.warn(`[Gemini Proxy] Key invalid or missing`);
        return res.status(401).json({ 
          error: "Gemini API key is invalid or missing. Please add a valid GEMINI_API_KEY in the Environment Settings (Vercel or AI Studio Settings)." 
        });
      }

      const { contents, systemInstruction } = req.body;

      // Initialize the Gemini client as guided
      const ai = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      // Configure prompt and system instructions
      const config: Record<string, unknown> = {
        temperature: 0.7,
      };
      if (systemInstruction) {
        config.systemInstruction = systemInstruction;
      }

      // Query Gemini API with the retry helper to gracefully handle limits / 429 errors
      const response = await generateContentWithRetry(
        ai,
        "gemini-3.5-flash", // Native recommended Gemini 3.5 model
        contents,
        config
      );

      const aiText = response?.text || "Sorry, I could not generate a response. Please try again.";
      res.json({ text: aiText });
    } catch (error: unknown) {
      console.error("Gemini API Proxy Error:", error);
      const message = error instanceof Error ? error.message : "Failed to generate content";
      res.status(500).json({ error: message });
    }
  });

  // Vite middleware setup
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
