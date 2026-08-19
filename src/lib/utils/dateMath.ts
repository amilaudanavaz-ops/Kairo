import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  isToday,
  isBefore,
  startOfDay,
  endOfDay,
  format,
  parseISO,
  set,
  differenceInWeeks,
  getWeekOfMonth,
  differenceInMinutes,
  addMinutes,
  addDays,
  subDays,
  subWeeks,
  isValid,
  isPast, 
  getDay, 
  getDate, 
  parse
} from 'date-fns';
import type { CalendarEvent } from '../../types/event';

export interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isCurrentDay: boolean;
  isPast: boolean;
  dateKey: string;
}

export interface RecurrenceDisplay {
  id: string;
  label: string;
  sub?: string;
}

/**
 * Normalizes an RFC 5545 UNTIL date string or ISO string into a JavaScript Date object.
 */
export function parseRRuleUntilDate(untilRaw?: string): Date | null {
  if (!untilRaw) return null;
  const clean = untilRaw.trim();

  // 1. ISO 8601 representation (e.g., 2026-08-10 or 2026-08-10T23:59:59Z)
  if (clean.includes('-')) {
    const d = parseISO(clean);
    return isValid(d) ? d : null;
  }

  // 2. Compact RFC 5545 representation (e.g., 20260810T235959Z or 20260810)
  const match = clean.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})Z?)?$/i);
  if (match) {
    const [, y, m, d, hh, mm, ss] = match;
    if (hh !== undefined) {
      return new Date(Date.UTC(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        parseInt(hh, 10),
        parseInt(mm, 10),
        parseInt(ss, 10)
      ));
    } else {
      return new Date(Date.UTC(
        parseInt(y, 10),
        parseInt(m, 10) - 1,
        parseInt(d, 10),
        23,
        59,
        59
      ));
    }
  }

  const fallback = new Date(clean);
  return isValid(fallback) ? fallback : null;
}

/**
 * Formats shorthand or RFC 5545 recurrence definitions into readable labels.
 */
export function formatRRuleLabel(rruleStr?: string, referenceDate?: Date): RecurrenceDisplay {
  if (!rruleStr || rruleStr === 'none') {
    return { id: 'none', label: 'Does not repeat' };
  }

  const d = referenceDate && isValid(referenceDate) ? referenceDate : new Date();
  const dayName = format(d, 'EEE');
  const dayOfMonth = format(d, 'do');
  const monthDay = format(d, 'MMM d');
  const weekNum = ['1st', '2nd', '3rd', '4th', '5th'][getWeekOfMonth(d) - 1] || 'last';

  // 1. Shorthand Recurrence Identifiers
  if (rruleStr === 'daily') return { id: 'daily', label: 'Every day' };
  if (rruleStr === 'weekday') return { id: 'weekday', label: 'Every weekday', sub: 'Mon – Fri' };
  if (rruleStr === 'weekly') return { id: 'weekly', label: 'Every week', sub: `on ${dayName}` };
  if (rruleStr === 'biweekly') return { id: 'biweekly', label: 'Every 2 weeks', sub: `on ${dayName}` };
  if (rruleStr === 'monthly_date' || rruleStr === 'monthly') return { id: 'monthly_date', label: 'Every month', sub: `on the ${dayOfMonth}` };
  if (rruleStr === 'monthly_day') return { id: 'monthly_day', label: 'Every month', sub: `on the ${weekNum} ${dayName}` };
  if (rruleStr === 'yearly') return { id: 'yearly', label: 'Every year', sub: `on ${monthDay}` };

  // 2. RFC 5545 String Parsing
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
    return { id: `every_${interval}_days`, label: `Every ${interval} days` };
  }

  if (freq === 'WEEKLY') {
    if (byday === 'MO,TU,WE,TH,FR') {
      return { id: 'weekday', label: 'Every weekday', sub: 'Mon – Fri' };
    }
    const formattedDays = byday
      ? byday.split(',').map(s => s.trim()).filter(Boolean).map(code => daysMap[code] || code).join(', ')
      : dayName;

    if (interval === 1) {
      return { id: 'weekly', label: 'Every week', sub: `on ${formattedDays}` };
    }
    if (interval === 2) {
      return { id: 'biweekly', label: 'Every 2 weeks', sub: `on ${formattedDays}` };
    }
    return { id: `every_${interval}_weeks`, label: `Every ${interval} weeks`, sub: `on ${formattedDays}` };
  }

  if (freq === 'MONTHLY') {
    const match = byday.match(/^(-?\d+)?([A-Z]{2})$/);
    if (match && match[2] && daysMap[match[2]]) {
      const posStr = posMap[match[1] || '1'] || `${match[1]}th`;
      const dayStr = daysMap[match[2]];
      return { id: 'monthly_day', label: 'Every month', sub: `on the ${posStr} ${dayStr}` };
    }
    if (bymonthday) {
      return { id: 'monthly_date', label: 'Every month', sub: `on the ${bymonthday}th` };
    }
    return { id: 'monthly', label: 'Every month' };
  }

  if (freq === 'YEARLY') {
    return { id: 'yearly', label: 'Every year', sub: `on ${monthDay}` };
  }

  return { id: 'weekly', label: 'Every week', sub: `on ${dayName}` };
}

