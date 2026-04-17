import { DAYS } from "@/data/routineData";

interface DayPickerProps {
  selectedDay: string;
  onSelectDay: (day: string) => void;
}

export function DayPicker({ selectedDay, onSelectDay }: DayPickerProps) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {DAYS.map(day => (
        <button
          key={day}
          onClick={() => onSelectDay(day)}
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
            selectedDay === day
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          }`}
        >
          {day.slice(0, 3)}
        </button>
      ))}
    </div>
  );
}
