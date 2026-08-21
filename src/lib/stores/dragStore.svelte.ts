import { format, parseISO, differenceInMinutes, addMinutes } from 'date-fns';
import { createProjectedSnapshot, isEventRecurring, getSafeDuration, generateAllDayIso } from '../utils/dateMath';
import { eventStore } from './eventStore.svelte';
import { contextMenuStore } from './contextMenuStore.svelte';
import type { CalendarEvent } from '../../types/event';
import { HOUR_HEIGHT_PX } from '../utils/timeMath';

export type DragMode = 'move' | 'resize-top' | 'resize-bottom';

class DragStore {
  draggedEvent = $state<CalendarEvent | null>(null);
  isDragging = $state(false);
  isTimelineDrag = $state(false);
  mode = $state<DragMode>('move');
  
  dragSourceDateKey = $state<string | null>(null);
  originalOccurrenceDate = $state<string | null>(null);
  dropTargetDateKey = $state<string | null>(null);

  // Live snapped projections for Week/Day grid in-grid phantom box
  projectedDateKey = $state<string | null>(null);
  projectedStartTime = $state<string | null>(null);
  projectedEndTime = $state<string | null>(null);

  currentX = $state(0);
  currentY = $state(0);

  private startX = 0;
  private startY = 0;
  private pendingEvent: CalendarEvent | null = null;
  private pendingSourceDateKey: string | null = null;
  private pendingMode: DragMode = 'move';
  private initialDurationMinutes = 60;
  private initialStartMinutes = 0;
  private initialEndMinutes = 60;

