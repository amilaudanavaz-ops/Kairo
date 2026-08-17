<script lang="ts">
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { parseISO, setHours, setMinutes, differenceInMinutes, addMinutes, format } from 'date-fns';
  import { List, X } from 'lucide-svelte';

  let selectedScope = $state<'this' | 'following' | 'all'>('this');
  let pending = $derived(contextMenuStore.pendingRecurringAction);
  let showPendingDiffs = $state(true);

  // Date or weekday change check
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

  function handleSave() {
    if (!pending) return;

    const master = pending.originalEvent;
    const updated = pending.updatedEvent;
    const occurrenceDate = pending.occurrenceDate || format(parseISO(master.startTime), 'yyyy-MM-dd');

    if (pending.action === 'delete') {
      if (selectedScope === 'this' && occurrenceDate) {
        const exdates = master.exdates || [];
        eventStore.updateEvent({
          ...master,
          exdates: [...exdates.filter(d => d !== occurrenceDate), occurrenceDate],
          updatedAt: new Date().toISOString()
        });
      } else if (selectedScope === 'following' && occurrenceDate) {
        eventStore.updateEvent({
          ...master,
          untilDate: occurrenceDate,
          updatedAt: new Date().toISOString()
        });
      } else {
        eventStore.deleteEvent(master.id);
      }
    } else if (pending.action === 'update' && updated) {
      if (selectedScope === 'this' && occurrenceDate) {
        // 1. Exclude this specific occurrence from master series
        const exdates = master.exdates || [];
        eventStore.updateEvent({
          ...master,
          exdates: [...exdates.filter(d => d !== occurrenceDate), occurrenceDate],
          updatedAt: new Date().toISOString()
        });

        // 2. Create standalone detached instance
        const detached = {
          ...updated,
          id: 'evt_' + Date.now(),
          rrule: 'none',
          exdates: [],
          untilDate: undefined,
          recurringEventId: master.id,
          originalStartTime: occurrenceDate,
          isRecurringInstance: false,
          updatedAt: new Date().toISOString()
        };
        eventStore.addEvent(detached);
      } else if (selectedScope === 'following' && occurrenceDate) {
        // 1. Terminate old series before this date
        eventStore.updateEvent({
          ...master,
          untilDate: occurrenceDate,
          updatedAt: new Date().toISOString()
        });

        // 2. Start new series from this date forward
        const newSeries = {
          ...updated,
          id: 'evt_' + Date.now(),
          rrule: master.rrule || updated.rrule || 'weekly',
          exdates: [],
          untilDate: undefined,
          recurringEventId: undefined,
          isRecurringInstance: false,
          updatedAt: new Date().toISOString()
        };
        eventStore.addEvent(newSeries);
      } else {
        // 3. Update "All events" across master series
        const newStart = parseISO(updated.startTime);
        const newEnd = parseISO(updated.endTime);
        const duration = differenceInMinutes(newEnd, newStart);

        const masterStart = parseISO(master.startTime);
        const adjustedMasterStart = setMinutes(setHours(masterStart, newStart.getHours()), newStart.getMinutes());
        const adjustedMasterEnd = addMinutes(adjustedMasterStart, duration);

        eventStore.updateEvent({
          ...master,
          title: updated.title,
          description: updated.description,
          location: updated.location,
          conferencingUrl: updated.conferencingUrl,
          startTime: adjustedMasterStart.toISOString(),
          endTime: adjustedMasterEnd.toISOString(),
          colorOverride: updated.colorOverride,
          calendarId: updated.calendarId,
          reminders: updated.reminders,
          rrule: updated.rrule || master.rrule,
          updatedAt: new Date().toISOString()
        });
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