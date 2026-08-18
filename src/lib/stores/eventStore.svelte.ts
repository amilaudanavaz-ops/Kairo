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
  loadInitialCalendars
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
  set
} from 'date-fns';
import { eventOccursOnDay } from '../utils/dateMath';
import { invoke } from '@tauri-apps/api/core';

class EventStore {
  events = $state<CalendarEvent[]>([]);
  isLoading = $state(false);

  /**
   * Retrieves all single-day and recurring event occurrences matching a date key.
   */
  getEventsForDateKey(dateKey: string): CalendarEvent[] {
    if (!dateKey) return [];
    let targetDate: Date;
    try {
      targetDate = parseISO(dateKey);
      if (!isValid(targetDate)) return [];
    } catch {
      return [];
    }

    const results: CalendarEvent[] = [];

    for (const evt of this.events) {
      if (!evt.startTime) continue;

      if (eventOccursOnDay(evt, targetDate)) {
        if (evt.recurringEventId || !evt.rrule || evt.rrule === 'none') {
          results.push({
            ...evt,
            occurrenceDate: dateKey
          });
        } else {
          // Project occurrence timestamp onto the matching day
          const origStart = parseISO(evt.startTime);
          const origEnd = evt.endTime ? parseISO(evt.endTime) : origStart;
          const duration = Math.max(15, differenceInMinutes(origEnd, origStart));

          const newStart = set(targetDate, {
            hours: origStart.getHours(),
            minutes: origStart.getMinutes(),
            seconds: origStart.getSeconds()
          });
          const newEnd = addMinutes(newStart, duration);

          results.push({
            ...evt,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
            occurrenceDate: dateKey,
            isRecurringInstance: true
          });
        }
      }
    }

    return results;
  }

  async init(): Promise<void> {
    this.isLoading = true;
    try {
      const stored = await loadStoredEvents();
      this.events = stored;
      // Auto-sync Google Calendar events in background on app start
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
    this.events = [...this.events, event];
    persistUpsertEvent(event).catch((err) => {
      console.error('Failed to persist new event:', err);
    });
  }

  updateEvent(updated: CalendarEvent): void {
    this.events = this.events.map((e) => (e.id === updated.id ? updated : e));
    persistUpsertEvent(updated).catch((err) => {
      console.error('Failed to persist updated event:', err);
    });
  }

  deleteEvent(id: string): void {
    this.events = this.events.filter((e) => e.id !== id);
    persistDeleteEvent(id).catch((err) => {
      console.error('Failed to delete event from DB:', err);
    });
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
   * Syncs and updates Google Calendar events across all registered accounts.
   */
  async syncGoogleEvents(): Promise<void> {
    try {
      const accounts = await loadAllAccountsWithTokens();
      for (const acc of accounts) {
        if (!acc.accessToken) continue;

        try {
          const [cals, events] = await invoke<any>('sync_google_calendar', {
            accessToken: acc.accessToken
          });

          if (Array.isArray(events)) {
            await clearAllGoogleEvents();
            const calendarMap = new Map<string, string>();

            for (const cal of cals) {
              const calId = 'cal_' + cal.id.replace(/[^a-zA-Z0-9_]/g, '_');
              calendarMap.set(cal.id, calId);
              const newCal: CalendarCategory = {
                id: calId,
                accountId: acc.id,
                googleCalendarId: cal.id,
                name: cal.summary || acc.email,
                colorId: 'google_custom',
                colorHex: cal.backgroundColor || cal.background_color || '#3b82f6',
                isPrimary: Boolean(cal.primary),
                isVisible: true,
                accessRole: cal.accessRole || cal.access_role || 'owner'
              };
              await persistCalendarCategory(newCal);
            }

            for (const gEvt of events) {
              if (gEvt.status === 'cancelled') continue;
              const targetCalId = calendarMap.get(gEvt.calendarId || gEvt.calendar_id || '') || calendarMap.values().next().value || 'cal_default';

              let startTime = '';
              let endTime = '';
              let isAllDay = false;

              const startDt = gEvt.start?.dateTime || gEvt.start?.date_time;
              const endDt = gEvt.end?.dateTime || gEvt.end?.date_time;
              const startDate = gEvt.start?.date;
              const endDate = gEvt.end?.date;

              if (startDt) {
                startTime = parseISO(startDt).toISOString();
                endTime = endDt ? parseISO(endDt).toISOString() : addMinutes(parseISO(startTime), 60).toISOString();
                isAllDay = false;
              } else if (startDate) {
                startTime = new Date(startDate + 'T00:00:00').toISOString();
                endTime = endDate ? new Date(endDate + 'T00:00:00').toISOString() : new Date(startDate + 'T23:59:59').toISOString();
                isAllDay = true;
              } else {
                continue;
              }

              // Parse RRULE from Google recurrence array if present
              const recurrenceRule = Array.isArray(gEvt.recurrence) && gEvt.recurrence.length > 0
                ? gEvt.recurrence[0].replace(/^RRULE:/i, '').trim()
                : 'none';

              const kairoEvt: CalendarEvent = {
                id: 'evt_g_' + gEvt.id.replace(/[^a-zA-Z0-9_]/g, '_'),
                calendarId: targetCalId,
                googleEventId: gEvt.id,
                recurringEventId: gEvt.recurringEventId || gEvt.recurring_event_id,
                title: gEvt.summary || '(No Title)',
                description: gEvt.description || '',
                location: gEvt.location || '',
                conferencingUrl: gEvt.hangoutLink || gEvt.hangout_link || '',
                conferencingProvider: 'google_meet',
                startTime,
                endTime,
                isAllDay,
                timeZone: gEvt.start?.timeZone || gEvt.start?.time_zone || 'GMT+5:30 Colombo',
                rrule: recurrenceRule,
                exdates: [],
                status: 'confirmed',
                busyStatus: gEvt.transparency === 'transparent' ? 'free' : 'busy',
                visibility: 'default',
                reminders: ['15m'],
                creatorEmail: acc.email,
                participants: gEvt.attendees ? gEvt.attendees.map((a: any) => a.email).filter(Boolean) : [],
                attachments: [],
                syncStatus: 'synced',
                updatedAt: new Date().toISOString()
              };

              await persistUpsertEvent(kairoEvt);
            }

            calendarState.calendars = await loadInitialCalendars();
            this.events = await loadStoredEvents();
          }
        } catch (err) {
          console.warn('Google calendar sync attempt failed:', err);
        }
      }
    } catch (e) {
      console.error('Failed to sync Google events:', e);
    }
  }
}

export const eventStore = new EventStore();