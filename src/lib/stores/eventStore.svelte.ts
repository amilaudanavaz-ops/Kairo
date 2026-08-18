import type { CalendarEvent, CalendarCategory } from '../../types/event';
import { 
  loadStoredEvents, 
  persistUpsertEvent, 
  persistDeleteEvent, 
  persistBatchEvents,
  loadAllAccountsWithTokens,
  updateAccountTokens,
  clearAllGoogleEvents,
  persistCalendarCategory,
  loadInitialCalendars,
  loadDbSettings,
  persistDbSetting
} from '../db/database';
import { calendarState } from './calendarState.svelte';
import { 
  format, 
  parseISO, 
  setHours, 
  setMinutes, 
  differenceInMinutes, 
  addMinutes, 
  isValid,
  set,
  subMonths,
  addMonths,
  getWeekOfMonth
} from 'date-fns';
import { getEventsForDay } from '../utils/dateMath';
import { invoke } from '@tauri-apps/api/core';

export interface RawGoogleEvent {
  google_event_id?: string;
  googleEventId?: string;
  recurring_event_id?: string;
  recurringEventId?: string;
  original_start_time?: string;
  originalStartTime?: string;
  rrule?: string;
  title?: string;
  description?: string;
  location?: string;
  meeting_url?: string;
  meetingUrl?: string;
  conferencing_provider?: string;
  conferencingProvider?: string;
  start_time?: string;
  startTime?: string;
  end_time?: string;
  endTime?: string;
  is_all_day?: boolean;
  isAllDay?: boolean;
  time_zone?: string;
  timeZone?: string;
  status?: string;
  busy_status?: string;
  busyStatus?: string;
  color_override?: string;
  colorOverride?: string;
  etag?: string;
  participants?: string[];
  reminders?: string[];
}

export type NormalizedGoogleEvent = RawGoogleEvent;

export interface GoogleEventsFetchResponse {
  events: RawGoogleEvent[];
  next_sync_token?: string;
}

function cleanHtmlDescription(raw?: string): string {
  if (!raw) return '';
  let text = raw;

  text = text.replace(/<(head|style|script)[^>]*>[\s\S]*?<\/\1>/gi, '');
  text = text.replace(/<(br|p|\/p|div|\/div|tr|\/tr|li)[^>]*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x2F;/gi, '/');

  const lines = text.split('\n').map((l) => l.trim());
  const cleaned: string[] = [];
  for (const line of lines) {
    if (line || (cleaned.length > 0 && cleaned[cleaned.length - 1] !== '')) {
      cleaned.push(line);
    }
  }

  return cleaned.join('\n').trim();
}

/**
 * Converts shorthand recurrence rules into standard RFC 5545 recurrence strings.
 */
