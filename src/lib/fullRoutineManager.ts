import { useState, useEffect, useCallback, useMemo } from "react";
import { ClassEntry, DAYS } from "@/data/routineData";
import { fullDepartmentRoutine } from "@/data/fullDepartmentRoutine";
import { saveStoredSectionRoutine } from "@/lib/parser";

const CACHE_KEY_FULL_ROUTINE = "cached-full-department-routine";
const CACHE_KEY_FULL_TIMESTAMP = "cached-full-routine-timestamp";
const SYNC_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Loads the full department routine from localStorage or falls back to pre-seeded dataset.
 */
export function getFullDepartmentRoutine(): ClassEntry[] {
  try {
    const raw = localStorage.getItem(CACHE_KEY_FULL_ROUTINE);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 50) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to load cached full routine:", e);
  }
  return fullDepartmentRoutine;
}

/**
 * Saves the full department routine to localStorage, updates timestamp,
 * and populates per-section caches so navigating to any semester/section is instant.
 */
export function saveFullDepartmentRoutine(entries: ClassEntry[]) {
  try {
    if (!Array.isArray(entries) || entries.length === 0) return;
    localStorage.setItem(CACHE_KEY_FULL_ROUTINE, JSON.stringify(entries));
    localStorage.setItem(CACHE_KEY_FULL_TIMESTAMP, String(Date.now()));

    // Populate individual section caches for instant per-section navigation
    const grouped = new Map<string, ClassEntry[]>();
    for (const entry of entries) {
      if (entry.semester && entry.section) {
        const key = `${entry.semester}-${entry.section.trim().toUpperCase()}`;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key)!.push(entry);
      }
    }

    for (const [key, sectionEntries] of grouped.entries()) {
      const [semStr, sec] = key.split("-");
      const sem = parseInt(semStr, 10);
      if (sem && sec) {
        saveStoredSectionRoutine(sem, sec, sectionEntries);
      }
    }
  } catch (e) {
    console.error("Failed to save full department routine:", e);
  }
}

/**
 * Fetches the full department routine from the server proxy.
 */
