import { ClassEntry } from "@/data/routineData";
import { fullDepartmentRoutine } from "@/data/fullDepartmentRoutine";
import {
  parseUniversityRoutineHtml,
  sectionToId,
  idToSection,
  getSectionCacheKey,
  getStoredSectionRoutine
} from "@/lib/parser";

export interface RoutineCacheMetadata {
  semesterId: number;
  sectionId: number;
  sectionName: string;
  data: ClassEntry[];
  fetchedAt: number;
  lastSuccessfulFetch: number;
  source: "university_endpoint";
  hash: string;
  expiresAt: number;
}

export interface FetchRoutineOptions {
  forceFresh?: boolean;
  signal?: AbortSignal;
  sessionCookie?: string;
  isBackground?: boolean;
}

export interface RoutineRepositoryResult {
  data: ClassEntry[];
  fromCache: boolean;
  isStale: boolean;
  isSyncing: boolean;
  error?: string;
  errorType?: "AUTH_REQUIRED" | "NETWORK_ERROR" | "PARSE_ERROR" | "VALIDATION_ERROR";
  lastSynced?: number;
}

type RoutineListener = (result: RoutineRepositoryResult) => void;

/**
 * RoutineRepository
 * Single Source of Truth & High-Performance Data Layer for University Routine
 * Features:
 * - Dynamic slot/time extraction directly from University HTML
 * - Per-combination caching (routine:{sem}:{sec})
 * - Stale-While-Revalidate (SWR) with atomic cache updates
 * - Race-condition protection for rapid switching
 * - Safe concurrency-limited background prefetch queue
 * - Strict validation before cache update
 */
export class RoutineRepository {
  private static instance: RoutineRepository;

  // In-memory runtime cache for micro-second access
  private memoryCache: Map<string, RoutineCacheMetadata> = new Map();
  // Active in-flight requests to deduplicate concurrent calls
  private inFlightRequests: Map<string, Promise<ClassEntry[]>> = new Map();
  // Active UI request tracker for race condition prevention
  private activeUiToken: string = "";
  // Subscribers map by key
  private listeners: Map<string, Set<RoutineListener>> = new Map();

  // Background prefetch queue
  private prefetchQueue: Array<{ semester: number; section: string; priority: number }> = [];
  private isProcessingPrefetch: boolean = false;
  private prefetchConcurrency: number = 2;
  private activePrefetches: number = 0;

  // Default Cache TTL: 15 minutes fresh, stale allowed up to 7 days offline
  private readonly CACHE_TTL_MS = 15 * 60 * 1000;
  private readonly STALE_ALLOWED_MS = 7 * 24 * 60 * 60 * 1000;

  private constructor() {
    this.hydrateFromStorage();
  }

  public static getInstance(): RoutineRepository {
    if (!RoutineRepository.instance) {
      RoutineRepository.instance = new RoutineRepository();
    }
    return RoutineRepository.instance;
  }

  /**
   * Generates a deterministic canonical cache key for semester and section
   */
  public getCanonicalKey(semester: number, section: string): string {
    const secNorm = (section || "A").trim().toUpperCase();
    const secId = sectionToId(secNorm);
    return `routine:${semester}:${secId}`;
  }

