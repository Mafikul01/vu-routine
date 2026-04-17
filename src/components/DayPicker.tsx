import { DAYS } from "@/data/routineData";

interface DayPickerProps {
  selectedDay: string;
  onSelectDay: (day: string) => void;
}

export function DayPicker({ selectedDay, onSelectDay }: DayPickerProps) {
  // Compute dates for the current week starting roughly around today
  const today = new Date();
  const getWeekDates = () => {
    const dates: Record<string, string> = {};
    DAYS.forEach(dayStr => {
      // Find the closest upcoming or current matching day
      let targetDate = new Date(today.getTime());
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const targetDayOfWeek = dayNames.indexOf(dayStr);
      const currentDayOfWeek = today.getDay();
      
      let distance = targetDayOfWeek - currentDayOfWeek;
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
    <div className="flex gap-1.5 overflow-x-auto pb-1">
      {DAYS.map(day => (
        <button
          key={day}
          onClick={() => onSelectDay(day)}
          className={`shrink-0 rounded-lg px-4 py-2 flex flex-col items-center justify-center transition-all ${
            selectedDay === day
              ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent"
          }`}
        >
          <span className="text-sm font-bold">{day.slice(0, 3)}</span>
          <span className={`text-[10px] ${selectedDay === day ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
            {datesMap[day]}
          </span>
        </button>
      ))}
    </div>
  );
}
