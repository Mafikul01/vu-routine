import { ClassEntry, SLOTS } from "@/data/routineData";

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
}

export function ClassCard({ entry, showSection = false }: ClassCardProps) {
  const slotInfo = SLOTS.find(s => s.slot === entry.slot);
  const displayStartTime = entry.startTime || entry.slotTime || slotInfo?.start;
  const displayEndTime = entry.endTime || slotInfo?.end;
  
  return (
    <div
      className={`rounded-lg border-l-4 p-4 ${slotColors[entry.slot] || "bg-card border-l-gray-300"} animate-fade-in shadow-sm hover:shadow-md transition-shadow`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-foreground items-center gap-1.5 flex bg-primary/5 px-2 py-0.5 rounded-md text-primary">
              {displayStartTime} - {displayEndTime}
            </span>
          </div>
          <h3 className="font-heading font-bold text-base leading-tight text-foreground mt-2">
            {entry.course}
            {showSection && (
              <span className="ml-2 text-xs font-normal text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded">
                Sec {entry.section}
              </span>
            )}
            {entry.semester && !showSection && (
              <span className="ml-2 text-xs font-normal text-muted-foreground uppercase">
                {entry.semester}th Sem
              </span>
            )}
          </h3>
          <p className="text-xs text-muted-foreground mt-2 font-medium">
            {entry.teachers.join(", ")}
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
