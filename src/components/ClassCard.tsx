import { ClassEntry, SLOTS, cleanTeacherName, normalizeTeacherName } from "@/data/routineData";
import { COURSE_NAMES } from "@/constants";
import { Teacher } from "@/types";
import { ChevronRight } from "lucide-react";

const slotColors: Record<number, string> = {
  1: "border-l-slot-1 bg-slot-1/5",
  2: "border-l-slot-2 bg-slot-2/5",
  3: "border-l-slot-3 bg-slot-3/5",
  4: "border-l-slot-4 bg-slot-4/5",
  5: "border-l-slot-5 bg-slot-5/5",
  6: "border-l-slot-6 bg-slot-6/5",
};

interface ClassCardProps {
  entry: ClassEntry;
  showSection?: boolean;
  teacherInfo?: Teacher[];
}

export function ClassCard({ entry, showSection = false, teacherInfo = [] }: ClassCardProps) {
  const slotInfo = SLOTS.find(s => s.slot === entry.slot);
  const displayStartTime = entry.startTime || slotInfo?.start;
  const displayEndTime = entry.endTime || slotInfo?.end;
  const timeText = entry.slotTime || (displayStartTime && displayEndTime ? `${displayStartTime} - ${displayEndTime}` : displayStartTime || displayEndTime || `Slot ${entry.slot}`);

  const getOrdinal = (n: number) => {
    if (n === 1) return "1st";
    if (n === 2) return "2nd";
    if (n === 3) return "3rd";
    return `${n}th`;
  };

  const getTeacherDisplayName = (name: string) => {
    const cleaned = cleanTeacherName(name);
    if (!teacherInfo || teacherInfo.length === 0) return cleaned;
    const normName = normalizeTeacherName(cleaned);
    const matched = teacherInfo.find(t => {
      const normTName = normalizeTeacherName(t.name);
      const normTInitials = normalizeTeacherName(t.initials || "");
      return normTName.includes(normName) || normName.includes(normTName) || (normTInitials && normTInitials === normName);
    });
    return matched ? cleanTeacherName(matched.name) : cleaned;
  };

  const courseFullName = entry.courseName || COURSE_NAMES[entry.course] || "";

  // Strictly filter out course code, course full name, and any semester/section/batch labels from teacher list
  const isNonTeacherString = (str: string): boolean => {
    if (!str || typeof str !== "string") return true;
    const trimmed = str.trim();
    if (trimmed === "" || trimmed === "TBA") return true;

    // Exclude if it equals course code
    if (trimmed.toLowerCase() === entry.course.toLowerCase()) return true;

    // Exclude if it equals course full name
    if (courseFullName && trimmed.toLowerCase() === courseFullName.toLowerCase()) return true;

    // Exclude ANY semester, batch, or section string (e.g. "33rd - 7th B", "33rd - 7th", "7th B", "7th - B", "7th(B)", "7th Sem", "7th Semester", "Section A", "33rd", "Batch 33")
    if (/^\d+(?:st|nd|rd|th)?\s*[-\/]?\s*\d*(?:st|nd|rd|th)?\s*\(?[A-Za-z0-9]?\)?$/i.test(trimmed)) return true;
    if (/\b\d+(?:st|nd|rd|th)\b/i.test(trimmed)) return true;
    if (/\b(Section|Semester|Sem|Batch)\b/i.test(trimmed)) return true;
    if (/^\d+[A-Za-z]$/i.test(trimmed)) return true;
    if (/^[A-Za-z]\s*\(\d+(?:st|nd|rd|th)\)/i.test(trimmed)) return true;

    // Exclude generic course title keywords
    if (/^(Digital Image Processing|Artificial Intelligence|Computer Networks|Microcontroller|Technical Report Writing|Theory|Lab\b|Engineering|Management|Accounting|Database|Software|Operating)/i.test(trimmed)) return true;

    return false;
  };

  const validTeachers = (Array.isArray(entry.teachers) ? entry.teachers : [entry.teachers])
    .filter(name => !isNonTeacherString(name));

  const displayTeachersList = validTeachers.length > 0
    ? validTeachers.filter((t, i, arr) => arr.indexOf(t) === i)
    : ["Faculty Member"];
  
  return (
    <div
      className={`group rounded-xl border-l-4 p-4 ${slotColors[entry.slot] || "bg-card border-l-gray-300"} animate-fade-in shadow-sm hover:shadow-md transition-all`}
    >
      <div className="flex items-stretch justify-between gap-3 min-h-[72px]">
        <div className="min-w-0 flex-1 flex flex-col items-start gap-1.5 justify-between">
          <div className="flex items-center flex-wrap gap-1.5">
            <span className="text-xs font-bold text-foreground items-center gap-1.5 flex bg-primary/5 px-2 py-0.5 rounded-md text-primary">
              {timeText}
            </span>
            {entry.colspan && entry.colspan > 1 && (
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                {entry.colspan} Slots
              </span>
            )}
            {entry.combinedGroup && (
              <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                {entry.combinedGroup}
              </span>
            )}
          </div>
          <h3 className="font-heading font-bold text-base leading-tight text-foreground flex items-center flex-wrap gap-2">
            <span>{entry.course}</span>
            {showSection && (
              <span className="text-[10px] font-bold text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                {getOrdinal(Number(entry.semester))} - {entry.section}
              </span>
            )}
            {entry.semester && !showSection && (
              <span className="text-[11px] font-bold text-muted-foreground bg-secondary/80 px-1.5 py-0.5 rounded uppercase tracking-wider">
                {getOrdinal(Number(entry.semester))} Sem
              </span>
            )}
          </h3>
          {(entry.courseName || COURSE_NAMES[entry.course]) && (
            <p className="text-xs text-muted-foreground/90 font-medium italic">
              {entry.courseName || COURSE_NAMES[entry.course]}
            </p>
          )}
          <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1 mt-0.5 truncate">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
            <span className="truncate">
              {displayTeachersList.map(t => getTeacherDisplayName(t)).join(", ")}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end justify-between shrink-0 self-stretch">
          <span className="shrink-0 rounded-lg bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground uppercase">
            {entry.room}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold text-primary/70 group-hover:text-primary transition-colors bg-primary/5 group-hover:bg-primary/10 px-2 py-0.5 rounded-md border border-primary/10">
            <span>Details</span>
            <ChevronRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </div>
  );
}
