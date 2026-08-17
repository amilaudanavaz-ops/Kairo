import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, format, parseISO } from 'date-fns';
import type { ViewMode, CalendarEvent, DayOverflowItem, CalendarCategory, ParticipantContact, LocationSuggestion } from '../../types/event';
import { eventStore } from './eventStore.svelte';
import { persistCalendarCategory } from '../db/database';

class CalendarState {
  currentDate = $state(new Date());
  viewMode = $state<ViewMode>('month');
  isSidebarOpen = $state(true);
  isInspectorDocked = $state(false);
  isAddAccountModalOpen = $state(false);
  
  // Selection tracking
  selectedEventId = $state<string | null>(null);
  selectedDateKey = $state<string | null>(null);
  isCreatingNewEvent = $state(false);
  inspectorRect = $state<DOMRect | null>(null);
  overflowData = $state<DayOverflowItem | null>(null);
  clipboardEvent = $state<CalendarEvent | null>(null);

  // Contacts Directory for Autocomplete
  contacts = $state<ParticipantContact[]>([]);

  // Locations Database
  locations = $state<LocationSuggestion[]>([]);

  // Calendars list
  calendars = $state<CalendarCategory[]>([]);

  selectedEvent = $derived.by<CalendarEvent | null>(() => {
    if (!this.selectedEventId) return null;
    return eventStore.events.find((e: CalendarEvent) => e.id === this.selectedEventId) ?? null;
  });

  setCalendars(newCals: CalendarCategory[]) {
    const map = new Map<string, CalendarCategory>();
    for (const c of newCals) {
      const key = c.googleCalendarId || c.id;
      if (!map.has(key)) {
        map.set(key, c);
      }
    }
    this.calendars = Array.from(map.values());
  }

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
    this.calendars = this.calendars.map((c: CalendarCategory) => {
      if (c.id === calendarId) {
        const updated = { ...c, isVisible: !c.isVisible };
        persistCalendarCategory(updated).catch(console.error);
        return updated;
      }
      return c;
    });
  }

  openAddAccountModal() {
    this.isAddAccountModalOpen = true;
  }

  closeAddAccountModal() {
    this.isAddAccountModalOpen = false;
  }

  openInspector(event: CalendarEvent, rect: DOMRect, isNew: boolean = false, dateKey?: string) {
    this.selectedEventId = event.id;
    this.selectedDateKey = dateKey || event.occurrenceDate || format(parseISO(event.startTime), 'yyyy-MM-dd');
    this.isCreatingNewEvent = isNew;
    this.inspectorRect = rect;
  }

  closeInspector() {
    this.selectedEventId = null;
    this.selectedDateKey = null;
    this.isCreatingNewEvent = false;
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