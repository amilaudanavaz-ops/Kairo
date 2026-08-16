import type { CalendarEvent } from '../../types/event';
import { moveEventDate } from '../utils/dateMath';

class EventStore {
  events = $state<CalendarEvent[]>([
    {
      id: 'evt_1',
      calendarId: '1',
      title: 'Mathematics for Computing',
      startTime: '2026-08-01T08:00:00.000Z',
      endTime: '2026-08-01T10:00:00.000Z',
      isAllDay: false,
      timeZone: 'UTC',
      status: 'confirmed',
      busyStatus: 'busy',
      syncStatus: 'synced',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt_2',
      calendarId: '2',
      title: 'VNOOIR - Lab Scraping',
      startTime: '2026-08-08T05:00:00.000Z',
      endTime: '2026-08-08T07:00:00.000Z',
      isAllDay: false,
      timeZone: 'UTC',
      status: 'confirmed',
      busyStatus: 'busy',
      syncStatus: 'synced',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt_3',
      calendarId: '2',
      title: 'Generate Video - Morning',
      startTime: '2026-08-08T10:00:00.000Z',
      endTime: '2026-08-08T11:00:00.000Z',
      isAllDay: false,
      timeZone: 'UTC',
      status: 'confirmed',
      busyStatus: 'busy',
      syncStatus: 'synced',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt_4',
      calendarId: '2',
      title: 'Generate Audio - Night',
      startTime: '2026-08-08T11:00:00.000Z',
      endTime: '2026-08-08T12:00:00.000Z',
      isAllDay: false,
      timeZone: 'UTC',
      status: 'confirmed',
      busyStatus: 'busy',
      syncStatus: 'synced',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt_5',
      calendarId: '2',
      title: 'VNOOIR Manual Research',
      startTime: '2026-08-08T13:00:00.000Z',
      endTime: '2026-08-08T15:00:00.000Z',
      isAllDay: false,
      timeZone: 'UTC',
      status: 'confirmed',
      busyStatus: 'busy',
      syncStatus: 'synced',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt_6',
      calendarId: '1',
      title: 'Semi Reset 🧹',
      startTime: '2026-08-08T16:00:00.000Z',
      endTime: '2026-08-08T17:00:00.000Z',
      isAllDay: false,
      timeZone: 'UTC',
      status: 'confirmed',
      busyStatus: 'busy',
      syncStatus: 'synced',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'evt_7',
      calendarId: '3',
      title: 'Esala Full Moon Poya Day',
      startTime: '2026-08-28T00:00:00.000Z',
      endTime: '2026-08-28T23:59:59.000Z',
      isAllDay: true,
      timeZone: 'UTC',
      status: 'confirmed',
      busyStatus: 'free',
      syncStatus: 'synced',
      updatedAt: new Date().toISOString()
    }
  ]);

  addEvent(event: CalendarEvent) {
    this.events = [...this.events, event];
  }

  updateEvent(updated: CalendarEvent) {
    this.events = this.events.map((e) => (e.id === updated.id ? updated : e));
  }

  deleteEvent(id: string) {
    this.events = this.events.filter((e) => e.id !== id);
  }

  rescheduleEvent(eventId: string, targetDate: Date) {
    const target = this.events.find((e) => e.id === eventId);
    if (!target) return;
    const updated = moveEventDate(target, targetDate);
    this.updateEvent(updated);
  }
}

export const eventStore = new EventStore();