/**
 * Strict occurrence evaluator based on integer UTC timestamp comparisons.
 */
  export function eventOccursOnDay(event: CalendarEvent, targetDate: Date | string): boolean {
  if (!event || !event.startTime) return false;

  const targetDay = typeof targetDate === 'string' ? parseISO(targetDate) : targetDate;
  if (!isValid(targetDay)) return false;

  const targetDateKey = format(targetDay, 'yyyy-MM-dd');
  const startDateKey = event.startTime.split('T')[0];

  // 1. Exdates check (must run first before any recurrence calculations)
  if (event.exdates) {
    const exList = Array.isArray(event.exdates)
      ? event.exdates
      : (typeof event.exdates === 'string' ? JSON.parse(event.exdates || '[]') : []);
    if (exList.includes(targetDateKey)) {
      return false;
    }
  }

  // 2. Until date boundary check
  if (event.untilDate && targetDateKey > event.untilDate) {
    return false;
  }

  // 3. Non-recurring events or detached child exceptions
  if (event.recurringEventId || !event.rrule || event.rrule === 'none') {
    if (event.isAllDay) {
      const startKey = event.startTime.split('T')[0];
      const endKey = (event.endTime || event.startTime).split('T')[0];

      let inclusiveEndKey = endKey;
      if (event.endTime && (event.endTime.includes('T00:00:00') || event.endTime.endsWith('T00:00:00Z')) && endKey > startKey) {
        inclusiveEndKey = format(subDays(parseISO(endKey), 1), 'yyyy-MM-dd');
      }

      return targetDateKey >= startKey && targetDateKey <= inclusiveEndKey;
    }
    return targetDateKey === startDateKey;
  }

  // 4. Cannot occur before initial series start date
  if (targetDateKey < startDateKey) return false;

  const start = parseISO(event.startTime);
  if (!isValid(start)) return false;

  // Normalized UTC midnights for interval calculation
  const [sy, sm, sd] = startDateKey.split('-').map(Number);
  const [ty, tm, td] = targetDateKey.split('-').map(Number);
  const startUtcMidnight = Date.UTC(sy, sm - 1, sd);
  const targetUtcMidnight = Date.UTC(ty, tm - 1, td);

  const rrule = event.rrule;

  // 5. Canonical RFC 5545 Frequency Evaluation
  const clean = rrule.replace(/^RRULE:/i, '').trim();
  const parts: Record<string, string> = {};
  for (const p of clean.split(';')) {
    const [k, v] = p.split('=');
    if (k && v) parts[k.toUpperCase()] = v.toUpperCase();
  }

  const freq = parts['FREQ'] || '';
  const interval = Math.max(1, parseInt(parts['INTERVAL'] || '1', 10));
  const byday = parts['BYDAY'] || '';
  const bymonthday = parts['BYMONTHDAY'] || '';

  const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const targetDayCode = dayCodes[targetDay.getDay()];

  if (freq === 'DAILY' || clean === 'daily') {
    const diffDays = Math.round((targetUtcMidnight - startUtcMidnight) / 86400000);
    return diffDays % interval === 0;
  }

  if (freq === 'WEEKLY' || clean === 'weekly' || clean === 'weekday' || clean === 'biweekly') {
    const diffDays = Math.round((targetUtcMidnight - startUtcMidnight) / 86400000);
    const diffWeeks = Math.floor(diffDays / 7);

    if (clean === 'weekday') {
      const day = targetDay.getDay();
      return day >= 1 && day <= 5;
    }

    if (byday) {
      const allowedDays = byday.split(',').map(s => s.trim().toUpperCase());
      if (!allowedDays.includes(targetDayCode)) return false;
      return diffWeeks % interval === 0;
    }

    if (start.getDay() !== targetDay.getDay()) return false;
    return diffWeeks % interval === 0;
  }

  if (freq === 'MONTHLY' || clean === 'monthly' || clean === 'monthly_date' || clean === 'monthly_day') {
    if (bymonthday || clean === 'monthly_date') {
      const targetDayNum = bymonthday ? parseInt(bymonthday, 10) : start.getDate();
      return targetDay.getDate() === targetDayNum;
    }
    if (byday || clean === 'monthly_day') {
      const match = byday.match(/^(-?\d+)?([A-Z]{2})$/);
      if (match) {
        const targetCode = match[2];
        const pos = parseInt(match[1] || '1', 10);
        if (targetDayCode !== targetCode) return false;
        return getWeekOfMonth(targetDay) === pos;
      }
      const startWeekNum = getWeekOfMonth(start);
      return targetDayCode === dayCodes[start.getDay()] && getWeekOfMonth(targetDay) === startWeekNum;
    }
    return start.getDate() === targetDay.getDate();
  }

  if (freq === 'YEARLY' || clean === 'yearly') {
    return start.getMonth() === targetDay.getMonth() && start.getDate() === targetDay.getDate();
  }

  return targetDateKey === startDateKey;
}

