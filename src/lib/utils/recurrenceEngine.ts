import { 
  format, 
  parseISO, 
  setHours, 
  setMinutes, 
  subDays, 
  isSameDay, 
  addMinutes, 
  differenceInMinutes, 
  set 
} from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import { eventStore, convertRRuleToRFC5545, sanitizeTimezone } from '../stores/eventStore.svelte';
import type { CalendarEvent } from '../../types/event';
import { getSafeDuration } from './dateMath';

export interface FieldDiff {
  field: string;
  newValue: string;
  oldValue: string;
}

export interface RecurrencePayload {
  scope: 'this' | 'following' | 'all';
  originalEvent: CalendarEvent;   // The specific grid block the user clicked
  updatedEvent?: CalendarEvent;   // The modified draft (undefined if deleting)
  occurrenceDate: string;         // The YYYY-MM-DD date of the block clicked
  diffs: FieldDiff[];             // Array of what specifically changed
}

/* ==========================================================================
   CLASSIFICATION UTILITIES
   ========================================================================== */

function getRootMaster(event: CalendarEvent): CalendarEvent {
  const rootId = event.recurringEventId || event.googleEventId || event.id;
  return eventStore.events.find(e => e.id === rootId || e.googleEventId === rootId) || event;
}

function calculateUntilString(cutoffDateKey: string, isAllDay: boolean, timeZone: string): string {
  const [y, m, d] = cutoffDateKey.split('-').map(Number);
  const cutoffDate = new Date(y, m - 1, d);
  
  if (isAllDay) {
    return format(cutoffDate, 'yyyyMMdd');
  }

  // Set to 23:59:59 in the event's specific timezone, then translate to absolute UTC
  const localEndOfCutoff = new Date(y, m - 1, d, 23, 59, 59);
  const zonedEndOfCutoff = fromZonedTime(localEndOfCutoff, sanitizeTimezone(timeZone));
  return zonedEndOfCutoff.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/* ==========================================================================
   ENGINE: UPDATE LOGIC
   ========================================================================== */

export async function executeRecurrenceUpdate(payload: RecurrencePayload): Promise<void> {
  const { scope, originalEvent, updatedEvent, occurrenceDate, diffs } = payload;
  if (!updatedEvent) return;

  const masterEvent = getRootMaster(originalEvent);
  const rootMasterGoogleId = masterEvent.googleEventId || masterEvent.id;
  const masterStart = parseISO(masterEvent.startTime);
  const occDate = parseISO(occurrenceDate);
  const masterStartKey = format(masterStart, 'yyyy-MM-dd');

  // Classify Event Position
  const isRoot = isSameDay(masterStart, occDate) || occurrenceDate <= masterStartKey;
  
  // Classify Mutation Type
  const isRRuleChange = diffs.some(d => d.field === 'Repeat');
  const isDateChange = occurrenceDate !== format(parseISO(updatedEvent.startTime), 'yyyy-MM-dd');
  const isTimeChange = diffs.some(d => d.field === 'Time') && !isDateChange;
  const isStructuralChange = isDateChange || isRRuleChange;

  // RULE A: "This Event" (Single Exception)
  if (scope === 'this') {
    // 1. Mark occurrence as excluded on the Master
    const currentExdates = masterEvent.exdates || [];
    if (!currentExdates.includes(occurrenceDate)) {
      eventStore.updateEvent({
        ...masterEvent,
        exdates: [...currentExdates, occurrenceDate],
        syncStatus: 'pending_update' // Sync Shield
      });
    }

    // 2. Calculate the original anchor time for Google mapping
    const origDateObj = parseISO(occurrenceDate);
    const masterStartObj = parseISO(masterEvent.startTime);
    const calculatedOriginalStart = set(origDateObj, {
      hours: masterStartObj.getHours(),
      minutes: masterStartObj.getMinutes(),
      seconds: masterStartObj.getSeconds()
    }).toISOString();

    const targetDateKey = format(parseISO(updatedEvent.startTime), 'yyyy-MM-dd');

    // 3. Create or update the standalone detached exception
    if (originalEvent.id !== masterEvent.id) {
      // It was already an exception, just update it in place
      eventStore.updateEvent({
        ...originalEvent,
        ...updatedEvent,
        recurringEventId: rootMasterGoogleId,
        originalStartTime: originalEvent.originalStartTime || calculatedOriginalStart,
        occurrenceDate: targetDateKey,
        isRecurringInstance: false,
        rrule: 'none',
        exdates: [],
        untilDate: undefined,
        syncStatus: 'pending_update'
      });
    } else {
      // Spawn a new detached exception row
      const detachedInstance: CalendarEvent = {
        ...updatedEvent,
        id: 'evt_' + Date.now(),
        googleEventId: undefined,
        recurringEventId: rootMasterGoogleId,
        originalStartTime: originalEvent.originalStartTime || calculatedOriginalStart,
        occurrenceDate: targetDateKey,
        isRecurringInstance: false,
        rrule: 'none',
        exdates: [],
        untilDate: undefined,
        syncStatus: 'pending_insert'
      };
      eventStore.addEvent(detachedInstance);
    }
  } 
  
  // RULE B: "This and Following" (Series Split)
  else if (scope === 'following') {
    if (isRoot) {
      // Modifying from the root is mathematically identical to updating "All Events"
      return executeRecurrenceUpdate({ ...payload, scope: 'all' });
    }

    // 1. Truncate the original master series at "Yesterday" (localized UTC)
    const cutoffDateObj = subDays(occDate, 1);
    const cutoffDateKey = format(cutoffDateObj, 'yyyy-MM-dd');
    const untilUtcStr = calculateUntilString(cutoffDateKey, masterEvent.isAllDay || false, masterEvent.timeZone || 'UTC');
    
    const canonicalMasterRRule = convertRRuleToRFC5545(masterEvent.rrule || 'weekly', masterEvent.startTime)
      .replace(/;?UNTIL=[^;]+/gi, '');

    eventStore.updateEvent({
      ...masterEvent,
      untilDate: cutoffDateKey,
      rrule: `${canonicalMasterRRule};UNTIL=${untilUtcStr}`,
      syncStatus: 'pending_update'
    });

    // 2. Identify Future Exceptions (>= occurrenceDate)
    const targetIso = occDate.toISOString();
    const futureExceptions = eventStore.events.filter(e => {
      const isRelated = e.recurringEventId === rootMasterGoogleId || e.recurringEventId === masterEvent.id;
      return (isRelated && e.startTime >= targetIso && e.id !== masterEvent.id);
    });

    // 3. Evaluate Future Exceptions based on Change Type
    const newSeriesId = 'evt_' + Date.now();

    if (isStructuralChange) {
      // Rhythm is broken: purge future exceptions
      for (const ex of futureExceptions) {
        console.log(`[KAIRO: AUTO-PURGE] Structural split detected. Automatically deleting invalid future exception: "${ex.title}" (${ex.id})`, ex);
        eventStore.deleteEvent(ex.id);
      }
    } else {
      // Rhythm is safe: Reparent exceptions to the new series and apply attribute shifts
      const startObj = parseISO(updatedEvent.startTime);
      const oldStartObj = parseISO(originalEvent.startTime);
      const deltaMinutes = differenceInMinutes(startObj, oldStartObj);

      for (const ex of futureExceptions) {
        let childStart = parseISO(ex.startTime);
        let childEnd = ex.endTime ? parseISO(ex.endTime) : childStart;
        
        if (isTimeChange) {
          childStart = addMinutes(childStart, deltaMinutes);
          childEnd = addMinutes(childEnd, deltaMinutes);
        }

        eventStore.updateEvent({
          ...ex,
          title: updatedEvent.title,
          description: updatedEvent.description,
          location: updatedEvent.location,
          conferencingUrl: updatedEvent.conferencingUrl,
          conferencingProvider: updatedEvent.conferencingProvider,
          colorOverride: updatedEvent.colorOverride,
          startTime: childStart.toISOString(),
          endTime: childEnd.toISOString(),
          recurringEventId: newSeriesId, // Reparenting
          syncStatus: 'pending_update'
        });
      }
    }

    // 4. Spawn the new Master Series
    const rawRule = isRRuleChange ? updatedEvent.rrule : canonicalMasterRRule;
    const newSeriesRRule = convertRRuleToRFC5545(rawRule, updatedEvent.startTime)
      .replace(/;?UNTIL=[^;]+/gi, '');

    const newSeries: CalendarEvent = {
      ...updatedEvent,
      id: newSeriesId,
      rrule: newSeriesRRule,
      exdates: [],
      untilDate: undefined,
      googleEventId: undefined,
      recurringEventId: undefined,
      isRecurringInstance: false,
      syncStatus: 'pending_insert'
    };
    
    eventStore.addEvent(newSeries);
  } 
  
  // RULE C: "All Events" (Global Cascade)
  else if (scope === 'all') {
    const newStart = parseISO(updatedEvent.startTime);
    const newEnd = parseISO(updatedEvent.endTime);
    const duration = getSafeDuration(newStart, newEnd);
    
    const oldStartObj = parseISO(originalEvent.startTime);
    const deltaMinutes = differenceInMinutes(newStart, oldStartObj);

    // MYSTERY 1 FIX: If modifying the root event, snap the Master directly to the new start time 
    // to prevent timezone offsets causing 1-day jumps. If modifying mid-series, use delta math.
    const adjustedMasterStart = isRoot ? newStart : addMinutes(masterStart, deltaMinutes);
    const adjustedMasterEnd = addMinutes(adjustedMasterStart, duration);

    const rawRule = isRRuleChange ? updatedEvent.rrule : masterEvent.rrule;
    const canonicalRRule = convertRRuleToRFC5545(rawRule, adjustedMasterStart.toISOString());

    // 1. Update the Master Series
    eventStore.updateEvent({
      ...masterEvent,
      title: updatedEvent.title,
      description: updatedEvent.description,
      location: updatedEvent.location,
      conferencingUrl: updatedEvent.conferencingUrl,
      conferencingProvider: updatedEvent.conferencingProvider,
      colorOverride: updatedEvent.colorOverride,
      startTime: adjustedMasterStart.toISOString(),
      endTime: adjustedMasterEnd.toISOString(),
      isAllDay: updatedEvent.isAllDay,
      timeZone: sanitizeTimezone(updatedEvent.timeZone),
      rrule: canonicalRRule,
      exdates: isStructuralChange ? [] : masterEvent.exdates, // Clear memory if cadence changes
      syncStatus: 'pending_update'
    });

    // 2. Cascade changes to child exceptions
    const childExceptions = eventStore.events.filter(e => 
      e.recurringEventId === rootMasterGoogleId || 
      (masterEvent.googleEventId && e.recurringEventId === masterEvent.googleEventId)
    );

    if (isStructuralChange) {
      // The timeline foundation changed; old exceptions are completely mathematically invalid.
      for (const ex of childExceptions) {
        console.log(`[KAIRO: AUTO-PURGE] Global structural change detected. Automatically deleting invalid exception: "${ex.title}" (${ex.id})`, ex);
        eventStore.deleteEvent(ex.id);
      }
    } else {
      // Attribute or pure Time shift: safe to cascade without destroying dates
      for (const child of childExceptions) {
        let childStart = parseISO(child.startTime);
        let childEnd = child.endTime ? parseISO(child.endTime) : childStart;

        if (isTimeChange) {
          childStart = addMinutes(childStart, deltaMinutes);
          childEnd = addMinutes(childStart, duration);
        }

        eventStore.updateEvent({
          ...child,
          title: updatedEvent.title,
          description: updatedEvent.description,
          location: updatedEvent.location,
          conferencingUrl: updatedEvent.conferencingUrl,
          conferencingProvider: updatedEvent.conferencingProvider,
          colorOverride: updatedEvent.colorOverride,
          startTime: childStart.toISOString(),
          endTime: childEnd.toISOString(),
          isAllDay: updatedEvent.isAllDay,
          timeZone: sanitizeTimezone(updatedEvent.timeZone),
          syncStatus: 'pending_update'
        });
      }
    }
  }
}

/* ==========================================================================
   ENGINE: DELETION LOGIC
   ========================================================================== */

export async function executeRecurrenceDelete(payload: Omit<RecurrencePayload, 'updatedEvent' | 'diffs'>): Promise<void> {
  const { scope, originalEvent, occurrenceDate } = payload;
  
  const masterEvent = getRootMaster(originalEvent);
  const rootMasterGoogleId = masterEvent.googleEventId || masterEvent.id;
  const masterStart = parseISO(masterEvent.startTime);
  const occDate = parseISO(occurrenceDate);
  const masterStartKey = format(masterStart, 'yyyy-MM-dd');
  const isRoot = isSameDay(masterStart, occDate) || occurrenceDate <= masterStartKey;

  // RULE A: "This Event"
  if (scope === 'this') {
    if (originalEvent.id !== masterEvent.id || originalEvent.recurringEventId) {
      eventStore.deleteEvent(originalEvent.id);
    }
    const currentExdates = masterEvent.exdates || [];
    if (!currentExdates.includes(occurrenceDate)) {
      eventStore.updateEvent({
        ...masterEvent,
        exdates: [...currentExdates, occurrenceDate],
        syncStatus: 'pending_update'
      });
    }
  } 
  
  // RULE B: "This and Following"
  else if (scope === 'following') {
    if (isRoot) {
      await eventStore.deleteRecurringSeries(rootMasterGoogleId, originalEvent.calendarId);
    } else {
      const cutoffDateObj = subDays(occDate, 1);
      const cutoffDateKey = format(cutoffDateObj, 'yyyy-MM-dd');
      const untilUtcStr = calculateUntilString(cutoffDateKey, masterEvent.isAllDay || false, masterEvent.timeZone || 'UTC');
      
      const canonicalMasterRRule = convertRRuleToRFC5545(masterEvent.rrule || 'weekly', masterEvent.startTime)
        .replace(/;?UNTIL=[^;]+/gi, '');

      eventStore.updateEvent({
        ...masterEvent,
        untilDate: cutoffDateKey,
        rrule: `${canonicalMasterRRule};UNTIL=${untilUtcStr}`,
        syncStatus: 'pending_update'
      });

      // Purge Future Exceptions
      const targetIso = occDate.toISOString();
      const futureExceptions = eventStore.events.filter(e => {
        const isRelated = e.recurringEventId === rootMasterGoogleId || e.recurringEventId === masterEvent.id;
        return (isRelated && e.startTime >= targetIso && e.id !== masterEvent.id);
      });
      for (const ex of futureExceptions) {
        console.log(`[KAIRO: AUTO-PURGE] Series truncation detected. Automatically deleting orphaned future exception: "${ex.title}" (${ex.id})`, ex);
        eventStore.deleteEvent(ex.id);
      }
    }
  } 
  
  // RULE C: "All Events"
  else if (scope === 'all') {
    await eventStore.deleteRecurringSeries(rootMasterGoogleId, originalEvent.calendarId);
  }
}