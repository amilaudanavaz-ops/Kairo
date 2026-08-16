
import type { CalendarEvent } from '../../types/event';
import { eventStore } from './eventStore.svelte';
import { parseISO } from 'date-fns';

class DragStore {
  isDragging = $state(false);
  draggedEvent = $state<CalendarEvent | null>(null);
  currentX = $state(0);
  currentY = $state(0);
  hoveredDateKey = $state<string | null>(null);

  private startX = 0;
  private startY = 0;
  private hasMoved = false;

  startDrag(e: PointerEvent, event: CalendarEvent) {
    if (e.button !== 0) return; // Only primary mouse button

    this.draggedEvent = event;
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.currentX = e.clientX;
    this.currentY = e.clientY;
    this.hasMoved = false;

    const onPointerMove = (moveEvent: PointerEvent) => {
      const dx = Math.abs(moveEvent.clientX - this.startX);
      const dy = Math.abs(moveEvent.clientY - this.startY);

      // 4px movement threshold before initiating drag
      if (!this.hasMoved && (dx > 4 || dy > 4)) {
        this.hasMoved = true;
        this.isDragging = true;
      }

      if (this.isDragging) {
        this.currentX = moveEvent.clientX;
        this.currentY = moveEvent.clientY;

        // Perform element hit-testing underneath cursor
        const elements = document.elementsFromPoint(moveEvent.clientX, moveEvent.clientY);
        const dayCell = elements.find((el) => el.hasAttribute('data-day-cell'));
        this.hoveredDateKey = dayCell ? dayCell.getAttribute('data-day-cell') : null;
      }
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);

      if (this.isDragging && this.draggedEvent && this.hoveredDateKey) {
        const [year, month, day] = this.hoveredDateKey.split('-').map(Number);
        const targetDate = new Date(year, month - 1, day);
        eventStore.rescheduleEvent(this.draggedEvent.id, targetDate);
      }

      this.isDragging = false;
      this.draggedEvent = null;
      this.hoveredDateKey = null;
      this.hasMoved = false;
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }
}

export const dragStore = new DragStore();