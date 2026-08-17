import type { CalendarEvent } from '../../types/event';
import { eventStore } from './eventStore.svelte';
import { contextMenuStore } from './contextMenuStore.svelte';
import { parseISO, setHours, setMinutes, differenceInMinutes, addMinutes } from 'date-fns';

class DragStore {
  isDragging = $state<boolean>(false);
  draggedEvent = $state<CalendarEvent | null>(null);
  currentX = $state<number>(0);
  currentY = $state<number>(0);
  hoveredDateKey = $state<string | null>(null);

  startDrag(e: PointerEvent, event: CalendarEvent, onDragInitiated?: () => void) {
    if (e.button !== 0) return;

    let dragStarted = false;
    const startX = e.clientX;
    const startY = e.clientY;
    this.currentX = e.clientX;
    this.currentY = e.clientY;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = Math.abs(moveEvent.clientX - startX);
      const dy = Math.abs(moveEvent.clientY - startY);

      if (!dragStarted && (dx > 4 || dy > 4)) {
        dragStarted = true;
        this.isDragging = true;
        this.draggedEvent = event;
        if (onDragInitiated) {
          onDragInitiated();
        }
      }

      if (this.isDragging) {
        this.currentX = moveEvent.clientX;
        this.currentY = moveEvent.clientY;

        const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
        const dayCell = elements.find((el: Element) => el.hasAttribute('data-day-cell'));
        this.hoveredDateKey = dayCell ? dayCell.getAttribute('data-day-cell') : null;
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (this.isDragging && this.draggedEvent && this.hoveredDateKey) {
        const [year, month, day] = this.hoveredDateKey.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day);
        
        if (this.draggedEvent.rrule && this.draggedEvent.rrule !== 'none') {
          const masterEvent = eventStore.events.find((e: CalendarEvent) => e.id === this.draggedEvent?.id) || this.draggedEvent;
          
          const origStart = parseISO(this.draggedEvent.startTime);
          const origEnd = parseISO(this.draggedEvent.endTime);
          const duration = differenceInMinutes(origEnd, origStart);

          const newStart = setMinutes(setHours(targetDate, origStart.getHours()), origStart.getMinutes());
          const newEnd = addMinutes(newStart, duration);

          const updatedEvent: CalendarEvent = {
            ...this.draggedEvent,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
            occurrenceDate: this.hoveredDateKey,
            updatedAt: new Date().toISOString()
          };
          
          contextMenuStore.promptRecurringAction(
            'update',
            masterEvent,
            updatedEvent,
            this.draggedEvent.occurrenceDate,
            this.draggedEvent
          );
        } else {
          eventStore.rescheduleEvent(this.draggedEvent.id, targetDate);
        }
      }

      if (this.isDragging) {
        setTimeout(() => {
          this.isDragging = false;
          this.draggedEvent = null;
          this.hoveredDateKey = null;
        }, 50);
      } else {
        this.isDragging = false;
        this.draggedEvent = null;
        this.hoveredDateKey = null;
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }
}

export const dragStore = new DragStore();