import type { CalendarEvent, CalendarCategory, UserAccount } from '../../types/event';
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
  getAccountAccessToken,
  getDb
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
  isSameDay, 
  isToday, 
  isBefore, 
  startOfDay, 
  endOfDay, 
  subDays, 
  addDays 
} from 'date-fns';
import { eventOccursOnDay, getEventsForDay, parseRRuleUntilDate } from '../utils/dateMath';
import { dispatchEventReminder } from '../utils/notifications';
import { invoke } from '@tauri-apps/api/core';

export interface NormalizedGoogleEvent {
  id?: string;
  summary?: string;
  description?: string | null;
  location?: string | null;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  recurrence?: string[];
  [key: string]: any;
}

export function sanitizeTimezone(tz?: string): string {
  if (!tz) return 'UTC';
  if (tz.includes('Colombo')) return 'Asia/Colombo';
  if (tz.includes('Kolkata')) return 'Asia/Kolkata';
  if (tz.includes('Karachi')) return 'Asia/Karachi';
  if (tz.includes('London')) return 'Europe/London';
  if (tz.includes('Berlin')) return 'Europe/Berlin';
  if (tz.includes('New York') || tz.includes('New_York')) return 'America/New_York';
  if (tz.includes('Los Angeles') || tz.includes('Los_Angeles')) return 'America/Los_Angeles';
  if (tz.includes('Singapore')) return 'Asia/Singapore';
  if (tz.includes('Tokyo')) return 'Asia/Tokyo';
  return tz;
}

