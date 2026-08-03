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

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const SLOTS = [
  { slot: 1, start: "09:00 AM", end: "10:05 AM" },
  { slot: 2, start: "10:05 AM", end: "11:10 AM" },
  { slot: 3, start: "11:10 AM", end: "12:15 PM" },
  { slot: 4, start: "12:15 PM", end: "01:20 PM" },
  { slot: 5, start: "01:50 PM", end: "02:55 PM" },
  { slot: 6, start: "02:55 PM", end: "04:00 PM" },
] as const;

export const SEMESTERS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export const SEMESTER_SECTIONS: Record<number, string[]> = {
  1: ["A", "B", "C", "D", "E", "F"],
  2: ["A", "B", "C", "D", "E", "F", "G"],
  3: ["A", "B", "C", "D", "E", "F"],
  4: ["A", "B", "C", "D", "E", "F", "G"],
  5: ["A", "B", "C", "D", "E", "F"],
  6: ["A", "B", "C", "D", "E", "F"],
  7: ["A", "B", "C", "D", "E", "F"],
  8: ["A", "B", "C", "D", "E", "F"],
};

export const routineData: ClassEntry[] = [
  // Sunday
  {
    day: "Sunday",
    slot: 1,
    teachers: ["Tahrima Sayem Sowa", "Syeda Tamanna Alam Monisha"],
    course: "CSE 4122",
    semester: 7,
    section: "B",
    room: "128 BCL"
  },
  {
    day: "Sunday",
    slot: 2,
    teachers: ["Md. Taufiq Khan"],
    course: "CSE 4103",
    semester: 7,
    section: "B",
    room: "511"
  },
  {
    day: "Sunday",
    slot: 4,
    teachers: ["Md. Mahfujur Rahman"],
    course: "CSE 4101",
    semester: 7,
    section: "B",
    room: "313"
  },
  {
    day: "Sunday",
    slot: 5,
    teachers: ["Asim Moin Saad"],
    course: "CSE 4107",
    semester: 7,
    section: "B",
    room: "413"
  },

  // Monday
  {
    day: "Monday",
    slot: 2,
    teachers: ["Md. Mahfujur Rahman", "D. M. Asadujjaman"],
    course: "CSE 4102",
    semester: 7,
    section: "B",
    room: "128 BCL"
  },
  {
    day: "Monday",
    slot: 4,
    teachers: ["BA New Teacher 1"],
    course: "ACC 4171",
    semester: 7,
    section: "B",
    room: "1008"
  },
  {
    day: "Monday",
    slot: 5,
    teachers: ["Md. Mahfujur Rahman"],
    course: "CSE 4101",
    semester: 7,
    section: "B",
    room: "311"
  },

  // Tuesday
  {
    day: "Tuesday",
    slot: 1,
    teachers: ["Syeda Tamanna Alam Monisha"],
    course: "CSE 4105",
    semester: 7,
    section: "B",
    room: "508"
  },
  {
    day: "Tuesday",
    slot: 2,
    teachers: ["Asim Moin Saad"],
    course: "CSE 4107",
    semester: 7,
    section: "B",
    room: "508"
  },
  {
    day: "Tuesday",
    slot: 3,
    teachers: ["BA New Teacher 1"],
    course: "ACC 4171",
    semester: 7,
    section: "B",
    room: "1011"
  },
  {
    day: "Tuesday",
    slot: 4,
    teachers: ["Md. Taufiq Khan", "Humayra Tasnim"],
    course: "CSE 4104",
    semester: 7,
    section: "B",
    room: "128 BCL"
  },

  // Wednesday
  {
    day: "Wednesday",
    slot: 1,
    teachers: ["Md. Taufiq Khan"],
    course: "CSE 4103",
    semester: 7,
    section: "B",
    room: "311"
  },
  {
    day: "Wednesday",
    slot: 2,
    teachers: ["S.M. Mahadi Hasan", "Asim Moin Saad"],
    course: "CSE 4108",
    semester: 7,
    section: "B",
    room: "131 MIL"
  },
  {
    day: "Wednesday",
    slot: 4,
    teachers: ["Syeda Tamanna Alam Monisha"],
    course: "CSE 4105",
    semester: 7,
    section: "B",
    room: "1008"
  }
];

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
    .replace(/^mrs\.?\s+/g, "") 
    .replace(/^mr\.?\s+/g, "")
    .replace(/^ms\.?\s+/g, "")
    .replace(/^dr\.?\s+/g, "")
    .replace(/\s*\(cse\)/g, "") // Remove (cse)
    .replace(/\s+cse$/g, "") 
    .replace(/\s+dept\.?$/g, "") 
    .replace(/[^a-z0-9 ]/g, "") 
    .trim();
  return normalized;
}

export function cleanTeacherName(name: string): string {
  if (!name) return "";
  
  // Custom mapping
  const mappings: Record<string, string> = {
    "Eco New teacher 3": "Faisal Aziz",
    "Eco New Teacher 3": "Faisal Aziz",
  };
  
  if (mappings[name]) return mappings[name];
  
  return name.replace(/\s*\(cse\)/i, "").trim();
}

export function getInitials(name: string): string {
  const normalized = normalizeTeacherName(name);
  if (!normalized) return "";
  const parts = normalized.split(/\s+/);
  if (parts.length === 1 && parts[0].length <= 3) return parts[0].toUpperCase(); // Already looks like initials
  return parts.map(p => p[0]).join("").toUpperCase();
}

export function getClassesForTeacher(day: string, teacherName: string, data: ClassEntry[] = routineData): ClassEntry[] {
  const normalizedSearch = normalizeTeacherName(teacherName);
  const searchInitials = teacherName.length <= 3 ? teacherName.toUpperCase() : null;
  
  return data
    .filter(e => e.day === day && e.teachers.some(t => {
      const normT = normalizeTeacherName(t);
      const initialsT = getInitials(t);
      
      return (
        normT.includes(normalizedSearch) || 
        normalizedSearch.includes(normT) ||
        (searchInitials && initialsT === searchInitials) ||
        (initialsT === normalizedSearch.toUpperCase())
      );
    }))
    .sort((a, b) => a.slot - b.slot);
}
