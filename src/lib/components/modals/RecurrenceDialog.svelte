<script lang="ts">
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { 
    eventStore, 
    getValidTokenAndCalendar, 
    convertRRuleToRFC5545, 
    sanitizeTimezone, 
    type NormalizedGoogleEvent 
  } from '../../stores/eventStore.svelte';
  import { getDb } from '../../db/database';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { 
    parseISO, 
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
  import { invoke } from '@tauri-apps/api/core';
  import type { CalendarEvent } from '../../../types/event';

  interface CalendarAuth {
    accessToken: string;
    googleCalendarId: string;
  }

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

  $effect(() => {
    if (isDateChange && selectedScope === 'all') {
      selectedScope = 'this';
    }
  });

  /* ==========================================================================
     DATABASE & SERIES MANAGEMENT HELPERS
     ========================================================================= */

  async function deleteSeriesFromDb(rootMasterGoogleId: string): Promise<void> {
    try {
      const db = await getDb();
      await db.execute(
        `DELETE FROM events WHERE id = ?1 OR google_event_id = ?1 OR recurring_event_id = ?1;`,
        [rootMasterGoogleId]
      );
    } catch (err) {
      console.error('Failed to delete series from SQLite DB:', err);
    }
  }

  async function deleteFutureInstancesFromDb(rootMasterGoogleId: string, fromIsoDate: string): Promise<void> {
    try {
      const db = await getDb();
      await db.execute(
        `DELETE FROM events WHERE (id = ?1 OR google_event_id = ?1 OR recurring_event_id = ?1) AND start_time >= ?2;`,
        [rootMasterGoogleId, fromIsoDate]
      );
    } catch (err) {
      console.error('Failed to delete future instances from SQLite DB:', err);
    }
  }

  async function deleteRecurringSeries(rootMasterGoogleId: string, calendarId?: string) {
    eventStore.events = eventStore.events.filter(e => 
      !(e.recurringEventId === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId || e.id === rootMasterGoogleId)
    );
    await deleteSeriesFromDb(rootMasterGoogleId);

    if (calendarId) {
      getValidTokenAndCalendar(calendarId).then(async (auth: CalendarAuth | null) => {
        if (!auth) return;
        try {
          await invoke('delete_google_event', {
            accessToken: auth.accessToken,
            calendarId: auth.googleCalendarId,
            eventId: rootMasterGoogleId
          });
        } catch (e) {
          console.error('Failed to delete series on Google:', e);
        }
      });
    }
  }

  /* ==========================================================================
     SAVE HANDLER
     ========================================================================= */

  async function handleSave() {
    if (!pending) return;

    const instance = pending.originalEvent;
    const updated = pending.updatedEvent;
    const occurrenceDate = pending.occurrenceDate || format(parseISO(instance.startTime), 'yyyy-MM-dd');
    
    // Resolve master series ID
    const rootMasterGoogleId = instance.recurringEventId || instance.googleEventId || instance.id;

    // Find all sibling occurrences of this series sorted chronologically
    const siblingInstances = eventStore.events.filter(e => 
      e.recurringEventId === rootMasterGoogleId || 
      e.googleEventId === rootMasterGoogleId ||
      e.id === instance.id
    ).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

    // Master start timestamp
    const masterStart = siblingInstances.length > 0 ? parseISO(siblingInstances[0].startTime) : parseISO(instance.startTime);
    const occDate = parseISO(occurrenceDate);
    const masterStartKey = format(masterStart, 'yyyy-MM-dd');

    if (pending.action === 'delete') {
      if (selectedScope === 'this' && occurrenceDate) {
        // Exclude this occurrence date from the master series
        const currentExdates = instance.exdates || [];
        if (!currentExdates.includes(occurrenceDate)) {
          eventStore.updateEvent({
            ...instance,
            exdates: [...currentExdates, occurrenceDate]
          });
        }
        eventStore.deleteEvent(instance.id);

        if (instance.googleEventId) {
          getValidTokenAndCalendar(instance.calendarId).then(async (auth: CalendarAuth | null) => {
            if (!auth) return;
            try {
              await invoke('delete_google_event', {
                accessToken: auth.accessToken,
                calendarId: auth.googleCalendarId,
                eventId: instance.googleEventId!
              });
            } catch (e) {
              console.error('Failed to delete instance on Google:', e);
            }
          });
        }
      } else if (selectedScope === 'following' && occurrenceDate) {
        if (isSameDay(masterStart, occDate) || occurrenceDate <= masterStartKey) {
          await deleteRecurringSeries(rootMasterGoogleId, instance.calendarId);
        } else {
          // Truncate series before the occurrence date
          const cutoffDate = subDays(occDate, 1);
          const untilUtcStr = `${format(cutoffDate, 'yyyyMMdd')}T235959Z`;
          const cutoffDateKey = format(cutoffDate, 'yyyy-MM-dd');
          const cleanRRule = instance.rrule ? instance.rrule.replace(/;?UNTIL=[^;]+/gi, '') : 'weekly';

          const masterEvent = eventStore.events.find(e => e.id === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId);
          if (masterEvent) {
            eventStore.updateEvent({
              ...masterEvent,
              untilDate: cutoffDateKey,
              rrule: `${cleanRRule};UNTIL=${untilUtcStr}`
            });
          }

          eventStore.events = eventStore.events.filter(e => {
            const isMatch = (e.recurringEventId === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId || e.id === instance.id);
            return !(isMatch && e.startTime >= occDate.toISOString());
          });
          await deleteFutureInstancesFromDb(rootMasterGoogleId, occDate.toISOString());

          if (rootMasterGoogleId) {
            getValidTokenAndCalendar(instance.calendarId).then(async (auth: CalendarAuth | null) => {
              if (!auth) return;
              try {
                await invoke<NormalizedGoogleEvent>('update_google_event', {
                  accessToken: auth.accessToken,
                  calendarId: auth.googleCalendarId,
                  eventId: rootMasterGoogleId,
                  event: {
                    title: instance.title,
                    description: instance.description || null,
                    location: instance.location || null,
                    start_time: masterStart.toISOString(),
                    end_time: addMinutes(masterStart, Math.max(15, differenceInMinutes(parseISO(instance.endTime), parseISO(instance.startTime)))).toISOString(),
                    is_all_day: instance.isAllDay,
                    time_zone: sanitizeTimezone(instance.timeZone),
                    rrule: convertRRuleToRFC5545(cleanRRule, masterStart.toISOString()) + `;UNTIL=${untilUtcStr}`
                  }
                });
              } catch (e) {
                console.error('Failed to update cutoff on Google:', e);
              }
            });
          }
        }
      } else {
        await deleteRecurringSeries(rootMasterGoogleId, instance.calendarId);
      }
    } else if (pending.action === 'update' && updated) {
      if (selectedScope === 'this' && occurrenceDate) {
        // Detach single occurrence as a standalone instance
        const currentExdates = instance.exdates || [];
        if (!currentExdates.includes(occurrenceDate)) {
          const masterEvent = eventStore.events.find(e => e.id === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId);
          if (masterEvent) {
            eventStore.updateEvent({
              ...masterEvent,
              exdates: [...(masterEvent.exdates || []), occurrenceDate]
            });
          }
        }

        const patchedInstance: CalendarEvent = {
          ...updated,
          id: 'evt_' + Date.now(),
          googleEventId: instance.googleEventId,
          recurringEventId: rootMasterGoogleId,
          occurrenceDate,
          isRecurringInstance: false,
          rrule: 'none',
          exdates: [],
          untilDate: undefined,
          updatedAt: new Date().toISOString()
        };
        eventStore.addEvent(patchedInstance);

        if (instance.googleEventId) {
          getValidTokenAndCalendar(instance.calendarId).then(async (auth: CalendarAuth | null) => {
            if (!auth) return;
            try {
              await invoke<NormalizedGoogleEvent>('update_google_event', {
                accessToken: auth.accessToken,
                calendarId: auth.googleCalendarId,
                eventId: instance.googleEventId!,
                event: {
                  title: updated.title,
                  description: updated.description || null,
                  location: updated.location || null,
                  start_time: updated.startTime,
                  end_time: updated.endTime,
                  is_all_day: updated.isAllDay,
                  time_zone: sanitizeTimezone(updated.timeZone),
                  rrule: null
                }
              });
            } catch (e) {
              console.error('Failed to patch Google recurring instance exception:', e);
            }
          });
        }
      } else if (selectedScope === 'following' && occurrenceDate) {
        const cutoffDate = subDays(occDate, 1);
        const untilUtcStr = `${format(cutoffDate, 'yyyyMMdd')}T235959Z`;
        const cutoffDateKey = format(cutoffDate, 'yyyy-MM-dd');
        const cleanRRule = instance.rrule ? instance.rrule.replace(/;?UNTIL=[^;]+/gi, '') : 'weekly';

        // 1. Truncate local master series with embedded UNTIL
        const masterEvent = eventStore.events.find(e => e.id === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId);
        if (masterEvent) {
          eventStore.updateEvent({
            ...masterEvent,
            untilDate: cutoffDateKey,
            rrule: `${cleanRRule};UNTIL=${untilUtcStr}`
          });
        }

        // 2. Set UNTIL cutoff on Google Calendar API
        if (rootMasterGoogleId) {
          getValidTokenAndCalendar(instance.calendarId).then(async (auth: CalendarAuth | null) => {
            if (!auth) return;
            try {
              await invoke<NormalizedGoogleEvent>('update_google_event', {
                accessToken: auth.accessToken,
                calendarId: auth.googleCalendarId,
                eventId: rootMasterGoogleId,
                event: {
                  title: instance.title,
                  description: instance.description || null,
                  location: instance.location || null,
                  start_time: masterStart.toISOString(),
                  end_time: addMinutes(masterStart, Math.max(15, differenceInMinutes(parseISO(instance.endTime), parseISO(instance.startTime)))).toISOString(),
                  is_all_day: instance.isAllDay,
                  time_zone: sanitizeTimezone(instance.timeZone),
                  rrule: convertRRuleToRFC5545(cleanRRule, masterStart.toISOString()) + `;UNTIL=${untilUtcStr}`
                }
              });
            } catch (e) {
              console.error('Failed to set UNTIL cutoff on Google:', e);
            }
          });
        }

        // 3. Clear existing detached sibling instances from cutoff onward
        eventStore.events = eventStore.events.filter(e => {
          const isMatch = (e.recurringEventId === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId || e.id === instance.id);
          return !(isMatch && e.startTime >= occDate.toISOString());
        });
        await deleteFutureInstancesFromDb(rootMasterGoogleId, occDate.toISOString());

        // 4. Create and persist new spawned recurring series
        const newSeriesId = 'evt_' + Date.now();
        const newSeries: CalendarEvent = {
          ...updated,
          id: newSeriesId,
          rrule: cleanRRule,
          exdates: [],
          untilDate: undefined,
          googleEventId: undefined,
          recurringEventId: undefined,
          isRecurringInstance: false,
          updatedAt: new Date().toISOString()
        };
        eventStore.addEvent(newSeries);

        // 5. Create new spawned series on Google Calendar
        getValidTokenAndCalendar(instance.calendarId).then(async (auth: CalendarAuth | null) => {
          if (!auth) return;
          try {
            const created = await invoke<NormalizedGoogleEvent>('create_google_event', {
              accessToken: auth.accessToken,
              calendarId: auth.googleCalendarId,
              event: {
                title: updated.title,
                description: updated.description || null,
                location: updated.location || null,
                start_time: updated.startTime,
                end_time: updated.endTime,
                is_all_day: updated.isAllDay,
                time_zone: sanitizeTimezone(updated.timeZone),
                rrule: convertRRuleToRFC5545(cleanRRule, updated.startTime)
              }
            });

            if (created && created.google_event_id) {
              eventStore.updateEvent({
                ...newSeries,
                googleEventId: created.google_event_id
              });
            }
          } catch (e) {
            console.error('Failed to spawn new recurring series on Google:', e);
          }
        });
      } else {
        const newStart = parseISO(updated.startTime);
        const newEnd = parseISO(updated.endTime);
        const duration = Math.max(15, differenceInMinutes(newEnd, newStart));

        const adjustedMasterStart = setMinutes(setHours(masterStart, newStart.getHours()), newStart.getMinutes());
        const adjustedMasterEnd = addMinutes(adjustedMasterStart, duration);

        eventStore.events = eventStore.events.map(e => {
          if (e.recurringEventId === rootMasterGoogleId || e.googleEventId === rootMasterGoogleId || e.id === instance.id) {
            return {
              ...e,
              title: updated.title,
              description: updated.description,
              location: updated.location,
              conferencingUrl: updated.conferencingUrl,
              colorOverride: updated.colorOverride,
              updatedAt: new Date().toISOString()
            };
          }
          return e;
        });

        if (rootMasterGoogleId) {
          getValidTokenAndCalendar(instance.calendarId).then(async (auth: CalendarAuth | null) => {
            if (!auth) return;
            try {
              await invoke<NormalizedGoogleEvent>('update_google_event', {
                accessToken: auth.accessToken,
                calendarId: auth.googleCalendarId,
                eventId: rootMasterGoogleId,
                event: {
                  title: updated.title,
                  description: updated.description || null,
                  location: updated.location || null,
                  start_time: adjustedMasterStart.toISOString(),
                  end_time: adjustedMasterEnd.toISOString(),
                  is_all_day: updated.isAllDay,
                  time_zone: sanitizeTimezone(updated.timeZone),
                  rrule: convertRRuleToRFC5545(updated.rrule || instance.rrule, adjustedMasterStart.toISOString())
                }
              });
            } catch (e) {
              console.error('Failed to update master series on Google:', e);
            }
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
  <div class="fixed inset-0 z-[120] bg-black/60 backdrop-blur-[2px] flex items-center justify-center select-none">
    <div class="w-[430px] bg-[#1e1e1e] border border-[#303030] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.95)] p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
      <h3 class="text-base font-bold text-zinc-100 tracking-tight">
        Edit repeat event “{pending.originalEvent.title || '(No Title)'}”
      </h3>

      <div class="flex flex-col gap-1.5 text-xs text-zinc-200">
        <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#262626] transition-colors {selectedScope === 'this' ? 'bg-[#252525] font-semibold text-white' : ''}">
          <input type="radio" name="recurrenceScope" value="this" bind:group={selectedScope} class="accent-blue-500 w-4 h-4 cursor-pointer" />
          <span>This event</span>
        </label>

        <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#262626] transition-colors {selectedScope === 'following' ? 'bg-[#252525] font-semibold text-white' : ''}">
          <input type="radio" name="recurrenceScope" value="following" bind:group={selectedScope} class="accent-blue-500 w-4 h-4 cursor-pointer" />
          <span>This and following events</span>
        </label>

        {#if !isDateChange}
          <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#262626] transition-colors {selectedScope === 'all' ? 'bg-[#252525] font-semibold text-white' : ''}">
            <input type="radio" name="recurrenceScope" value="all" bind:group={selectedScope} class="accent-blue-500 w-4 h-4 cursor-pointer" />
            <span>All events</span>
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