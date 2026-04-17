import Papa from 'papaparse';
import { ClassEntry } from "@/data/routineData";
import { Teacher } from "@/types";

export function getGoogleSheetCsvUrlByGid(baseUrl: string, gid: string): string {
  const sheetIdMatch = baseUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!sheetIdMatch) return baseUrl;
  const sheetId = sheetIdMatch[1];
  return `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
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

export function parseTeacherCsv(csvData: string): Teacher[] {
  const parsed = Papa.parse(csvData, { skipEmptyLines: true }).data as string[][];
  const teachers: Teacher[] = [];
  
  for(let i = 2; i < parsed.length; i++){
    const row = parsed[i];
    if (row[2] && row[2].trim()) {
      teachers.push({
        initials: row[1]?.trim() || "",
        name: row[2]?.trim(),
        designation: row[3]?.trim() || "",
        department: row[4]?.trim() || "CSE",
        phone: row[6]?.trim() || "",
        email: row[7]?.trim() || "",
        officeRoom: ""
      });
    }
    
    // Sometimes there are additional teachers in columns 11 and 12
    if (row[11] && row[11].trim() && row[12] && row[12].trim()) {
      teachers.push({
        initials: row[10]?.trim() || "",
        name: row[12]?.trim() || row[11]?.trim(),
        designation: "",
        department: "CSE",
        phone: row[13]?.trim() || "",
        email: "",
        officeRoom: ""
      });
    }
  }
  return teachers;
}
