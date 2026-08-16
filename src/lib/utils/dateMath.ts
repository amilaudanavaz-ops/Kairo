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
  addMinutes
} from 'date-fns';
import type { CalendarEvent } from '../../types/event';

export interface DayCell {
  date: Date;
  isCurrentMonth: boolean;
  isCurrentDay: boolean;
  dateKey: string;
}

export function generateMonthGrid(activeDate: Date): DayCell[] {
  const monthStart = startOfMonth(activeDate);
  const monthEnd = endOfMonth(monthStart);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  return days.map((date) => ({
    date,
    isCurrentMonth: isSameMonth(date, activeDate),
    isCurrentDay: isToday(date),
    dateKey: format(date, 'yyyy-MM-dd')
  }));
}

/**
 * Evaluates whether an event occurs on a target day, respecting recurrence rules,
 * exclusion dates (exdates), and termination cutoffs (untilDate).
 */
export function eventOccursOnDay(event: CalendarEvent, targetDay: Date): boolean {
  const start = parseISO(event.startTime);
  const targetDayStart = new Date(targetDay.getFullYear(), targetDay.getMonth(), targetDay.getDate());
  const eventDayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const targetDateKey = format(targetDay, 'yyyy-MM-dd');

  // 1. Cannot occur before its origin start date
  if (targetDayStart < eventDayStart) return false;

  // 2. Suppress date if explicitly excluded (e.g. modified via "This event")
  if (event.exdates && event.exdates.includes(targetDateKey)) {
    return false;
  }

  // 3. Suppress date if past termination cutoff (e.g. modified via "This and following")
  if (event.untilDate && targetDateKey >= event.untilDate) {
    return false;
  }

  // 4. Non-recurring standalone events
  if (!event.rrule || event.rrule === 'none') {
    return isSameDay(start, targetDay);
  }

  // 5. Recurrence rule evaluation
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

/**
 * Returns all active and recurring events for a specific calendar day,
 * attaching the exact occurrence date to each instance.
 */
export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  const dateKey = format(day, 'yyyy-MM-dd');

  return events
    .filter((event) => eventOccursOnDay(event, day))
    .map((event) => {
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
        isRecurringInstance: Boolean(event.rrule && event.rrule !== 'none')
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