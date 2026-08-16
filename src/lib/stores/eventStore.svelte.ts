import type { CalendarEvent } from '../../types/event';
import { moveEventDate } from '../utils/dateMath';
import { 
  loadStoredEvents, 
  persistUpsertEvent, 
  persistDeleteEvent 
} from '../db/database';

class EventStore {
  events = $state<CalendarEvent[]>([]);
  isLoading = $state(true);

  async init() {
    try {
      const stored = await loadStoredEvents();
      if (stored.length > 0) {
        this.events = stored;
      }
    } catch (e) {
      console.warn('Using in-memory fallback events:', e);
    } finally {
      this.isLoading = false;
    }
  }

  addEvent(event: CalendarEvent) {
    this.events = [...this.events, event];
    persistUpsertEvent(event).catch(console.error);
  }

  updateEvent(updated: CalendarEvent) {
    this.events = this.events.map((e) => (e.id === updated.id ? updated : e));
    persistUpsertEvent(updated).catch(console.error);
  }

  deleteEvent(id: string) {
    this.events = this.events.filter((e) => e.id !== id);
    persistDeleteEvent(id).catch(console.error);
  }

  rescheduleEvent(eventId: string, targetDate: Date) {
    const target = this.events.find((e) => e.id === eventId);
    if (!target) return;
    const updated = moveEventDate(target, targetDate);
    this.updateEvent(updated);
  }
}

export const eventStore = new EventStore();