export async function fetchFullRoutineFromServer(): Promise<{
  success: boolean;
  entries: ClassEntry[];
  timestamp?: number;
  totalClasses?: number;
  uniqueRooms?: string[];
  uniqueTeachers?: string[];
  error?: string;
}> {
  try {
    const res = await fetch("/api/routine/full", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Server returned status ${res.status}`);
    }
    const data = await res.json();
    if (data.success && Array.isArray(data.entries) && data.entries.length > 0) {
      saveFullDepartmentRoutine(data.entries);
      return {
        success: true,
        entries: data.entries,
        timestamp: data.timestamp,
        totalClasses: data.totalClasses,
        uniqueRooms: data.uniqueRooms,
        uniqueTeachers: data.uniqueTeachers
      };
    }
    throw new Error(data.error || "Invalid response format");
  } catch (err: unknown) {
    console.warn("Could not fetch full routine from /api/routine/full:", err);
    return {
      success: false,
      entries: getFullDepartmentRoutine(),
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/**
 * Natural room sorting (e.g. 105, 127 EEL, 128 BCL, 1001, 1003, etc.)
 */
export function getDepartmentAllRooms(routine: ClassEntry[]): string[] {
  const roomsSet = new Set<string>();
  for (const e of routine) {
    if (e.room && e.room.trim() && e.room.trim().toUpperCase() !== "TBA") {
      roomsSet.add(e.room.trim());
    }
  }
  return Array.from(roomsSet).sort((a, b) =>
    a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
  );
}

/**
 * Returns all classes taking place in a specific room on a given day.
 */
export function getDepartmentClassesByRoom(routine: ClassEntry[], day: string, room: string): ClassEntry[] {
  return routine
    .filter(e => e.day.toLowerCase() === day.toLowerCase() && e.room.trim().toUpperCase() === room.trim().toUpperCase())
    .sort((a, b) => a.slot - b.slot);
}

/**
 * Returns all classes taking place in a given slot on a given day across ALL semesters and sections.
 */
export function getDepartmentClassesBySlot(routine: ClassEntry[], day: string, slot: number): ClassEntry[] {
  return routine
    .filter(e => e.day.toLowerCase() === day.toLowerCase() && e.slot === slot)
    .sort((a, b) => a.room.localeCompare(b.room, undefined, { numeric: true, sensitivity: "base" }));
}

/**
 * Returns a map of room -> ClassEntry for a specific day and slot.
 */
export function getRoomOccupancyMap(routine: ClassEntry[], day: string, slot: number): Map<string, ClassEntry> {
  const map = new Map<string, ClassEntry>();
  for (const entry of routine) {
    if (entry.day.toLowerCase() === day.toLowerCase() && entry.slot === slot && entry.room) {
      map.set(entry.room.trim(), entry);
    }
  }
  return map;
}

/**
 * Calculates days on which a room is completely free across all 8 semesters.
 */
export function getDepartmentRoomFreeDays(routine: ClassEntry[], room: string): string[] {
  if (!room) return [];
  return DAYS.filter(day => {
    return !routine.some(e => e.day.toLowerCase() === day.toLowerCase() && e.room.trim().toUpperCase() === room.trim().toUpperCase());
  });
}

/**
 * Returns all unique teachers across all semesters and sections.
 */
export function getDepartmentAllTeachers(routine: ClassEntry[]): string[] {
  const teacherSet = new Set<string>();
  for (const e of routine) {
    if (Array.isArray(e.teachers)) {
      for (const t of e.teachers) {
        const cleaned = t.trim();
        if (cleaned && !cleaned.toLowerCase().includes("tba") && cleaned !== "-") {
          teacherSet.add(cleaned);
        }
      }
    }
  }
  return Array.from(teacherSet).sort();
}

/**
 * Returns all classes taught by a teacher across all semesters and sections.
 */
export function getDepartmentClassesForTeacher(
  routine: ClassEntry[],
  teacherName: string,
  day?: string
): ClassEntry[] {
  if (!teacherName) return [];
  const normTarget = teacherName.trim().toLowerCase();
  return routine.filter(e => {
    if (day && e.day.toLowerCase() !== day.toLowerCase()) return false;
    return e.teachers.some(t => {
      const norm = t.trim().toLowerCase();
      return norm === normTarget || norm.includes(normTarget) || normTarget.includes(norm);
    });
  }).sort((a, b) => a.slot - b.slot);
}

/**
 * Custom React hook for automated periodic full routine synchronization and background pre-caching.
 */
export function useFullRoutineSync() {
  const [fullRoutine, setFullRoutine] = useState<ClassEntry[]>(() => getFullDepartmentRoutine());
  const [isSyncingFull, setIsSyncingFull] = useState(false);
  const [lastFullSyncTime, setLastFullSyncTime] = useState<number>(() => {
    const raw = localStorage.getItem(CACHE_KEY_FULL_TIMESTAMP);
    return raw ? parseInt(raw, 10) : Date.now();
  });

  const syncFullRoutine = useCallback(async (force = false) => {
    const now = Date.now();
    const rawTime = localStorage.getItem(CACHE_KEY_FULL_TIMESTAMP);
    const lastTime = rawTime ? parseInt(rawTime, 10) : 0;

    // Skip if recently synced unless forced
    if (!force && now - lastTime < SYNC_INTERVAL_MS) {
      return;
    }

    setIsSyncingFull(true);
    try {
      const result = await fetchFullRoutineFromServer();
      if (result.success && result.entries.length > 0) {
        setFullRoutine(result.entries);
        setLastFullSyncTime(now);
      }
    } catch (e) {
      console.error("Full routine background sync error:", e);
    } finally {
      setIsSyncingFull(false);
    }
  }, []);

  // On mount and periodic interval
  useEffect(() => {
    // Initial check on mount
    syncFullRoutine(false);

    // Periodic check every 15 minutes
    const interval = setInterval(() => {
      syncFullRoutine(false);
    }, SYNC_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [syncFullRoutine]);

  const allRooms = useMemo(() => getDepartmentAllRooms(fullRoutine), [fullRoutine]);
  const allTeachers = useMemo(() => getDepartmentAllTeachers(fullRoutine), [fullRoutine]);

  return {
    fullRoutine,
    allRooms,
    allTeachers,
    isSyncingFull,
    lastFullSyncTime,
    syncFullRoutineNow: () => syncFullRoutine(true)
  };
}
