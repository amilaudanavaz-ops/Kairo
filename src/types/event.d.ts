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
  recurringEventId?: string; // References parent master if this is an exception
  originalStartTime?: string; // ISO string of the specific occurrence being replaced
  title: string;
  description?: string;
  location?: string;
  conferencingUrl?: string;
  meetingUrl?: string;
  startTime: string; // ISO UTC string
  endTime: string;   // ISO UTC string
  isAllDay: boolean;
  timeZone: string;
  rrule?: string;    // 'none' | 'daily' | 'weekday' | 'weekly' | 'biweekly' | 'monthly_date' | 'monthly_day' | 'yearly'
  exdates?: string[]; // Array of 'yyyy-MM-dd' dates where master recurrence is suppressed
  untilDate?: string; // 'yyyy-MM-dd' termination cutoff for "This and following events"
  occurrenceDate?: string; // 'yyyy-MM-dd' tracking the specific occurrence being viewed/dragged
  isRecurringInstance?: boolean; // Virtual occurrence flag
  status: EventStatus;
  busyStatus: BusyStatus;
  visibility: Visibility;
  reminders: string[];
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