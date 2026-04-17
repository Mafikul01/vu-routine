import { DAYS } from "@/data/routineData";

interface DayPickerProps {
  selectedDay: string;
  onSelectDay: (day: string) => void;
  freeDays?: string[];
}

export function DayPicker({ selectedDay, onSelectDay, freeDays = [] }: DayPickerProps) {
  // Compute dates for the current week starting roughly around today
  const today = new Date();
  const getWeekDates = () => {
    const dates: Record<string, string> = {};
    DAYS.forEach(dayStr => {
      // Find the closest upcoming or current matching day
      const targetDate = new Date(today.getTime());
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const targetDayOfWeek = dayNames.indexOf(dayStr);
      const currentDayOfWeek = today.getDay();
      
      const distance = targetDayOfWeek - currentDayOfWeek;
      // If we want to always show the upcoming days rather than strictly this Sunday-Saturday week:
      // if distance is less than -1 (e.g. it's wednesday and target is monday), wrap around to next week. (Optional)
      // Actually, standard is to show just the dates of the current week (Sunday to Thursday).
      // So distance from today to target day:
      const diff = today.getDate() + distance;
      targetDate.setDate(diff);
      
      const dayNum = targetDate.getDate();
      const monthPrefix = targetDate.toLocaleString('default', { month: 'short' });
      dates[dayStr] = `${dayNum} ${monthPrefix}`;
    });
    return dates;
  };

  const datesMap = getWeekDates();

  return (
    <div className="grid grid-cols-7 gap-1 pb-1">
      {DAYS.map(day => {
        const isSelected = selectedDay === day;
        const isFree = freeDays.includes(day);
        
        return (
          <button
            key={day}
            onClick={() => onSelectDay(day)}
            className={`flex flex-col items-center justify-center rounded-lg py-2 transition-all ${
              isSelected
                ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                : isFree
                ? "bg-green-500/10 text-green-600 border border-green-200 dark:bg-green-900/20 dark:border-green-900/30"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent"
            }`}
          >
            <span className="text-[10px] font-bold md:text-xs">{day.slice(0, 3)}</span>
            <span className={`text-[8px] md:text-[10px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
              {datesMap[day]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
