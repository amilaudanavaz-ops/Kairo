import type { CalendarEvent } from '../../types/event';
import { eventStore } from './eventStore.svelte';
import { contextMenuStore } from './contextMenuStore.svelte';
import { moveEventDate } from '../utils/dateMath';

class DragStore {
  isDragging = $state(false);
  draggedEvent = $state<CalendarEvent | null>(null);
  currentX = $state(0);
  currentY = $state(0);
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
        
        if (this.draggedEvent.rrule && this.draggedEvent.rrule !== 'none') {
          const masterEvent = eventStore.events.find(e => e.id === this.draggedEvent?.id) || this.draggedEvent;
          const updatedEvent = moveEventDate(this.draggedEvent, targetDate);
          
          contextMenuStore.pendingRecurringAction = {
            action: 'update',
            originalEvent: masterEvent,
            updatedEvent,
            occurrenceDate: this.draggedEvent.occurrenceDate,
            diffs: [{
              field: 'Time',
              newValue: targetDate.toLocaleDateString([], { month: 'short', day: 'numeric' }),
              oldValue: this.draggedEvent.occurrenceDate || ''
            }]
          };
          contextMenuStore.isRecurrenceModalOpen = true;
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