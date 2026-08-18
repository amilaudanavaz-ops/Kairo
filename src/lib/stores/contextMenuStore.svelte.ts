import type { CalendarEvent, CalendarCategory } from '../../types/event';
import { eventStore } from './eventStore.svelte';
import { calendarState } from './calendarState.svelte';
import { format, parseISO, setHours, setMinutes, subDays, isSameDay } from 'date-fns';

export type ContextMenuMode = 'event' | 'cell' | 'calendar';

export interface FieldDiff {
  field: string;
  newValue: string;
  oldValue: string;
}

export interface RecurringActionPayload {
  action: 'update' | 'delete';
  originalEvent: CalendarEvent;
  initialSnapshot?: CalendarEvent;
  updatedEvent?: CalendarEvent;
  occurrenceDate?: string;
  diffs: FieldDiff[];
}

class ContextMenuStore {
  isOpen = $state(false);
  mode = $state<ContextMenuMode>('cell');
  x = $state(0);
  y = $state(0);
  targetEvent = $state<CalendarEvent | null>(null);
  targetCalendar = $state<CalendarCategory | null>(null);
  targetDate = $state<Date | null>(null);

  // Recurrence Dialog State
  isRecurrenceModalOpen = $state(false);
  pendingRecurringAction = $state<RecurringActionPayload | null>(null);

  promptRecurringAction(
    action: 'update' | 'delete', 
    originalEvent: CalendarEvent, 
    updatedEvent?: CalendarEvent,
    occurrenceDate?: string,
    initialSnapshot?: CalendarEvent
  ) {
    const diffs: FieldDiff[] = [];

    if (action === 'update' && updatedEvent) {
      const base = initialSnapshot || originalEvent;

      const oldStart = parseISO(base.startTime);
      const oldEnd = parseISO(base.endTime);
      const newStart = parseISO(updatedEvent.startTime);
      const newEnd = parseISO(updatedEvent.endTime);

      const oldDateKey = format(oldStart, 'yyyy-MM-dd');
      const newDateKey = format(newStart, 'yyyy-MM-dd');

      if (oldDateKey !== newDateKey || oldStart.getTime() !== newStart.getTime() || oldEnd.getTime() !== newEnd.getTime()) {
        const oldFormatted = oldDateKey !== newDateKey 
          ? `${format(oldStart, 'MMM d, h:mm a')}–${format(oldEnd, 'h:mm a')}`
          : `${format(oldStart, 'h:mm a')}–${format(oldEnd, 'h:mm a')}`;

        const newFormatted = oldDateKey !== newDateKey
          ? `${format(newStart, 'MMM d, h:mm a')}–${format(newEnd, 'h:mm a')}`
          : `${format(newStart, 'h:mm a')}–${format(newEnd, 'h:mm a')}`;

        diffs.push({
          field: 'Time',
          newValue: newFormatted,
          oldValue: oldFormatted
        });
      }

      if ((base.title || '') !== (updatedEvent.title || '')) {
        diffs.push({
          field: 'Title',
          newValue: updatedEvent.title || '(No Title)',
          oldValue: base.title || '(No Title)'
        });
      }

      if ((base.description || '') !== (updatedEvent.description || '')) {
        diffs.push({
          field: 'Description',
          newValue: updatedEvent.description ? (updatedEvent.description.slice(0, 40) + '...') : '(empty)',
          oldValue: base.description ? (base.description.slice(0, 40) + '...') : '(empty)'
        });
      }

      if (base.colorOverride !== updatedEvent.colorOverride) {
        diffs.push({
          field: 'Color',
          newValue: updatedEvent.colorOverride || 'Default Color',
          oldValue: base.colorOverride || 'Default Color'
        });
      }

      if (base.rrule !== updatedEvent.rrule) {
        diffs.push({
          field: 'Repeat',
          newValue: updatedEvent.rrule || 'Does not repeat',
          oldValue: base.rrule || 'Does not repeat'
        });
      }

      if (diffs.length === 0) {
        this.isRecurrenceModalOpen = false;
        this.pendingRecurringAction = null;
        return;
      }
    }

    this.pendingRecurringAction = { 
      action, 
      originalEvent,
      initialSnapshot: initialSnapshot || originalEvent,
      updatedEvent,
      occurrenceDate: occurrenceDate || (initialSnapshot ? format(parseISO(initialSnapshot.startTime), 'yyyy-MM-dd') : undefined),
      diffs
    };
    this.isRecurrenceModalOpen = true;
  }

