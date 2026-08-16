<script lang="ts">
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';

  let selectedScope = $state<'this' | 'following' | 'all'>('this');

  function handleConfirm() {
    const pending = contextMenuStore.pendingRecurringAction;
    if (!pending) return;

    if (pending.action === 'delete') {
      if (selectedScope === 'this') {
        // Detach this single instance as an exception
        eventStore.deleteEvent(pending.originalEvent.id);
      } else {
        eventStore.deleteEvent(pending.originalEvent.id);
      }
      if (calendarState.selectedEventId === pending.originalEvent.id) {
        calendarState.closeInspector();
      }
    } else if (pending.action === 'update' && pending.updatedEvent) {
      if (selectedScope === 'this') {
        // Convert single occurrence into standalone event without rrule
        const detached = {
          ...pending.updatedEvent,
          id: 'evt_' + Date.now(),
          rrule: 'none',
          recurringEventId: pending.originalEvent.id
        };
        eventStore.addEvent(detached);
      } else {
        eventStore.updateEvent(pending.updatedEvent);
      }
    }

    contextMenuStore.isRecurrenceModalOpen = false;
    contextMenuStore.pendingRecurringAction = null;
  }

  function handleCancel() {
    contextMenuStore.isRecurrenceModalOpen = false;
    contextMenuStore.pendingRecurringAction = null;
  }
</script>

{#if contextMenuStore.isRecurrenceModalOpen && contextMenuStore.pendingRecurringAction}
  <div class="fixed inset-0 z-[80] bg-black/60 backdrop-blur-[1.5px] flex items-center justify-center select-none">
    <div class="w-96 bg-[#1e1e1e] border border-[#333333] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.9)] p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
      <h3 class="text-sm font-bold text-zinc-100">
        Edit repeat event "{contextMenuStore.pendingRecurringAction.originalEvent.title || '(No Title)'}"
      </h3>

      <div class="flex flex-col gap-2 text-xs text-zinc-200">
        <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#282828] transition-colors {selectedScope === 'this' ? 'bg-[#252525] font-semibold text-white' : ''}">
          <input type="radio" name="recurrenceScope" value="this" bind:group={selectedScope} class="accent-blue-500" />
          <span>This event</span>
        </label>

        <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#282828] transition-colors {selectedScope === 'following' ? 'bg-[#252525] font-semibold text-white' : ''}">
          <input type="radio" name="recurrenceScope" value="following" bind:group={selectedScope} class="accent-blue-500" />
          <span>This and following events</span>
        </label>

        <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#282828] transition-colors {selectedScope === 'all' ? 'bg-[#252525] font-semibold text-white' : ''}">
          <input type="radio" name="recurrenceScope" value="all" bind:group={selectedScope} class="accent-blue-500" />
          <span>All events</span>
        </label>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#292929]">
        <button 
          onclick={handleCancel}
          class="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-[#292929] rounded-lg transition-colors cursor-pointer"
        >
          Discard change
        </button>
        <button 
          onclick={handleConfirm}
          class="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow cursor-pointer"
        >
          Save event
        </button>
      </div>
    </div>
  </div>
{/if}