<script lang="ts">
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';

  let selectedScope = $state<'this' | 'following' | 'all'>('this');
  let pending = $derived(contextMenuStore.pendingRecurringAction);

  function handleSave() {
    if (!pending) return;

    if (pending.action === 'delete') {
      if (selectedScope === 'this') {
        eventStore.deleteEvent(pending.originalEvent.id);
      } else {
        eventStore.deleteEvent(pending.originalEvent.id);
      }
      if (calendarState.selectedEventId === pending.originalEvent.id) {
        calendarState.closeInspector();
      }
    } else if (pending.action === 'update' && pending.updatedEvent) {
      if (selectedScope === 'this') {
        // Create an exception / standalone detached instance
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

  function handleContinueEditing() {
    contextMenuStore.isRecurrenceModalOpen = false;
  }

  function handleDiscard() {
    contextMenuStore.isRecurrenceModalOpen = false;
    contextMenuStore.pendingRecurringAction = null;
  }
</script>

{#if contextMenuStore.isRecurrenceModalOpen && pending}
  <!-- Backdrop -->
  <div class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[2px] flex items-center justify-center select-none">
    <div class="w-[400px] bg-[#1e1e1e] border border-[#333333] rounded-2xl shadow-[0_24px_60px_rgba(0,0,0,0.9)] p-6 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
      <h3 class="text-sm font-bold text-zinc-100">
        Edit repeat event "{pending.originalEvent.title || '(No Title)'}"
      </h3>

      <!-- Notion Scope Selection Radios -->
      <div class="flex flex-col gap-2.5 text-xs text-zinc-200">
        <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#282828] transition-colors {selectedScope === 'this' ? 'bg-[#262626] font-semibold text-white' : ''}">
          <input type="radio" name="recurrenceScope" value="this" bind:group={selectedScope} class="accent-blue-500 w-4 h-4" />
          <span>This event</span>
        </label>

        <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#282828] transition-colors {selectedScope === 'following' ? 'bg-[#262626] font-semibold text-white' : ''}">
          <input type="radio" name="recurrenceScope" value="following" bind:group={selectedScope} class="accent-blue-500 w-4 h-4" />
          <span>This and following events</span>
        </label>

        <label class="flex items-center gap-3 cursor-pointer p-2 rounded-lg hover:bg-[#282828] transition-colors {selectedScope === 'all' ? 'bg-[#262626] font-semibold text-white' : ''}">
          <input type="radio" name="recurrenceScope" value="all" bind:group={selectedScope} class="accent-blue-500 w-4 h-4" />
          <span>All events</span>
        </label>
      </div>

      <!-- Diff Preview Section (Matching Notion Calendar) -->
      {#if pending.diffOld && pending.diffNew}
        <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#181818] border border-[#282828] text-xs text-zinc-300">
          <span class="text-zinc-500">{pending.diffType === 'title' ? 'Title' : 'Time'}</span>
          <span class="line-through text-zinc-500">{pending.diffOld}</span>
          <span class="text-blue-400 font-semibold">{pending.diffNew}</span>
        </div>
      {/if}

      <!-- Bottom Action Buttons -->
      <div class="flex items-center justify-between pt-3 border-t border-[#292929]">
        <button 
          onclick={handleDiscard}
          class="px-3 py-1.5 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
        >
          Discard change
        </button>

        <div class="flex items-center gap-2">
          <button 
            onclick={handleContinueEditing}
            class="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-colors cursor-pointer"
          >
            Continue editing
          </button>
          <button 
            onclick={handleSave}
            class="px-4 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow cursor-pointer"
          >
            Save event
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}