export function convertRRuleToRFC5545(rule?: string, startTimeIso?: string): string {
  if (!rule || rule === 'none') return '';
  if (rule.toUpperCase().startsWith('RRULE:')) return rule;
  if (rule.toUpperCase().startsWith('FREQ=')) return `RRULE:${rule}`;

  const d = startTimeIso && isValid(parseISO(startTimeIso)) ? parseISO(startTimeIso) : new Date();
  const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const dayCode = dayCodes[d.getDay()];

  if (rule === 'daily') return 'RRULE:FREQ=DAILY';
  if (rule === 'weekday') return 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
  if (rule === 'weekly') return `RRULE:FREQ=WEEKLY;BYDAY=${dayCode}`;
  if (rule === 'biweekly') return `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayCode}`;
  if (rule === 'monthly_date' || rule === 'monthly') return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${d.getDate()}`;
  if (rule === 'monthly_day') {
    const weekNum = Math.ceil(d.getDate() / 7);
    return `RRULE:FREQ=MONTHLY;BYDAY=${weekNum}${dayCode}`;
  }
  if (rule === 'yearly') return `RRULE:FREQ=YEARLY`;
  return `RRULE:FREQ=WEEKLY;BYDAY=${dayCode}`;
}

export async function getValidTokenAndCalendar(calendarId: string): Promise<{ accessToken: string; googleCalendarId: string } | null> {
  const cal = calendarState.calendars.find(c => c.id === calendarId || c.googleCalendarId === calendarId);
  if (!cal) return null;
  const token = await getAccountAccessToken(cal.accountId);
  if (!token) return null;
  return {
    accessToken: token,
    googleCalendarId: cal.googleCalendarId || 'primary'
  };
}

class EventStore {
  events = $state<CalendarEvent[]>([]);
  isLoading = $state(false);
  isSyncing = $state(false);
  lastSyncedAt = $state<string | null>(null);
  searchQuery = $state('');
  selectedCalendarFilter = $state<string | null>(null);

  /* ==========================================================================
     REACTIVE DERIVATIONS
     ========================================================================== */

  filteredEvents = $derived.by(() => {
    let list = this.events;
    if (this.selectedCalendarFilter) {
      list = list.filter((e) => e.calendarId === this.selectedCalendarFilter);
    }
    if (this.searchQuery.trim()) {
      const q = this.searchQuery.toLowerCase().trim();
      list = list.filter((e) => 
        (e.title && e.title.toLowerCase().includes(q)) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q))
      );
    }
    return list;
  });

  todayEvents = $derived.by(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    return this.getEventsForDateKey(todayStr);
  });

  upcomingEvents = $derived.by(() => {
    const now = new Date();
    const futureLimit = addDays(now, 14);
    return this.getEventsForRange(now, futureLimit);
  });

  /* ==========================================================================
     DATE LOOKUP & PROJECTION ENGINE
     ========================================================================== */

  /**
   * Retrieves all single-day and recurring event occurrences matching a date key (yyyy-MM-dd).
   * Evaluates recurring formulas dynamically, honoring both untilDate and RRULE:UNTIL cutoffs.
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
          // Project occurrence timestamp onto the matching target day
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

  getEventsForDate(date: Date): CalendarEvent[] {
    return this.getEventsForDateKey(format(date, 'yyyy-MM-dd'));
  }

  getEventsForRange(startDate: Date, endDate: Date): CalendarEvent[] {
    const results: CalendarEvent[] = [];
    let current = startOfDay(startDate);
    const end = endOfDay(endDate);

    while (current <= end) {
      const dayKey = format(current, 'yyyy-MM-dd');
      const dayEvents = this.getEventsForDateKey(dayKey);
      results.push(...dayEvents);
      current = addDays(current, 1);
    }

    return results.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }

  getEventById(id: string): CalendarEvent | undefined {
    return this.events.find((e) => e.id === id);
  }

  getEventsByCalendarId(calendarId: string): CalendarEvent[] {
    return this.events.filter((e) => e.calendarId === calendarId);
  }

  /* ==========================================================================
     INITIALIZATION & LIFECYCLE
     ========================================================================== */

  async init(): Promise<void> {
    this.isLoading = true;
    try {
      const stored = await loadStoredEvents();
      this.events = stored;

      // Auto-sync Google Calendar events in background on startup
      this.syncGoogleEvents().catch((err) => {
        console.warn('Initial Google Calendar background sync failed:', err);
      });
    } catch (err) {
      console.error('Failed to load events from database:', err);
    } finally {
      this.isLoading = false;
    }
  }

  async initDatabase(): Promise<void> {
    await this.init();
  }

  /* ==========================================================================
     CRUD OPERATIONS
     ========================================================================== */

  addEvent(event: CalendarEvent): void {
    const newEvent: CalendarEvent = {
      ...event,
      updatedAt: new Date().toISOString()
    };
    this.events = [...this.events, newEvent];
    persistUpsertEvent(newEvent).catch((err) => {
      console.error('Failed to persist new event:', err);
    });

    if (newEvent.reminders && newEvent.reminders.length > 0) {
      dispatchEventReminder(newEvent);
    }
  }

  updateEvent(updated: CalendarEvent): void {
    const freshEvent: CalendarEvent = {
      ...updated,
      updatedAt: new Date().toISOString()
    };
    this.events = this.events.map((e) => (e.id === freshEvent.id ? freshEvent : e));
    persistUpsertEvent(freshEvent).catch((err) => {
      console.error('Failed to persist updated event:', err);
    });

    if (freshEvent.reminders && freshEvent.reminders.length > 0) {
      dispatchEventReminder(freshEvent);
    }
  }

  deleteEvent(id: string): void {
    this.events = this.events.filter((e) => e.id !== id);
    persistDeleteEvent(id).catch((err) => {
      console.error('Failed to delete event from database:', err);
    });
  }

  deleteEventsByCalendarId(calendarId: string): void {
    this.events = this.events.filter((e) => e.calendarId !== calendarId);
  }

  async deleteRecurringSeries(rootMasterGoogleId: string, calendarId?: string): Promise<void> {
    this.events = this.events.filter(e => 
      !(e.recurringEventId === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId || e.id === rootMasterGoogleId)
    );
    try {
      const db = await getDb();
      await db.execute(
        `DELETE FROM events WHERE id = ?1 OR google_event_id = ?1 OR recurring_event_id = ?1;`,
        [rootMasterGoogleId]
      );
    } catch (err) {
      console.error('Failed to delete recurring series in DB:', err);
    }

    if (calendarId) {
      getValidTokenAndCalendar(calendarId).then(async (auth) => {
        if (!auth) return;
        try {
          await invoke('delete_google_event', {
            accessToken: auth.accessToken,
            calendarId: auth.googleCalendarId,
            eventId: rootMasterGoogleId
          });
        } catch (e) {
          console.error('Failed to delete series on Google:', e);
        }
      });
    }
  }

  async batchUpsertEvents(newEvents: CalendarEvent[]): Promise<void> {
    const idMap = new Map(newEvents.map((e) => [e.id, e]));
    this.events = [
      ...this.events.filter((e) => !idMap.has(e.id)),
      ...newEvents
    ];
    await persistBatchEvents(newEvents);
  }

  async clearAllEvents(): Promise<void> {
    this.events = [];
    await clearAllGoogleEvents();
  }

  /* ==========================================================================
     DRAG, RESCHEDULE & TIME MUTATIONS
     ========================================================================== */

  rescheduleEvent(id: string, targetDate: Date): void {
    const target = this.events.find((e) => e.id === id);
    if (!target) return;

    const origStart = parseISO(target.startTime);
    const origEnd = target.endTime ? parseISO(target.endTime) : origStart;
    const duration = differenceInMinutes(origEnd, origStart);

    const newStart = set(targetDate, {
      hours: origStart.getHours(),
      minutes: origStart.getMinutes(),
      seconds: origStart.getSeconds()
    });
    const newEnd = addMinutes(newStart, duration);

    const updated: CalendarEvent = {
      ...target,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.updateEvent(updated);
  }

  moveEventTime(id: string, deltaMinutes: number): void {
    const target = this.events.find((e) => e.id === id);
    if (!target) return;

    const start = addMinutes(parseISO(target.startTime), deltaMinutes);
    const end = target.endTime ? addMinutes(parseISO(target.endTime), deltaMinutes) : addMinutes(start, 60);

    const updated: CalendarEvent = {
      ...target,
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.updateEvent(updated);
  }

  duplicateEvent(id: string): CalendarEvent | null {
    const target = this.events.find((e) => e.id === id);
    if (!target) return null;

    const duplicated: CalendarEvent = {
      ...target,
      id: 'evt_' + Date.now(),
      title: target.title ? `${target.title} (Copy)` : '(Copy)',
      updatedAt: new Date().toISOString()
    };

    this.addEvent(duplicated);
    return duplicated;
  }

  /* ==========================================================================
     RECURRING OCCURRENCE SPLITTING & MUTATIONS
     ========================================================================== */

  async deleteOccurrence(originalEventId: string, occurrenceDateKey: string): Promise<void> {
    const target = this.events.find((e) => e.id === originalEventId);
    if (!target) return;

    const currentExdates = target.exdates || [];
    if (!currentExdates.includes(occurrenceDateKey)) {
      this.updateEvent({
        ...target,
        exdates: [...currentExdates, occurrenceDateKey]
      });
    }
  }

  async deleteFollowingOccurrences(originalEventId: string, fromDateKey: string): Promise<void> {
    const target = this.events.find((e) => e.id === originalEventId);
    if (!target) return;

    const fromDate = parseISO(fromDateKey);
    const masterStart = parseISO(target.startTime);

    if (isSameDay(masterStart, fromDate)) {
      this.deleteEvent(target.id);
    } else {
      const cutoffDateKey = format(subDays(fromDate, 1), 'yyyy-MM-dd');
      const untilUtcStr = `${format(subDays(fromDate, 1), 'yyyyMMdd')}T235959Z`;
      const cleanRRule = target.rrule ? target.rrule.replace(/;?UNTIL=[^;]+/gi, '') : 'weekly';

      this.updateEvent({
        ...target,
        untilDate: cutoffDateKey,
        rrule: `${cleanRRule};UNTIL=${untilUtcStr}`
      });
    }
  }

  async detachOccurrence(
    originalEventId: string, 
    occurrenceDateKey: string, 
    updatedFields: Partial<CalendarEvent>
  ): Promise<CalendarEvent | null> {
    const target = this.events.find((e) => e.id === originalEventId);
    if (!target) return null;

    // 1. Exclude from master recurring series
    await this.deleteOccurrence(originalEventId, occurrenceDateKey);

    // 2. Insert detached standalone instance
    const detachedEvent: CalendarEvent = {
      ...target,
      ...updatedFields,
      id: 'evt_' + Date.now(),
      recurringEventId: target.id,
      rrule: 'none',
      exdates: [],
      untilDate: undefined,
      updatedAt: new Date().toISOString()
    };

    this.addEvent(detachedEvent);
    return detachedEvent;
  }

  async splitSeries(
    originalEventId: string, 
    splitDateKey: string, 
    updatedFields: Partial<CalendarEvent>
  ): Promise<CalendarEvent | null> {
    const target = this.events.find((e) => e.id === originalEventId);
    if (!target) return null;

    const splitDate = parseISO(splitDateKey);
    const masterStart = parseISO(target.startTime);

    if (isSameDay(masterStart, splitDate)) {
      const updated: CalendarEvent = {
        ...target,
        ...updatedFields,
        id: target.id,
        updatedAt: new Date().toISOString()
      };
      this.updateEvent(updated);
      return updated;
    }

    // 1. Terminate original series before split date
    const cutoffDateKey = format(subDays(splitDate, 1), 'yyyy-MM-dd');
    const untilUtcStr = `${format(subDays(splitDate, 1), 'yyyyMMdd')}T235959Z`;
    const cleanRRule = target.rrule ? target.rrule.replace(/;?UNTIL=[^;]+/gi, '') : 'weekly';

    this.updateEvent({
      ...target,
      untilDate: cutoffDateKey,
      rrule: `${cleanRRule};UNTIL=${untilUtcStr}`
    });

    // 2. Spawn new recurring series from split date forward
    const followingSeries: CalendarEvent = {
      ...target,
      ...updatedFields,
      id: 'evt_' + Date.now(),
      recurringEventId: undefined,
      exdates: [],
      untilDate: undefined,
      rrule: cleanRRule,
      updatedAt: new Date().toISOString()
    };

    this.addEvent(followingSeries);
    return followingSeries;
  }

  /* ==========================================================================
     GOOGLE CALENDAR SYNC ENGINE
     ========================================================================== */

  private mapGoogleEvent(gEvt: any, targetCalId: string, accountEmail: string): CalendarEvent | null {
    if (gEvt.status === 'cancelled') return null;

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
      return null;
    }

    // Preserve the raw recurrence rule (including any embedded UNTIL= parameter)
    const recurrenceRule = Array.isArray(gEvt.recurrence) && gEvt.recurrence.length > 0
      ? gEvt.recurrence[0].replace(/^RRULE:/i, '').trim()
      : 'none';

    // Extract UNTIL cutoff if present in the recurrence string
    let extractedUntilDate: string | undefined = undefined;
    if (recurrenceRule !== 'none') {
      const untilMatch = recurrenceRule.match(/UNTIL=([^;]+)/i);
      if (untilMatch && untilMatch[1]) {
        const parsed = parseRRuleUntilDate(untilMatch[1]);
        if (parsed) {
          extractedUntilDate = format(parsed, 'yyyy-MM-dd');
        }
      }
    }

    return {
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
      untilDate: extractedUntilDate,
      status: 'confirmed',
      busyStatus: gEvt.transparency === 'transparent' ? 'free' : 'busy',
      visibility: 'default',
      reminders: ['15m'],
      creatorEmail: accountEmail,
      participants: gEvt.attendees ? gEvt.attendees.map((a: any) => a.email).filter(Boolean) : [],
      attachments: [],
      syncStatus: 'synced',
      updatedAt: new Date().toISOString()
    };
  }

  async syncGoogleEvents(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

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

            const parsedEvents: CalendarEvent[] = [];
            for (const gEvt of events) {
              const targetCalId = calendarMap.get(gEvt.calendarId || gEvt.calendar_id || '') || calendarMap.values().next().value || 'cal_default';
              const mapped = this.mapGoogleEvent(gEvt, targetCalId, acc.email);
              if (mapped) {
                parsedEvents.push(mapped);
                await persistUpsertEvent(mapped);
              }
            }

            calendarState.calendars = await loadInitialCalendars();
            this.events = await loadStoredEvents();
            this.lastSyncedAt = new Date().toISOString();
          }
        } catch (err) {
          console.warn(`Failed syncing Google account (${acc.email}):`, err);
        }
      }
    } catch (e) {
      console.error('Fatal Google Calendar sync error:', e);
    } finally {
      this.isSyncing = false;
    }
  }
}

export const eventStore = new EventStore();