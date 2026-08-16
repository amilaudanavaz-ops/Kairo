export type SyncStatus = 'synced' | 'pending_insert' | 'pending_update' | 'pending_delete';
export type BusyStatus = 'busy' | 'free';
export type Visibility = 'default' | 'public' | 'private';
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
  conferencingUrl?: string;
  meetingUrl?: string;
  startTime: string; // ISO UTC string
  endTime: string;   // ISO UTC string
  isAllDay: boolean;
  timeZone: string;
  rrule?: string;    // 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly' | custom RFC5545
  status: EventStatus;
  busyStatus: BusyStatus;
  visibility: Visibility;
  reminders: string; // e.g. '10m', '30m', '1h', '1d'
  creatorEmail?: string;
  participants?: string[];
  attachments?: string[];
  colorOverride?: string;
  syncStatus: SyncStatus;
  updatedAt: string;
}

export interface DayOverflowItem {
  date: Date;
  events: CalendarEvent[];
  anchorRect: DOMRect;
}