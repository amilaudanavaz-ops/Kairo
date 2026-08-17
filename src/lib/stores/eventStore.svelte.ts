import type { CalendarEvent } from '../../types/event';
import { loadStoredEvents, persistUpsertEvent, persistDeleteEvent } from '../db/database';
import { parseISO, setHours, setMinutes, differenceInMinutes, addMinutes } from 'date-fns';

class EventStore {
  events = $state<CalendarEvent[]>([]);
  isLoading = $state(false);

  async init(): Promise<void> {
    this.isLoading = true;
    try {
      const stored = await loadStoredEvents();
      this.events = stored;
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
}

export const eventStore = new EventStore();