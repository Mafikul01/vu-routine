import { ClassEntry } from "@/data/routineData";
import { parseUniversityRoutineHtml, sectionToId, getStoredSectionRoutine, saveStoredSectionRoutine, getSectionCacheKey } from "@/lib/parser";

export interface RoutineFetchResult {
  success: boolean;
  data: ClassEntry[];
  fromCache?: boolean;
  timestamp?: number;
  error?: string;
  errorType?: "AUTH_REQUIRED" | "NETWORK_ERROR" | "PARSE_ERROR" | "SERVER_ERROR";
}

export interface UniversityLoginResponse {
  success: boolean;
  message?: string;
  session?: string;
  error?: string;
}

/**
 * Robust API Service for Real-time University Routine Fetching & Caching
 */
export class RoutineApiService {
  private static readonly API_BASE = "/api/routine";
  private static readonly CACHE_PREFIX = "routine-cache-sem-";

  /**
   * Fetches real-time routine from the University Student Panel endpoint.
   * Handles session headers, timeout, error fallback to cache, and automatic data caching.
   */
  public static async fetchSectionRoutine(
    semester: number,
    section: string,
    sessionCookie?: string
  ): Promise<RoutineFetchResult> {
    const secId = sectionToId(section);
    const storedSession = sessionCookie || localStorage.getItem("easymate-session") || "";

    const headers: Record<string, string> = {
      "Accept": "text/html, application/json, */*",
      "X-Requested-With": "XMLHttpRequest"
    };

    if (storedSession) {
      headers["x-university-cookie"] = storedSession;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second timeout

      const url = `${this.API_BASE}?semester_id=${encodeURIComponent(semester)}&section_id=${encodeURIComponent(secId)}`;
      const response = await fetch(url, {
        headers,
        signal: controller.signal,
        cache: "no-store"
      });

      clearTimeout(timeoutId);

      // Handle Authentication Required (Session expired or login redirect)
      if (response.status === 401) {
        console.warn(`[RoutineApiService] Authentication required for Semester ${semester} Section ${section}`);
        const cached = getStoredSectionRoutine(semester, section);
        return {
          success: false,
          data: cached || [],
          fromCache: !!cached,
          error: "University session expired or login required. Please update session cookie in Settings.",
          errorType: "AUTH_REQUIRED"
        };
      }

      if (!response.ok) {
        throw new Error(`University endpoint returned HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      let html = "";

      if (contentType.includes("application/json")) {
        const json = await response.json();
        if (json.error === "AUTH_REQUIRED") {
          const cached = getStoredSectionRoutine(semester, section);
          return {
            success: false,
            data: cached || [],
            fromCache: !!cached,
            error: json.message || "University login required",
            errorType: "AUTH_REQUIRED"
          };
        }
        html = json.html || json.data || "";
      } else {
        html = await response.text();
      }

      // Check for redirect HTML inside response
      if (html.includes("/front/student/login") || html.includes("<title>Redirecting to http://160.187.25.3:8083/front/student/login</title>")) {
        const cached = getStoredSectionRoutine(semester, section);
        return {
          success: false,
          data: cached || [],
          fromCache: !!cached,
          error: "University portal session expired. Please paste a fresh session cookie in Settings.",
          errorType: "AUTH_REQUIRED"
        };
      }

      // Parse the live HTML table with verified parser
      const parsedEntries = parseUniversityRoutineHtml(html, semester, section);

      if (parsedEntries && parsedEntries.length > 0) {
        // Cache the fresh verified data locally
        saveStoredSectionRoutine(semester, section, parsedEntries);
        return {
          success: true,
          data: parsedEntries,
          fromCache: false,
          timestamp: Date.now()
        };
      }

      // If parsing resulted in 0 items (e.g. empty schedule or invalid structure), check cache
      const cached = getStoredSectionRoutine(semester, section);
      return {
        success: parsedEntries.length > 0,
        data: cached || parsedEntries,
        fromCache: !!cached,
        error: parsedEntries.length === 0 ? "No classes found for this semester & section in live routine." : undefined
      };

    } catch (err: unknown) {
      console.error(`[RoutineApiService] Error fetching Sem ${semester} Sec ${section}:`, err);
      const cached = getStoredSectionRoutine(semester, section);
      
      const isAbort = err instanceof Error && err.name === "AbortError";
      return {
        success: false,
        data: cached || [],
        fromCache: !!cached,
        error: isAbort ? "Request timed out while connecting to University server." : (err instanceof Error ? err.message : "Network error"),
        errorType: "NETWORK_ERROR"
      };
    }
  }

  /**
   * Updates session cookie on backend proxy and local storage
   */
  public static async saveSessionCookie(session: string): Promise<boolean> {
    const cleanSession = session.trim();
    localStorage.setItem("easymate-session", cleanSession);

    try {
      const response = await fetch("/api/routine/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session: cleanSession })
      });
      return response.ok;
    } catch (e) {
      console.error("[RoutineApiService] Failed to update backend session cookie:", e);
      return false;
    }
  }

  /**
   * Gets cached routine for a semester and section
   */
  public static getCachedSectionRoutine(semester: number, section: string): ClassEntry[] | null {
    return getStoredSectionRoutine(semester, section);
  }

  /**
   * Clears routine cache for a specific semester/section or all cached routines
   */
  public static clearCache(semester?: number, section?: string): void {
    if (semester !== undefined && section !== undefined) {
      const key = getSectionCacheKey(semester, section);
      localStorage.removeItem(key);
    } else {
      // Clear all routine cache keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(this.CACHE_PREFIX)) {
          localStorage.removeItem(key);
        }
      }
    }
  }
}

export default RoutineApiService;
