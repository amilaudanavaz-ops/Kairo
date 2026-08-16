import type { CalendarEvent } from '../../types/event';
import { eventStore } from './eventStore.svelte';
import { calendarState } from './calendarState.svelte';

class ContextMenuStore {
  isOpen = $state(false);
  x = $state(0);
  y = $state(0);
  targetEvent = $state<CalendarEvent | null>(null);

  open(e: MouseEvent, event: CalendarEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.targetEvent = event;
    
    // Prevent menu overflowing window boundaries
    const menuWidth = 220;
    const menuHeight = 260;
    this.x = Math.min(window.innerWidth - menuWidth - 10, e.clientX);
    this.y = Math.min(window.innerHeight - menuHeight - 10, e.clientY);
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
    this.targetEvent = null;
  }

  setColorOverride(colorHex: string | undefined) {
    if (!this.targetEvent) return;
    eventStore.updateEvent({
      ...this.targetEvent,
      colorOverride: colorHex
    });
    this.close();
  }

  cut() {
    if (!this.targetEvent) return;
    calendarState.clipboardEvent = { ...this.targetEvent };
    eventStore.deleteEvent(this.targetEvent.id);
    if (calendarState.selectedEvent?.id === this.targetEvent.id) {
      calendarState.closeInspector();
    }
    this.close();
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
    eventStore.deleteEvent(this.targetEvent.id);
    if (calendarState.selectedEvent?.id === this.targetEvent.id) {
      calendarState.closeInspector();
    }
    this.close();
  }
}

export const contextMenuStore = new ContextMenuStore();