<script lang="ts">
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { 
    eventStore, 
    convertRRuleToRFC5545, 
    sanitizeTimezone 
  } from '../../stores/eventStore.svelte';
  import { 
    getDb, 
    deleteSeriesFromDb, 
    deleteFutureInstancesFromDb 
  } from '../../db/database';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { 
    parseISO, 
    set,
    setHours, 
    setMinutes, 
    differenceInMinutes, 
    addMinutes, 
    format, 
    isSameDay, 
    subDays, 
    isValid 
  } from 'date-fns';
  import { List, X } from 'lucide-svelte';
  import type { CalendarEvent } from '../../../types/event';

  let selectedScope = $state<'this' | 'following' | 'all'>('this');
  let pending = $derived(contextMenuStore.pendingRecurringAction);
  let showPendingDiffs = $state(true);

  let isDateChange = $derived.by(() => {
    if (!pending?.updatedEvent) return false;
    const base = pending.initialSnapshot || pending.originalEvent;
    const oldOccKey = pending.occurrenceDate || format(parseISO(base.startTime), 'yyyy-MM-dd');
    const newOccKey = format(parseISO(pending.updatedEvent.startTime), 'yyyy-MM-dd');
    return oldOccKey !== newOccKey;
  });

  let isDetachedException = $derived.by(() => {
    if (!pending?.originalEvent) return false;
    return Boolean(
      pending.originalEvent.recurringEventId && 
      (!pending.originalEvent.rrule || pending.originalEvent.rrule === 'none')
    );
  });

  $effect(() => {
    if (isDateChange && selectedScope === 'all') {
      selectedScope = 'this';
    }
  });

  /* ==========================================================================
     SAVE HANDLER
     ========================================================================== */

  async function handleSave() {
    if (!pending) return;

    const instance = pending.originalEvent;
    const updated = pending.updatedEvent;
    const occurrenceDate = pending.occurrenceDate || format(parseISO(instance.startTime), 'yyyy-MM-dd');
    
    // Resolve the master recurring series ID
    const rootMasterGoogleId = instance.recurringEventId || instance.googleEventId || instance.id;

    // Find the master event record
    const masterEvent = eventStore.events.find(e => e.id === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId) || instance;
    const masterStart = parseISO(masterEvent.startTime);
    const occDate = parseISO(occurrenceDate);
    const masterStartKey = format(masterStart, 'yyyy-MM-dd');

    /* ------------------------------------------------------------------------
       1. DELETE ACTION
       ------------------------------------------------------------------------ */
    if (pending.action === 'delete') {
      if (selectedScope === 'this' && occurrenceDate) {
        // 1. If deleting a detached child exception, delete its record directly
        if (instance.id !== masterEvent.id || instance.recurringEventId) {
          eventStore.deleteEvent(instance.id);
        }

        // 2. Add exdate to master series to ensure it is not re-projected
        if (masterEvent && masterEvent.id !== instance.id) {
          const currentExdates = masterEvent.exdates || [];
          if (!currentExdates.includes(occurrenceDate)) {
            eventStore.updateEvent({
              ...masterEvent,
              exdates: [...currentExdates, occurrenceDate]
            });
          }
        }
      } else if (selectedScope === 'following' && occurrenceDate) {
        if (isSameDay(masterStart, occDate) || occurrenceDate <= masterStartKey) {
          await eventStore.deleteRecurringSeries(rootMasterGoogleId, instance.calendarId);
        } else {
          const cutoffDate = subDays(occDate, 1);
          const untilUtcStr = `${format(cutoffDate, 'yyyyMMdd')}T235959Z`;
          const cutoffDateKey = format(cutoffDate, 'yyyy-MM-dd');
          
          const canonicalMasterRRule = convertRRuleToRFC5545(masterEvent.rrule || 'weekly', masterEvent.startTime)
            .replace(/;?UNTIL=[^;]+/gi, '');

          eventStore.updateEvent({
            ...masterEvent,
            untilDate: cutoffDateKey,
            rrule: `${canonicalMasterRRule};UNTIL=${untilUtcStr}`
          });

          eventStore.events = eventStore.events.filter(e => {
            const isMatch = (e.recurringEventId === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId || e.id === instance.id);
            return !(isMatch && e.startTime >= occDate.toISOString() && e.id !== masterEvent.id);
          });
          await deleteFutureInstancesFromDb(rootMasterGoogleId, occDate.toISOString());
        }
      } else {
        // Delete all instances across master and all child exceptions
        await eventStore.deleteRecurringSeries(rootMasterGoogleId, instance.calendarId);
      }
    }
    /* ------------------------------------------------------------------------
       2. UPDATE ACTION
       ------------------------------------------------------------------------ */
    else if (pending.action === 'update' && updated) {
      if (selectedScope === 'this' && occurrenceDate) {
        // Exclude original occurrence date from master
        const currentExdates = masterEvent.exdates || [];
        if (!currentExdates.includes(occurrenceDate)) {
          eventStore.updateEvent({
            ...masterEvent,
            exdates: [...currentExdates, occurrenceDate]
          });
        }

        // Calculate original start timestamp corresponding to the specific occurrence date
        const origDateObj = parseISO(occurrenceDate);
        const masterStartObj = parseISO(masterEvent.startTime);
        const calculatedOriginalStart = set(origDateObj, {
          hours: masterStartObj.getHours(),
          minutes: masterStartObj.getMinutes(),
          seconds: masterStartObj.getSeconds()
        }).toISOString();

        const targetDateKey = format(parseISO(updated.startTime), 'yyyy-MM-dd');

        if (instance.id !== masterEvent.id) {
          // Editing an existing detached child exception: update in-place to prevent duplicates
          eventStore.updateEvent({
            ...instance,
            ...updated,
            recurringEventId: rootMasterGoogleId,
            originalStartTime: instance.originalStartTime || calculatedOriginalStart,
            occurrenceDate: targetDateKey,
            isRecurringInstance: false,
            rrule: 'none',
            exdates: [],
            untilDate: undefined,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Creating a new detached exception from a virtual master instance
          const detachedInstance: CalendarEvent = {
            ...updated,
            id: 'evt_' + Date.now(),
            googleEventId: undefined,
            recurringEventId: rootMasterGoogleId,
            originalStartTime: instance.originalStartTime || calculatedOriginalStart,
            occurrenceDate: targetDateKey,
            isRecurringInstance: false,
            rrule: 'none',
            exdates: [],
            untilDate: undefined,
            updatedAt: new Date().toISOString()
          };
          eventStore.addEvent(detachedInstance);
        }
      } else if (selectedScope === 'following' && occurrenceDate) {
        const isModifyingFromRoot = isSameDay(masterStart, occDate) || occurrenceDate <= masterStartKey;

        if (isModifyingFromRoot) {
          // Modifying from the very first occurrence: update master series in-place
          const newStart = parseISO(updated.startTime);
          const newEnd = parseISO(updated.endTime);
          const duration = Math.max(15, differenceInMinutes(newEnd, newStart));

          const rawRule = (updated.rrule && updated.rrule !== 'none') ? updated.rrule : masterEvent.rrule;
          const canonicalRRule = convertRRuleToRFC5545(rawRule, newStart.toISOString())
            .replace(/;?UNTIL=[^;]+/gi, '');

          eventStore.updateEvent({
            ...masterEvent,
            title: updated.title,
            description: updated.description,
            location: updated.location,
            conferencingUrl: updated.conferencingUrl,
            conferencingProvider: updated.conferencingProvider,
            colorOverride: updated.colorOverride,
            startTime: newStart.toISOString(),
            endTime: newEnd.toISOString(),
            isAllDay: updated.isAllDay,
            timeZone: sanitizeTimezone(updated.timeZone),
            rrule: canonicalRRule,
            untilDate: undefined,
            updatedAt: new Date().toISOString()
          });
        } else {
          // Modifying mid-series: truncate old master and spawn new series
          const cutoffDate = subDays(occDate, 1);
          const untilUtcStr = masterEvent.isAllDay 
            ? format(cutoffDate, 'yyyyMMdd') 
            : `${format(cutoffDate, 'yyyyMMdd')}T235959Z`;
          const cutoffDateKey = format(cutoffDate, 'yyyy-MM-dd');
          
          const canonicalMasterRRule = convertRRuleToRFC5545(masterEvent.rrule || 'weekly', masterEvent.startTime)
            .replace(/;?UNTIL=[^;]+/gi, '');

          eventStore.updateEvent({
            ...masterEvent,
            untilDate: cutoffDateKey,
            rrule: `${canonicalMasterRRule};UNTIL=${untilUtcStr}`
          });

          // Remove detached future instances matching local or Google ID from memory and SQLite
          const masterGid = masterEvent.googleEventId;
          eventStore.events = eventStore.events.filter(e => {
            const isMatch = (
              e.recurringEventId === rootMasterGoogleId || 
              e.id === instance.id ||
              (masterGid && e.recurringEventId === masterGid) ||
              e.recurringEventId === masterEvent.id
            );
            return !(isMatch && e.startTime >= occDate.toISOString() && e.id !== masterEvent.id);
          });
          
          await deleteFutureInstancesFromDb(rootMasterGoogleId, occDate.toISOString());
          if (masterGid && masterGid !== rootMasterGoogleId) {
            await deleteFutureInstancesFromDb(masterGid, occDate.toISOString());
          }

          // Spawn the new recurring series with cadence matching the new target start day
          const rawRule = (updated.rrule && updated.rrule !== 'none') ? updated.rrule : canonicalMasterRRule;
          const newSeriesRRule = convertRRuleToRFC5545(rawRule, updated.startTime)
            .replace(/;?UNTIL=[^;]+/gi, '');

          const newSeriesId = 'evt_' + Date.now();
          const newSeries: CalendarEvent = {
            ...updated,
            id: newSeriesId,
            rrule: newSeriesRRule,
            exdates: [],
            untilDate: undefined,
            googleEventId: undefined,
            recurringEventId: undefined,
            isRecurringInstance: false,
            updatedAt: new Date().toISOString()
          };
          
          eventStore.addEvent(newSeries);
        }
      } else {
        // Update all events across the master series
        const newStart = parseISO(updated.startTime);
        const newEnd = parseISO(updated.endTime);
        const duration = Math.max(15, differenceInMinutes(newEnd, newStart));

        const adjustedMasterStart = setMinutes(setHours(masterStart, newStart.getHours()), newStart.getMinutes());
        const adjustedMasterEnd = addMinutes(adjustedMasterStart, duration);

        const canonicalRRule = convertRRuleToRFC5545(updated.rrule || masterEvent.rrule, adjustedMasterStart.toISOString());

        // 1. Update the master recurring series
        eventStore.updateEvent({
          ...masterEvent,
          title: updated.title,
          description: updated.description,
          location: updated.location,
          conferencingUrl: updated.conferencingUrl,
          conferencingProvider: updated.conferencingProvider,
          colorOverride: updated.colorOverride,
          startTime: adjustedMasterStart.toISOString(),
          endTime: adjustedMasterEnd.toISOString(),
          isAllDay: updated.isAllDay,
          timeZone: sanitizeTimezone(updated.timeZone),
          rrule: canonicalRRule,
          updatedAt: new Date().toISOString()
        });

        // 2. Synchronize all detached child exceptions belonging to this series
        const childExceptions = eventStore.events.filter(e => 
          e.recurringEventId === rootMasterGoogleId || 
          (masterEvent.googleEventId && e.recurringEventId === masterEvent.googleEventId)
        );

        for (const child of childExceptions) {
          let childStart = parseISO(child.startTime);
          let childEnd = child.endTime ? parseISO(child.endTime) : childStart;

          // Adjust time slot if time was modified, while preserving the exception's calendar day
          if (
            newStart.getHours() !== parseISO(instance.startTime).getHours() || 
            newStart.getMinutes() !== parseISO(instance.startTime).getMinutes()
          ) {
            childStart = setMinutes(setHours(childStart, newStart.getHours()), newStart.getMinutes());
            childEnd = addMinutes(childStart, duration);
          }

          eventStore.updateEvent({
            ...child,
            title: updated.title,
            description: updated.description,
            location: updated.location,
            conferencingUrl: updated.conferencingUrl,
            conferencingProvider: updated.conferencingProvider,
            colorOverride: updated.colorOverride,
            startTime: childStart.toISOString(),
            endTime: childEnd.toISOString(),
            isAllDay: updated.isAllDay,
            timeZone: sanitizeTimezone(updated.timeZone),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    contextMenuStore.isRecurrenceModalOpen = false;
    contextMenuStore.pendingRecurringAction = null;
    calendarState.closeInspector();
  }

  function handleContinueEditing() {
    contextMenuStore.isRecurrenceModalOpen = false;
  }

  function handleDiscard() {
    contextMenuStore.isRecurrenceModalOpen = false;
    contextMenuStore.pendingRecurringAction = null;
    calendarState.closeInspector();
  }
</script>

{#if contextMenuStore.isRecurrenceModalOpen && pending}
  <div 
    class="fixed inset-0 z-[120] bg-black/60 backdrop-blur-[2px] flex items-center justify-center select-none"
    role="presentation"
  >
    <div 
      class="w-[430px] bg-[#1e1e1e] border border-[#303030] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.95)] p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150"
      role="dialog"
      aria-modal="true"
    >
      <h3 class="text-base font-bold text-zinc-100 tracking-tight">
        Edit repeat event “{pending.originalEvent.title || '(No Title)'}”
      </h3>

      <div class="flex flex-col gap-1.5 text-xs text-zinc-200">
        <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#262626] transition-colors {selectedScope === 'this' ? 'bg-[#252525] font-semibold text-white' : ''}">
          <input type="radio" name="recurrenceScope" value="this" bind:group={selectedScope} class="accent-blue-500 w-4 h-4 cursor-pointer" />
          <span>{isDetachedException ? 'Only this modified event' : 'This event'}</span>
        </label>

        {#if !isDetachedException}
          <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#262626] transition-colors {selectedScope === 'following' ? 'bg-[#252525] font-semibold text-white' : ''}">
            <input type="radio" name="recurrenceScope" value="following" bind:group={selectedScope} class="accent-blue-500 w-4 h-4 cursor-pointer" />
            <span>This and following events</span>
          </label>
        {/if}

        {#if !isDateChange || isDetachedException}
          <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#262626] transition-colors {selectedScope === 'all' ? 'bg-[#252525] font-semibold text-white' : ''}">
            <input type="radio" name="recurrenceScope" value="all" bind:group={selectedScope} class="accent-blue-500 w-4 h-4 cursor-pointer" />
            <span>{isDetachedException ? 'All events in this recurring series' : 'All events'}</span>
          </label>
        {/if}
      </div>

      {#if pending.diffs && pending.diffs.length > 0}
        <div class="border-t border-[#2a2a2a] pt-3 flex flex-col gap-2">
          <div class="flex items-center justify-between text-xs text-zinc-400 font-medium">
            <div class="flex items-center gap-1.5">
              <List size={13} class="text-zinc-500" />
              <span>Pending changes •</span>
            </div>
            <button onclick={() => showPendingDiffs = !showPendingDiffs} class="p-0.5 hover:text-zinc-200 cursor-pointer">
              <X size={13} />
            </button>
          </div>

          {#if showPendingDiffs}
            <div class="flex flex-col gap-2.5 max-h-36 overflow-y-auto custom-scrollbar pr-1">
              {#each pending.diffs as diff}
                <div class="flex flex-col text-xs">
                  <div class="flex items-baseline gap-2">
                    <span class="text-zinc-500 font-medium w-24 shrink-0">{diff.field}</span>
                    <span class="text-zinc-100 font-semibold">{diff.newValue} •</span>
                  </div>
                  <div class="pl-26 text-[11px] line-through text-zinc-500">
                    {diff.oldValue}
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      <div class="flex items-center justify-between pt-3 border-t border-[#292929]">
        <button 
          onclick={handleDiscard}
          class="text-xs font-semibold text-[#ef4444] hover:text-rose-300 py-1.5 px-1 rounded transition-colors cursor-pointer"
        >
          Discard changes
        </button>

        <div class="flex items-center gap-2">
          <button 
            onclick={handleContinueEditing}
            class="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white bg-[#282828] hover:bg-[#303030] rounded-lg transition-colors cursor-pointer"
          >
            Continue editing
          </button>
          <button 
            onclick={handleSave}
            class="px-4 py-1.5 text-xs font-semibold text-white bg-[#2563eb] hover:bg-blue-500 rounded-lg transition-colors shadow cursor-pointer"
          >
            Save event
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}