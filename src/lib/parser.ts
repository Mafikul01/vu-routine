import Papa from 'papaparse';
import { ClassEntry } from "@/data/routineData";
import { Teacher } from "@/types";

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

        results.push({
          day: currentDay,
          slot: slots[c] || c,
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
    const key = t.name.toLowerCase().replace(/[^a-z0-9]/g, "");
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
