import { format, parseISO, differenceInMinutes, addMinutes } from 'date-fns';
import { eventStore } from './eventStore.svelte';
import { contextMenuStore } from './contextMenuStore.svelte';
import type { CalendarEvent } from '../../types/event';

// 1x1 transparent GIF to suppress browser default drag ghost
const TRANSPARENT_PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

class DragStore {
  draggedEvent = $state<CalendarEvent | null>(null);
  isDragging = $state(false);
  dragSourceDateKey = $state<string | null>(null);
  originalOccurrenceDate = $state<string | null>(null);
  dropTargetDateKey = $state<string | null>(null);
  currentX = $state(0);
  currentY = $state(0);

  startDrag(event: CalendarEvent, sourceDateKey?: string, e?: DragEvent): void {
    this.draggedEvent = { ...event };
    this.isDragging = true;
    this.dragSourceDateKey = sourceDateKey || event.occurrenceDate || format(parseISO(event.startTime), 'yyyy-MM-dd');
    this.originalOccurrenceDate = event.occurrenceDate || this.dragSourceDateKey;

    if (e) {
      if (e.clientX > 0 && e.clientY > 0) {
        this.currentX = e.clientX;
        this.currentY = e.clientY;
      }

      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', event.id);

        // Hide default native screenshot ghost
        const img = new Image();
        img.src = TRANSPARENT_PIXEL;
        e.dataTransfer.setDragImage(img, 0, 0);
      }
    }
  }

  setDropTarget(dateKey: string | null): void {
    this.dropTargetDateKey = dateKey;
  }

  updatePosition(x: number, y: number): void {
    // Only update when valid coordinates are received (filters out Chromium 0,0 ticks)
    if (x > 0 && y > 0) {
      this.currentX = x;
      this.currentY = y;
    }
  }

  endDrag(): void {
    this.draggedEvent = null;
    this.isDragging = false;
    this.dragSourceDateKey = null;
    this.originalOccurrenceDate = null;
    this.dropTargetDateKey = null;
    this.currentX = 0;
    this.currentY = 0;
  }

  /**
   * Drops an event onto a day cell (Month view or All-day strip).
   */
  async handleDrop(targetDateKey: string): Promise<void> {
    if (!this.draggedEvent || !this.dragSourceDateKey) {
      this.endDrag();
      return;
    }

    if (this.dragSourceDateKey === targetDateKey) {
      this.endDrag();
      return;
    }

    const event = { ...this.draggedEvent };
    const originalOcc = this.originalOccurrenceDate || this.dragSourceDateKey;
    const startObj = parseISO(event.startTime);
    const endObj = parseISO(event.endTime);
    const duration = Math.max(15, differenceInMinutes(endObj, startObj));

    const [targetY, targetM, targetD] = targetDateKey.split('-').map(Number);

    let updatedStartIso: string;
    let updatedEndIso: string;

    if (event.isAllDay) {
      updatedStartIso = `${targetDateKey}T00:00:00`;
      updatedEndIso = `${targetDateKey}T00:00:00`;
    } else {
      const newStart = new Date(targetY, targetM - 1, targetD, startObj.getHours(), startObj.getMinutes(), 0);
      const newEnd = addMinutes(newStart, duration);
      updatedStartIso = newStart.toISOString();
      updatedEndIso = newEnd.toISOString();
    }

    const updatedEvent: CalendarEvent = {
      ...event,
      startTime: updatedStartIso,
      endTime: updatedEndIso,
      occurrenceDate: targetDateKey,
      updatedAt: new Date().toISOString()
    };

    const isRecurring = Boolean(
      (event.rrule && event.rrule !== 'none') ||
      event.recurringEventId ||
      event.isRecurringInstance
    );

    if (isRecurring) {
      const master = eventStore.events.find(e => 
        e.id === event.recurringEventId || 
        e.googleEventId === event.recurringEventId || 
        e.id === event.id
      ) || event;

      contextMenuStore.promptRecurringAction(
        'update',
        master,
        updatedEvent,
        originalOcc,
        event
      );
    } else {
      eventStore.updateEvent(updatedEvent);
    }

    this.endDrag();
  }

  /**
   * Drops an event onto a specific time slot (Week or Day view).
   */
  async handleDropOnTime(targetDateKey: string, hour: number, minute: number): Promise<void> {
    if (!this.draggedEvent) {
      this.endDrag();
      return;
    }

    const event = { ...this.draggedEvent };
    const originalOcc = this.originalOccurrenceDate || this.dragSourceDateKey || format(parseISO(event.startTime), 'yyyy-MM-dd');
    const startObj = parseISO(event.startTime);
    const endObj = parseISO(event.endTime);
    const duration = Math.max(15, differenceInMinutes(endObj, startObj));

    const [targetY, targetM, targetD] = targetDateKey.split('-').map(Number);
    const newStart = new Date(targetY, targetM - 1, targetD, hour, minute, 0);
    const newEnd = addMinutes(newStart, duration);

    const updatedEvent: CalendarEvent = {
      ...event,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      isAllDay: false,
      occurrenceDate: targetDateKey,
      updatedAt: new Date().toISOString()
    };

    const isRecurring = Boolean(
      (event.rrule && event.rrule !== 'none') ||
      event.recurringEventId ||
      event.isRecurringInstance
    );

    if (isRecurring) {
      const master = eventStore.events.find(e => 
        e.id === event.recurringEventId || 
        e.googleEventId === event.recurringEventId || 
        e.id === event.id
      ) || event;

      contextMenuStore.promptRecurringAction(
        'update',
        master,
        updatedEvent,
        originalOcc,
        event
      );
    } else {
      eventStore.updateEvent(updatedEvent);
    }

    this.endDrag();
  }
}

export const dragStore = new DragStore();