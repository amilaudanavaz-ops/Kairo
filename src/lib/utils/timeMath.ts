import { 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  parseISO, 
  differenceInMinutes, 
  setHours, 
  setMinutes 
} from 'date-fns';
import type { CalendarEvent } from '../../types/event';

export const HOUR_HEIGHT_PX = 48; // Height in px per hour slot
export const TOTAL_HOURS = 24;

export function getWeekDays(activeDate: Date): Date[] {
  const start = startOfWeek(activeDate, { weekStartsOn: 0 });
  const end = endOfWeek(activeDate, { weekStartsOn: 0 });
  return eachDayOfInterval({ start, end });
}

export function computeTimedEventStyle(event: CalendarEvent): { top: number; height: number } {
  const start = parseISO(event.startTime);
  const end = parseISO(event.endTime);

  const startHour = start.getHours() + start.getMinutes() / 60;
  const durationMinutes = Math.max(15, differenceInMinutes(end, start));
  const durationHours = durationMinutes / 60;

  return {
    top: startHour * HOUR_HEIGHT_PX,
    height: Math.max(20, durationHours * HOUR_HEIGHT_PX)
  };
}

export function snapPointerToTime(offsetY: number, targetDate: Date): Date {
  const rawHour = offsetY / HOUR_HEIGHT_PX;
  const snappedMinutes = Math.floor((rawHour * 60) / 15) * 15; // 15-minute snapping
  const hours = Math.min(23, Math.max(0, Math.floor(snappedMinutes / 60)));
  const minutes = snappedMinutes % 60;

  return setMinutes(setHours(targetDate, hours), minutes);
}