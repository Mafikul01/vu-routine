import Papa from 'papaparse';
import * as cheerio from 'cheerio';
import { ClassEntry } from "@/data/routineData";
import { fullDepartmentRoutine } from "@/data/fullDepartmentRoutine";
import { Teacher } from "@/types";

export function sectionToId(section: string): number {
  if (!section) return 1;
  const clean = section.replace(/^(section|sec)\s*/i, "").trim().toUpperCase();
  if (/^\d+$/.test(clean)) {
    return parseInt(clean, 10);
  }
  const map: Record<string, number> = {
    A: 1,
    B: 2,
    C: 3,
    D: 4,
    E: 5,
    F: 6,
    G: 7
  };
  return map[clean] || 1;
}

export function idToSection(id: number): string {
  const map: Record<number, string> = {
    1: "A",
    2: "B",
    3: "C",
    4: "D",
    5: "E",
    6: "F",
    7: "G"
  };
  return map[id] || "A";
}

export const UNIVERSITY_SLOT_TIMES: Record<number, { start: string; end: string; slotTime: string }> = {
  1: { start: "09:00 AM", end: "10:15 AM", slotTime: "09:00 AM - 10:15 AM" },
  2: { start: "10:15 AM", end: "11:30 AM", slotTime: "10:15 AM - 11:30 AM" },
  3: { start: "11:30 AM", end: "12:45 PM", slotTime: "11:30 AM - 12:45 PM" },
  4: { start: "01:15 PM", end: "02:30 PM", slotTime: "01:15 PM - 02:30 PM" },
  5: { start: "02:30 PM", end: "03:45 PM", slotTime: "02:30 PM - 03:45 PM" },
  6: { start: "03:45 PM", end: "05:00 PM", slotTime: "03:45 PM - 05:00 PM" }
};

