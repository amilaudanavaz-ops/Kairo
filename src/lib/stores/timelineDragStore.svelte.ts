import type { CalendarEvent } from '../../types/event';
import { eventStore } from './eventStore.svelte';
import { parseISO, addMinutes, differenceInMinutes, setHours, setMinutes } from 'date-fns';
import { HOUR_HEIGHT_PX } from '../utils/timeMath';

export type DragMode = 'move' | 'resize-top' | 'resize-bottom';

class TimelineDragStore {
  isDragging = $state(false);
  dragMode = $state<DragMode>('move');
  activeEvent = $state<CalendarEvent | null>(null);
  
  // Ghost preview coordinates
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
    if (e.button !== 0) return; // Only primary button
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
    this.previewDateKey = event.startTime.split('T')[0];

    const onPointerMove = (moveEvent: PointerEvent) => {
      const deltaY = moveEvent.clientY - this.startClientY;
      
      if (!this.isDragging && (Math.abs(deltaY) > 3 || Math.abs(moveEvent.clientX - this.startClientX) > 3)) {
        this.isDragging = true;
      }

      if (!this.isDragging) return;

      // 15-minute snap step in pixels (HOUR_HEIGHT_PX / 4)
      const stepPx = HOUR_HEIGHT_PX / 4;
      const snappedDeltaSteps = Math.round(deltaY / stepPx);
      const deltaMinutes = snappedDeltaSteps * 15;

      if (this.dragMode === 'move') {
        // Move start and end simultaneously
        const newStart = addMinutes(this.initialEventStart, deltaMinutes);
        const newEnd = addMinutes(this.initialEventEnd, deltaMinutes);

        // Bound to 00:00 - 23:59
        if (newStart.getHours() >= 0 && newEnd.getDate() === newStart.getDate()) {
          const clampedMinutes = newStart.getHours() * 60 + newStart.getMinutes();
          this.previewTop = Math.max(0, Math.min(24 * HOUR_HEIGHT_PX - this.initialHeight, (clampedMinutes / 60) * HOUR_HEIGHT_PX));
        }

        // Horizontal hit-test for day columns in Week view
        const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
        const dayCell = elements.find((el) => el.hasAttribute('data-timeline-col'));
        if (dayCell) {
          this.previewDateKey = dayCell.getAttribute('data-timeline-col');
        }
      } else if (this.dragMode === 'resize-bottom') {
        // Expand/reduce end time
        const newDuration = Math.max(15, differenceInMinutes(this.initialEventEnd, this.initialEventStart) + deltaMinutes);
        this.previewHeight = Math.max(stepPx, (newDuration / 60) * HOUR_HEIGHT_PX);
      } else if (this.dragMode === 'resize-top') {
        // Expand/reduce start time
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
    if (this.previewDateKey) {
      const [y, m, d] = this.previewDateKey.split('-').map(Number);
      targetDate = new Date(y, m - 1, d);
    }

    const startH = Math.floor(startMinutesFromTop / 60);
    const startM = Math.round((startMinutesFromTop % 60) / 15) * 15;

    const newStart = setMinutes(setHours(targetDate, startH), startM);
    const newEnd = addMinutes(newStart, durationMinutes);

    eventStore.updateEvent({
      ...this.activeEvent,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
}

export const timelineDragStore = new TimelineDragStore();