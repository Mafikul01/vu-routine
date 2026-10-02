export interface ClassEntry {
  day: string;
  slot: number;
  startTime?: string;
  endTime?: string;
  slotTime?: string;
  teachers: string[];
  course: string;
  courseName?: string;
  semester: number;
  section: string;
  room: string;
  colspan?: number;
  dataId?: string;
  isConsecutive?: boolean;
  combinedGroup?: string;
}

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export const SLOTS = [
  { slot: 1, start: "09:00 AM", end: "10:15 AM" },
  { slot: 2, start: "10:15 AM", end: "11:30 AM" },
  { slot: 3, start: "11:30 AM", end: "12:45 PM" },
  { slot: 4, start: "01:15 PM", end: "02:30 PM" },
  { slot: 5, start: "02:30 PM", end: "03:45 PM" },
  { slot: 6, start: "03:45 PM", end: "05:00 PM" },
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
  // ================= SEMESTER 7 - SECTION B =================
  // Sunday
  {
    day: "Sunday",
    slot: 1,
    startTime: "09:00 AM",
    endTime: "10:15 AM",
    slotTime: "09:00 AM - 10:15 AM",
    teachers: ["Tahrima Sayem Sowa", "Syeda Tamanna Alam Monisha"],
    course: "CSE 4122",
    courseName: "Technical Report Writing",
    semester: 7,
    section: "B",
    room: "128 BCL"
  },
  {
    day: "Sunday",
    slot: 2,
    startTime: "10:15 AM",
    endTime: "11:30 AM",
    slotTime: "10:15 AM - 11:30 AM",
    teachers: ["Md. Taufiq Khan"],
    course: "CSE 4103",
    courseName: "Digital Image Processing",
    semester: 7,
    section: "B",
    room: "511"
  },
  {
    day: "Sunday",
    slot: 4,
    startTime: "01:15 PM",
    endTime: "02:30 PM",
    slotTime: "01:15 PM - 02:30 PM",
    teachers: ["Md. Mahfujur Rahman"],
    course: "CSE 4101",
    courseName: "Artificial Intelligence",
    semester: 7,
    section: "B",
    room: "313"
  },
  {
    day: "Sunday",
    slot: 5,
    startTime: "02:30 PM",
    endTime: "03:45 PM",
    slotTime: "02:30 PM - 03:45 PM",
    teachers: ["Asim Moin Saad"],
    course: "CSE 4107",
    courseName: "Microcontroller, Computer Peripherals and Interfacing",
    semester: 7,
    section: "B",
    room: "413"
  },

  // Monday
  {
    day: "Monday",
    slot: 2,
    startTime: "10:15 AM",
    endTime: "12:45 PM",
    slotTime: "10:15 AM - 12:45 PM",
    colspan: 2,
    isConsecutive: true,
    teachers: ["Md. Mahfujur Rahman", "D. M. Asadujjaman"],
    course: "CSE 4102",
    courseName: "Artificial Intelligence Lab",
    semester: 7,
    section: "B",
    room: "128 BCL"
  },
  {
    day: "Monday",
    slot: 4,
    startTime: "01:15 PM",
    endTime: "02:30 PM",
    slotTime: "01:15 PM - 02:30 PM",
    teachers: ["Saiful Islam"],
    course: "ACC 4171",
    courseName: "Industrial Management and Accountancy",
    semester: 7,
    section: "B",
    room: "1008"
  },
  {
    day: "Monday",
    slot: 5,
    startTime: "02:30 PM",
    endTime: "03:45 PM",
    slotTime: "02:30 PM - 03:45 PM",
    teachers: ["Md. Mahfujur Rahman"],
    course: "CSE 4101",
    courseName: "Artificial Intelligence",
    semester: 7,
    section: "B",
    room: "311"
  },

  // Tuesday
  {
    day: "Tuesday",
    slot: 1,
    startTime: "09:00 AM",
    endTime: "10:15 AM",
    slotTime: "09:00 AM - 10:15 AM",
    teachers: ["Syeda Tamanna Alam Monisha"],
    course: "CSE 4105",
    courseName: "Engineering Ethics and Environmental Protection",
    semester: 7,
    section: "B",
    room: "508"
  },
  {
    day: "Tuesday",
    slot: 2,
    startTime: "10:15 AM",
    endTime: "11:30 AM",
    slotTime: "10:15 AM - 11:30 AM",
    teachers: ["Asim Moin Saad"],
    course: "CSE 4107",
    courseName: "Microcontroller, Computer Peripherals and Interfacing",
    semester: 7,
    section: "B",
    room: "508"
  },
  {
    day: "Tuesday",
    slot: 3,
    startTime: "11:30 AM",
    endTime: "12:45 PM",
    slotTime: "11:30 AM - 12:45 PM",
    teachers: ["Saiful Islam"],
    course: "ACC 4171",
    courseName: "Industrial Management and Accountancy",
    semester: 7,
    section: "B",
    room: "1011"
  },
  {
    day: "Tuesday",
    slot: 4,
    startTime: "01:15 PM",
    endTime: "03:45 PM",
    slotTime: "01:15 PM - 03:45 PM",
    colspan: 2,
    isConsecutive: true,
    teachers: ["Md. Taufiq Khan", "Humayra Tasnim"],
    course: "CSE 4104",
    courseName: "Digital Image Processing Lab",
    semester: 7,
    section: "B",
    room: "128 BCL"
  },

  // Wednesday
  {
    day: "Wednesday",
    slot: 1,
    startTime: "09:00 AM",
    endTime: "10:15 AM",
    slotTime: "09:00 AM - 10:15 AM",
    teachers: ["Md. Taufiq Khan"],
    course: "CSE 4103",
    courseName: "Digital Image Processing",
    semester: 7,
    section: "B",
    room: "311"
  },
  {
    day: "Wednesday",
    slot: 2,
    startTime: "10:15 AM",
    endTime: "11:30 AM",
    slotTime: "10:15 AM - 11:30 AM",
    teachers: ["S.M. Mahadi Hasan", "Asim Moin Saad"],
    course: "CSE 4108",
    courseName: "Microcontroller Lab",
    semester: 7,
    section: "B",
    room: "131 MIL"
  },
  {
    day: "Wednesday",
    slot: 4,
    startTime: "01:15 PM",
    endTime: "02:30 PM",
    slotTime: "01:15 PM - 02:30 PM",
    teachers: ["Syeda Tamanna Alam Monisha"],
    course: "CSE 4105",
    courseName: "Engineering Ethics and Environmental Protection",
    semester: 7,
    section: "B",
    room: "1008"
  },

  // ================= SEMESTER 7 - SECTION A =================
  // Sunday
  {
    day: "Sunday",
    slot: 3,
    startTime: "11:30 AM",
    endTime: "12:45 PM",
    slotTime: "11:30 AM - 12:45 PM",
    teachers: ["Saiful Islam"],
    course: "ACC 4171",
    courseName: "Industrial Management and Accountancy",
    semester: 7,
    section: "A",
    room: "408"
  },
  {
    day: "Sunday",
    slot: 4,
    startTime: "01:15 PM",
    endTime: "02:30 PM",
    slotTime: "01:15 PM - 02:30 PM",
    teachers: ["Sajeeb Kumar Ray", "Syeda Tamanna Alam Monisha"],
    course: "CSE 4122",
    courseName: "Technical Report Writing",
    semester: 7,
    section: "A",
    room: "106 DSAL"
  },

  // Monday
  {
    day: "Monday",
    slot: 2,
    startTime: "10:15 AM",
    endTime: "12:45 PM",
    slotTime: "10:15 AM - 12:45 PM",
    colspan: 2,
    isConsecutive: true,
    teachers: ["Md. Mahfujur Rahman", "D. M. Asadujjaman"],
    course: "CSE 4102",
    courseName: "Artificial Intelligence Lab",
    semester: 7,
    section: "A",
    room: "128 BCL"
  },
  {
    day: "Monday",
    slot: 5,
    startTime: "02:30 PM",
    endTime: "03:45 PM",
    slotTime: "02:30 PM - 03:45 PM",
    teachers: ["Syeda Tamanna Alam Monisha"],
    course: "CSE 4105",
    courseName: "Engineering Ethics and Environmental Protection",
    semester: 7,
    section: "A",
    room: "314"
  },
  {
    day: "Monday",
    slot: 6,
    startTime: "03:45 PM",
    endTime: "05:00 PM",
    slotTime: "03:45 PM - 05:00 PM",
    teachers: ["Zannatul Mifta", "Mohd Ruhul Ameen"],
    course: "CSE 4108",
    courseName: "Microcontroller Lab",
    semester: 7,
    section: "A",
    room: "131 MIL"
  },

  // Tuesday
  {
    day: "Tuesday",
    slot: 1,
    startTime: "09:00 AM",
    endTime: "11:30 AM",
    slotTime: "09:00 AM - 11:30 AM",
    colspan: 2,
    isConsecutive: true,
    teachers: ["Ipshita Tasnim Raha", "Zuairia Raisa Bintay Makin"],
    course: "CSE 4104",
    courseName: "Digital Image Processing Lab",
    semester: 7,
    section: "A",
    room: "103 DMSL"
  },
  {
    day: "Tuesday",
    slot: 3,
    startTime: "11:30 AM",
    endTime: "12:45 PM",
    slotTime: "11:30 AM - 12:45 PM",
    teachers: ["Syeda Tamanna Alam Monisha"],
    course: "CSE 4105",
    courseName: "Engineering Ethics and Environmental Protection",
    semester: 7,
    section: "A",
    room: "313"
  },
  {
    day: "Tuesday",
    slot: 4,
    startTime: "01:15 PM",
    endTime: "02:30 PM",
    slotTime: "01:15 PM - 02:30 PM",
    teachers: ["Saiful Islam"],
    course: "ACC 4171",
    courseName: "Industrial Management and Accountancy",
    semester: 7,
    section: "A",
    room: "1013"
  },

  // Wednesday
  {
    day: "Wednesday",
    slot: 4,
    startTime: "01:15 PM",
    endTime: "02:30 PM",
    slotTime: "01:15 PM - 02:30 PM",
    teachers: ["Zuairia Raisa Bintay Makin"],
    course: "CSE 4103",
    courseName: "Digital Image Processing",
    semester: 7,
    section: "A",
    room: "414"
  },
  {
    day: "Wednesday",
    slot: 5,
    startTime: "02:30 PM",
    endTime: "03:45 PM",
    slotTime: "02:30 PM - 03:45 PM",
    teachers: ["Md. Mahfujur Rahman"],
    course: "CSE 4101",
    courseName: "Artificial Intelligence",
    semester: 7,
    section: "A",
    room: "414"
  },
  {
    day: "Wednesday",
    slot: 6,
    startTime: "03:45 PM",
    endTime: "05:00 PM",
    slotTime: "03:45 PM - 05:00 PM",
    teachers: ["Dr. Md. Johirul Islam"],
    course: "CSE 4107",
    courseName: "Microcontroller, Computer Peripherals and Interfacing",
    semester: 7,
    section: "A",
    room: "913"
  },

  // Thursday
  {
    day: "Thursday",
    slot: 3,
    startTime: "11:30 AM",
    endTime: "12:45 PM",
    slotTime: "11:30 AM - 12:45 PM",
    teachers: ["Zuairia Raisa Bintay Makin"],
    course: "CSE 4103",
    courseName: "Digital Image Processing",
    semester: 7,
    section: "A",
    room: "313"
  },
  {
    day: "Thursday",
    slot: 4,
    startTime: "01:15 PM",
    endTime: "02:30 PM",
    slotTime: "01:15 PM - 02:30 PM",
    teachers: ["Md. Mahfujur Rahman"],
    course: "CSE 4101",
    courseName: "Artificial Intelligence",
    semester: 7,
    section: "A",
    room: "411"
  },
  {
    day: "Thursday",
    slot: 6,
    startTime: "03:45 PM",
    endTime: "05:00 PM",
    slotTime: "03:45 PM - 05:00 PM",
    teachers: ["Dr. Md. Johirul Islam"],
    course: "CSE 4107",
    courseName: "Microcontroller, Computer Peripherals and Interfacing",
    semester: 7,
    section: "A",
    room: "408"
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