  executeRecurringAction(scope: 'this' | 'following' | 'all') {
    if (!this.pendingRecurringAction) return;
    const { action, originalEvent, updatedEvent, occurrenceDate } = this.pendingRecurringAction;
    const targetDateKey = occurrenceDate || format(parseISO(originalEvent.startTime), 'yyyy-MM-dd');
    const targetDate = parseISO(targetDateKey);
    const masterStart = parseISO(originalEvent.startTime);

    if (action === 'update' && updatedEvent) {
      if (scope === 'all') {
        eventStore.updateEvent({
          ...updatedEvent,
          id: originalEvent.id
        });
      } else if (scope === 'this') {
        // 1. Add date to master series exdates
        const currentExdates = originalEvent.exdates || [];
        if (!currentExdates.includes(targetDateKey)) {
          eventStore.updateEvent({
            ...originalEvent,
            exdates: [...currentExdates, targetDateKey]
          });
        }
        // 2. Insert modified instance as a detached event
        const detachedEvent: CalendarEvent = {
          ...updatedEvent,
          id: 'evt_' + Date.now(),
          recurringEventId: originalEvent.id,
          rrule: 'none',
          exdates: [],
          untilDate: undefined
        };
        eventStore.addEvent(detachedEvent);
      } else if (scope === 'following') {
        if (isSameDay(masterStart, targetDate)) {
          eventStore.updateEvent({
            ...updatedEvent,
            id: originalEvent.id
          });
        } else {
          const cutoffDateKey = format(subDays(targetDate, 1), 'yyyy-MM-dd');
          eventStore.updateEvent({
            ...originalEvent,
            untilDate: cutoffDateKey
          });

          const followingSeries: CalendarEvent = {
            ...updatedEvent,
            id: 'evt_' + Date.now(),
            recurringEventId: undefined,
            exdates: [],
            untilDate: undefined
          };
          eventStore.addEvent(followingSeries);
        }
      }
    } else if (action === 'delete') {
      if (scope === 'all') {
        eventStore.deleteEvent(originalEvent.id);
      } else if (scope === 'this') {
        const currentExdates = originalEvent.exdates || [];
        if (!currentExdates.includes(targetDateKey)) {
          eventStore.updateEvent({
            ...originalEvent,
            exdates: [...currentExdates, targetDateKey]
          });
        }
      } else if (scope === 'following') {
        if (isSameDay(masterStart, targetDate)) {
          eventStore.deleteEvent(originalEvent.id);
        } else {
          const cutoffDateKey = format(subDays(targetDate, 1), 'yyyy-MM-dd');
          eventStore.updateEvent({
            ...originalEvent,
            untilDate: cutoffDateKey
          });
        }
      }
    }

    this.isRecurrenceModalOpen = false;
    this.pendingRecurringAction = null;
    calendarState.closeInspector();
  }

  openForEvent(e: MouseEvent, event: CalendarEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.mode = 'event';
    this.targetEvent = event;
    this.targetCalendar = null;
    this.targetDate = null;
    this.setPosition(e.clientX, e.clientY, 220, 260);
    this.isOpen = true;
  }

  openForCell(e: MouseEvent, date: Date) {
    e.preventDefault();
    e.stopPropagation();
    this.mode = 'cell';
    this.targetEvent = null;
    this.targetCalendar = null;
    this.targetDate = date;
    this.setPosition(e.clientX, e.clientY, 200, 100);
    this.isOpen = true;
  }

  openForCalendar(e: MouseEvent, calendar: CalendarCategory) {
    e.preventDefault();
    e.stopPropagation();
    this.mode = 'calendar';
    this.targetCalendar = calendar;
    this.targetEvent = null;
    this.targetDate = null;
    this.setPosition(e.clientX, e.clientY, 240, 310);
    this.isOpen = true;
  }

  private setPosition(clientX: number, clientY: number, width: number, height: number) {
    this.x = Math.min(window.innerWidth - width - 12, clientX);
    this.y = Math.min(window.innerHeight - height - 12, clientY);
  }

  close() {
    this.isOpen = false;
    this.targetEvent = null;
    this.targetCalendar = null;
    this.targetDate = null;
  }

