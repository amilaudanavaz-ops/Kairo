import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import type { ViewMode, CalendarEvent, DayOverflowItem, CalendarCategory } from '../../types/event';
import { eventStore } from './eventStore.svelte';

class CalendarState {
  currentDate = $state(new Date());
  viewMode = $state<ViewMode>('month');
  isSidebarOpen = $state(true);
  isInspectorDocked = $state(false);
  isAddAccountModalOpen = $state(false);
  
  // Modals & Floating Inspectors
  selectedEventId = $state<string | null>(null);
  inspectorRect = $state<DOMRect | null>(null);
  overflowData = $state<DayOverflowItem | null>(null);
  clipboardEvent = $state<CalendarEvent | null>(null);

  // Live Reactive Selected Event
  selectedEvent = $derived.by(() => {
    if (!this.selectedEventId) return null;
    return eventStore.events.find((e) => e.id === this.selectedEventId) || null;
  });

  calendars = $state<CalendarCategory[]>([
    { id: '1', accountId: 'acc_primary', name: 'Personal & Work', colorId: 'blue', colorHex: '#3b82f6', isPrimary: true, isVisible: true },
    { id: '2', accountId: 'acc_primary', name: 'Scraping & Dev', colorId: 'amber', colorHex: '#f59e0b', isPrimary: false, isVisible: true },
    { id: '3', accountId: 'acc_primary', name: 'Holidays', colorId: 'emerald', colorHex: '#10b981', isPrimary: false, isVisible: true }
  ]);

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  toggleInspectorDock() {
    this.isInspectorDocked = !this.isInspectorDocked;
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
  }

  setDate(date: Date) {
    this.currentDate = date;
  }

  setToday() {
    this.currentDate = new Date();
  }

  navigateNext() {
    if (this.viewMode === 'month') this.currentDate = addMonths(this.currentDate, 1);
    else if (this.viewMode === 'week') this.currentDate = addWeeks(this.currentDate, 1);
    else this.currentDate = addDays(this.currentDate, 1);
  }

  navigatePrev() {
    if (this.viewMode === 'month') this.currentDate = subMonths(this.currentDate, 1);
    else if (this.viewMode === 'week') this.currentDate = subWeeks(this.currentDate, 1);
    else this.currentDate = subDays(this.currentDate, 1);
  }

  toggleCalendarVisibility(calendarId: string) {
    this.calendars = this.calendars.map((c) =>
      c.id === calendarId ? { ...c, isVisible: !c.isVisible } : c
    );
  }

  openAddAccountModal() {
    this.isAddAccountModalOpen = true;
  }

  closeAddAccountModal() {
    this.isAddAccountModalOpen = false;
  }

  openInspector(event: CalendarEvent, rect: DOMRect) {
    this.selectedEventId = event.id;
    this.inspectorRect = rect;
  }

  closeInspector() {
    this.selectedEventId = null;
    this.inspectorRect = null;
  }

  openOverflow(date: Date, events: CalendarEvent[], rect: DOMRect) {
    this.overflowData = { date, events, anchorRect: rect };
  }

  closeOverflow() {
    this.overflowData = null;
  }
}

export const calendarState = new CalendarState(); 