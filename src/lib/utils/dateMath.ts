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
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
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
 * Checks whether an event occurs on a target date, accounting for recurrence rules (RRULE)
 */
export function eventOccursOnDay(event: CalendarEvent, targetDay: Date): boolean {
  const start = parseISO(event.startTime);
  
  // Cannot occur before its initial start date
  if (targetDay < startOfDayDate(start)) return false;

  // Single non-recurring event
  if (!event.rrule || event.rrule === 'none') {
    return isSameDay(start, targetDay);
  }

  // Daily recurrence
  if (event.rrule === 'daily') {
    return true;
  }

  // Weekday recurrence (Mon - Fri)
  if (event.rrule === 'weekday') {
    const dayOfWeek = targetDay.getDay();
    return dayOfWeek >= 1 && dayOfWeek <= 5;
  }

  // Weekly recurrence on same weekday
  if (event.rrule === 'weekly') {
    return start.getDay() === targetDay.getDay();
  }

  // Bi-weekly (Every 2 weeks)
  if (event.rrule === 'biweekly') {
    if (start.getDay() !== targetDay.getDay()) return false;
    const diffWeeks = Math.abs(differenceInWeeks(targetDay, start));
    return diffWeeks % 2 === 0;
  }

  // Monthly on same date (e.g. 16th of every month)
  if (event.rrule === 'monthly_date' || event.rrule === 'monthly') {
    return start.getDate() === targetDay.getDate();
  }

  // Monthly on same day position (e.g. 3rd Thursday)
  if (event.rrule === 'monthly_day') {
    return start.getDay() === targetDay.getDay() && getWeekOfMonth(start) === getWeekOfMonth(targetDay);
  }

  // Yearly on same month and date
  if (event.rrule === 'yearly') {
    return start.getMonth() === targetDay.getMonth() && start.getDate() === targetDay.getDate();
  }

  return isSameDay(start, targetDay);
}

function startOfDayDate(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Returns all active and recurring events for a specific calendar day
 */
export function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((event) => eventOccursOnDay(event, day))
    .map((event) => {
      if (!isSameDay(parseISO(event.startTime), day)) {
        // Project start and end time to target recurring day
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
          endTime: newEnd.toISOString()
        };
      }
      return event;
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