  createEventAtCell() {
    if (!this.targetDate) return;
    const now = new Date();
    const startTime = setMinutes(setHours(this.targetDate, now.getHours()), 0);
    const endTime = setMinutes(setHours(this.targetDate, now.getHours() + 1), 0);

    const primaryCal = calendarState.calendars.find(c => c.isPrimary) || calendarState.calendars[0];

    const draftEvent: CalendarEvent = {
      id: 'evt_' + Date.now(),
      calendarId: primaryCal?.id || '1',
      title: '',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      isAllDay: false,
      timeZone: 'GMT+5:30 Colombo',
      status: 'confirmed',
      busyStatus: 'busy',
      visibility: 'default',
      reminders: ['15m'],
      creatorEmail: 'amilavaz2003@gmail.com',
      syncStatus: 'pending_insert',
      updatedAt: new Date().toISOString()
    };

    calendarState.openInspector(draftEvent, new DOMRect(this.x, this.y, 20, 20), true);
    this.close();
  }

  pasteEventAtCell() {
    if (!this.targetDate || !calendarState.clipboardEvent) return;
    const clip = calendarState.clipboardEvent;
    const [year, month, day] = [this.targetDate.getFullYear(), this.targetDate.getMonth(), this.targetDate.getDate()];
    const origStart = new Date(clip.startTime);
    const origEnd = new Date(clip.endTime);
    const duration = origEnd.getTime() - origStart.getTime();

    const newStart = new Date(year, month, day, origStart.getHours(), origStart.getMinutes());
    const newEnd = new Date(newStart.getTime() + duration);

    const pastedEvent: CalendarEvent = {
      ...clip,
      id: 'evt_' + Date.now(),
      title: clip.title,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      updatedAt: new Date().toISOString()
    };

    eventStore.addEvent(pastedEvent);
    this.close();
  }

  setColorOverride(colorHex: string | undefined) {
    if (!this.targetEvent) return;
    const updated = { ...this.targetEvent, colorOverride: colorHex };
    const isRecurring = Boolean((this.targetEvent.rrule && this.targetEvent.rrule !== 'none') || this.targetEvent.recurringEventId || this.targetEvent.isRecurringInstance);

    if (isRecurring) {
      const masterEvent = eventStore.events.find(
        (e: CalendarEvent) => (this.targetEvent?.recurringEventId && (e.id === this.targetEvent.recurringEventId || e.googleEventId === this.targetEvent.recurringEventId)) || e.id === this.targetEvent?.id
      ) || this.targetEvent;

      this.promptRecurringAction('update', masterEvent, updated, this.targetEvent.occurrenceDate, this.targetEvent);
    } else {
      eventStore.updateEvent(updated);
    }
    this.close();
  }

  cut() {
    if (!this.targetEvent) return;
    calendarState.clipboardEvent = { ...this.targetEvent };
    this.delete();
  }

  copy() {
    if (!this.targetEvent) return;
    calendarState.clipboardEvent = { ...this.targetEvent };
    this.close();
  }

  duplicate() {
    if (!this.targetEvent) return;
    const duplicated: CalendarEvent = {
      ...this.targetEvent,
      id: 'evt_' + Date.now(),
      title: this.targetEvent.title + ' (Copy)',
      updatedAt: new Date().toISOString()
    };
    eventStore.addEvent(duplicated);
    this.close();
  }

  delete() {
    if (!this.targetEvent) return;
    const isRecurring = Boolean(
      (this.targetEvent.rrule && this.targetEvent.rrule !== 'none') || 
      this.targetEvent.recurringEventId || 
      this.targetEvent.isRecurringInstance
    );

    if (isRecurring) {
      const masterEvent = eventStore.events.find(
        (e: CalendarEvent) => (this.targetEvent?.recurringEventId && (e.id === this.targetEvent.recurringEventId || e.googleEventId === this.targetEvent.recurringEventId)) || e.id === this.targetEvent?.id
      ) || this.targetEvent;

      const dateKey = this.targetEvent.occurrenceDate || format(parseISO(this.targetEvent.startTime), 'yyyy-MM-dd');
      this.promptRecurringAction('delete', masterEvent, undefined, dateKey, this.targetEvent);
    } else {
      eventStore.deleteEvent(this.targetEvent.id);
      if (calendarState.selectedEventId === this.targetEvent.id) {
        calendarState.closeInspector();
      }
    }
    this.close();
  }
}

export const contextMenuStore = new ContextMenuStore();