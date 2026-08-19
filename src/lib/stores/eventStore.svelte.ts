import type { CalendarEvent, CalendarCategory, UserAccount, SyncStatus } from '../../types/event';
import { 
  loadStoredEvents, 
  persistUpsertEvent, 
  persistDeleteEvent, 
  persistBatchEvents, 
  loadAllAccountsWithTokens, 
  updateAccountTokens, 
  persistCalendarCategory, 
  loadInitialCalendars, 
  getAccountAccessToken,
  getAccountTokens,
  loadDbSettings,
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
  google_event_id?: string;
  summary?: string;
  title?: string;
  description?: string | null;
  location?: string | null;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string; timeZone?: string };
  start_time?: string;
  end_time?: string;
  is_all_day?: boolean;
  time_zone?: string;
  recurrence?: string[];
  rrule?: string;
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

/**
 * Converts shorthand or mixed recurrence strings into strict RFC 5545 format.
 * Preserves embedded UNTIL cutoff parameters during series splits.
 */
export function convertRRuleToRFC5545(rule?: string, startTimeIso?: string): string {
  if (!rule || rule === 'none') return '';

  // 1. Extract and preserve any existing UNTIL parameter
  let untilParam = '';
  const untilMatch = rule.match(/;?UNTIL=([^;]+)/i);
  if (untilMatch && untilMatch[1]) {
    untilParam = `;UNTIL=${untilMatch[1].trim()}`;
  }

  // 2. Clean the base rule of any UNTIL suffix or RRULE prefix
  const baseRule = rule
    .replace(/;?UNTIL=[^;]+/gi, '')
    .replace(/^RRULE:/i, '')
    .trim();

  const d = startTimeIso && isValid(parseISO(startTimeIso)) ? parseISO(startTimeIso) : new Date();
  const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const dayCode = dayCodes[d.getDay()];

  let rfcBase = '';

  if (baseRule.toUpperCase().startsWith('FREQ=')) {
    rfcBase = `RRULE:${baseRule}`;
  } else if (baseRule === 'daily') {
    rfcBase = 'RRULE:FREQ=DAILY';
  } else if (baseRule === 'weekday') {
    rfcBase = 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
  } else if (baseRule === 'weekly') {
    rfcBase = `RRULE:FREQ=WEEKLY;BYDAY=${dayCode}`;
  } else if (baseRule === 'biweekly') {
    rfcBase = `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayCode}`;
  } else if (baseRule === 'monthly_date' || baseRule === 'monthly') {
    rfcBase = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${d.getDate()}`;
  } else if (baseRule === 'monthly_day') {
    const weekNum = Math.ceil(d.getDate() / 7);
    rfcBase = `RRULE:FREQ=MONTHLY;BYDAY=${weekNum}${dayCode}`;
  } else if (baseRule === 'yearly') {
    rfcBase = 'RRULE:FREQ=YEARLY';
  } else if (!baseRule || baseRule === 'none') {
    return '';
  } else {
    rfcBase = `RRULE:${baseRule}`;
  }

  return `${rfcBase}${untilParam}`;
}

export async function getValidTokenAndCalendar(calendarId: string): Promise<{ accessToken: string; googleCalendarId: string; accountId: string } | null> {
  let cal = calendarState.calendars.find(c => c.id === calendarId || c.googleCalendarId === calendarId);
  if (!cal && calendarState.calendars.length > 0) {
    cal = calendarState.calendars.find(c => c.isPrimary) || calendarState.calendars[0];
  }
  if (!cal) {
    const dbCals = await loadInitialCalendars();
    cal = dbCals.find(c => c.id === calendarId || c.googleCalendarId === calendarId) || dbCals.find(c => c.isPrimary) || dbCals[0];
  }
  if (!cal) return null;

  const token = await getAccountAccessToken(cal.accountId);
  if (!token) return null;
  return {
    accessToken: token,
    googleCalendarId: cal.googleCalendarId || 'primary',
    accountId: cal.accountId
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
     OAUTH TOKEN REFRESH INTERCEPTOR
     ========================================================================== */

  private async refreshAccessTokenForAccount(accountId: string): Promise<string | null> {
    try {
      const tokens = await getAccountTokens(accountId);
      if (!tokens.refreshToken) {
        console.warn(`Cannot refresh token for account ${accountId}: Missing refresh token.`);
        return null;
      }

      const settings = await loadDbSettings();
      const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID || settings['google_client_id'] || settings['googleClientId'] || '').trim();
      const clientSecret = (import.meta.env.VITE_GOOGLE_CLIENT_SECRET || settings['google_client_secret'] || settings['googleClientSecret'] || '').trim();

      if (!clientId || !clientSecret) {
        console.warn('Cannot refresh Google token: Client ID or Client Secret missing.');
        return null;
      }

      const res = await invoke<{ access_token: string; refresh_token?: string }>('refresh_google_token', {
        clientId,
        clientSecret,
        refreshToken: tokens.refreshToken
      });

      if (res && res.access_token) {
        await updateAccountTokens(accountId, res.access_token, res.refresh_token);
        return res.access_token;
      }
    } catch (err) {
      console.error(`Token refresh failed for account ${accountId}:`, err);
    }
    return null;
  }

  private async executeWithAuthRetry<T>(
    accountId: string, 
    currentAccessToken: string, 
    action: (token: string) => Promise<T>
  ): Promise<T> {
    try {
      return await action(currentAccessToken);
    } catch (err: any) {
      const errStr = typeof err === 'string' ? err : JSON.stringify(err);
      if (errStr.includes('401') || errStr.includes('UNAUTHENTICATED') || errStr.includes('authError')) {
        console.info(`Encountered 401 for account ${accountId}. Refreshing OAuth token...`);
        const freshToken = await this.refreshAccessTokenForAccount(accountId);
        if (freshToken) {
          return await action(freshToken);
        }
      }
      throw err;
    }
  }

  /* ==========================================================================
     DATE LOOKUP & PROJECTION ENGINE
     ========================================================================== */

  getEventsForDateKey(dateKey: string): CalendarEvent[] {
    if (!dateKey) return [];
    let targetDate: Date;
    try {
      targetDate = parseISO(dateKey);
      if (!isValid(targetDate)) return [];
    } catch {
      return [];
    }

    const hiddenCalendarIds = new Set(
      calendarState.calendars
        .filter(c => !c.isVisible)
        .flatMap(c => [c.id, c.googleCalendarId].filter(Boolean) as string[])
    );

    const results: CalendarEvent[] = [];

    for (const evt of this.events) {
      if (!evt.startTime) continue;
      if (hiddenCalendarIds.has(evt.calendarId)) continue;

      if (eventOccursOnDay(evt, targetDate)) {
        if (evt.recurringEventId || !evt.rrule || evt.rrule === 'none') {
          results.push({
            ...evt,
            occurrenceDate: dateKey
          });
        } else {
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
     OUTBOUND GOOGLE CALENDAR DISPATCHERS
     ========================================================================== */

  private async dispatchGoogleCreate(event: CalendarEvent): Promise<void> {
    const auth = await getValidTokenAndCalendar(event.calendarId);
    if (!auth) return;

    try {
      const created = await this.executeWithAuthRetry(
        auth.accountId,
        auth.accessToken,
        (token) => invoke<NormalizedGoogleEvent>('create_google_event', {
          accessToken: token,
          calendarId: auth.googleCalendarId,
          event: {
            title: event.title || '(No Title)',
            description: event.description || null,
            location: event.location || null,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
            timeZone: sanitizeTimezone(event.timeZone),
            rrule: convertRRuleToRFC5545(event.rrule, event.startTime)
          }
        })
      );

      if (created && (created.google_event_id || created.id)) {
        const gid = created.google_event_id || created.id;
        const updatedWithGid: CalendarEvent = { 
          ...event, 
          googleEventId: gid, 
          syncStatus: 'synced' as SyncStatus
        };
        this.events = this.events.map(e => e.id === event.id ? updatedWithGid : e);
        await persistUpsertEvent(updatedWithGid);
      }
    } catch (err) {
      console.warn('Outbound Google event creation failed:', err);
    }
  }

  private async dispatchGoogleUpdate(event: CalendarEvent): Promise<void> {
    if (!event.googleEventId) {
      await this.dispatchGoogleCreate(event);
      return;
    }

    const auth = await getValidTokenAndCalendar(event.calendarId);
    if (!auth) return;

    try {
      await this.executeWithAuthRetry(
        auth.accountId,
        auth.accessToken,
        (token) => invoke<NormalizedGoogleEvent>('update_google_event', {
          accessToken: token,
          calendarId: auth.googleCalendarId,
          eventId: event.googleEventId,
          event: {
            title: event.title || '(No Title)',
            description: event.description || null,
            location: event.location || null,
            startTime: event.startTime,
            endTime: event.endTime,
            isAllDay: event.isAllDay,
            timeZone: sanitizeTimezone(event.timeZone),
            rrule: convertRRuleToRFC5545(event.rrule, event.startTime)
          }
        })
      );
    } catch (err) {
      console.warn('Outbound Google event update failed:', err);
    }
  }

  private async dispatchGoogleDelete(googleEventId: string, calendarId: string): Promise<void> {
    const auth = await getValidTokenAndCalendar(calendarId);
    if (!auth) return;

    try {
      await this.executeWithAuthRetry(
        auth.accountId,
        auth.accessToken,
        (token) => invoke('delete_google_event', {
          accessToken: token,
          calendarId: auth.googleCalendarId,
          eventId: googleEventId
        })
      );
    } catch (err) {
      console.warn('Outbound Google event deletion failed:', err);
    }
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

    this.dispatchGoogleCreate(newEvent).catch(() => {});
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

    this.dispatchGoogleUpdate(freshEvent).catch(() => {});
  }

  deleteEvent(id: string): void {
    const target = this.events.find(e => e.id === id);
    this.events = this.events.filter((e) => e.id !== id);
    persistDeleteEvent(id).catch((err) => {
      console.error('Failed to delete event from database:', err);
    });

    if (target?.googleEventId) {
      this.dispatchGoogleDelete(target.googleEventId, target.calendarId).catch(() => {});
    }
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
      this.dispatchGoogleDelete(rootMasterGoogleId, calendarId).catch(() => {});
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
    try {
      const db = await getDb();
      await db.execute(`DELETE FROM events;`);
    } catch (e) {
      console.error('Failed to clear events:', e);
    }
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
      googleEventId: undefined,
      title: target.title ? `${target.title} (Copy)` : '(Copy)',
      updatedAt: new Date().toISOString()
    };

    this.addEvent(duplicated);
    return duplicated;
  }

  /* ==========================================================================
     GOOGLE CALENDAR SYNC ENGINE (NON-DESTRUCTIVE MERGE)
     ========================================================================== */

  private mapGoogleEvent(gEvt: any, targetCalId: string, accountEmail: string): CalendarEvent | null {
    if (gEvt.status === 'cancelled') return null;

    let startTime = '';
    let endTime = '';
    let isAllDay = false;

    const startDt = gEvt.start_time || gEvt.startTime || gEvt.start?.dateTime || gEvt.start?.date_time;
    const endDt = gEvt.end_time || gEvt.endTime || gEvt.end?.dateTime || gEvt.end?.date_time;
    const startDate = gEvt.start?.date;
    const endDate = gEvt.end?.date;

    if (startDt) {
      startTime = parseISO(startDt).toISOString();
      endTime = endDt ? parseISO(endDt).toISOString() : addMinutes(parseISO(startTime), 60).toISOString();
      isAllDay = Boolean(gEvt.is_all_day || gEvt.isAllDay);
    } else if (startDate) {
      startTime = new Date(startDate + 'T00:00:00').toISOString();
      endTime = endDate ? new Date(endDate + 'T00:00:00').toISOString() : new Date(startDate + 'T23:59:59').toISOString();
      isAllDay = true;
    } else {
      return null;
    }

    const recurrenceRule = Array.isArray(gEvt.recurrence) && gEvt.recurrence.length > 0
      ? gEvt.recurrence[0].replace(/^RRULE:/i, '').trim()
      : (gEvt.rrule || 'none');

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

    const rawGid = gEvt.google_event_id || gEvt.googleEventId || gEvt.id || String(Date.now());

    return {
      id: 'evt_g_' + rawGid.replace(/[^a-zA-Z0-9_]/g, '_'),
      calendarId: targetCalId,
      googleEventId: rawGid,
      recurringEventId: gEvt.recurring_event_id || gEvt.recurringEventId,
      title: gEvt.title || gEvt.summary || '(No Title)',
      description: gEvt.description || '',
      location: gEvt.location || '',
      conferencingUrl: gEvt.meeting_url || gEvt.meetingUrl || gEvt.hangoutLink || gEvt.hangout_link || '',
      conferencingProvider: gEvt.conferencing_provider || gEvt.conferencingProvider || 'google_meet',
      startTime,
      endTime,
      isAllDay,
      timeZone: gEvt.time_zone || gEvt.timeZone || gEvt.start?.timeZone || 'GMT+5:30 Colombo',
      rrule: gEvt.rrule || recurrenceRule,
      exdates: [],
      untilDate: extractedUntilDate,
      status: 'confirmed',
      busyStatus: gEvt.busy_status || gEvt.busyStatus || (gEvt.transparency === 'transparent' ? 'free' : 'busy'),
      visibility: 'default',
      reminders: ['15m'],
      creatorEmail: accountEmail,
      participants: gEvt.participants || (gEvt.attendees ? gEvt.attendees.map((a: any) => a.email).filter(Boolean) : []),
      attachments: [],
      syncStatus: 'synced' as SyncStatus,
      updatedAt: new Date().toISOString()
    };
  }

  async syncGoogleEvents(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;

    try {
      const accounts = await loadAllAccountsWithTokens();
      const existingCalendars = await loadInitialCalendars();
      const existingVisibilityMap = new Map(existingCalendars.map(c => [c.googleCalendarId || c.id, c.isVisible]));
      const existingColorMap = new Map(existingCalendars.map(c => [c.googleCalendarId || c.id, c.colorHex]));

      for (const acc of accounts) {
        if (!acc.accessToken) continue;

        try {
          // 1. Fetch calendars with automatic token refresh
          const cals = await this.executeWithAuthRetry(
            acc.id,
            acc.accessToken,
            (token) => invoke<any[]>('fetch_google_calendars', { accessToken: token })
          );

          if (Array.isArray(cals) && cals.length > 0) {
            const calendarMap = new Map<string, string>();

            for (const cal of cals) {
              const calId = 'cal_' + cal.id.replace(/[^a-zA-Z0-9_]/g, '_');
              calendarMap.set(cal.id, calId);

              const preservedVisibility = existingVisibilityMap.has(cal.id)
                ? existingVisibilityMap.get(cal.id)!
                : (existingVisibilityMap.has(calId) ? existingVisibilityMap.get(calId)! : true);

              const preservedColor = existingColorMap.get(cal.id) 
                || existingColorMap.get(calId) 
                || cal.background_color 
                || cal.backgroundColor 
                || '#3b82f6';

              const newCal: CalendarCategory = {
                id: calId,
                accountId: acc.id,
                googleCalendarId: cal.id,
                name: cal.summary || acc.email,
                colorId: 'google_custom',
                colorHex: preservedColor,
                isPrimary: Boolean(cal.primary),
                isVisible: preservedVisibility,
                accessRole: cal.access_role || cal.accessRole || 'owner'
              };
              await persistCalendarCategory(newCal);

              // 2. Fetch master events with automatic token refresh (singleEvents=false)
              try {
                const currentToken = (await getAccountAccessToken(acc.id)) || acc.accessToken;
                const eventsRes = await this.executeWithAuthRetry(
                  acc.id,
                  currentToken,
                  (token) => invoke<{ events: any[] }>('fetch_google_events', {
                    accessToken: token,
                    calendarId: cal.id,
                    timeMin: null,
                    timeMax: null,
                    syncToken: null
                  })
                );

                if (eventsRes && Array.isArray(eventsRes.events)) {
                  // Build lookup of current in-memory events to merge records and prevent ID churn
                  const existingGoogleEventMap = new Map<string, CalendarEvent>();
                  for (const e of this.events) {
                    if (e.googleEventId) {
                      existingGoogleEventMap.set(e.googleEventId, e);
                    }
                  }

                  for (const gEvt of eventsRes.events) {
                    const mapped = this.mapGoogleEvent(gEvt, calId, acc.email);
                    if (mapped) {
                      const matched = existingGoogleEventMap.get(mapped.googleEventId || '');
                      if (matched) {
                        mapped.id = matched.id;
                      }
                      await persistUpsertEvent(mapped);
                    }
                  }
                }
              } catch (evtErr) {
                console.warn(`Failed fetching events for calendar ${cal.id}:`, evtErr);
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