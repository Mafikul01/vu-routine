import { ClassEntry, SLOTS, cleanTeacherName, normalizeTeacherName } from "@/data/routineData";
import { COURSE_NAMES } from "@/constants";
import { Teacher } from "@/types";

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
  const displayStartTime = entry.startTime || entry.slotTime || slotInfo?.start;
  const displayEndTime = entry.endTime || slotInfo?.end;

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
  
  return (
    <div
      className={`rounded-lg border-l-4 p-4 ${slotColors[entry.slot] || "bg-card border-l-gray-300"} animate-fade-in shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1 flex flex-col items-start gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-foreground items-center gap-1.5 flex bg-primary/5 px-2 py-0.5 rounded-md text-primary">
              {displayStartTime} - {displayEndTime}
            </span>
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
          {COURSE_NAMES[entry.course] && (
            <p className="text-xs text-muted-foreground/90 font-medium italic">
              {COURSE_NAMES[entry.course]}
            </p>
          )}
          <p className="text-xs text-muted-foreground font-semibold flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
            {entry.teachers.map(t => getTeacherDisplayName(t)).join(", ")}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className="shrink-0 rounded-md bg-secondary px-2.5 py-1 text-xs font-bold text-secondary-foreground uppercase">
            {entry.room}
          </span>
        </div>
      </div>
    </div>
  );
}
