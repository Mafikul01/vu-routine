import { DAYS } from "@/data/routineData";
import { useMemo } from "react";

interface DayPickerProps {
  selectedDay: string;
  onSelectDay: (day: string) => void;
  freeDays?: string[];
}

export function DayPicker({ selectedDay, onSelectDay, freeDays = [] }: DayPickerProps) {
  // Compute dates for the current week starting roughly around today
  const datesMap = useMemo(() => {
    const today = new Date();
    const dates: Record<string, string> = {};
    DAYS.forEach(dayStr => {
      // Find the closest upcoming or current matching day
      const targetDate = new Date(today.getTime());
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const targetDayOfWeek = dayNames.indexOf(dayStr);
      const currentDayOfWeek = today.getDay();
      
      const distance = targetDayOfWeek - currentDayOfWeek;
      const diff = today.getDate() + distance;
      targetDate.setDate(diff);
      
      const dayNum = targetDate.getDate();
      const monthPrefix = targetDate.toLocaleString('default', { month: 'short' });
      dates[dayStr] = `${dayNum} ${monthPrefix}`;
    });
    return dates;
  }, []);

  return (
    <div className="grid grid-cols-7 gap-1 pb-1">
      {DAYS.map(day => {
        const isSelected = selectedDay === day;
        const isFree = freeDays.includes(day);
        
        return (
          <button
            key={day}
            onClick={() => onSelectDay(day)}
            className={`flex flex-col items-center justify-center rounded-lg py-1.5 transition-all active:scale-90 ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                : isFree
                ? "bg-green-500/10 text-green-600 border border-green-200 dark:bg-green-900/20 dark:border-green-900/30"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent"
            }`}
          >
            <span className="text-[13px] font-bold leading-tight md:text-[15px]">{day.slice(0, 3)}</span>
            <span className={`text-[10.5px] leading-tight md:text-[12px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {datesMap[day]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
