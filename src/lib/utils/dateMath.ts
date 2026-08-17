import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  format,
  parseISO,
  set,
  differenceInWeeks,
  getWeekOfMonth,
  differenceInMinutes,
  addMinutes,
  addDays
} from 'date-fns';
import type { CalendarEvent } from '../../types/event';

export interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isCurrentDay: boolean;
  dateKey: string;
}

export interface RecurrenceDisplay {
  id: string;
  label: string;
  sub?: string;
}

/**
 * Standard RFC 5545 RRULE Parser & Formatter.
 * Translates raw Google RRULE definitions into Notion-style labels.
 */
export function formatRRuleLabel(rruleStr?: string, referenceDate?: Date): RecurrenceDisplay {
  if (!rruleStr || rruleStr === 'none') {
    return { id: 'none', label: 'Does not repeat' };
  }

  const clean = rruleStr.replace(/^RRULE:/i, '').trim();
  const parts: Record<string, string> = {};
  for (const p of clean.split(';')) {
    const [k, v] = p.split('=');
    if (k && v) parts[k.toUpperCase()] = v.toUpperCase();
  }

  const freq = parts['FREQ'] || '';
  const interval = parseInt(parts['INTERVAL'] || '1', 10);
  const byday = parts['BYDAY'] || '';
  const bymonthday = parts['BYMONTHDAY'] || '';

  const daysMap: Record<string, string> = {
    MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun'
  };

  const posMap: Record<string, string> = {
    '1': '1st', '2': '2nd', '3': '3rd', '4': '4th', '5': '5th', '-1': 'last'
  };

  if (freq === 'DAILY') {
    if (interval === 1) return { id: 'daily', label: 'Every day' };
    return { id: 'daily', label: `Every ${interval} days` };
  }

  if (freq === 'WEEKLY') {
    if (byday === 'MO,TU,WE,TH,FR') {
      return { id: 'weekday', label: 'Every weekday', sub: 'Mon – Fri' };
    }

    const dayNames = byday.split(',').filter(Boolean).map(code => daysMap[code] || code);
    const dayText = dayNames.join(', ');

    if (interval === 1) {
      return { id: 'weekly', label: 'Every week', sub: dayText ? `on ${dayText}` : undefined };
    }
    if (interval === 2) {
      return { id: 'biweekly', label: 'Every 2 weeks', sub: dayText ? `on ${dayText}` : undefined };
    }
    return { id: `every_${interval}_weeks`, label: `Every ${interval} weeks`, sub: dayText ? `on ${dayText}` : undefined };
  }

  if (freq === 'MONTHLY') {
    const match = byday.match(/^(-?\d+)?([A-Z]{2})$/);
    if (match && match[2] && daysMap[match[2]]) {
      const posNum = match[1] || '1';
      const posStr = posMap[posNum] || `${posNum}th`;
      const dayStr = daysMap[match[2]];
      return { id: 'monthly_day', label: 'Every month', sub: `on the ${posStr} ${dayStr}` };
    }
    if (bymonthday) {
      return { id: 'monthly_date', label: 'Every month', sub: `on the ${bymonthday}th` };
    }
    return { id: 'monthly', label: 'Every month' };
  }

  if (freq === 'YEARLY') {
    return { id: 'yearly', label: 'Every year' };
  }

  return { id: clean, label: 'Repeats (Recurring Series)' };
}

/**
 * Continuous Rolling Week Month Grid Generator.
 * Generates a rolling 5-week window anchored to the start of the week.
 */
export function generateMonthGrid(
  activeDate: Date, 
  weekStartsOn: 0 | 1 = 0, 
  numWeeks: number = 5
): DayCell[] {
  const gridStart = startOfWeek(activeDate, { weekStartsOn });
  const gridEnd = addDays(gridStart, numWeeks * 7 - 1);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // Dominant month is calculated from the middle visible row (Row 3)
  const middleRowDate = addDays(gridStart, 17);

  return days.map((date) => ({
    date,
    isCurrentMonth: isSameMonth(date, middleRowDate),
    isCurrentDay: isToday(date),
    dateKey: format(date, 'yyyy-MM-dd')
  }));
}

/**
 * Evaluates whether an event occurs on a target day.
 */
export function eventOccursOnDay(event: CalendarEvent, targetDay: Date): boolean {
  const start = parseISO(event.startTime);
  const end = parseISO(event.endTime);
  const targetDayStart = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate());
  const eventDayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const endDayStart = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  const targetDateKey = format(targetDay, 'yyyy-MM-dd');

  if (targetDayStart < eventDayStart) return false;

  if (event.exdates && event.exdates.includes(targetDateKey)) {
    return false;
  }

  if (event.untilDate && targetDateKey >= event.untilDate) {
    return false;
  }

  if (event.recurringEventId || event.googleEventId || !event.rrule || event.rrule === 'none') {
    if (event.isAllDay) {
      return targetDayStart >= eventDayStart && targetDayStart <= endDayStart;
    }
    return isSameDay(start, targetDay);
  }

  if (event.rrule === 'daily') return true;

  if (event.rrule === 'weekday') {
    const day = targetDay.getDay();
    return day >= 1 && day <= 5;
  }

  if (event.rrule === 'weekly') {
    return start.getDay() === targetDay.getDay();
  }

  if (event.rrule === 'biweekly') {
    if (start.getDay() !== targetDay.getDay()) return false;
    const diffWeeks = Math.abs(differenceInWeeks(targetDay, start));
    return diffWeeks % 2 === 0;
  }

  if (event.rrule === 'monthly_date' || event.rrule === 'monthly') {
    return start.getDate() === targetDay.getDate();
  }

  if (event.rrule === 'monthly_day') {
    return start.getDay() === targetDay.getDay() && getWeekOfMonth(start) === getWeekOfMonth(targetDay);
  }

  if (event.rrule === 'yearly') {
    return start.getMonth() === targetDay.getMonth() && start.getDate() === targetDay.getDate();
  }

  return isSameDay(start, targetDay);
}

export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dateKey = format(day, 'yyyy-MM-dd');

  return events
    .filter((event) => eventOccursOnDay(event, day))
    .map((event) => {
      if (event.recurringEventId || event.googleEventId || !event.rrule || event.rrule === 'none') {
        return {
          ...event,
          occurrenceDate: dateKey
        };
      }

      const origStart = parseISO(event.startTime);
      const origEnd = parseISO(event.endTime);
      const duration = differenceInMinutes(origEnd, origStart);

      const newStart = set(day, {
        hours: origStart.getHours(),
        minutes: origStart.getMinutes(),
        seconds: origStart.getSeconds()
      });
      const newEnd = addMinutes(newStart, duration);

      return {
        ...event,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        occurrenceDate: dateKey,
        isRecurringInstance: true
      };
    });
}

export function moveEventDate(event: CalendarEvent, targetDate: Date): CalendarEvent {
  const originalStart = parseISO(event.startTime);
  const originalEnd = parseISO(event.endTime);

  const newStart = set(targetDate, {
    hours: originalStart.getHours(),
    minutes: originalStart.getMinutes(),
    seconds: originalStart.getSeconds()
  });

  const durationMs = originalEnd.getTime() - originalStart.getTime();
  const newEnd = new Date(newStart.getTime() + durationMs);

  return {
    ...event,
    startTime: newStart.toISOString(),
    endTime: newEnd.toISOString(),
    syncStatus: 'pending_update',
    updatedAt: new Date().toISOString()
  };
}