import { calendarState } from './calendarState.svelte';
import { eventStore } from './eventStore.svelte';
import { contextMenuStore } from './contextMenuStore.svelte';
import type { CalendarEvent } from '../../types/event';
import { 
  parseISO, 
  format, 
  set, 
  isValid, 
  differenceInMinutes, 
  addMinutes 
} from 'date-fns';

class DragStore {
  draggedEvent = $state<CalendarEvent | null>(null);
  isDragging = $state(false);
  dragSourceDateKey = $state<string | null>(null);
  originalOccurrenceDate = $state<string | null>(null);
  dropTargetDateKey = $state<string | null>(null);
  hoveredDateKey = $state<string | null>(null);
  currentX = $state(0);
  currentY = $state(0);

  /* ==========================================================================
     DRAG LIFECYCLE HANDLERS
     ========================================================================== */

  startDrag(event: CalendarEvent, sourceDateKey?: string, x?: number, y?: number): void {
    this.draggedEvent = { ...event };
    this.isDragging = true;
    this.dragSourceDateKey = sourceDateKey || event.occurrenceDate || format(parseISO(event.startTime), 'yyyy-MM-dd');
    this.originalOccurrenceDate = event.occurrenceDate || this.dragSourceDateKey;
    if (x !== undefined) this.currentX = x;
    if (y !== undefined) this.currentY = y;
  }

  updatePosition(x: number, y: number): void {
    this.currentX = x;
    this.currentY = y;
  }

  setDropTarget(dateKey: string | null): void {
    this.dropTargetDateKey = dateKey;
    this.hoveredDateKey = dateKey;
  }

  endDrag(): void {
    this.draggedEvent = null;
    this.isDragging = false;
    this.dragSourceDateKey = null;
    this.originalOccurrenceDate = null;
    this.dropTargetDateKey = null;
    this.hoveredDateKey = null;
  }

  /* ==========================================================================
     DROP & MUTATION DISPATCHER
     ========================================================================== */

  handleDrop(targetDateKey: string): void {
    if (!this.draggedEvent || !targetDateKey) {
      this.endDrag();
      return;
    }

    const event = this.draggedEvent;
    const sourceKey = this.dragSourceDateKey || event.occurrenceDate || format(parseISO(event.startTime), 'yyyy-MM-dd');
    const originalOccurrence = this.originalOccurrenceDate || sourceKey;

    // Skip if dropped onto the exact same calendar day
    if (sourceKey === targetDateKey) {
      this.endDrag();
      return;
    }

    let targetDate: Date;
    try {
      targetDate = parseISO(targetDateKey);
      if (!isValid(targetDate)) {
        this.endDrag();
        return;
      }
    } catch {
      this.endDrag();
      return;
    }

    const origStart = parseISO(event.startTime);
    const origEnd = event.endTime ? parseISO(event.endTime) : origStart;
    const duration = Math.max(15, differenceInMinutes(origEnd, origStart));

    const newStart = set(targetDate, {
      hours: origStart.getHours(),
      minutes: origStart.getMinutes(),
      seconds: origStart.getSeconds()
    });
    const newEnd = addMinutes(newStart, duration);

    const updatedEvent: CalendarEvent = {
      ...event,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      occurrenceDate: targetDateKey,
      updatedAt: new Date().toISOString()
    };

    // Check if event is recurring
    const isRecurring = Boolean(
      event.recurringEventId || 
      (event.rrule && event.rrule !== 'none') || 
      event.isRecurringInstance
    );

    if (isRecurring) {
      contextMenuStore.promptRecurringAction(
        'update',
        event,
        updatedEvent,
        originalOccurrence,
        event
      );
    } else {
      eventStore.updateEvent(updatedEvent);
    }

    this.endDrag();
  }
}

export const dragStore = new DragStore();