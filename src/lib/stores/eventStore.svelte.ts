import { invoke } from '@tauri-apps/api/core';
import type { CalendarEvent, EventStatus, BusyStatus } from '../../types/event';
import { 
  loadStoredEvents, 
  persistUpsertEvent, 
  persistDeleteEvent, 
  persistBatchEvents,
  loadAllAccountsWithTokens,
  loadInitialCalendars,
  updateAccountTokens
} from '../db/database';
import { calendarState } from './calendarState.svelte';
import { parseISO, setHours, setMinutes, differenceInMinutes, addMinutes, subMonths, addMonths } from 'date-fns';

interface RawGoogleEvent {
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

class EventStore {
  events = $state<CalendarEvent[]>([]);
  isLoading = $state<boolean>(false);
  isSyncing = $state<boolean>(false);

  async init(): Promise<void> {
    this.isLoading = true;
    try {
      const stored = await loadStoredEvents();
      this.events = stored;
      this.syncGoogleEvents().catch((err: unknown) => {
        console.error('Background Google sync error:', err);
      });
    } catch (err: unknown) {
      console.error('Failed to load events from DB:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async initDatabase(): Promise<void> {
    await this.init();
  }

  async syncGoogleEvents(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const accounts = await loadAllAccountsWithTokens();
      const calendars = await loadInitialCalendars();

      if (accounts.length === 0 || calendars.length === 0) {
        return;
      }

      const baseDate = calendarState.currentDate || new Date();
      const timeMin = subMonths(baseDate, 6).toISOString();
      const timeMax = addMonths(baseDate, 6).toISOString();

      const syncedEvents: CalendarEvent[] = [];

      for (const acc of accounts) {
        if (!acc.accessToken && !acc.refreshToken) continue;

        let activeToken = acc.accessToken || '';
        const targetCalendars = calendars.filter((c: any) => c.accountId === acc.id || calendars.length === 1);
        const listToSync = targetCalendars.length > 0 ? targetCalendars : calendars;

        for (const cal of listToSync) {
          const gCalId = cal.googleCalendarId || cal.id || 'primary';
          
          try {
            let rawList: RawGoogleEvent[] = [];
            try {
              if (!activeToken && acc.refreshToken) {
                throw new Error('Trigger refresh');
              }
              rawList = await invoke<RawGoogleEvent[]>('fetch_google_events', {
                accessToken: activeToken,
                calendarId: gCalId,
                timeMin,
                timeMax
              });
            } catch {
              const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
              const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';

              if (acc.refreshToken && clientId) {
                const refreshed = await invoke<{ access_token?: string; accessToken?: string }>('refresh_google_token', {
                  clientId,
                  clientSecret,
                  refreshToken: acc.refreshToken
                });
                activeToken = (refreshed.access_token || refreshed.accessToken)!;
                await updateAccountTokens(acc.id, activeToken);

                rawList = await invoke<RawGoogleEvent[]>('fetch_google_events', {
                  accessToken: activeToken,
                  calendarId: gCalId,
                  timeMin,
                  timeMax
                });
              }
            }

            for (const item of rawList) {
              const rawId = item.googleEventId || item.google_event_id || `g_${Date.now()}`;
              const eventId = `evt_${cal.id}_${rawId.replace(/[^a-zA-Z0-9_]/g, '_')}`;
              const startTime = item.startTime || item.start_time || new Date().toISOString();
              const endTime = item.endTime || item.end_time || new Date().toISOString();
              const isAllDay = item.isAllDay ?? item.is_all_day ?? false;
              const recurringId = item.recurringEventId || item.recurring_event_id;
              const origStart = item.originalStartTime || item.original_start_time;

              const mappedEvent: CalendarEvent = {
                id: eventId,
                calendarId: cal.id,
                googleEventId: rawId,
                recurringEventId: recurringId,
                originalStartTime: origStart,
                title: item.title || '(No Title)',
                description: cleanHtmlDescription(item.description),
                location: item.location || '',
                conferencingUrl: item.meetingUrl || item.meeting_url || '',
                conferencingProvider: (item.conferencing_provider as any) || 'google_meet',
                meetingUrl: item.meetingUrl || item.meeting_url || '',
                startTime,
                endTime,
                isAllDay,
                timeZone: item.timeZone || item.time_zone || 'UTC',
                // Retain authoritative RRULE from Google parent series
                rrule: item.rrule || 'none',
                exdates: [],
                isRecurringInstance: Boolean(recurringId || (item.rrule && item.rrule !== 'none')),
                status: (item.status as EventStatus) || 'confirmed',
                busyStatus: ((item.busyStatus || item.busy_status) as BusyStatus) || 'busy',
                visibility: 'default',
                reminders: item.reminders && item.reminders.length > 0 ? item.reminders : ['15m'],
                creatorEmail: acc.email,
                participants: item.participants || [],
                colorOverride: item.colorOverride || item.color_override,
                syncStatus: 'synced',
                updatedAt: new Date().toISOString()
              };

              syncedEvents.push(mappedEvent);
            }
          } catch (calErr: unknown) {
            console.error(`Failed to sync calendar ${cal.name}:`, calErr);
          }
        }
      }

      if (syncedEvents.length > 0) {
        await persistBatchEvents(syncedEvents);
        
        const eventMap = new Map<string, CalendarEvent>();
        for (const ev of syncedEvents) {
          eventMap.set(ev.id, ev);
        }
        this.events = Array.from(eventMap.values());
      }
    } catch (err: unknown) {
      console.error('Failed to sync events:', err);
    } finally {
      this.isSyncing = false;
    }
  }

  addEvent(event: CalendarEvent): void {
    this.events = [...this.events.filter((e: CalendarEvent) => e.id !== event.id), event];
    persistUpsertEvent(event).catch((err: unknown) => {
      console.error('Failed to persist new event:', err);
    });
  }

  updateEvent(updated: CalendarEvent): void {
    this.events = this.events.map((e: CalendarEvent) => (e.id === updated.id ? updated : e));
    persistUpsertEvent(updated).catch((err: unknown) => {
      console.error('Failed to persist updated event:', err);
    });
  }

  deleteEvent(id: string): void {
    this.events = this.events.filter((e: CalendarEvent) => e.id !== id);
    persistDeleteEvent(id).catch((err: unknown) => {
      console.error('Failed to delete event from DB:', err);
    });
  }

  rescheduleEvent(id: string, targetDate: Date): void {
    const target = this.events.find((e: CalendarEvent) => e.id === id);
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
      syncStatus: 'pending_update',
      updatedAt: new Date().toISOString()
    };

    this.updateEvent(updated);
  }
}

export const eventStore = new EventStore();