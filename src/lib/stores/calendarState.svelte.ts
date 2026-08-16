import { addMonths, subMonths, addWeeks, subWeeks, addDays, subDays } from 'date-fns';
import type { ViewMode, CalendarEvent, DayOverflowItem, CalendarCategory } from '../../types/event';

class CalendarState {
  currentDate = $state(new Date());
  viewMode = $state<ViewMode>('month');
  isSidebarOpen = $state(true);
  
  // Modals and Popover Anchors
  selectedEvent = $state<CalendarEvent | null>(null);
  inspectorRect = $state<DOMRect | null>(null);
  overflowData = $state<DayOverflowItem | null>(null);
  quickCreateDate = $state<Date | null>(null);

  // Active Calendars
  calendars = $state<CalendarCategory[]>([
    { id: '1', accountId: 'acc_1', name: 'Personal & Work', colorId: 'blue', colorHex: '#3b82f6', isPrimary: true, isVisible: true },
    { id: '2', accountId: 'acc_1', name: 'Scraping & Dev', colorId: 'amber', colorHex: '#f59e0b', isPrimary: false, isVisible: true },
    { id: '3', accountId: 'acc_1', name: 'Holidays', colorId: 'emerald', colorHex: '#10b981', isPrimary: false, isVisible: true }
  ]);

  toggleSidebar() {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  setViewMode(mode: ViewMode) {
    this.viewMode = mode;
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
    const target = this.calendars.find(c => c.id === calendarId);
    if (target) {
      target.isVisible = !target.isVisible;
    }
  }

  openInspector(event: CalendarEvent, rect: DOMRect) {
    this.selectedEvent = event;
    this.inspectorRect = rect;
  }

  closeInspector() {
    this.selectedEvent = null;
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