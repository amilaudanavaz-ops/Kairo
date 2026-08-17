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
  accessRole?: string;
}

export interface ParticipantContact {
  name: string;
  email: string;
  avatarUrl?: string;
}

export interface LocationSuggestion {
  title: string;
  subtitle: string;
}

export interface UserAccount {
  id: string;
  email: string;
  name: string;
  provider: 'google' | 'kairo';
  avatarUrl?: string;
  isPrimary: boolean;
  syncEnabled: boolean;
}

export type SettingsTab = 
  | 'general' 
  | 'profile' 
  | 'notifications' 
  | 'menubar' 
  | 'conferencing' 
  | 'accounts';

export interface CalendarEvent {
  id: string;
  calendarId: string;
  googleEventId?: string;
  recurringEventId?: string;
  originalStartTime?: string;
  title: string;
  description?: string;
  location?: string;
  conferencingUrl?: string;
  conferencingProvider?: 'google_meet' | 'zoom' | 'custom';
  meetingUrl?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  timeZone: string;
  rrule?: string;
  exdates?: string[];
  untilDate?: string;
  occurrenceDate?: string;
  isRecurringInstance?: boolean;
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