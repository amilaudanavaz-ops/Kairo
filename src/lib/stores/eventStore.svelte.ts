import type { CalendarEvent } from '../../types/event';
import { 
  loadStoredEvents, 
  persistUpsertEvent, 
  persistDeleteEvent, 
  persistBatchEvents,
  loadAllAccountsWithTokens,
  updateAccountTokens 
} from '../db/database';
import { format, parseISO, setHours, setMinutes, differenceInMinutes, addMinutes, startOfDay, endOfDay, eachDayOfInterval } from 'date-fns';

class EventStore {
  events = $state<CalendarEvent[]>([]);
  isLoading = $state(false);

  // Pre-indexed O(1) Map for high-performance zero-lag grid rendering
  eventsByDate = $derived.by(() => {
    const map = new Map<string, CalendarEvent[]>();

    for (const evt of this.events) {
      if (!evt.startTime) continue;
      
      try {
        const start = parseISO(evt.startTime);
        const end = evt.endTime ? parseISO(evt.endTime) : start;

        if (evt.isAllDay) {
          const days = eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) });
          for (const d of days) {
            const key = format(d, 'yyyy-MM-dd');
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(evt);
          }
        } else {
          const key = format(start, 'yyyy-MM-dd');
          if (!map.has(key)) map.set(key, []);
          map.get(key)!.push(evt);
        }
      } catch (e) {
        console.warn('Failed to index event:', evt.id, e);
      }
    }

    return map;
  });

  // Fast O(1) helper to retrieve events for any given date
  getEventsForDateKey(dateKey: string): CalendarEvent[] {
    return this.eventsByDate.get(dateKey) || [];
  }

  async init(): Promise<void> {
    this.isLoading = true;
    try {
      const stored = await loadStoredEvents();
      this.events = stored;
    } catch (err) {
      console.error('Failed to load events from SQLite DB:', err);
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

  async syncGoogleEvents(): Promise<void> {
    const accounts = await loadAllAccountsWithTokens();
    if (accounts.length === 0) return;
  }
}

export const eventStore = new EventStore();