/**
 * Continuous rolling month grid matrix generator.
 */
export function generateMonthGrid(
  anchorDate: Date, 
  weekStartsOn: 0 | 1 = 0, 
  totalWeeks: number = 7
): DayCell[] {
  const visibleStart = startOfWeek(anchorDate, { weekStartsOn });
  const gridStart = subWeeks(visibleStart, 1);
  const gridEnd = addDays(gridStart, totalWeeks * 7 - 1);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const middleRowDate = addDays(visibleStart, 17);
  const todayStart = startOfDay(new Date());

  return days.map((date) => ({
    date,
    isCurrentMonth: isSameMonth(date, middleRowDate),
    isCurrentDay: isToday(date),
    isPast: isBefore(startOfDay(date), todayStart),
    dateKey: format(date, 'yyyy-MM-dd')
  }));
}

/**
 * Projects matching event instances for a given day.
 */
export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dateKey = format(day, 'yyyy-MM-dd');

  return events
    .filter((event) => eventOccursOnDay(event, day))
    .map((event) => {
      if (event.recurringEventId || !event.rrule || event.rrule === 'none') {
        return {
          ...event,
          occurrenceDate: dateKey
        };
      }

      const origStart = parseISO(event.startTime);
      const origEnd = event.endTime ? parseISO(event.endTime) : origStart;
      const duration = Math.max(15, differenceInMinutes(origEnd, origStart));

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

/**
 * Creates an updated event projection with shifted start and end times.
 */
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