export function convertRRuleToRFC5545(rruleStr: string | undefined, startIso: string): string | null {
  if (!rruleStr || rruleStr === 'none') return null;
  if (rruleStr.startsWith('RRULE:') || rruleStr.toUpperCase().includes('FREQ=')) {
    return rruleStr.startsWith('RRULE:') ? rruleStr : `RRULE:${rruleStr}`;
  }

  const d = parseISO(startIso);
  const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const dayCode = dayCodes[d.getDay()];

  if (rruleStr === 'daily') return 'RRULE:FREQ=DAILY';
  if (rruleStr === 'weekday') return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
  if (rruleStr === 'weekly') return `RRULE:FREQ=WEEKLY;BYDAY=${dayCode}`;
  if (rruleStr === 'biweekly') return `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayCode}`;
  if (rruleStr === 'monthly_date' || rruleStr === 'monthly') return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${d.getDate()}`;
  if (rruleStr === 'monthly_day') {
    const weekNum = getWeekOfMonth(d);
    return `RRULE:FREQ=MONTHLY;BYDAY=${weekNum}${dayCode}`;
  }
  if (rruleStr === 'yearly') return 'RRULE:FREQ=YEARLY';

  return `RRULE:${rruleStr}`;
}

export async function getValidTokenAndCalendar(calendarId: string): Promise<{ accessToken: string; googleCalendarId: string } | null> {
  const calendars = await loadInitialCalendars();
  const cal = calendars.find(c => c.id === calendarId || c.googleCalendarId === calendarId);
  if (!cal || !cal.googleCalendarId || cal.accessRole === 'reader' || cal.accessRole === 'freeBusyReader') {
    return null;
  }

  const accounts = await loadAllAccountsWithTokens();
  const acc = accounts.find(a => a.id === cal.accountId) || accounts[0];
  if (!acc) return null;

  let activeToken = acc.accessToken || '';
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
  const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';

  if (!activeToken && acc.refreshToken && clientId) {
    try {
      const refreshed = await invoke<{ access_token?: string; accessToken?: string }>('refresh_google_token', {
        clientId,
        clientSecret,
        refreshToken: acc.refreshToken
      });
      activeToken = (refreshed.access_token || refreshed.accessToken)!;
      await updateAccountTokens(acc.id, activeToken);
    } catch (e) {
      console.error('Token refresh error:', e);
      return null;
    }
  }

  if (!activeToken) return null;

  return {
    accessToken: activeToken,
    googleCalendarId: cal.googleCalendarId
  };
}

class EventStore {
  events = $state<CalendarEvent[]>([]);
  isLoading = $state<boolean>(false);
  isSyncing = $state<boolean>(false);

  getEventsForDateKey(dateKey: string): CalendarEvent[] {
    if (!dateKey) return [];
    let targetDate: Date;
    try {
      targetDate = parseISO(dateKey);
      if (!isValid(targetDate)) return [];
    } catch {
      return [];
    }

    return getEventsForDay(this.events, targetDate);
  }

  async init(): Promise<void> {
    this.isLoading = true;
    try {
      const stored = await loadStoredEvents();
      this.events = stored;
      this.syncGoogleEvents().catch(() => {});
    } catch (err) {
      console.error('Failed to load events from DB:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async initDatabase(): Promise<void> {
    await this.init();
  }

  addEvent(event: CalendarEvent): void {
    this.events = [...this.events.filter((e) => e.id !== event.id), event];
    persistUpsertEvent(event).catch((err) => {
      console.error('Failed to persist new event:', err);
    });

    if (!event.googleEventId) {
      const rfc5545RRule = convertRRuleToRFC5545(event.rrule, event.startTime);

      getValidTokenAndCalendar(event.calendarId).then(async (auth) => {
        if (!auth) return;
        try {
          const res = await invoke<NormalizedGoogleEvent>('create_google_event', {
            accessToken: auth.accessToken,
            calendarId: auth.googleCalendarId,
            event: {
              title: event.title,
              description: event.description || null,
              location: event.location || null,
              start_time: event.startTime,
              end_time: event.endTime,
              is_all_day: event.isAllDay,
              time_zone: event.timeZone || 'UTC',
              rrule: rfc5545RRule
            }
          });

          if (res && res.google_event_id) {
            const syncedEvent: CalendarEvent = {
              ...event,
              googleEventId: res.google_event_id,
              syncStatus: 'synced'
            };
            this.events = this.events.map(e => e.id === event.id ? syncedEvent : e);
            await persistUpsertEvent(syncedEvent);
          }
        } catch (e) {
          console.error('Failed to create event on Google Calendar:', e);
        }
      });
    }
  }

  updateEvent(updated: CalendarEvent): void {
    this.events = this.events.map((e) => (e.id === updated.id ? updated : e));
    persistUpsertEvent(updated).catch((err) => {
      console.error('Failed to persist updated event:', err);
    });

    if (updated.googleEventId) {
      const rfc5545RRule = convertRRuleToRFC5545(updated.rrule, updated.startTime);

      getValidTokenAndCalendar(updated.calendarId).then(async (auth) => {
        if (!auth) return;
        try {
          await invoke<NormalizedGoogleEvent>('update_google_event', {
            accessToken: auth.accessToken,
            calendarId: auth.googleCalendarId,
            eventId: updated.googleEventId,
            event: {
              title: updated.title,
              description: updated.description || null,
              location: updated.location || null,
              start_time: updated.startTime,
              end_time: updated.endTime,
              is_all_day: updated.isAllDay,
              time_zone: updated.timeZone || 'UTC',
              rrule: rfc5545RRule
            }
          });
        } catch (e) {
          console.error('Failed to update event on Google Calendar:', e);
        }
      });
    }
  }

  deleteEvent(id: string): void {
    const target = this.events.find((e) => e.id === id);
    if (!target) return;

    this.events = this.events.filter((e) => e.id !== id);

    persistDeleteEvent(id).catch((err) => {
      console.error('Failed to delete event from DB:', err);
    });

    // If deleting a standalone non-recurring event, dispatch directly
    if (target && target.googleEventId && (!target.recurringEventId && (!target.rrule || target.rrule === 'none'))) {
      getValidTokenAndCalendar(target.calendarId).then(async (auth) => {
        if (!auth) return;
        try {
          await invoke('delete_google_event', {
            accessToken: auth.accessToken,
            calendarId: auth.googleCalendarId,
            eventId: target.googleEventId!
          });
        } catch (e) {
          console.error('Failed to delete standalone event on Google:', e);
        }
      });
    }
  }

  rescheduleEvent(id: string, targetDate: Date): void {
    const target = this.events.find((e) => e.id === id);
    if (!target) return;

    const origStart = parseISO(target.startTime);
    const origEnd = parseISO(target.endTime);
    const duration = differenceInMinutes(origEnd, origStart);

    const newStart = setMinutes(setHours(targetDate, origStart.getHours()), origStart.getMinutes());
    const newEnd = addMinutes(newStart, duration);

    const updated: CalendarEvent = {
      ...target,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.updateEvent(updated);
  }

  /**
   * Real-Time Incremental Sync using nextSyncToken (<100ms response).
   */
  async syncGoogleEvents(forceFullSync: boolean = false): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const accounts = await loadAllAccountsWithTokens();
      if (accounts.length === 0) return;

      const baseDate = calendarState.currentDate || new Date();
      const timeMin = subMonths(baseDate, 6).toISOString();
      const timeMax = addMonths(baseDate, 6).toISOString();
      const dbSettings = await loadDbSettings();

      for (const acc of accounts) {
        let activeToken = acc.accessToken || '';
        if (!activeToken && !acc.refreshToken) continue;

        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
        const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';

        // 1. Fetch user's Google Calendar List
        let googleCals: any[] = [];
        try {
          googleCals = await invoke<any[]>('fetch_google_calendars', {
            accessToken: activeToken
          });
        } catch (calErr) {
          if (acc.refreshToken && clientId) {
            try {
              const refreshed = await invoke<{ access_token?: string; accessToken?: string }>('refresh_google_token', {
                clientId,
                clientSecret,
                refreshToken: acc.refreshToken
              });
              activeToken = (refreshed.access_token || refreshed.accessToken)!;
              await updateAccountTokens(acc.id, activeToken);
              googleCals = await invoke<any[]>('fetch_google_calendars', {
                accessToken: activeToken
              });
            } catch (refErr) {
              console.error(`Failed to refresh token for account ${acc.email}:`, refErr);
              continue;
            }
          } else {
            console.error(`Failed to fetch calendars for account ${acc.email}:`, calErr);
            continue;
          }
        }

        // 2. Persist calendars to DB
        const currentDbCals = await loadInitialCalendars();
        const calMap = new Map<string, string>();

        for (const gCal of googleCals) {
          const calId = 'cal_' + gCal.id.replace(/[^a-zA-Z0-9_]/g, '_');
          calMap.set(gCal.id, calId);

          const existing = currentDbCals.find(c => c.id === calId || c.googleCalendarId === gCal.id);
          const isPrimary = existing ? existing.isPrimary : Boolean(gCal.primary);
          const isVisible = existing ? existing.isVisible : true;
          const colorHex = existing?.colorHex || gCal.backgroundColor || gCal.background_color || '#3b82f6';
          const accessRole = gCal.accessRole || gCal.access_role || 'owner';

          const category: CalendarCategory = {
            id: calId,
            accountId: acc.id,
            googleCalendarId: gCal.id,
            name: gCal.summary || acc.email,
            colorId: 'google_custom',
            colorHex,
            isPrimary,
            isVisible,
            accessRole
          };
          await persistCalendarCategory(category);
        }

        calendarState.calendars = await loadInitialCalendars();

        // 3. Incremental Delta Sync per Calendar
        for (const gCal of googleCals) {
          const targetCalId = calMap.get(gCal.id) || 'cal_' + gCal.id.replace(/[^a-zA-Z0-9_]/g, '_');
          const syncTokenKey = `sync_token_${gCal.id}`;
          const currentSyncToken = forceFullSync ? undefined : dbSettings[syncTokenKey];

          try {
            const fetchRes = await invoke<GoogleEventsFetchResponse>('fetch_google_events', {
              accessToken: activeToken,
              calendarId: gCal.id,
              timeMin: currentSyncToken ? null : timeMin,
              timeMax: currentSyncToken ? null : timeMax,
              syncToken: currentSyncToken || null
            });

            const { events: rawEvents, next_sync_token } = fetchRes;

            // Save new syncToken for next query
            if (next_sync_token) {
              await persistDbSetting(syncTokenKey, next_sync_token);
              dbSettings[syncTokenKey] = next_sync_token;
            }

            const upsertBatch: CalendarEvent[] = [];

            for (const item of rawEvents) {
              const rawId = item.google_event_id || item.googleEventId || `g_${Date.now()}`;
              const eventId = `evt_g_${targetCalId}_${rawId.replace(/[^a-zA-Z0-9_]/g, '_')}`;

              // Handle remote deletions immediately
              if (item.status === 'cancelled') {
                await persistDeleteEvent(eventId);
                this.events = this.events.filter(e => e.id !== eventId && e.googleEventId !== rawId);
                continue;
              }

              const startTime = item.start_time || item.startTime || new Date().toISOString();
              const endTime = item.end_time || item.endTime || new Date().toISOString();
              const isAllDay = item.is_all_day ?? item.isAllDay ?? false;
              const recurringId = item.recurring_event_id || item.recurringEventId;
              const origStart = item.original_start_time || item.originalStartTime;
              const rrule = item.rrule || 'none';

              const mappedEvent: CalendarEvent = {
                id: eventId,
                calendarId: targetCalId,
                googleEventId: rawId,
                recurringEventId: recurringId,
                originalStartTime: origStart,
                title: item.title || '(No Title)',
                description: cleanHtmlDescription(item.description),
                location: item.location || '',
                conferencingUrl: item.meeting_url || item.meetingUrl || '',
                conferencingProvider: (item.conferencing_provider || item.conferencingProvider || 'google_meet') as any,
                meetingUrl: item.meeting_url || item.meetingUrl || '',
                startTime,
                endTime,
                isAllDay,
                timeZone: item.time_zone || item.timeZone || 'UTC',
                rrule,
                exdates: [],
                isRecurringInstance: Boolean(recurringId || (rrule && rrule !== 'none')),
                status: (item.status as any) || 'confirmed',
                busyStatus: ((item.busy_status || item.busyStatus) as any) || 'busy',
                visibility: 'default',
                reminders: item.reminders && item.reminders.length > 0 ? item.reminders : ['15m'],
                creatorEmail: acc.email,
                participants: item.participants || [],
                attachments: [],
                colorOverride: item.color_override || item.colorOverride,
                syncStatus: 'synced',
                updatedAt: new Date().toISOString()
              };

              upsertBatch.push(mappedEvent);
            }

            if (upsertBatch.length > 0) {
              await persistBatchEvents(upsertBatch);
            }
          } catch (calEvtErr) {
            console.error(`Failed to sync calendar ${gCal.summary || gCal.id}:`, calEvtErr);
          }
        }
      }

      // Reload state directly from SQLite
      this.events = await loadStoredEvents();
    } catch (err) {
      console.error('Failed to sync Google events:', err);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const eventStore = new EventStore();