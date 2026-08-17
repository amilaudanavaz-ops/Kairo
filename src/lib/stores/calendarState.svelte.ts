import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays, format, parseISO } from 'date-fns';
import type { ViewMode, CalendarEvent, DayOverflowItem, CalendarCategory, ParticipantContact, LocationSuggestion } from '../../types/event';
import { eventStore } from './eventStore.svelte';

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

  // Contacts Directory for Auto-suggest
  contacts = $state<ParticipantContact[]>([
    { name: 'Amma', email: 'mangalialuthgama1964@gmail.com' },
    { name: 'ashely harry', email: 'ashelyharry990@gmail.com' },
    { name: 'androidapp', email: 'androidapp@imo.im' },
    { name: 'amila vaz', email: 'amilavaz2003@gmail.com' },
    { name: 'abuse', email: 'abuse@fb.com' },
    { name: 'VNOOIR Team', email: 'team@vnooir.agency' },
    { name: 'Kasun Bandara', email: 'kasun.b@gmail.com' },
    { name: 'Nisal Senarath', email: 'nisal.s@gmail.com' }
  ]);

  // Locations Database
  locations = $state<LocationSuggestion[]>([
    { title: 'Children Park', subtitle: 'Netolpitiya' },
    { title: "SOS Children's Village Galle", subtitle: 'Wakwella Road, Galle' },
    { title: "Children's Park", subtitle: 'B142, Hakmana' },
    { title: "Children's park", subtitle: 'Karittakanda, Ambalangoda' },
    { title: 'Children & Maternity Clinic Navimana', subtitle: 'Matara' },
    { title: 'Colombo City Centre', subtitle: '137 Sir James Pieris Mawatha, Colombo' },
    { title: 'One Galle Face', subtitle: '1A Centre Road, Galle Face, Colombo' },
    { title: 'VNOOIR Studio', subtitle: 'Level 4, High Street Building, Colombo' }
  ]);

  selectedEvent = $derived.by(() => {
    if (!this.selectedEventId) return null;
    return eventStore.events.find((e) => e.id === this.selectedEventId) || null;
  });

  calendars = $state<CalendarCategory[]>([
    { id: '1', accountId: 'acc_primary', name: 'amilavaz2003@gmail.com', colorId: 'blue', colorHex: '#3b82f6', isPrimary: true, isVisible: true },
    { id: '2', accountId: 'acc_primary', name: 'Family', colorId: 'amber', colorHex: '#d97706', isPrimary: false, isVisible: true },
    { id: '3', accountId: 'acc_primary', name: 'ICC Cricket', colorId: 'red', colorHex: '#b91c1c', isPrimary: false, isVisible: true },
    { id: '4', accountId: 'acc_primary', name: 'VNOOIR', colorId: 'charcoal', colorHex: '#71717a', isPrimary: false, isVisible: true },
    { id: '5', accountId: 'acc_primary', name: "L'Instant Céleste", colorId: 'amber', colorHex: '#f59e0b', isPrimary: false, isVisible: true }
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