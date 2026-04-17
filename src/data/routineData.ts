export interface ClassEntry {
  day: string;
  slot: number;
  startTime?: string;
  endTime?: string;
  slotTime?: string;
  teachers: string[];
  course: string;
  semester: number;
  section: string;
  room: string;
}

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday"] as const;

export const SLOTS = [
  { slot: 1, start: "09:00 AM", end: "10:00 AM" },
  { slot: 2, start: "10:05 AM", end: "11:05 AM" },
  { slot: 3, start: "11:10 AM", end: "12:10 PM" },
  { slot: 4, start: "12:15 PM", end: "01:15 PM" },
  { slot: 5, start: "01:50 PM", end: "02:50 PM" },
  { slot: 6, start: "02:55 PM", end: "03:55 PM" },
] as const;

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

export const SEMESTER_SECTIONS: Record<number, string[]> = {
  1: ["A", "B", "C"],
  2: ["A", "B", "C", "D", "E", "F", "G"],
  3: ["A", "B", "C"],
  4: ["A", "B", "C", "D", "E", "F", "G"],
  5: ["A", "B", "C", "D"],
  6: ["A", "B", "C", "D", "E", "F"],
  7: ["A", "B"],
  8: ["A", "B", "C", "D", "E", "F"],
  9: ["A", "B"],
};

export const routineData: ClassEntry[] = [];

export function getTeacherList(data: ClassEntry[] = routineData): string[] {
  const teachers = new Set<string>();
  data.forEach(entry => {
    entry.teachers.forEach(t => teachers.add(t));
  });
  return Array.from(teachers).sort();
}

export function getTodayName(): string {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return days[new Date().getDay()];
}

export function getClassesForStudent(day: string, semester: number, section: string, data: ClassEntry[] = routineData): ClassEntry[] {
  return data
    .filter(e => e.day === day && e.semester === semester && e.section.split(',').map(s => s.trim().toUpperCase()).includes(section.toUpperCase()))
    .sort((a, b) => a.slot - b.slot);
}

export function normalizeTeacherName(name: string): string {
  if (!name) return "";
  const normalized = name.toLowerCase()
    .replace(/^md\.?\s+/g, "") // Remove 'Md ' or 'Md. ' from the beginning
    .replace(/\s+cse$/g, "") // Remove ' CSE' from the end
    .replace(/\s+dept\.?$/g, "") // Remove ' Dept' or ' Dept.'
    .replace(/[^a-z0-9 ]/g, "") // Remove non-alphanumeric chars (except spaces)
    .trim();
  return normalized;
}

export function getClassesForTeacher(day: string, teacherName: string, data: ClassEntry[] = routineData): ClassEntry[] {
  const normalizedSearch = normalizeTeacherName(teacherName);
  return data
    .filter(e => e.day === day && e.teachers.some(t => normalizeTeacherName(t).includes(normalizedSearch) || normalizedSearch.includes(normalizeTeacherName(t))))
    .sort((a, b) => a.slot - b.slot);
}