  /**
   * Hydrates memory cache from localStorage on startup
   */
  private hydrateFromStorage(): void {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("routine:") || key.startsWith("routine-cache-sem-"))) {
          const raw = localStorage.getItem(key);
          if (raw) {
            try {
              const parsed = JSON.parse(raw);
              if (parsed && Array.isArray(parsed.data) && parsed.data.length > 0) {
                const canonicalKey = this.getCanonicalKey(parsed.semesterId, parsed.sectionName || idToSection(parsed.sectionId));
                this.memoryCache.set(canonicalKey, parsed);
              } else if (Array.isArray(parsed) && parsed.length > 0) {
                // Legacy format migration
                const first = parsed[0];
                const sem = first.semester || 1;
                const sec = first.section || "A";
                const canonicalKey = this.getCanonicalKey(sem, sec);
                const metadata: RoutineCacheMetadata = {
                  semesterId: sem,
                  sectionId: sectionToId(sec),
                  sectionName: sec.toUpperCase(),
                  data: parsed,
                  fetchedAt: Date.now() - 3600000,
                  lastSuccessfulFetch: Date.now() - 3600000,
                  source: "university_endpoint",
                  hash: this.computeHash(parsed),
                  expiresAt: Date.now() + this.CACHE_TTL_MS
                };
                this.memoryCache.set(canonicalKey, metadata);
              }
            } catch {
              // Ignore invalid JSON
            }
          }
        }
      }
    } catch (err) {
      console.warn("[RoutineRepository] Storage hydration warning:", err);
    }
  }

  /**
   * Computes deterministic hash of parsed routine entries to check for real changes
   */
  private computeHash(entries: ClassEntry[]): string {
    if (!entries || entries.length === 0) return "empty";
    const sig = entries.map(e => `${e.day}|${e.slot}|${e.startTime}|${e.endTime}|${e.course}|${e.room}|${(e.teachers || []).join(",")}`).sort().join(";;");
    let hash = 0;
    for (let i = 0; i < sig.length; i++) {
      hash = ((hash << 5) - hash) + sig.charCodeAt(i);
      hash |= 0;
    }
    return hash.toString(36);
  }

  /**
   * Gets cached routine data if available (memory -> storage -> full department dataset)
   */
  public getCached(semester: number, section: string): RoutineCacheMetadata | null {
    const key = this.getCanonicalKey(semester, section);
    const cached = this.memoryCache.get(key);
    if (cached && Array.isArray(cached.data) && cached.data.length > 0) {
      return cached;
    }

    // Check stored section routine in localStorage
    const stored = getStoredSectionRoutine(semester, section);
    if (stored && stored.length > 0) {
      const metadata: RoutineCacheMetadata = {
        semesterId: semester,
        sectionId: sectionToId(section),
        sectionName: section.toUpperCase(),
        data: stored,
        fetchedAt: Date.now() - 60000,
        lastSuccessfulFetch: Date.now() - 60000,
        source: "university_endpoint",
        hash: this.computeHash(stored),
        expiresAt: Date.now() + this.CACHE_TTL_MS
      };
      this.memoryCache.set(key, metadata);
      return metadata;
    }

    // Check verified department routine dataset
    const inFull = fullDepartmentRoutine.filter(c => c.semester === semester && c.section.toUpperCase() === section.toUpperCase());
    if (inFull && inFull.length > 0) {
      const metadata: RoutineCacheMetadata = {
        semesterId: semester,
        sectionId: sectionToId(section),
        sectionName: section.toUpperCase(),
        data: inFull,
        fetchedAt: Date.now() - 60000,
        lastSuccessfulFetch: Date.now() - 60000,
        source: "university_endpoint",
        hash: this.computeHash(inFull),
        expiresAt: Date.now() + this.CACHE_TTL_MS
      };
      this.memoryCache.set(key, metadata);
      return metadata;
    }

    return null;
  }

  /**
   * Fetches fresh routine from University Endpoint with validation, SWR, and atomic cache update
   */
  public async fetchFresh(
    semester: number,
    section: string,
    options: FetchRoutineOptions = {}
  ): Promise<RoutineRepositoryResult> {
    const canonicalKey = this.getCanonicalKey(semester, section);
    const secId = sectionToId(section);
    const secNorm = section.toUpperCase();
    const token = `${canonicalKey}-${Date.now()}-${Math.random()}`;

    if (!options.isBackground) {
      this.activeUiToken = token;
    }

    const cached = this.getCached(semester, section);
    const now = Date.now();
    const isStale = !cached || now > cached.expiresAt;

    // SWR: If we have valid cache and not forcing fresh, immediately return cache and revalidate in background
    if (cached && !options.forceFresh && !isStale) {
      this.queueBackgroundPrefetch(semester, section);
      return {
        data: cached.data,
        fromCache: true,
        isStale: false,
        isSyncing: false,
        lastSynced: cached.lastSuccessfulFetch
      };
    }

    // Deduplicate in-flight requests for the same semester/section
    let requestPromise = this.inFlightRequests.get(canonicalKey);
    if (!requestPromise) {
      requestPromise = this.executeUniversityEndpointRequest(semester, secId, secNorm, options);
      this.inFlightRequests.set(canonicalKey, requestPromise);
    }

    try {
      const freshEntries = await requestPromise;
      this.inFlightRequests.delete(canonicalKey);

      // Validate entries before cache replacement
      const isValid = this.validateRoutineEntries(freshEntries, semester, secNorm);
      if (!isValid) {
        console.warn(`[RoutineRepository] Validation failed for Sem ${semester} Sec ${secNorm}. Keeping previous cache.`);
        return {
          data: cached ? cached.data : [],
          fromCache: !!cached,
          isStale: true,
          isSyncing: false,
          error: "Endpoint response validation failed or contained no class entries.",
          errorType: "VALIDATION_ERROR",
          lastSynced: cached?.lastSuccessfulFetch
        };
      }

      // Check if dataset actually changed
      const newHash = this.computeHash(freshEntries);
      const hasChanged = !cached || cached.hash !== newHash;

      const metadata: RoutineCacheMetadata = {
        semesterId: semester,
        sectionId: secId,
        sectionName: secNorm,
        data: freshEntries,
        fetchedAt: Date.now(),
        lastSuccessfulFetch: Date.now(),
        source: "university_endpoint",
        hash: newHash,
        expiresAt: Date.now() + this.CACHE_TTL_MS
      };

      // Atomic cache update
      this.memoryCache.set(canonicalKey, metadata);
      this.persistToLocalStorage(metadata);

      // Trigger background prefetch for remaining sections in the active semester
      if (!options.isBackground) {
        this.queueBackgroundPrefetch(semester, secNorm);
      }

      const result: RoutineRepositoryResult = {
        data: freshEntries,
        fromCache: false,
        isStale: false,
        isSyncing: false,
        lastSynced: metadata.lastSuccessfulFetch
      };

      // Notify listeners if this is still the active selection or if cache changed
      if (hasChanged) {
        this.notifyListeners(canonicalKey, result);
      }

      return result;
    } catch (err: unknown) {
      this.inFlightRequests.delete(canonicalKey);
      const isAuthError = err instanceof Error && err.message === "AUTH_REQUIRED";
      
      if (isAuthError) {
        console.info(`[RoutineRepository] University session required for Sem ${semester} Sec ${secNorm}. Serving cached/verified schedule.`);
      } else {
        console.warn(`[RoutineRepository] Fetch warning for Sem ${semester} Sec ${secNorm}:`, err);
      }

      const fallbackData = cached?.data || this.getCached(semester, section)?.data || [];

      return {
        data: fallbackData,
        fromCache: true,
        isStale: true,
        isSyncing: false,
        error: isAuthError ? "University portal session expired or login required." : (err instanceof Error ? err.message : "Network error"),
        errorType: isAuthError ? "AUTH_REQUIRED" : "NETWORK_ERROR",
        lastSynced: cached?.lastSuccessfulFetch || Date.now()
      };
    }
  }

  /**
   * Executes HTTP request to university routine proxy endpoint
   */
  private async executeUniversityEndpointRequest(
    semester: number,
    sectionId: number,
    sectionName: string,
    options: FetchRoutineOptions
  ): Promise<ClassEntry[]> {
    const sessionCookie = options.sessionCookie || localStorage.getItem("easymate-session") || "";

    const headers: Record<string, string> = {
      "Accept": "text/html, application/json, */*",
      "X-Requested-With": "XMLHttpRequest"
    };

    if (sessionCookie) {
      headers["x-university-cookie"] = sessionCookie;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000);

    try {
      const url = `/api/routine?semester_id=${encodeURIComponent(semester)}&section_id=${encodeURIComponent(sectionId)}`;
      const response = await fetch(url, {
        headers,
        signal: options.signal || controller.signal,
        cache: "no-store"
      });

      clearTimeout(timeoutId);

      if (response.status === 401) {
        throw new Error("AUTH_REQUIRED");
      }

      if (!response.ok) {
        throw new Error(`University proxy HTTP ${response.status}: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type") || "";
      let html = "";

      if (contentType.includes("application/json")) {
        const json = await response.json();
        if (json.error === "AUTH_REQUIRED") {
          throw new Error("AUTH_REQUIRED");
        }
        html = json.html || json.data || "";
      } else {
        html = await response.text();
      }

      if (html.includes("/front/student/login") || html.includes("<title>Redirecting to http://160.187.25.3:8083/front/student/login</title>")) {
        throw new Error("AUTH_REQUIRED");
      }

      // Parse HTML dynamically extracting all slots, times, courses, teachers, and rooms
      const parsed = parseUniversityRoutineHtml(html, semester, sectionName);
      return parsed;
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  /**
   * Validates parsed routine entries before allowing them to replace cache
   */
  private validateRoutineEntries(entries: ClassEntry[], semester: number, section: string): boolean {
    if (!Array.isArray(entries) || entries.length === 0) {
      return false;
    }

    const validDays = new Set(["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);

    for (const entry of entries) {
      if (!entry.day || !validDays.has(entry.day)) return false;
      if (!entry.slot || entry.slot < 1 || entry.slot > 10) return false;
      if (!entry.course || typeof entry.course !== "string") return false;
      if (!entry.teachers || !Array.isArray(entry.teachers)) return false;
    }

    return true;
  }

  /**
   * Persists validated cache record to local storage
   */
  private persistToLocalStorage(metadata: RoutineCacheMetadata): void {
    try {
      const canonicalKey = this.getCanonicalKey(metadata.semesterId, metadata.sectionName);
      localStorage.setItem(canonicalKey, JSON.stringify(metadata));

      // Also sync to legacy key for full backwards compatibility
      const legacyKey = getSectionCacheKey(metadata.semesterId, metadata.sectionName);
      localStorage.setItem(legacyKey, JSON.stringify(metadata.data));
    } catch (e) {
      console.warn("[RoutineRepository] LocalStorage write error:", e);
    }
  }

  /**
   * Background Prefetch Queue Management
   * Safely prefetches remaining sections in the background without blocking the UI
   */
  public queueBackgroundPrefetch(currentSemester: number, currentSection: string): void {
    const secNorm = currentSection.toUpperCase();
    const commonSections = ["A", "B", "C", "D", "E", "F"];

    // Add sibling sections to prefetch queue with priority 2
    for (const sec of commonSections) {
      if (sec === secNorm) continue;
      const key = this.getCanonicalKey(currentSemester, sec);
      const cached = this.getCached(currentSemester, sec);
      const isStale = !cached || (Date.now() - cached.fetchedAt > this.CACHE_TTL_MS);

      if (isStale && !this.inFlightRequests.has(key)) {
        this.prefetchQueue.push({ semester: currentSemester, section: sec, priority: 2 });
      }
    }

    this.processPrefetchQueue();
  }

  /**
   * Processes background prefetch queue with safe concurrency limit
   */
  private async processPrefetchQueue(): Promise<void> {
    if (this.isProcessingPrefetch || this.prefetchQueue.length === 0) return;
    this.isProcessingPrefetch = true;

    while (this.prefetchQueue.length > 0 && this.activePrefetches < this.prefetchConcurrency) {
      // Sort by priority descending
      this.prefetchQueue.sort((a, b) => b.priority - a.priority);
      const item = this.prefetchQueue.shift();
      if (!item) break;

      this.activePrefetches++;
      this.fetchFresh(item.semester, item.section, { isBackground: true })
        .catch(() => {
          // Background fetch errors are non-fatal and ignored silently
        })
        .finally(() => {
          this.activePrefetches--;
          // Small pause between background requests to prevent server throttling
          setTimeout(() => this.processPrefetchQueue(), 1500);
        });
    }

    this.isProcessingPrefetch = false;
  }

  /**
   * Subscribe to cache updates for a specific semester + section
   */
  public subscribe(semester: number, section: string, listener: RoutineListener): () => void {
    const key = this.getCanonicalKey(semester, section);
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }
    this.listeners.get(key)!.add(listener);

    return () => {
      const set = this.listeners.get(key);
      if (set) {
        set.delete(listener);
        if (set.size === 0) {
          this.listeners.delete(key);
        }
      }
    };
  }

  /**
   * Notifies all registered listeners of a routine update
   */
  private notifyListeners(key: string, result: RoutineRepositoryResult): void {
    const set = this.listeners.get(key);
    if (set) {
      set.forEach(listener => {
        try {
          listener(result);
        } catch (e) {
          console.error("[RoutineRepository] Listener error:", e);
        }
      });
    }
  }

  /**
   * Invalidate cache for a specific semester/section or all
   */
  public invalidate(semester?: number, section?: string): void {
    if (semester !== undefined && section !== undefined) {
      const key = this.getCanonicalKey(semester, section);
      this.memoryCache.delete(key);
      localStorage.removeItem(key);
      localStorage.removeItem(getSectionCacheKey(semester, section));
    } else {
      this.memoryCache.clear();
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && (key.startsWith("routine:") || key.startsWith("routine-cache-sem-"))) {
          localStorage.removeItem(key);
        }
      }
    }
  }
}

export const routineRepository = RoutineRepository.getInstance();
export default routineRepository;
