import type { CalendarEvent } from '../../types/event';
import { eventStore } from './eventStore.svelte';
import { calendarState } from './calendarState.svelte';
import { format, parseISO, setHours, setMinutes } from 'date-fns';

export type ContextMenuMode = 'event' | 'cell';

export interface FieldDiff {
  field: string;
  newValue: string;
  oldValue: string;
}

export interface RecurringActionPayload {
  action: 'update' | 'delete';
  originalEvent: CalendarEvent;
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
  targetDate = $state<Date | null>(null);

  // Recurrence Dialog State
  isRecurrenceModalOpen = $state(false);
  pendingRecurringAction = $state<RecurringActionPayload | null>(null);

  promptRecurringAction(
    action: 'update' | 'delete', 
    originalEvent: CalendarEvent, 
    updatedEvent?: CalendarEvent,
    occurrenceDate?: string
  ) {
    const diffs: FieldDiff[] = [];

    if (action === 'update' && updatedEvent) {
      const oldStart = parseISO(originalEvent.startTime);
      const oldEnd = parseISO(originalEvent.endTime);
      const newStart = parseISO(updatedEvent.startTime);
      const newEnd = parseISO(updatedEvent.endTime);

      const oldTimeStr = `${format(oldStart, 'h:mm a')}–${format(oldEnd, 'h:mm a')}`;
      const newTimeStr = `${format(newStart, 'h:mm a')}–${format(newEnd, 'h:mm a')}`;
      const oldDateStr = format(oldStart, 'MMM d');
      const newDateStr = format(newStart, 'MMM d');

      // Date / Time Diff
      if (oldDateStr !== newDateStr || oldTimeStr !== newTimeStr) {
        diffs.push({
          field: 'Time',
          newValue: oldDateStr !== newDateStr ? `${newDateStr}, ${newTimeStr}` : newTimeStr,
          oldValue: oldDateStr !== newDateStr ? `${oldDateStr}, ${oldTimeStr}` : oldTimeStr
        });
      }

      // Title Diff
      if ((originalEvent.title || '') !== (updatedEvent.title || '')) {
        diffs.push({
          field: 'Title',
          newValue: updatedEvent.title || '(No Title)',
          oldValue: originalEvent.title || '(No Title)'
        });
      }

      // Description Diff
      if ((originalEvent.description || '') !== (updatedEvent.description || '')) {
        diffs.push({
          field: 'Description',
          newValue: updatedEvent.description ? (updatedEvent.description.slice(0, 45) + '...') : '(empty)',
          oldValue: originalEvent.description ? (originalEvent.description.slice(0, 45) + '...') : '(empty)'
        });
      }

      // Color Diff
      if (originalEvent.colorOverride !== updatedEvent.colorOverride) {
        diffs.push({
          field: 'Color',
          newValue: updatedEvent.colorOverride || 'Default',
          oldValue: originalEvent.colorOverride || 'Default'
        });
      }
    }

    this.pendingRecurringAction = { 
      action, 
      originalEvent, 
      updatedEvent,
      occurrenceDate: occurrenceDate || originalEvent.occurrenceDate,
      diffs
    };
    this.isRecurrenceModalOpen = true;
  }

  openForEvent(e: MouseEvent, event: CalendarEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.mode = 'event';
    this.targetEvent = event;
    this.targetDate = null;
    this.setPosition(e.clientX, e.clientY, 220, 260);
    this.isOpen = true;
  }

  openForCell(e: MouseEvent, date: Date) {
    e.preventDefault();
    e.stopPropagation();
    this.mode = 'cell';
    this.targetEvent = null;
    this.targetDate = date;
    this.setPosition(e.clientX, e.clientY, 200, 100);
    this.isOpen = true;
  }

  private setPosition(clientX: number, clientY: number, width: number, height: number) {
    this.x = Math.min(window.innerWidth - width - 12, clientX);
    this.y = Math.min(window.innerHeight - height - 12, clientY);
  }

  close() {
    this.isOpen = false;
    this.targetEvent = null;
    this.targetDate = null;
  }

  createEventAtCell() {
    if (!this.targetDate) return;
    const now = new Date();
    const startTime = setMinutes(setHours(this.targetDate, now.getHours()), 0);
    const endTime = setMinutes(setHours(this.targetDate, now.getHours() + 1), 0);

    const newEvent: CalendarEvent = {
      id: 'evt_' + Date.now(),
      calendarId: calendarState.calendars[0]?.id || '1',
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

    eventStore.addEvent(newEvent);
    calendarState.openInspector(newEvent, new DOMRect(this.x, this.y, 20, 20), true);
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
    if (this.targetEvent.rrule && this.targetEvent.rrule !== 'none') {
      this.promptRecurringAction('update', this.targetEvent, updated, this.targetEvent.occurrenceDate);
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
    if (this.targetEvent.rrule && this.targetEvent.rrule !== 'none') {
      this.promptRecurringAction('delete', this.targetEvent, undefined, this.targetEvent.occurrenceDate);
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