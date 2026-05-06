import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
      const genAIModule = await import("@google/genai");
      const GoogleGenAI = genAIModule.GoogleGenAI;
      
      if (!GoogleGenAI) {
        throw new Error("Failed to load GoogleGenAI from @google/genai module.");
      }
      
      const rawKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
      // Thorough sanitization: remove all whitespace and surrounding quotes/backticks
      const apiKey = rawKey?.replace(/\s+/g, '').replace(/^[`'"]+|[`'"]+$/g, '');
      
      if (!apiKey || apiKey.length < 20) {
        console.warn(`[Gemini Proxy] Key invalid or missing (Length: ${apiKey?.length || 0})`);
        return res.status(401).json({ 
          error: "Gemini API key is invalid or missing. Please add a valid GEMINI_API_KEY to Settings -> Environment Variables." 
        });
      }
      
      const ai = new GoogleGenAI({ apiKey });
      const { model, contents, systemInstruction } = req.body;

      const response = await ai.models.generateContent({
        model: model || 'gemini-3-flash-preview',
        contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        }
      });

      res.json({ text: response.text });
    } catch (error: unknown) {
      console.error("Gemini Proxy Error:", error);
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
