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
  getDb,
  deleteDbEventByGoogleId,
  getCalendarSyncToken,
  saveCalendarSyncToken,
  clearCalendarSyncToken
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
  recurring_event_id?: string;
  recurringEventId?: string;
  original_start_time?: string;
  originalStartTime?: string;
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

  let untilParam = '';
  const untilMatch = rule.match(/;?UNTIL=([^;]+)/i);
  if (untilMatch && untilMatch[1]) {
    untilParam = `;UNTIL=${untilMatch[1].trim()}`;
  }

  const baseRule = rule
    .replace(/;?UNTIL=[^;]+/gi, '')
    .replace(/^RRULE:/i, '')
    .trim();

  const d = startTimeIso && isValid(parseISO(startTimeIso)) ? parseISO(startTimeIso) : new Date();
  const dayCodes = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const dayCode = dayCodes[d.getDay()];

  let rfcBase = '';

  if (baseRule === 'daily' || baseRule === 'FREQ=DAILY') {
    rfcBase = 'RRULE:FREQ=DAILY';
  } else if (baseRule === 'weekday') {
    rfcBase = 'RRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR';
  } else if (baseRule === 'weekly' || (baseRule.includes('FREQ=WEEKLY') && !baseRule.includes('INTERVAL=2') && !baseRule.includes('MO,TU,WE,TH,FR'))) {
    rfcBase = `RRULE:FREQ=WEEKLY;BYDAY=${dayCode}`;
  } else if (baseRule === 'biweekly' || (baseRule.includes('FREQ=WEEKLY') && baseRule.includes('INTERVAL=2'))) {
    rfcBase = `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${dayCode}`;
  } else if (baseRule === 'monthly_date' || baseRule === 'monthly' || baseRule.includes('FREQ=MONTHLY;BYMONTHDAY')) {
    rfcBase = `RRULE:FREQ=MONTHLY;BYMONTHDAY=${d.getDate()}`;
  } else if (baseRule === 'monthly_day' || (baseRule.includes('FREQ=MONTHLY') && baseRule.includes('BYDAY='))) {
    const weekNum = Math.ceil(d.getDate() / 7);
    rfcBase = `RRULE:FREQ=MONTHLY;BYDAY=${weekNum}${dayCode}`;
  } else if (baseRule === 'yearly' || baseRule.includes('FREQ=YEARLY')) {
    rfcBase = 'RRULE:FREQ=YEARLY';
  } else if (baseRule.toUpperCase().startsWith('FREQ=')) {
    // If it's a custom rule with a single BYDAY, replace with new day code
    const updatedByDay = baseRule.replace(/BYDAY=[A-Z]{2}/i, `BYDAY=${dayCode}`);
    rfcBase = `RRULE:${updatedByDay}`;
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
    currentToken: string,
    fn: (token: string) => Promise<T>,
    retryCount: number = 0
  ): Promise<T> {
    try {
      return await fn(currentToken);
    } catch (err: any) {
      const errStr = typeof err === 'string' ? err : JSON.stringify(err);

      // Handle Rate Limit Exceeded with exponential backoff (up to 3 retries)
      if (errStr.includes('rateLimitExceeded') || errStr.includes('userRateLimitExceeded') || errStr.includes('403')) {
        if (retryCount < 3) {
          const delayMs = (retryCount + 1) * 800;
          await new Promise(resolve => setTimeout(resolve, delayMs));
          return this.executeWithAuthRetry(accountId, currentToken, fn, retryCount + 1);
        }
      }

      // Handle 401 Unauthorized / Expired Token
      if (errStr.includes('401') || errStr.includes('Invalid Credentials') || errStr.includes('UNAUTHENTICATED')) {
        const refreshedToken = await this.refreshAccountToken(accountId);
        if (refreshedToken) {
          return await fn(refreshedToken);
        }
      }

      throw err;
    }
  }

  private async refreshAccountToken(accountId: string): Promise<string | null> {
    try {
      const tokens = await getAccountTokens(accountId);
      if (!tokens || !tokens.refreshToken) return null;

      const dbSettings = await loadDbSettings();
      const clientId = dbSettings['google_client_id'] || '';
      const clientSecret = dbSettings['google_client_secret'] || '';

      if (!clientId || !clientSecret) {
        console.warn('Cannot refresh Google token: Missing Google OAuth Client ID or Client Secret.');
        return null;
      }

      const refreshed = await invoke<{ access_token?: string; accessToken?: string; refresh_token?: string; refreshToken?: string; expires_in?: number; expiresIn?: number }>('refresh_google_token', {
        clientId,
        clientSecret,
        refreshToken: tokens.refreshToken
      });

      const newAccessToken = refreshed?.access_token || refreshed?.accessToken;
      const newRefreshToken = refreshed?.refresh_token || refreshed?.refreshToken || tokens.refreshToken;
      const newExpiresIn = refreshed?.expires_in || refreshed?.expiresIn || 3600;

      if (newAccessToken) {
        await updateAccountTokens(
          accountId,
          newAccessToken,
          newRefreshToken
        );
        return newAccessToken;
      }

      return null;
    } catch (err) {
      console.error(`Failed to refresh token for account ${accountId}:`, err);
      return null;
    }
  }

  /* ==========================================================================
     DATE LOOKUP & PROJECTION ENGINE
     ========================================================================== */

  getEventsForDateKey(dateKey: string): CalendarEvent[] {
    const result: CalendarEvent[] = [];

    // 1. Collect all standalone events and detached child exceptions
    const standaloneAndExceptions = this.events.filter(e => 
      !e.rrule || e.rrule === 'none' || e.recurringEventId
    );

    // Track which (masterId + dateKey) occurrences have been overridden
    const overriddenOccurrences = new Set<string>();

    for (const e of standaloneAndExceptions) {
      if (e.recurringEventId) {
        const origDate = e.originalStartTime 
          ? format(parseISO(e.originalStartTime), 'yyyy-MM-dd')
          : (e.occurrenceDate || format(parseISO(e.startTime), 'yyyy-MM-dd'));
        
        overriddenOccurrences.add(`${e.recurringEventId}_${origDate}`);

        // Also cross-reference master record's alternate IDs if available
        const parentMaster = this.events.find(m => m.id === e.recurringEventId || m.googleEventId === e.recurringEventId);
        if (parentMaster) {
          overriddenOccurrences.add(`${parentMaster.id}_${origDate}`);
          if (parentMaster.googleEventId) {
            overriddenOccurrences.add(`${parentMaster.googleEventId}_${origDate}`);
          }
        }
      }

      if (eventOccursOnDay(e, dateKey)) {
        result.push(e);
      }
    }

    // 2. Collect master recurring series and project occurrences
    const masterEvents = this.events.filter(e => 
      e.rrule && e.rrule !== 'none' && !e.recurringEventId
    );

    for (const master of masterEvents) {
      const masterKey = master.id;
      const googleKey = master.googleEventId;

      // If a child exception exists for this date, suppress the master occurrence
      const isOverridden = 
        overriddenOccurrences.has(`${masterKey}_${dateKey}`) ||
        (googleKey ? overriddenOccurrences.has(`${googleKey}_${dateKey}`) : false);

      if (isOverridden) {
        continue;
      }

      if (eventOccursOnDay(master, dateKey)) {
        result.push(master);
      }
    }

    return result;
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

  private hasRegisteredListeners = false;
  private pollIntervalTimer: number | undefined;

  async init(): Promise<void> {
    this.isLoading = true;
    try {
      const stored = await loadStoredEvents();
      this.events = stored;

      // 1. Initial Google Calendar background sync
      this.syncGoogleEvents().catch((err) => {
        console.warn('Initial Google Calendar background sync failed:', err);
      });

      // 2. Register window focus & short polling interval
      if (!this.hasRegisteredListeners && typeof window !== 'undefined') {
        this.hasRegisteredListeners = true;

        // Auto-sync whenever user focuses back on the Kairo desktop app
        window.addEventListener('focus', () => {
          this.syncGoogleEvents().catch(console.warn);
        });

        // Fast delta-poll every 25 seconds using saved syncToken
        if (this.pollIntervalTimer) clearInterval(this.pollIntervalTimer);
        this.pollIntervalTimer = window.setInterval(() => {
          this.syncGoogleEvents().catch(console.warn);
        }, 25000);
      }
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
            isAllDay: Boolean(event.isAllDay),
            timeZone: sanitizeTimezone(event.timeZone),
            rrule: convertRRuleToRFC5545(event.rrule, event.startTime),
            recurringEventId: event.recurringEventId || null,
            originalStartTime: event.originalStartTime || null
          }
        })
      );

      if (created && created.google_event_id) {
        event.googleEventId = created.google_event_id;
        
        // Update in-memory state so background sync recognizes this event and doesn't duplicate it
        this.events = this.events.map(e => e.id === event.id ? { ...e, googleEventId: created.google_event_id } : e);
        await persistUpsertEvent(event);
      }
    } catch (err) {
      console.error('Outbound Google event creation failed:', err);
    }
  }

  private async dispatchGoogleUpdate(event: CalendarEvent): Promise<void> {
    if (!event.googleEventId) {
      await this.dispatchGoogleCreate(event);
      return;
    }

    const auth = await getValidTokenAndCalendar(event.calendarId);
    if (!auth) return;

    let cleanStart = event.startTime;
    let cleanEnd = event.endTime;

    if (!event.isAllDay) {
      const pStart = parseISO(event.startTime);
      const pEnd = parseISO(event.endTime);
      if (isValid(pStart)) cleanStart = pStart.toISOString();
      if (isValid(pEnd)) cleanEnd = pEnd.toISOString();
    } else {
      const sDate = event.startTime.split('T')[0];
      const eDate = (event.endTime || event.startTime).split('T')[0];
      cleanStart = `${sDate}T00:00:00`;
      cleanEnd = `${eDate}T00:00:00`;
    }

    try {
      const res = await this.executeWithAuthRetry(
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
            startTime: cleanStart,
            endTime: cleanEnd,
            isAllDay: Boolean(event.isAllDay),
            timeZone: sanitizeTimezone(event.timeZone),
            rrule: convertRRuleToRFC5545(event.rrule, cleanStart),
            recurringEventId: event.recurringEventId || null,
            originalStartTime: event.recurringEventId ? (event.originalStartTime || null) : null
          }
        })
      );

      if (res) {
        await persistUpsertEvent(event);
      }
    } catch (err) {
      console.error('Outbound Google event update failed:', err);
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
    let startIso: string;
    let endIso: string;

    if (event.isAllDay) {
      const sKey = event.startTime ? event.startTime.split('T')[0] : format(new Date(), 'yyyy-MM-dd');
      const eKey = event.endTime ? event.endTime.split('T')[0] : sKey;
      startIso = `${sKey}T00:00:00`;
      endIso = `${eKey}T00:00:00`;
    } else {
      startIso = event.startTime ? new Date(event.startTime).toISOString() : new Date().toISOString();
      endIso = event.endTime ? new Date(event.endTime).toISOString() : addMinutes(parseISO(startIso), 60).toISOString();

      if (new Date(endIso) <= new Date(startIso)) {
        endIso = addMinutes(parseISO(startIso), 60).toISOString();
      }
    }

    const newEvent: CalendarEvent = {
      ...event,
      startTime: startIso,
      endTime: endIso,
      timeZone: sanitizeTimezone(event.timeZone),
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

  updateEvent(event: CalendarEvent): void {
    const updated: CalendarEvent = {
      ...event,
      timeZone: sanitizeTimezone(event.timeZone),
      updatedAt: new Date().toISOString()
    };

    // Reassign array to trigger Svelte 5 reactivity immediately
    this.events = this.events.map(e => e.id === event.id ? updated : e);

    persistUpsertEvent(updated).catch((err) => {
      console.error('Failed to persist updated event:', err);
    });

    if (updated.reminders && updated.reminders.length > 0) {
      dispatchEventReminder(updated);
    }

    this.dispatchGoogleUpdate(updated).catch(() => {});
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
    // 1. Locate the master event record to get its canonical Google Event ID
    const master = this.events.find(e => 
      e.id === rootMasterGoogleId || 
      e.googleEventId === rootMasterGoogleId || 
      e.recurringEventId === rootMasterGoogleId
    );

    const masterGid = master?.googleEventId || (!rootMasterGoogleId.startsWith('evt_') ? rootMasterGoogleId : undefined);
    const targetCalId = calendarId || master?.calendarId;

    // 2. Filter out master and all related child instances from memory
    this.events = this.events.filter(e => {
      const matchesMaster = e.id === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId || e.recurringEventId === rootMasterGoogleId;
      const matchesGid = masterGid && (e.googleEventId === masterGid || e.recurringEventId === masterGid);
      return !(matchesMaster || matchesGid);
    });

    // 3. Purge master and child rows from SQLite
    try {
      const db = await getDb();
      await db.execute(
        `DELETE FROM events WHERE id = ?1 OR google_event_id = ?1 OR recurring_event_id = ?1 ${masterGid ? 'OR google_event_id = ?2 OR recurring_event_id = ?2' : ''};`,
        masterGid ? [rootMasterGoogleId, masterGid] : [rootMasterGoogleId]
      );
    } catch (err) {
      console.error('Failed to delete recurring series in DB:', err);
    }

    // 4. Dispatch Google Cloud deletion
    if (masterGid && targetCalId) {
      this.dispatchGoogleDelete(masterGid, targetCalId).catch(() => {});
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

    if (gEvt.is_all_day || gEvt.isAllDay || startDate) {
      isAllDay = true;
      const rawStart = gEvt.start_time || gEvt.startTime || startDate || '';
      const rawEnd = gEvt.end_time || gEvt.endTime || endDate || rawStart;

      const startDateStr = rawStart.split('T')[0];
      const endDateStr = rawEnd.split('T')[0];

      startTime = `${startDateStr}T00:00:00`;
      endTime = `${endDateStr}T00:00:00`;
    } else if (startDt) {
      startTime = parseISO(startDt).toISOString();
      endTime = endDt ? parseISO(endDt).toISOString() : addMinutes(parseISO(startTime), 60).toISOString();
      isAllDay = false;
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
      originalStartTime: gEvt.original_start_time || gEvt.originalStartTime,
      title: gEvt.title || gEvt.summary || '(No Title)',
      description: gEvt.description || '',
      location: gEvt.location || '',
      conferencingUrl: gEvt.meeting_url || gEvt.meetingUrl || gEvt.hangoutLink || gEvt.hangout_link || '',
      conferencingProvider: gEvt.conferencing_provider || gEvt.conferencingProvider || 'google_meet',
      startTime,
      endTime,
      isAllDay,
      timeZone: gEvt.time_zone || gEvt.timeZone || gEvt.start?.timeZone || 'GMT+5:30 Colombo',
      rrule: recurrenceRule,
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
          const cals = await this.executeWithAuthRetry(
            acc.id,
            acc.accessToken,
            (token) => invoke<any[]>('fetch_google_calendars', { accessToken: token })
          );

          if (Array.isArray(cals) && cals.length > 0) {
            for (const cal of cals) {
              const calId = 'cal_' + cal.id.replace(/[^a-zA-Z0-9_]/g, '_');

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

              const savedSyncToken = await getCalendarSyncToken(cal.id);

              try {
                const currentToken = (await getAccountAccessToken(acc.id)) || acc.accessToken;
                const eventsRes = await this.executeWithAuthRetry(
                  acc.id,
                  currentToken,
                  (token) => invoke<{ events: any[]; next_sync_token?: string; nextSyncToken?: string }>('fetch_google_events', {
                    accessToken: token,
                    calendarId: cal.id,
                    timeMin: null,
                    timeMax: null,
                    syncToken: savedSyncToken || null
                  })
                );

                if (eventsRes && Array.isArray(eventsRes.events)) {
                  // Map existing local events by googleEventId and by local id
                  const existingByGoogleId = new Map<string, CalendarEvent>();
                  const existingById = new Map<string, CalendarEvent>();

                  for (const e of this.events) {
                    if (e.googleEventId) existingByGoogleId.set(e.googleEventId, e);
                    existingById.set(e.id, e);
                  }

                  for (const gEvt of eventsRes.events) {
                    const rawGid = gEvt.google_event_id || gEvt.googleEventId || gEvt.id;

                    /* --------------------------------------------------------
                       1. HANDLE DELETED / CANCELLED REMOTE EVENTS
                       -------------------------------------------------------- */
                    if (gEvt.status === 'cancelled') {
                      if (!rawGid) continue;

                      const isRecurrenceException = Boolean(
                        gEvt.recurring_event_id || 
                        gEvt.recurringEventId || 
                        gEvt.original_start_time || 
                        gEvt.originalStartTime
                      );

                      if (isRecurrenceException) {
                        // Single occurrence deletion: add occurrence date to master's exdates
                        const parentMasterId = gEvt.recurring_event_id || gEvt.recurringEventId;
                        const origRaw = gEvt.original_start_time || gEvt.originalStartTime;
                        const occDateKey = origRaw ? origRaw.split('T')[0] : '';

                        if (parentMasterId && occDateKey) {
                          const master = this.events.find(e => 
                            e.id === parentMasterId || 
                            e.googleEventId === parentMasterId
                          );

                          if (master) {
                            const currentExdates = master.exdates || [];
                            if (!currentExdates.includes(occDateKey)) {
                              master.exdates = [...currentExdates, occDateKey];
                              await persistUpsertEvent(master);
                            }
                          }
                        }

                        // Remove detached child exception row from local memory and SQLite
                        this.events = this.events.filter(e => e.googleEventId !== rawGid && e.id !== rawGid);
                        await deleteDbEventByGoogleId(rawGid);
                      } else {
                        // Standard event or master recurring series deletion
                        this.events = this.events.filter(e => 
                          e.googleEventId !== rawGid && 
                          e.id !== rawGid && 
                          e.recurringEventId !== rawGid
                        );
                        await deleteDbEventByGoogleId(rawGid);
                      }
                      continue;
                    }

                    /* --------------------------------------------------------
                       2. HANDLE CREATED / UPDATED REMOTE EVENTS
                       -------------------------------------------------------- */
                    const mapped = this.mapGoogleEvent(gEvt, calId, acc.email);
                    if (mapped) {
                      const matched = existingByGoogleId.get(mapped.googleEventId || '') || existingById.get(mapped.googleEventId || '');
                      if (matched) {
                        mapped.id = matched.id;
                        // Preserve locally calculated exdates if Google did not explicitly provide them
                        if ((!mapped.exdates || mapped.exdates.length === 0) && matched.exdates && matched.exdates.length > 0) {
                          mapped.exdates = matched.exdates;
                        }
                      }
                      await persistUpsertEvent(mapped);
                    }
                  }

                  const newSyncToken = eventsRes.next_sync_token || eventsRes.nextSyncToken;
                  if (newSyncToken) {
                    await saveCalendarSyncToken(cal.id, newSyncToken);
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