export function extractSlotTimeFromText(text: string): { start: string; end: string; slotTime: string } | null {
  if (!text) return null;
  // Normalize all dash variations (en-dash, em-dash, hyphens, minus)
  const clean = text.replace(/[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g, "-").replace(/\s+/g, " ").trim();
  const timeMatch = clean.match(/(\d{1,2}:\d{2}(?:\s*[AaPp][Mm])?)\s*[-to~]+\s*(\d{1,2}:\d{2}\s*[AaPp][Mm])/i);
  if (!timeMatch) return null;

  let start = timeMatch[1].trim().toUpperCase();
  let end = timeMatch[2].trim().toUpperCase();

  if (!start.includes("AM") && !start.includes("PM")) {
    const startHour = parseInt(start.split(":")[0], 10);
    if (end.includes("PM")) {
      start = (startHour >= 7 && startHour <= 11) ? `${start} AM` : `${start} PM`;
    } else {
      start = `${start} AM`;
    }
  }

  // Ensure clean format like "09:00 AM"
  start = start.replace(/([0-9])([AP]M)/, "$1 $2");
  end = end.replace(/([0-9])([AP]M)/, "$1 $2");

  return {
    start,
    end,
    slotTime: `${start} - ${end}`
  };
}

export function parseUniversityRoutineHtml(html: string, semester: number = 7, section: string = "B"): ClassEntry[] {
  if (!html || typeof html !== "string") return [];
  const $ = cheerio.load(html);
  const results: ClassEntry[] = [];
  const seen = new Set<string>();
  const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  // 1. Dynamically extract slot timings directly from table headers or slot titles
  const dynamicSlotTimes: Record<number, { start: string; end: string; slotTime: string }> = {};

  $("thead tr th, table tr:first-child th, tr th").each((idx, th) => {
    const clone = $(th).clone();
    clone.find("br").replaceWith(" ");
    const text = clone.text().replace(/\s+/g, " ").trim();
    const parsedTime = extractSlotTimeFromText(text);

    const slotMatch = text.match(/Slot\s*(\d+)/i);
    // If "Slot N" is explicitly in text, use that slot number; otherwise if idx > 0, column idx represents Slot idx
    const slotNum = slotMatch ? parseInt(slotMatch[1], 10) : (idx > 0 ? idx : 0);

    if (slotNum > 0 && parsedTime) {
      dynamicSlotTimes[slotNum] = parsedTime;
    }
  });

  $(".routine-slot, .slot-title, summary, details, [class*='slot']").each((_, el) => {
    const clone = $(el).clone();
    clone.find("br").replaceWith(" ");
    const text = clone.text().replace(/\s+/g, " ").trim();
    const slotMatch = text.match(/Slot\s*(\d+)/i);
    const parsedTime = extractSlotTimeFromText(text);

    if (slotMatch && parsedTime) {
      const slotNum = parseInt(slotMatch[1], 10);
      if (!dynamicSlotTimes[slotNum]) {
        dynamicSlotTimes[slotNum] = parsedTime;
      }
    }
  });

  const getSlotTiming = (slotNum: number, span: number = 1) => {
    const startObj = dynamicSlotTimes[slotNum] || UNIVERSITY_SLOT_TIMES[slotNum];
    const endSlot = slotNum + span - 1;
    const endObj = dynamicSlotTimes[endSlot] || UNIVERSITY_SLOT_TIMES[endSlot] || startObj;

    const startTime = startObj?.start || "";
    const endTime = endObj?.end || startObj?.end || "";
    const slotTime = (startTime && endTime) ? `${startTime} - ${endTime}` : (startObj?.slotTime || "");

    return { startTime, endTime, slotTime };
  };

  const addEntry = (entry: ClassEntry) => {
    const key = `${entry.day}-${entry.slot}-${entry.course}-${entry.room}-${entry.section}`;
    if (!seen.has(key)) {
      seen.add(key);
      results.push(entry);
    }
  };

  // 2. Desktop table structure (<table class="table ...">)
  const tableRows = $("table tbody tr, table tr").toArray();
  for (const row of tableRows) {
    const cells = $(row).find("th, td").toArray();
    if (cells.length < 2) continue;

    // Detect day from first cell
    const firstText = $(cells[0]).text().trim();
    const matchedDay = DAYS.find(d => d.toLowerCase() === firstText.toLowerCase()) ||
                       DAYS.find(d => firstText.toLowerCase().includes(d.toLowerCase()));
    if (!matchedDay) continue;

    let currentSlot = 1;
    for (let c = 1; c < cells.length; c++) {
      const cell = $(cells[c]);
      const colspan = parseInt(cell.attr("colspan") || "1", 10);
      const slotAttr = cell.attr("data-slot");
      const slot = slotAttr ? parseInt(slotAttr, 10) : currentSlot;

      const eventCards = cell.find(".event-card").toArray();
      for (const cardEl of eventCards) {
        const card = $(cardEl);
        const course = card.find(".text-bold").first().text().trim() ||
                       card.find("[class*='code'], strong, b").first().text().trim();
        if (!course) continue;

        let courseName = "";
        let teachers: string[] = [];
        let room = "TBA";

        const dataId = card.attr("data-id") || undefined;
        const isConsecutiveAttr = card.attr("data-is-consecutive");
        const isConsecutive = isConsecutiveAttr === "1" || colspan > 1;
        const combinedGroup = card.attr("data-combined-group") || undefined;

        // 1. Check data attributes on card and table cell
        const attrRoom = card.attr("data-room") ||
                         card.attr("data-room-name") ||
                         card.attr("data-room-id") ||
                         card.attr("data-room-no") ||
                         card.attr("data-venue") ||
                         card.attr("data-location") ||
                         cell.attr("data-room") ||
                         cell.attr("data-room-name") ||
                         cell.attr("data-room-id") ||
                         cell.attr("data-venue");
        if (attrRoom && attrRoom.trim() && attrRoom.trim() !== "TBA") {
          room = attrRoom.trim().replace(/^(Room|Rm|R\.?|Room\s*No|Room\s*#|Location|Venue)[:\s\-#]*/i, "").trim();
        }

        // 2. Check hidden inputs or fields inside card
        if (room === "TBA") {
          const hiddenRoom = card.find("input[type='hidden'][name*='room'], input[type='hidden'][id*='room'], input[name*='room_no'], [data-field*='room']").val();
          if (hiddenRoom && String(hiddenRoom).trim() && String(hiddenRoom).trim() !== "TBA") {
            room = String(hiddenRoom).trim().replace(/^(Room|Rm|R\.?|Room\s*No|Room\s*#|Location|Venue)[:\s\-#]*/i, "").trim();
          }
        }

        // 3. Check tooltips / popovers
        if (room === "TBA") {
          const tooltip = card.attr("data-original-title") || card.attr("title") ||
                          card.find("[data-original-title]").attr("data-original-title") ||
                          card.find("[title]").attr("title");
          if (tooltip) {
            const tooltipMatch = tooltip.match(/(?:Room|Rm|R|Venue|Location)[\s:#\-_]*([A-Z0-9\-\s]+)/i) ||
                                 tooltip.match(/\b([1-9]\d{2,3}[A-Za-z]?)\b/);
            if (tooltipMatch) {
              room = tooltipMatch[1].trim();
            }
          }
        }

        const divs = card.children("div, p, span").toArray();
        for (const divEl of divs) {
          const div = $(divEl);
          const text = div.text().trim();
          if (!text || div.hasClass("text-bold")) continue;

          const hasUserIcon = div.find("i.fa-user, .fa-user, [class*='user'], [class*='teacher'], [class*='person'], svg").length > 0;
          const hasRoomIcon = div.find("i.fa-map-marker, i.fa-building, i.fa-home, i.fa-location-arrow, i.fa-door-closed, .fa-map-marker, .fa-building, .fa-home, [class*='location'], [class*='room'], [class*='building'], [class*='pin']").length > 0;
          const isExplicitTeacher = /^(Teacher|Faculty|Instructor|Lecturer|Sir|Madam|Mr\.|Ms\.|Mrs\.|Dr\.|Prof\.|Md\.|S\.M\.|A\.S\.M\.)/i.test(text);
          const hasRoomPrefix = /^(Room|Rm|R\.?|Room\s*No|Room\s*#|Location|Venue)[:\s\-#]*/i.test(text);
          const isStandaloneRoomPattern = /^(\d{3,4}[A-Za-z]?|[A-Za-z]{1,4}[\s\-]?\d{2,4}[A-Za-z]?)$/i.test(text) ||
                                          /^((?:CSE|EEE|ICE|PHY|CHEM|BIO|MATH|ENG)?\s*(?:Lab|Laboratory|Gallery|Auditorium|Workshop|Seminar\s*Room|Annex)[\s\-#]*\d*)$/i.test(text);
          const isRoom = hasRoomIcon || hasRoomPrefix || (isStandaloneRoomPattern && text !== course);

          if (isRoom) {
            room = text.replace(/^(Room|Rm|R\.?|Room\s*No|Room\s*#|Location|Venue)[:\s\-#]*/i, "").trim();
          } else if (hasUserIcon || isExplicitTeacher) {
            const rawTeacher = text.replace(/^(Teacher|Faculty|Instructor|Lecturer|Sir|Madam):?\s*/i, "").trim();
            const extracted = rawTeacher.split(/,|\n|\/|&/).map(t => t.trim()).filter(Boolean);
            if (extracted.length > 0) {
              teachers.push(...extracted);
            }
          } else {
            // Check if this text is a course title
            const isCourseTitle = /(\blab\b|\btheory\b|\bengineering\b|\bmanagement\b|\baccountancy\b|\bmathematics\b|\bphysics\b|\bchemistry\b|\bprogramming\b|\bintelligence\b|\bnetwork\b|\bdatabase\b|\beconomics\b|\barchitecture\b|\bmicrocontroller\b|\bperipherals\b|\binterfacing\b|\bwriting\b|\bprocessing\b|\bsystem\b|\belectronic\b|\bcircuits\b)/i.test(text);

            if (isCourseTitle && !courseName) {
              courseName = text;
            } else if (teachers.length === 0) {
              // It is a teacher's / instructor's name!
              const extracted = text.split(/,|\n|\/|&/).map(t => t.trim()).filter(Boolean);
              if (extracted.length > 0) {
                teachers.push(...extracted);
              }
            } else if (!courseName) {
              courseName = text;
            }
          }
        }

        // Secondary Room check from full card text or department verified dataset
        if (!room || room === "TBA") {
          const cardText = card.text();
          const roomMatch = cardText.match(/(?:Room|Rm|R)[\s:#\-_]*([A-Z0-9\-]+)/i) ||
                            cardText.match(/\b([1-9]\d{2,3}[A-Za-z]?)\b/);
          if (roomMatch) {
            room = roomMatch[1].trim();
          }
        }

        if (!room || room === "TBA") {
          const matchInDept = fullDepartmentRoutine.find(e =>
            e.semester === semester &&
            e.section.toUpperCase() === section.toUpperCase() &&
            e.day.toLowerCase() === matchedDay.toLowerCase() &&
            e.slot === slot &&
            (e.course === course || e.course.replace(/\s+/g, "") === course.replace(/\s+/g, ""))
          );
          if (matchInDept && matchInDept.room && matchInDept.room !== "TBA") {
            room = matchInDept.room;
          }
        }

        // Clean teachers list - eliminate placeholder names
        let cleanTeachers = teachers
          .map(t => t.replace(/^(Teacher|Faculty|Instructor):?\s*/i, "").trim())
          .filter(Boolean);

        if (cleanTeachers.length === 0) {
          cleanTeachers = ["Faculty Member"];
        }

        const timing = getSlotTiming(slot, colspan);
        addEntry({
          day: matchedDay,
          slot,
          startTime: timing.startTime,
          endTime: timing.endTime,
          slotTime: timing.slotTime,
          teachers: cleanTeachers,
          course,
          courseName: courseName || undefined,
          semester,
          section,
          room: room || "TBA",
          colspan: colspan > 1 ? colspan : undefined,
          dataId,
          isConsecutive,
          combinedGroup
        });
      }

      currentSlot += colspan;
    }
  }

  // 3. Mobile structure fallback (only if desktop table yielded 0 items to avoid duplicate entries)
  if (results.length === 0) {
    $(".routine-day").each((_, dayEl) => {
      const dayText = $(dayEl).find(".day-name, h3, h4, h5, [class*='day']").first().text().trim();
      const matchedDay = DAYS.find(d => d.toLowerCase() === dayText.toLowerCase()) ||
                         DAYS.find(d => dayText.toLowerCase().includes(d.toLowerCase()));
      if (!matchedDay) return;

      $(dayEl).find(".routine-slot").each((_, slotEl) => {
        let slot = parseInt($(slotEl).attr("data-slot") || "0", 10);
        if (!slot) {
          const match = $(slotEl).find(".slot-title, summary, details, [class*='slot']").first().text().match(/Slot\s*(\d+)/i);
          if (match) slot = parseInt(match[1], 10);
        }
        if (!slot) slot = 1;

        const course = $(slotEl).find(".course-code-chip, .text-bold, strong, b").first().text().trim();
        if (!course) return;

        let courseName = "";
        let room = "TBA";
        let teachers: string[] = [];

        $(slotEl).find(".routine-item-details div, details div, p, span").each((_, detailEl) => {
          const text = $(detailEl).text().trim();
          if (!text) return;
          const hasUserIcon = $(detailEl).find("i.fa-user, .fa-user, [class*='user'], [class*='teacher'], svg").length > 0;
          const hasRoomIcon = $(detailEl).find("i.fa-map-marker, i.fa-building, i.fa-home, [class*='location'], [class*='room'], [class*='building']").length > 0;
          const isExplicitTeacher = /^(Teacher|Faculty|Instructor|Lecturer|Sir|Madam|Mr\.|Ms\.|Mrs\.|Dr\.|Prof\.|Md\.)/i.test(text);
          const hasRoomPrefix = /^(Room|Rm|R\.?|Room\s*No|Room\s*#|Location|Venue)[:\s\-#]*/i.test(text);
          const isStandaloneRoomPattern = /^(\d{3,4}[A-Za-z]?|[A-Za-z]{1,4}[\s\-]?\d{2,4}[A-Za-z]?)$/i.test(text) ||
                                          /^((?:CSE|EEE|ICE|PHY|CHEM|BIO|MATH|ENG)?\s*(?:Lab|Laboratory|Gallery|Auditorium|Workshop|Seminar\s*Room|Annex)[\s\-#]*\d*)$/i.test(text);
          const isRoom = hasRoomIcon || hasRoomPrefix || (isStandaloneRoomPattern && text !== course);

          if (isRoom) {
            room = text.replace(/^(Room|Rm|R\.?|Room\s*No|Room\s*#|Location|Venue)[:\s\-#]*/i, "").trim();
          } else if (hasUserIcon || isExplicitTeacher) {
            const raw = text.replace(/^(Teacher|Faculty|Instructor|Lecturer|Sir|Madam):?\s*/i, "").trim();
            teachers = raw.split(/,|\n|\/|&/).map(t => t.trim()).filter(Boolean);
          } else if (!courseName && /(\blab\b|\btheory\b|\bengineering\b|\bmanagement\b|\baccountancy\b|\bmathematics\b|\bintelligence\b|\bnetwork\b|\beconomics\b|\bwriting\b)/i.test(text)) {
            courseName = text;
          } else if (teachers.length === 0 && !text.includes(course)) {
            teachers = text.split(/,|\n|\/|&/).map(t => t.trim()).filter(Boolean);
          } else if (!courseName && !text.includes(course)) {
            courseName = text;
          }
        });

        if (!room || room === "TBA") {
          const matchInDept = fullDepartmentRoutine.find(e =>
            e.semester === semester &&
            e.section.toUpperCase() === section.toUpperCase() &&
            e.day.toLowerCase() === matchedDay.toLowerCase() &&
            e.slot === slot &&
            (e.course === course || e.course.replace(/\s+/g, "") === course.replace(/\s+/g, ""))
          );
          if (matchInDept && matchInDept.room && matchInDept.room !== "TBA") {
            room = matchInDept.room;
          }
        }

        const timing = getSlotTiming(slot, 1);
        addEntry({
          day: matchedDay,
          slot,
          startTime: timing.startTime,
          endTime: timing.endTime,
          slotTime: timing.slotTime,
          teachers: teachers.length > 0 ? teachers : ["Faculty Member"],
          course,
          courseName: courseName || undefined,
          semester,
          section,
          room: room || "TBA"
        });
      });
    });
  }

  return results;
}

export function getSectionCacheKey(semester: number, section: string): string {
  const normSec = (section || "A").trim().toUpperCase();
  return `routine-cache-sem-${semester}-sec-${normSec}`;
}

export function getStoredSectionRoutine(semester: number, section: string): ClassEntry[] | null {
  try {
    const key = getSectionCacheKey(semester, section);
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let needsUpgrade = false;
        const upgraded = parsed.map((entry: ClassEntry) => {
          let updated = { ...entry };
          if (
            !entry.startTime ||
            entry.startTime === "10:05 AM" ||
            entry.endTime === "10:05 AM" ||
            entry.slotTime?.includes("10:05 AM") ||
            entry.slotTime?.includes("01:20 PM") ||
            entry.slotTime?.includes("01:50 PM")
          ) {
            needsUpgrade = true;
            const timing = UNIVERSITY_SLOT_TIMES[entry.slot] || { start: "09:00 AM", end: "10:15 AM", slotTime: "09:00 AM - 10:15 AM" };
            const span = entry.colspan || 1;
            const endSlot = entry.slot + span - 1;
            const endTiming = UNIVERSITY_SLOT_TIMES[endSlot] || timing;
            const start = timing.start;
            const end = endTiming.end;
            updated = {
              ...updated,
              startTime: start,
              endTime: end,
              slotTime: `${start} - ${end}`
            };
          }

          // Clean legacy placeholder names like "BA New Teacher", "BA Teacher"
          if (!updated.teachers || updated.teachers.length === 0 || updated.teachers.some(t => /ba\b|new\s*teacher/i.test(t))) {
            needsUpgrade = true;
            if (updated.course === "ACC 4171") {
              updated.teachers = [updated.section?.toUpperCase() === "C" ? "Fahmida Akter Jesis Shithi" : "Saiful Islam"];
            } else if (updated.teachers) {
              updated.teachers = updated.teachers.map(t => {
                if (/ba\b|new\s*teacher/i.test(t)) {
                  if (t === "Eco New Teacher 3") return "Faisal Aziz";
                  if (t === "Eco New Teacher 1") return "Ayesha Akter Lima";
                  if (t === "Eco New Teacher 4") return "Md. Alamin Hossain Pappu";
                  if (t === "CSE New Teacher 1") return "Akib Ikbal";
                  if (t === "CSE New Teacher 2" || t === "CSE New Teacher2") return "Ahmed Al Azmain";
                  if (t === "CSE New Teacher 3") return "Adrita Alam";
                  if (t === "CSE New Teacher 4") return "Arifa Ferdousi";
                  if (t === "Eng New Teacher 6") return "Afroza Islam";
                  return "Faculty Member";
                }
                return t;
              });
            }
          }

          // Upgrade room if missing or TBA
          if (!updated.room || updated.room === "TBA" || updated.room === "") {
            needsUpgrade = true;
            const matchInDept = fullDepartmentRoutine.find(e =>
              e.semester === semester &&
              e.section.toUpperCase() === section.toUpperCase() &&
              e.day.toLowerCase() === (updated.day || "").toLowerCase() &&
              e.slot === updated.slot &&
              (e.course === updated.course || e.course.replace(/\s+/g, "") === (updated.course || "").replace(/\s+/g, ""))
            );
            if (matchInDept && matchInDept.room && matchInDept.room !== "TBA") {
              updated.room = matchInDept.room;
            }
          }

          return updated;
        });

        if (needsUpgrade) {
          localStorage.setItem(key, JSON.stringify(upgraded));
          return upgraded;
        }

        return parsed;
      }
    }
  } catch (e) {
    console.error("Cache read error:", e);
  }
  return null;
}

export function saveStoredSectionRoutine(semester: number, section: string, entries: ClassEntry[]) {
  try {
    const key = getSectionCacheKey(semester, section);
    localStorage.setItem(key, JSON.stringify(entries));
    localStorage.setItem(`${key}-timestamp`, String(Date.now()));

    // Also update the global routine cache for cross-sectional components without mixing
    const globalRaw = localStorage.getItem("cached-routine");
    const existing: ClassEntry[] = globalRaw ? JSON.parse(globalRaw) : [];
    const others = existing.filter(e => !(e.semester === semester && e.section.toUpperCase() === section.trim().toUpperCase()));
    const merged = [...others, ...entries];
    localStorage.setItem("cached-routine", JSON.stringify(merged));
  } catch (e) {
    console.error("Cache write error:", e);
  }
}

export async function fetchUniversityRoutine(
  semester: number,
  section: string,
  cookie?: string
): Promise<{ success: boolean; data: ClassEntry[]; error?: string }> {
  try {
    const sectionId = sectionToId(section);
    const headers: Record<string, string> = {};
    if (cookie) {
      headers["X-University-Cookie"] = cookie;
    }

    const response = await fetch(`/api/routine?semester_id=${semester}&section_id=${sectionId}`, {
      headers,
      cache: "no-store"
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        data: [],
        error: errorData.message || `HTTP ${response.status}`
      };
    }

    const html = await response.text();
    const entries = parseUniversityRoutineHtml(html, semester, section);
    return {
      success: true,
      data: entries
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Network request failed";
    return {
      success: false,
      data: [],
      error: message
    };
  }
}

export function getGoogleSheetCsvUrlByGid(baseUrl: string, gid: string): string {
  const sheetIdMatch = baseUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!sheetIdMatch) return baseUrl;
  const sheetId = sheetIdMatch[1];
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}&t=${Date.now()}`;
}

export function parseRoutineCsv(csvData: string, fallbackSemester: number = 1): ClassEntry[] {
  const parsed = Papa.parse(csvData, { skipEmptyLines: true }).data as string[][];
  let currentDay = "Sunday";
  const results: ClassEntry[] = [];
  if (!parsed || parsed.length === 0) return [];

  const headers = parsed[0];
  const slots: number[] = [];
  
  for (let i = 1; i < headers.length; i++) {
    if (!headers[i]) continue;
    const match = headers[i].match(/Slot (\d+)/i);
    if (match) slots[i] = parseInt(match[1], 10);
  }

  for (let r = 1; r < parsed.length; r++) {
    const row = parsed[r];
    const dayCol = row[0]?.trim();
    if (dayCol) {
      // Normalize day name capitalization
      currentDay = dayCol.charAt(0).toUpperCase() + dayCol.slice(1).toLowerCase();
    }

    for (let c = 1; c < row.length; c++) {
      const cell = row[c]?.trim();
      if (!cell) continue;

      const lines = cell.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length >= 2) {
        const teachers = lines[0].split(',').map(t => t.trim());
        const courseStr = lines[1];
        const match = courseStr.match(/(.*?)\s*\((.*?)\s*Sem\.?\s*(.*?)\s*Sec\)?/i);
        
        let course = courseStr, sem = fallbackSemester, sec = "A";
        if (match) {
          course = match[1].trim();
          sem = parseInt(match[2], 10) || fallbackSemester;
          sec = match[3].trim().toUpperCase();
        }

        let room = "TBA";
        if (lines.length >= 3) {
          const roomMatch = lines[2].match(/Room:\s*(.*)/i);
          if (roomMatch) room = roomMatch[1].trim();
          else room = lines[2].trim();
        }

        let entrySlot = slots[c] || c;

        // Apply updated Summer-2026 correction for 7th B Wednesday CSE 4108
        if (sem === 7 && sec === "B" && course === "CSE 4108" && currentDay === "Wednesday") {
          entrySlot = 2;
          teachers.length = 0;
          teachers.push("S.M. Mahadi Hasan", "Asim Moin Saad");
          room = "131 MIL";
        }

        const timing = UNIVERSITY_SLOT_TIMES[entrySlot] || { start: "09:00 AM", end: "10:15 AM", slotTime: "09:00 AM - 10:15 AM" };
        results.push({
          day: currentDay,
          slot: entrySlot,
          startTime: timing.start,
          endTime: timing.end,
          slotTime: timing.slotTime,
          teachers,
          course,
          semester: sem,
          section: sec,
          room
        });
      }
    }
  }
  return results;
}

export function normalizeBangladeshiPhone(phone: string): string {
  if (!phone) return "";
  // Strip spaces, dashes, parentheses
  const cleaned = phone.trim().replace(/[\s\-()]/g, "");
  
  if (cleaned.startsWith("+880")) {
    const main = cleaned.slice(4);
    if (main.startsWith("1") && main.length === 10) {
      return cleaned;
    }
  } else if (cleaned.startsWith("880")) {
    const main = cleaned.slice(3);
    if (main.startsWith("1") && main.length === 10) {
      return "+880" + main;
    }
  } else if (cleaned.startsWith("1") && cleaned.length === 10) {
    return "0" + cleaned;
  } else if (cleaned.startsWith("01") && cleaned.length === 11) {
    return cleaned;
  } else if (/^[1-9]\d{9}$/.test(cleaned) && cleaned.startsWith("1")) {
    return "0" + cleaned;
  }
  return cleaned;
}

export function parseTeacherCsv(csvData: string): Teacher[] {
  const parsed = Papa.parse(csvData, { skipEmptyLines: true }).data as string[][];
  const teachers: Teacher[] = [];

  const getInitials = (nameStr: string): string => {
    if (!nameStr) return "";
    const cleaned = nameStr
      .replace(/^(Prof\.|Dr\.|Mr\.|Mrs\.|Ms\.|Md\.)/g, "")
      .replace(/[^a-zA-Z\s]/g, "")
      .trim();
    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length === 1 && parts[0].length <= 3) return parts[0].toUpperCase();
    return parts.map(p => p[0]).join("").toUpperCase();
  };
  
  for (let i = 2; i < parsed.length; i++) {
    const row = parsed[i];
    if (!row) continue;

    // 1. Main teacher table: Name is row[2], Designation is row[3], Email is row[4], Phone is row[5]
    if (row[2] && row[2].trim() && row[2] !== "Name" && row[2] !== "Sl") {
      const name = row[2].trim().replace(/\s*\(cse\)/i, "").trim();
      const designation = row[3]?.trim() || "";
      const email = row[4]?.trim() || "";
      const phone = normalizeBangladeshiPhone(row[5]?.trim() || "");
      
      teachers.push({
        initials: getInitials(name),
        name,
        designation,
        department: "CSE",
        phone,
        email,
        officeRoom: ""
      });
    }
    
    // 2. Routine committee table: Initial is row[11], Name is row[12], Phone is row[13]
    if (row[11] && row[11].trim() && row[11] !== "Teacher's Initial" && row[12] && row[12].trim()) {
      const initials = row[11].trim();
      const name = row[12].trim().replace(/\s*\(cse\)/i, "").trim();
      const phone = normalizeBangladeshiPhone(row[13]?.trim() || "");
      
      teachers.push({
        initials,
        name,
        designation: "Routine Committee",
        department: "CSE",
        phone,
        email: "",
        officeRoom: ""
      });
    }
  }

  // De-duplicate by normalized name
  const uniqueTeachers: Record<string, Teacher> = {};
  for (const t of teachers) {
    const key = (t.name || '').toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!uniqueTeachers[key]) {
      uniqueTeachers[key] = t;
    } else {
      uniqueTeachers[key] = {
        ...uniqueTeachers[key],
        initials: t.initials || uniqueTeachers[key].initials,
        designation: (uniqueTeachers[key].designation === "Routine Committee" || !uniqueTeachers[key].designation) ? t.designation : uniqueTeachers[key].designation,
        phone: t.phone || uniqueTeachers[key].phone,
        email: t.email || uniqueTeachers[key].email,
      };
    }
  }

  return Object.values(uniqueTeachers);
}
