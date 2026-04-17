export interface ClassSession {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
  subject: string;
  teacher: string;
  room: string;
  section?: string;
  batch?: string;
  courseCode?: string;
  semester?: string;
}

export interface Teacher {
  name: string;
  initials?: string;
  designation?: string;
  department?: string;
  phone?: string;
  email?: string;
  officeRoom?: string;
}

export interface Course {
  code: string;
  name: string;
  credit?: number;
}

export interface UserConfig {
  role: 'student' | 'teacher';
  semester?: string;
  section?: string;
  teacherName?: string;
  theme?: 'light' | 'dark';
  syncUrls?: string[];
}

export interface RoutineData {
  sessions: ClassSession[];
  teachers: Teacher[];
  semesters: string[];
  sections: string[];
  courses: Course[];
}
