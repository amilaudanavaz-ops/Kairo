import type { CalendarEvent } from '../../types/event';
import { eventStore } from './eventStore.svelte';
import { contextMenuStore } from './contextMenuStore.svelte';
import { parseISO, addMinutes, differenceInMinutes, setHours, setMinutes, format } from 'date-fns';
import { HOUR_HEIGHT_PX } from '../utils/timeMath';

export type DragMode = 'move' | 'resize-top' | 'resize-bottom';

class TimelineDragStore {
  isDragging = $state(false);
  dragMode = $state<DragMode>('move');
  activeEvent = $state<CalendarEvent | null>(null);
  
  previewTop = $state(0);
  previewHeight = $state(0);
  previewDateKey = $state<string | null>(null);

  private startClientY = 0;
  private startClientX = 0;
  private initialEventStart = new Date();
  private initialEventEnd = new Date();
  private initialTop = 0;
  private initialHeight = 0;
  private targetDay: Date = new Date();

  startTimelineDrag(
    e: PointerEvent, 
    event: CalendarEvent, 
    day: Date, 
    mode: DragMode = 'move'
  ) {
    if (e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();

    this.dragMode = mode;
    this.activeEvent = event;
    this.targetDay = day;
    this.startClientY = e.clientY;
    this.startClientX = e.clientX;
    this.initialEventStart = parseISO(event.startTime);
    this.initialEventEnd = parseISO(event.endTime);

    const startMinutes = this.initialEventStart.getHours() * 60 + this.initialEventStart.getMinutes();
    const durationMinutes = Math.max(15, differenceInMinutes(this.initialEventEnd, this.initialEventStart));

    this.initialTop = (startMinutes / 60) * HOUR_HEIGHT_PX;
    this.initialHeight = (durationMinutes / 60) * HOUR_HEIGHT_PX;

    this.previewTop = this.initialTop;
    this.previewHeight = this.initialHeight;
    // Strict date anchoring: Resizing always stays anchored to the current day column
    this.previewDateKey = format(day, 'yyyy-MM-dd');

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - this.startClientY;
      const deltaX = moveEvent.clientX - this.startClientX;
      
      if (!this.isDragging && (Math.abs(deltaY) > 3 || Math.abs(deltaX) > 3)) {
        this.isDragging = true;
      }

      if (!this.isDragging) return;

      const stepPx = HOUR_HEIGHT_PX / 4; // 15-minute step in pixels
      const snappedDeltaSteps = Math.round(deltaY / stepPx);
      const deltaMinutes = snappedDeltaSteps * 15;

      if (this.dragMode === 'move') {
        const newStart = addMinutes(this.initialEventStart, deltaMinutes);
        const clampedMinutes = newStart.getHours() * 60 + newStart.getMinutes();
        this.previewTop = Math.max(0, Math.min(24 * HOUR_HEIGHT_PX - this.initialHeight, (clampedMinutes / 60) * HOUR_HEIGHT_PX));

        // Horizontal column detection only during full-body moves
        const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
        const dayCell = elements.find((el) => el.hasAttribute('data-timeline-col'));
        if (dayCell) {
          this.previewDateKey = dayCell.getAttribute('data-timeline-col');
        }
      } else if (this.dragMode === 'resize-bottom') {
        // Expand/reduce bottom edge
        const originalDuration = differenceInMinutes(this.initialEventEnd, this.initialEventStart);
        const newDuration = Math.max(15, originalDuration + deltaMinutes);
        this.previewHeight = (newDuration / 60) * HOUR_HEIGHT_PX;
      } else if (this.dragMode === 'resize-top') {
        // Expand/reduce top edge (Anchored securely to the column)
        const originalDuration = differenceInMinutes(this.initialEventEnd, this.initialEventStart);
        const newDuration = Math.max(15, originalDuration - deltaMinutes);
        const durationDiff = originalDuration - newDuration;
        
        this.previewTop = Math.max(0, this.initialTop + (durationDiff / 60) * HOUR_HEIGHT_PX);
        this.previewHeight = (newDuration / 60) * HOUR_HEIGHT_PX;
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (this.isDragging && this.activeEvent) {
        this.commitChanges();
      }

      this.isDragging = false;
      this.activeEvent = null;
      this.previewDateKey = null;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  private commitChanges() {
    if (!this.activeEvent) return;

    const startMinutesFromTop = (this.previewTop / HOUR_HEIGHT_PX) * 60;
    const durationMinutes = (this.previewHeight / HOUR_HEIGHT_PX) * 60;

    let targetDate = this.targetDay;
    if (this.dragMode === 'move' && this.previewDateKey) {
      const [y, m, d] = this.previewDateKey.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    }

    const startH = Math.floor(startMinutesFromTop / 60);
    const startM = Math.round((startMinutesFromTop % 60) / 15) * 15;

    const newStart = setMinutes(setHours(targetDate, startH), startM);
    const newEnd = addMinutes(newStart, durationMinutes);

    const updatedEvent: CalendarEvent = {
      ...this.activeEvent,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Prompt recurrence scope selector if event repeats
    if (this.activeEvent.rrule && this.activeEvent.rrule !== 'none') {
      contextMenuStore.promptRecurringAction('update', this.activeEvent, updatedEvent);
    } else {
      eventStore.updateEvent(updatedEvent);
    }
  }
}

export const timelineDragStore = new TimelineDragStore();