  /**
   * Initializes pointer drag or resize with a 4px movement deadzone.
   */
  initDrag(event: CalendarEvent, sourceDateKey: string, e: PointerEvent, mode: DragMode = 'move'): void {
    if (e.button !== 0) return;

    this.startX = e.clientX;
    this.startY = e.clientY;
    this.currentX = e.clientX;
    this.currentY = e.clientY;
    this.pendingEvent = { ...event };
    // Look at the physical HTML element to find the date as a foolproof fallback
    const target = e.target as HTMLElement | null;
    const domDateKey = target?.closest('[data-day-cell]')?.getAttribute('data-day-cell') || 
                      target?.closest('[data-timeline-column]')?.getAttribute('data-timeline-column');

    this.pendingSourceDateKey = sourceDateKey || domDateKey || event.occurrenceDate || format(parseISO(event.startTime), 'yyyy-MM-dd');
    this.originalOccurrenceDate = event.occurrenceDate || this.pendingSourceDateKey;
    this.pendingMode = mode;

    const sObj = parseISO(event.startTime);
    const eObj = parseISO(event.endTime);
    this.initialStartMinutes = sObj.getHours() * 60 + sObj.getMinutes();
    this.initialEndMinutes = eObj.getHours() * 60 + eObj.getMinutes();
    this.initialDurationMinutes = getSafeDuration(sObj, eObj);

    const onPointerMove = (moveEvent: PointerEvent) => {
      this.currentX = moveEvent.clientX;
      this.currentY = moveEvent.clientY;

      if (!this.isDragging) {
        const dist = Math.hypot(moveEvent.clientX - this.startX, moveEvent.clientY - this.startY);
        if (dist > 4) {
          this.isDragging = true;
          this.mode = this.pendingMode;
          this.draggedEvent = this.pendingEvent;
          this.dragSourceDateKey = this.pendingSourceDateKey;
          this.dropTargetDateKey = this.pendingSourceDateKey;
          this.projectedDateKey = this.pendingSourceDateKey;
          
          if (this.mode === 'resize-top' || this.mode === 'resize-bottom') {
            document.body.style.cursor = 'ns-resize';
            this.isTimelineDrag = true;
            this.projectedStartTime = this.pendingEvent?.startTime || null;
            this.projectedEndTime = this.pendingEvent?.endTime || null;
          } else {
            document.body.style.cursor = 'grabbing';
            this.isTimelineDrag = false;
            this.projectedStartTime = null;
            this.projectedEndTime = null;
          }
          document.body.style.userSelect = 'none';
        }
      }

      if (this.isDragging && this.draggedEvent) {
        const elem = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        
        // 1. Check if hovering a 24-hour timeline column (Week/Day view)
        const timelineCol = elem?.closest('[data-timeline-column]') as HTMLElement | null;
        if (timelineCol) {
          this.isTimelineDrag = true;
          const colDateKey = timelineCol.getAttribute('data-timeline-column') || this.dragSourceDateKey;
          this.dropTargetDateKey = colDateKey;
          this.projectedDateKey = colDateKey;

          const rect = timelineCol.getBoundingClientRect();
          const offsetY = Math.max(0, moveEvent.clientY - rect.top);
          // Uses the dynamic HOUR_HEIGHT_PX instead of a hardcoded 56
          const currentHoverMinutes = Math.floor(((offsetY / HOUR_HEIGHT_PX) * 60) / 15) * 15;

          const [y, m, d] = (colDateKey || '').split('-').map(Number);

          if (this.mode === 'move') {
            const newStartMin = Math.min(1440 - this.initialDurationMinutes, Math.max(0, currentHoverMinutes));
            const newEndMin = newStartMin + this.initialDurationMinutes;

            const newStart = new Date(y, m - 1, d, Math.floor(newStartMin / 60), newStartMin % 60, 0);
            const newEnd = new Date(y, m - 1, d, Math.floor(newEndMin / 60), newEndMin % 60, 0);

            this.projectedStartTime = newStart.toISOString();
            this.projectedEndTime = newEnd.toISOString();
          } else if (this.mode === 'resize-bottom') {
            // Pin start time, scale end time down/up (min 15 mins duration)
            const startHour = Math.floor(this.initialStartMinutes / 60);
            const startMin = this.initialStartMinutes % 60;
            const pinnedStart = new Date(y, m - 1, d, startHour, startMin, 0);

            const newEndMin = Math.min(1440, Math.max(this.initialStartMinutes + 15, currentHoverMinutes));
            const newEnd = new Date(y, m - 1, d, Math.floor(newEndMin / 60), newEndMin % 60, 0);

            this.projectedStartTime = pinnedStart.toISOString();
            this.projectedEndTime = newEnd.toISOString();
          } else if (this.mode === 'resize-top') {
            // Pin end time, scale start time up/down (min 15 mins duration)
            const endHour = Math.floor(this.initialEndMinutes / 60);
            const endMin = this.initialEndMinutes % 60;
            const pinnedEnd = new Date(y, m - 1, d, endHour, endMin, 0);

            const newStartMin = Math.max(0, Math.min(this.initialEndMinutes - 15, currentHoverMinutes));
            const newStart = new Date(y, m - 1, d, Math.floor(newStartMin / 60), newStartMin % 60, 0);

            this.projectedStartTime = newStart.toISOString();
            this.projectedEndTime = pinnedEnd.toISOString();
          }
          return;
        }

        // 2. Month view day cells
        if (this.mode === 'move') {
          this.isTimelineDrag = false;
          this.projectedStartTime = null;
          this.projectedEndTime = null;

          const dayCell = elem?.closest('[data-day-cell]') as HTMLElement | null;
          if (dayCell) {
            const cellDateKey = dayCell.getAttribute('data-day-cell');
            if (cellDateKey) {
              this.dropTargetDateKey = cellDateKey;
              this.projectedDateKey = cellDateKey;
            }
          }
        }
      }
    };

    const onPointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (this.isDragging && this.draggedEvent) {
        if (this.isTimelineDrag && this.projectedDateKey && this.projectedStartTime && this.projectedEndTime) {
          this.commitReschedule(this.projectedDateKey, this.projectedStartTime, this.projectedEndTime);
        } else if (this.dropTargetDateKey) {
          this.handleDrop(this.dropTargetDateKey);
        } else {
          this.endDrag();
        }

        // Keep isDragging active briefly to prevent the subsequent click event from opening the inspector
        setTimeout(() => {
          this.endDrag();
        }, 100);
      } else {
        this.endDrag();
      }
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  startDrag(event: CalendarEvent, sourceDateKey?: string, e?: DragEvent | PointerEvent): void {
    if (e && 'button' in e) {
      this.initDrag(event, sourceDateKey || '', e as PointerEvent, 'move');
    }
  }

  setDropTarget(dateKey: string | null): void {
    this.dropTargetDateKey = dateKey;
  }

  updatePosition(x: number, y: number): void {
    if (x > 0 && y > 0) {
      this.currentX = x;
      this.currentY = y;
    }
  }

  endDrag(): void {
    this.draggedEvent = null;
    this.isDragging = false;
    this.isTimelineDrag = false;
    this.mode = 'move';
    this.dragSourceDateKey = null;
    this.originalOccurrenceDate = null;
    this.dropTargetDateKey = null;
    this.projectedDateKey = null;
    this.projectedStartTime = null;
    this.projectedEndTime = null;
    this.pendingEvent = null;
    this.pendingSourceDateKey = null;
  }

  async handleDrop(targetDateKey: string): Promise<void> {
    if (!this.draggedEvent || !this.dragSourceDateKey) {
      this.endDrag();
      return;
    }

    if (this.dragSourceDateKey === targetDateKey) {
      this.endDrag();
      return;
    }

    const event = { ...this.draggedEvent };
    const originalOcc = this.originalOccurrenceDate || this.dragSourceDateKey;
    const startObj = parseISO(event.startTime);
    const endObj = parseISO(event.endTime);
    const duration = getSafeDuration(startObj, endObj);
    const [targetY, targetM, targetD] = targetDateKey.split('-').map(Number);

    let updatedStartIso: string;
    let updatedEndIso: string;

    if (event.isAllDay) {
      const allDayIso = generateAllDayIso(targetDateKey);
      updatedStartIso = allDayIso.startIso;
      updatedEndIso = allDayIso.endIso;
    } else {
      const newStart = new Date(targetY, targetM - 1, targetD, startObj.getHours(), startObj.getMinutes(), 0);
      const newEnd = addMinutes(newStart, duration);
      updatedStartIso = newStart.toISOString();
      updatedEndIso = newEnd.toISOString();
    }

    this.commitReschedule(targetDateKey, updatedStartIso, updatedEndIso);
  }

  private commitReschedule(dateKey: string, startIso: string, endIso: string): void {
    if (!this.draggedEvent) {
      this.endDrag();
      return;
    }

    const event = { ...this.draggedEvent };
    const originalOcc = this.originalOccurrenceDate || this.dragSourceDateKey || format(parseISO(event.startTime), 'yyyy-MM-dd');

    const updatedEvent: CalendarEvent = {
      ...event,
      startTime: startIso,
      endTime: endIso,
      occurrenceDate: dateKey,
      updatedAt: new Date().toISOString()
    };

    const isRecurring = isEventRecurring(event);

    if (isRecurring) {
      // Check if this specific event is already broken off from the main series
      const isDetachedException = Boolean(event.recurringEventId && (!event.rrule || event.rrule === 'none'));
      
      // If detached, use it directly. Otherwise, find the root master.
      const master = isDetachedException ? event : (eventStore.events.find(e => 
        e.id === event.recurringEventId || 
        e.googleEventId === event.recurringEventId || 
        e.id === event.id
      ) || event);
      
      const projectedSnapshot = createProjectedSnapshot(master, originalOcc);

      contextMenuStore.promptRecurringAction(
        'update',
        master,
        updatedEvent,
        originalOcc,
        projectedSnapshot
      );
    } else {
      eventStore.updateEvent(updatedEvent);
    }
  }
}

export const dragStore = new DragStore();