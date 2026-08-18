import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, format, parseISO } from 'date-fns';
import type { ViewMode, CalendarEvent, DayOverflowItem, CalendarCategory, ParticipantContact, LocationSuggestion } from '../../types/event';
import { 
  setExclusiveDefaultCalendarInDb, 
  updateCalendarColorInDb, 
  updateCalendarVisibilityInDb,
  deleteCalendarFromDb 
} from '../db/database';
import { eventStore } from './eventStore.svelte';

class CalendarState {
  currentDate = $state(new Date());
  viewMode = $state<ViewMode>('month');
  isSidebarOpen = $state(true);
  isInspectorDocked = $state(false);
  isAddAccountModalOpen = $state(false);
  
  // Selection & Draft Tracking
  selectedEventId = $state<string | null>(null);
  selectedDateKey = $state<string | null>(null);
  isCreatingNewEvent = $state(false);
  draftEvent = $state<CalendarEvent | null>(null);
  inspectorRect = $state<DOMRect | null>(null);
  overflowData = $state<DayOverflowItem | null>(null);
  clipboardEvent = $state<CalendarEvent | null>(null);

  // Contacts
  contacts = $state<ParticipantContact[]>([]);

  // Locations
  locations = $state<LocationSuggestion[]>([]);

  // Calendar Categories List
  calendars = $state<CalendarCategory[]>([]);

  selectedEvent = $derived.by(() => {
    if (this.isCreatingNewEvent && this.draftEvent) {
      return this.draftEvent;
    }
    if (!this.selectedEventId) return null;
    return eventStore.events.find((e) => e.id === this.selectedEventId) || this.draftEvent || null;
  });

  setCalendars(cals: CalendarCategory[]) {
    this.calendars = cals;
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

  // Toggle calendar visibility checkbox
  toggleCalendarVisibility(calendarId: string) {
    const target = this.calendars.find(c => c.id === calendarId || c.googleCalendarId === calendarId);
    if (!target) return;
    const nextState = !target.isVisible;
    this.calendars = this.calendars.map((c) =>
      (c.id === calendarId || c.googleCalendarId === calendarId) ? { ...c, isVisible: nextState } : c
    );
    updateCalendarVisibilityInDb(calendarId, nextState).catch(console.error);
  }

  // Make exclusively default
  async setDefaultCalendar(calendarId: string) {
    this.calendars = this.calendars.map((c) => ({
      ...c,
      isPrimary: c.id === calendarId || c.googleCalendarId === calendarId
    }));
    await setExclusiveDefaultCalendarInDb(calendarId);
  }

  // Show only this calendar (hides all others)
  async showOnlyCalendar(calendarId: string) {
    this.calendars = this.calendars.map((c) => ({
      ...c,
      isVisible: c.id === calendarId || c.googleCalendarId === calendarId
    }));
    for (const cal of this.calendars) {
      await updateCalendarVisibilityInDb(cal.id, cal.id === calendarId || cal.googleCalendarId === calendarId);
    }
  }

  // Update calendar hex color
  async updateCalendarColor(calendarId: string, colorHex: string) {
    this.calendars = this.calendars.map((c) =>
      (c.id === calendarId || c.googleCalendarId === calendarId) ? { ...c, colorHex } : c
    );
    await updateCalendarColorInDb(calendarId, colorHex);
  }

  // Remove calendar from list
  async removeCalendar(calendarId: string) {
    this.calendars = this.calendars.filter(c => c.id !== calendarId && c.googleCalendarId !== calendarId);
    eventStore.events = eventStore.events.filter(e => e.calendarId !== calendarId);
    await deleteCalendarFromDb(calendarId);
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
    this.draftEvent = isNew ? event : null;
    this.inspectorRect = rect;
  }

  closeInspector() {
    this.selectedEventId = null;
    this.selectedDateKey = null;
    this.isCreatingNewEvent = false;
    this.draftEvent = null;
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