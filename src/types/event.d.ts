export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';
export type BusyStatus = 'busy' | 'free';
export type EventStatus = 'confirmed' | 'tentative' | 'cancelled';
export type ViewMode = 'day' | 'week' | 'month';

export interface CalendarCategory {
  id: string;
  accountId: string;
  googleCalendarId?: string;
  name: string;
  colorId: string;
  colorHex: string;
  isPrimary: boolean;
  isVisible: boolean;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  googleEventId?: string;
  recurringEventId?: string;
  title: string;
  description?: string;
  location?: string;
  meetingUrl?: string;
  startTime: string; // ISO UTC string
  endTime: string;   // ISO UTC string
  isAllDay: boolean;
  timeZone: string;
  rrule?: string;
  originalStartTime?: string;
  status: EventStatus;
  busyStatus: BusyStatus;
  colorOverride?: string;
  syncStatus: SyncStatus;
  updatedAt: string;
}

export interface DayOverflowItem {
  date: Date;
  events: CalendarEvent[];
  anchorRect: DOMRect;
}