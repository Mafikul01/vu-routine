import { DAYS } from "@/data/routineData";
import { useState, useRef, useEffect } from "react";
import { Check } from "lucide-react";

interface DayPickerProps {
  selectedDay: string;
  onSelectDay: (day: string) => void;
  freeDays?: string[];
}

export function DayPicker({ selectedDay, onSelectDay, freeDays = [] }: DayPickerProps) {
  const [showUpcoming, setShowUpcoming] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const today = new Date();
  
  // Standard 7-day view logic
  const getWeekDates = () => {
    const dates: Record<string, { label: string, isToday: boolean, fullDate: Date }> = {};
    DAYS.forEach(dayStr => {
      const targetDate = new Date(today.getTime());
      const targetDayOfWeek = DAYS.indexOf(dayStr as typeof DAYS[number]);
      const currentDayOfWeek = today.getDay();
      
      let distance = targetDayOfWeek - currentDayOfWeek;
      
      // If today is Friday or Saturday, show next week's dates for Sunday-Thursday
      if ((currentDayOfWeek === 5 || currentDayOfWeek === 6) && targetDayOfWeek >= 0 && targetDayOfWeek <= 4) {
        distance += 7;
      }
      
      targetDate.setDate(today.getDate() + distance);
      
      const dayNum = targetDate.getDate();
      const monthPrefix = targetDate.toLocaleString('default', { month: 'short' });
      dates[dayStr] = { 
        label: `${dayNum} ${monthPrefix}`,
        isToday: distance === 0,
        fullDate: targetDate
      };
    });
    return dates;
  };

  const weekDatesMap = getWeekDates();

  // Upcoming dates logic (generate next 60 days)
  const getUpcomingDates = () => {
    const dates = [];
    for (let i = 0; i < 60; i++) {
      const date = new Date(today.getTime());
      date.setDate(today.getDate() + i);
      const dayStr = DAYS[date.getDay()];
      dates.push({
        dayStr,
        dayNum: date.getDate(),
        monthPrefix: date.toLocaleString('default', { month: 'short' }),
        fullDate: date,
        isToday: i === 0,
        id: `upcoming-${i}`
      });
    }
    return dates;
  };

  const upcomingDates = getUpcomingDates();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-end pr-1">
        <label className="flex items-center gap-1.5 cursor-pointer group">
          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center transition-colors ${showUpcoming ? 'bg-primary border-primary text-primary-foreground' : 'border border-muted-foreground/40 text-transparent group-hover:border-primary/50'}`}>
            <Check className="w-2.5 h-2.5" />
          </div>
          <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
            Upcoming
          </span>
          <input 
            type="checkbox" 
            className="hidden" 
            checked={showUpcoming}
            onChange={(e) => setShowUpcoming(e.target.checked)}
          />
        </label>
      </div>

      {!showUpcoming ? (
        <div className="grid grid-cols-7 gap-1 pb-1">
          {DAYS.map(day => {
            const isSelected = selectedDay === day;
            const isFree = freeDays.includes(day);
            const { label, isToday } = weekDatesMap[day];
            
            return (
              <button
                key={day}
                onClick={() => onSelectDay(day)}
                className={`relative flex flex-col items-center justify-center rounded-lg py-1.5 transition-all outline-none ${
                  isSelected
                    ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                    : isFree
                    ? "bg-green-500/10 text-green-600 border border-green-200 dark:bg-green-900/20 dark:border-green-900/30"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent"
                }`}
              >
                <span className="text-[13px] font-bold leading-tight md:text-[15px]">{day.slice(0, 3)}</span>
                <span className={`text-[10.5px] leading-tight md:text-[12px] truncate px-1 max-w-full ${isSelected ? "text-primary-foreground/80" : isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  {label}
                </span>
                {isToday && !isSelected && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-primary rounded-full translate-x-1/3 -translate-y-1/3 border border-background"></div>}
              </button>
            );
          })}
        </div>
      ) : (
        <div 
          ref={scrollRef}
          className="flex overflow-x-auto gap-1.5 pb-2 -mx-1 px-1 scrollbar-hide snap-x [&::-webkit-scrollbar]:hidden"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {upcomingDates.map(({ dayStr, dayNum, monthPrefix, isToday, id }, index) => {
            const isSelected = selectedDay === dayStr;
            // Highlight the exact selected date (assuming we just select by day name and pick the closest matching one for UX logic)
            // But since onSelectDay only passes 'Day', it might highlight multiple instances if they scroll far down.
            // Wait, if they select "Sunday", we only want to highlight the selected week's Sunday. For infinite scroll, maybe just highlight the first matching or let the caller update `selectedDay`. 
            // In a real app we'd pass exact Date to `onSelectDay`, but since we only have `dayStr`, we'll just highlight the selected day string.
            const isFree = freeDays.includes(dayStr);
            // Highlight selected if it's the closest to today that matches that day.
            // For now, let's just highlight all that match `selectedDay` to keep it simple with existing `selectedDay` string type.
            const matchesDayStr = selectedDay === dayStr;
            // Let's only highlight the FIRST matching selectedDay, to prevent all Sundays from lighting up!
            const isFirstMatch = upcomingDates.findIndex(d => d.dayStr === dayStr) === index;
            const highlightSelected = matchesDayStr && isFirstMatch;

            return (
              <button
                key={id}
                onClick={() => {
                  onSelectDay(dayStr);
                  // Optionally, scroll it slightly into view
                  const el = document.getElementById(id);
                  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                }}
                id={id}
                className={`snap-start shrink-0 w-14 flex flex-col items-center justify-center rounded-lg py-2 transition-all outline-none ${
                  highlightSelected
                    ? "bg-primary text-primary-foreground shadow-sm ring-1 ring-primary/20"
                    : isFree
                    ? "bg-green-500/10 text-green-600 border border-green-200 dark:bg-green-900/20 dark:border-green-900/30"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-transparent"
                }`}
              >
                <span className="text-[13px] font-bold leading-tight md:text-[15px]">{dayStr.slice(0, 3)}</span>
                <span className={`text-[10.5px] leading-tight md:text-[12px] truncate px-1 max-w-full ${highlightSelected ? "text-primary-foreground/80" : isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                  {dayNum} {monthPrefix}
                </span>
                {isToday && !highlightSelected && <div className="absolute top-0 right-0 w-1.5 h-1.5 bg-primary rounded-full translate-x-1/3 -translate-y-1/3 border border-background"></div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
