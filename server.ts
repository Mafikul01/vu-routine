import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { GoogleGenAI } from "@google/genai";

const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

// Simple rate-limiting map to prevent users from spamming requests too fast
const userLastRequestTimes = new Map<string, number>();

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

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        console.warn(`[Gemini Proxy] Key invalid or missing`);
        return res.status(500).json({ 
          error: "Server Error: Unable to complete your request. Please check GEMINI_API_KEY." 
        });
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const { contents, systemInstruction, model } = req.body;
      
      const response = await ai.models.generateContent({
        model: model || 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7
        }
      });
      
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Proxy Error:", error);
      res.status(500).json({ error: error?.message || "Server Error: Unable to complete your request. Please try again later." });
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
