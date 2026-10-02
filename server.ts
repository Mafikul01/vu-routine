import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { GoogleGenAI } from "@google/genai";
import { fullDepartmentRoutine } from "./src/data/fullDepartmentRoutine";
import { ClassEntry } from "./src/data/routineData";

const _filename = typeof __filename !== 'undefined' ? __filename : fileURLToPath(import.meta.url);
const _dirname = typeof __dirname !== 'undefined' ? __dirname : path.dirname(_filename);

// Simple rate-limiting map to prevent users from spamming requests too fast
const userLastRequestTimes = new Map<string, number>();

// Simple response cache
const responseCache = new Map<string, { text: string, timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes

async function withRetry<T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.status === 429 || error.status === 503 || error.status === 500)) {
      console.warn(`Retryable error, retrying in ${delay}ms...`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
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

  // Pre-seed in-memory full department routine cache from verified dataset
  const fullRoutineCache = {
    timestamp: Date.now(),
    entries: fullDepartmentRoutine,
    totalClasses: fullDepartmentRoutine.length,
    uniqueRooms: Array.from(new Set(fullDepartmentRoutine.map(e => e.room).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    ),
    uniqueTeachers: Array.from(new Set(fullDepartmentRoutine.flatMap(e => e.teachers).filter(Boolean))).sort()
  };

  // Endpoint: GET /api/routine/full
  app.get("/api/routine/full", (_req, res) => {
    res.json({
      success: true,
      timestamp: fullRoutineCache.timestamp,
      totalClasses: fullRoutineCache.totalClasses,
      uniqueRooms: fullRoutineCache.uniqueRooms,
      uniqueTeachers: fullRoutineCache.uniqueTeachers,
      entries: fullRoutineCache.entries
    });
  });

  // Endpoint: POST /api/routine/sync-full
  app.post("/api/routine/sync-full", async (_req, res) => {
    await syncFullDepartmentRoutineServer();
    res.json({
      success: true,
      message: "Full routine sync executed",
      timestamp: fullRoutineCache.timestamp,
      totalClasses: fullRoutineCache.totalClasses,
      uniqueRooms: fullRoutineCache.uniqueRooms.length,
      uniqueTeachers: fullRoutineCache.uniqueTeachers.length
    });
  });

  let activeUniversityCookieHeader: string = "";
  let isLoggingIn = false;
  let loginPromise: Promise<string | null> | null = null;

  async function loginUniversitySession(overrideRoll?: string, overridePass?: string): Promise<string | null> {
    const roll = overrideRoll || process.env.UNIVERSITY_ROLL || process.env.UNIVERSITY_STUDENT_ROLL || "";
    const password = overridePass || process.env.UNIVERSITY_PASSWORD || process.env.UNIVERSITY_STUDENT_PASSWORD || "";

    if (!roll || !password) {
      return activeUniversityCookieHeader || null;
    }

    if (isLoggingIn && loginPromise) {
      return loginPromise;
    }

    isLoggingIn = true;
    loginPromise = (async () => {
      try {
        console.log("[University Auth] Fetching student login page to extract CSRF token...");
        const loginPageResp = await fetch("http://160.187.25.3:8083/front/student/login", {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });

        const rawSetCookie = loginPageResp.headers.get("set-cookie") || "";
        const cookieParts = rawSetCookie.split(",").map(c => c.split(";")[0].trim()).filter(Boolean);
        const initialCookieHeader = cookieParts.join("; ");
        const html = await loginPageResp.text();

        const tokenMatch = html.match(/name="_token"\s+type="hidden"\s+value="([^"]+)"/i) ||
                           html.match(/value="([^"]+)"\s+name="_token"/i) ||
                           html.match(/<input[^>]*name=["']_token["'][^>]*value=["']([^"']+)["']/i);
        
        if (!tokenMatch) {
          console.error("[University Auth] Failed to extract CSRF _token from login page.");
          return null;
        }

        const csrfToken = tokenMatch[1];
        const params = new URLSearchParams();
        params.append("_token", csrfToken);
        params.append("roll", roll.trim());
        params.append("password", password.trim());
        params.append("pass", password.trim()); // Compatibility

        const postResp = await fetch("http://160.187.25.3:8083/front/student/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
            "Cookie": initialCookieHeader,
            "Referer": "http://160.187.25.3:8083/front/student/login",
            "Origin": "http://160.187.25.3:8083"
          },
          body: params.toString(),
          redirect: "manual"
        });

        const postCookiesRaw = postResp.headers.get("set-cookie") || "";
        const postCookieParts = postCookiesRaw.split(",").map(c => c.split(";")[0].trim()).filter(Boolean);
        
        if (postCookieParts.length > 0) {
          // Merge with initial cookies (easymate_session and XSRF-TOKEN)
          const mergedCookies = new Map<string, string>();
          [...cookieParts, ...postCookieParts].forEach(c => {
            const [k, v] = c.split("=");
            if (k && v) mergedCookies.set(k.trim(), v.trim());
          });

          activeUniversityCookieHeader = Array.from(mergedCookies.entries())
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");

          console.log("[University Auth] Successfully logged in and captured session cookies.");
          return activeUniversityCookieHeader;
        }

        return activeUniversityCookieHeader || null;
      } catch (err) {
        console.error("[University Auth] Error during login flow:", err);
        return null;
      } finally {
        isLoggingIn = false;
        loginPromise = null;
      }
    })();

    return loginPromise;
  }

  // University Routine Proxy Endpoint
  app.get("/api/routine", async (req, res) => {
    try {
      const semesterId = String(req.query.semester_id || "7").trim();
      const sectionId = String(req.query.section_id || "1").trim();

      const fetchRoutineHtml = async (cookies: string) => {
        const targetUrl = `http://160.187.25.3:8083/front/student/routine/load?semester_id=${encodeURIComponent(semesterId)}&section_id=${encodeURIComponent(sectionId)}`;
        const headers: Record<string, string> = {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
          "Accept": "text/html, */*; q=0.01",
          "X-Requested-With": "XMLHttpRequest",
          "Referer": "http://160.187.25.3:8083/front/student/routine"
        };
        if (cookies) {
          headers["Cookie"] = cookies.includes("=") ? cookies : `easymate_session=${cookies}`;
        }
        const resp = await fetch(targetUrl, { headers, redirect: "manual" });
        return resp;
      };

      let cookies = (req.headers["x-university-cookie"] as string) || activeUniversityCookieHeader;
      if (!cookies) {
        cookies = (await loginUniversitySession()) || "";
      }

      let response = await fetchRoutineHtml(cookies);
      let isAuthRequired = response.status === 302 || response.status === 301;
      let html = "";

      if (!isAuthRequired) {
        html = await response.text();
        if (html.includes("/front/student/login") || html.includes("<title>Redirecting to http://160.187.25.3:8083/front/student/login</title>")) {
          isAuthRequired = true;
        }
      }

      // Auto-relogin retry if session expired
      const hasCredentials = !!(process.env.UNIVERSITY_ROLL || process.env.UNIVERSITY_STUDENT_ROLL);
      if (isAuthRequired && hasCredentials) {
        console.log("[University Routine Proxy] Session expired. Performing automatic re-login retry...");
        const freshCookies = await loginUniversitySession();
        if (freshCookies) {
          cookies = freshCookies;
          response = await fetchRoutineHtml(cookies);
          if (response.status !== 302 && response.status !== 301) {
            html = await response.text();
            if (!html.includes("/front/student/login")) {
              isAuthRequired = false;
            }
          }
        }
      }

      if (html && !isAuthRequired) {
        console.log(`[University Routine Proxy] Routine HTML received (length=${html.length}) for Sem ${semesterId} Sec ${sectionId}`);
        const tableRows = html.match(/<tr[\s\S]*?<\/tr>/gi);
        if (tableRows && tableRows.length > 0) {
          console.log(`[University Routine Proxy] Total <tr> rows: ${tableRows.length}. First data row structure:`, tableRows.slice(1, 2).map(r => r.replace(/\s+/g, ' ').substring(0, 350)));
        }
        const sampleCards = html.match(/<div[^>]*class=["'][^"']*event-card[^"']*["'][\s\S]*?<\/div>/gi);
        if (sampleCards && sampleCards.length > 0) {
          console.log(`[University Routine Proxy] Sample event-card HTML:`, sampleCards[0].replace(/\s+/g, ' ').substring(0, 350));
        }
      }

      if (isAuthRequired) {
        return res.status(401).json({
          error: "AUTH_REQUIRED",
          message: "University session expired or login required"
        });
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(html);
    } catch (error: unknown) {
      console.error("University Routine Proxy Error:", error);
      res.status(502).json({
        error: "PROXY_ERROR",
        message: "Failed to connect to University endpoint",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Portal session update endpoint
  app.post("/api/routine/session", (req, res) => {
    const { session } = req.body || {};
    if (typeof session === "string" && session.trim()) {
      activeUniversityCookieHeader = session.trim().includes("=") ? session.trim() : `easymate_session=${session.trim()}`;
      return res.json({ success: true, message: "Session updated" });
    }
    return res.status(400).json({ error: "Invalid session string" });
  });

  // Automated University Login Proxy
  app.post("/api/routine/login", async (req, res) => {
    try {
      const { roll, pass, password } = req.body || {};
      const userPass = password || pass;
      if (!roll || !userPass) {
        return res.status(400).json({ error: "Roll/Student ID and Password are required" });
      }

      const session = await loginUniversitySession(String(roll), String(userPass));
      if (session) {
        return res.json({
          success: true,
          message: "Login successful",
          session
        });
      }
      return res.status(401).json({
        error: "LOGIN_FAILED",
        message: "Invalid credentials or login rejected by University portal"
      });
    } catch (error: unknown) {
      console.error("Login API Error:", error);
      res.status(500).json({
        error: "LOGIN_ERROR",
        message: error instanceof Error ? error.message : "Failed to process login"
      });
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
      
      // Cache key
      const cacheKey = JSON.stringify(contents) + JSON.stringify(systemInstruction);
      if (responseCache.has(cacheKey)) {
        const cached = responseCache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) {
          return res.json({ text: cached.text });
        }
      }
      
      const response = await withRetry(() => ai.models.generateContent({
        model: model || 'gemini-2.5-flash',
        contents: contents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7
        }
      }));
      
      responseCache.set(cacheKey, { text: response.text, timestamp: Date.now() });
      res.json({ text: response.text });
    } catch (error: any) {
      console.error("Gemini API Proxy Error:", error);
      let status = 500;
      let message = "Server Error: Unable to complete your request. Please try again later.";
      
      if (error.status === 429) {
        status = 429;
        message = "Rate limit exceeded. Please wait a moment.";
      } else if (error.status === 401 || error.status === 403) {
        status = 500; // Keep internal
        message = "Configuration error. Please contact support.";
      }
      
      res.status(status).json({ error: message });
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
