<script lang="ts">
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';

  let selectedScope = $state<'this' | 'following' | 'all'>('this');

  function handleConfirm() {
    const pending = contextMenuStore.pendingRecurringAction;
    if (!pending) return;

    if (pending.action === 'delete') {
      if (selectedScope === 'this') {
        eventStore.deleteEvent(pending.event.id);
      } else {
        eventStore.deleteEvent(pending.event.id);
      }
    } else if (pending.action === 'update' && pending.targetDate) {
      eventStore.rescheduleEvent(pending.event.id, pending.targetDate);
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
  <div class="fixed inset-0 z-50 bg-black/50 backdrop-blur-[1px] flex items-center justify-center">
    <div class="w-96 bg-[#1e1e1e] border border-[#333333] rounded-2xl shadow-2xl p-5 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-100 select-none">
      <h3 class="text-sm font-semibold text-zinc-100">
        Edit repeat event "{contextMenuStore.pendingRecurringAction.event.title}"
      </h3>

      <div class="flex flex-col gap-2.5 text-xs text-zinc-200">
        <label class="flex items-center gap-3 cursor-pointer p-1.5 rounded-lg hover:bg-[#262626]">
          <input type="radio" name="recurrenceScope" value="this" bind:group={selectedScope} class="accent-blue-500" />
          <span>This event</span>
        </label>

        <label class="flex items-center gap-3 cursor-pointer p-1.5 rounded-lg hover:bg-[#262626]">
          <input type="radio" name="recurrenceScope" value="following" bind:group={selectedScope} class="accent-blue-500" />
          <span>This and following events</span>
        </label>

        <label class="flex items-center gap-3 cursor-pointer p-1.5 rounded-lg hover:bg-[#262626]">
          <input type="radio" name="recurrenceScope" value="all" bind:group={selectedScope} class="accent-blue-500" />
          <span>All events</span>
        </label>
      </div>

      <div class="flex items-center justify-end gap-2 pt-2 border-t border-[#292929]">
        <button 
          onclick={handleCancel}
          class="px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-[#292929] rounded-lg transition-colors"
        >
          Discard change
        </button>
        <button 
          onclick={handleConfirm}
          class="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors shadow"
        >
          Save event
        </button>
      </div>
    </div>
  </div>
{/if}