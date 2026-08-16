<script lang="ts">
  import { format, parseISO } from 'date-fns';
  import { X, Trash2, Clock, AlignLeft, Calendar as CalIcon, Check } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';

  let event = $derived(calendarState.selectedEvent);

  function handleSaveTitle(e: Event) {
    if (!event) return;
    const title = (e.target as HTMLInputElement).value;
    eventStore.updateEvent({ ...event, title });
  }

  function handleDelete() {
    if (!event) return;
    eventStore.deleteEvent(event.id);
    calendarState.closeInspector();
  }

  function calculatePosition(rect: DOMRect | null) {
    if (!rect) return 'top: 25%; left: 50%; transform: translateX(-50%);';
    
    const inspectorWidth = 320;
    const inspectorHeight = 360;

    // Prefer rendering to the right of the active anchor
    let left = rect.right + 12;
    if (left + inspectorWidth > window.innerWidth - 16) {
      // Flip to left if screen boundary is reached
      left = Math.max(16, rect.left - inspectorWidth - 12);
    }

    let top = Math.min(window.innerHeight - inspectorHeight - 16, Math.max(16, rect.top - 10));
    return `top: ${top}px; left: ${left}px;`;
  }
</script>

{#if event}
  <!-- Event Inspector Panel with Higher Stacking Level -->
  <div
    class="fixed z-50 w-80 bg-[#1c1c1c] border border-[#333333] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.6)] p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100 select-text"
    style={calculatePosition(calendarState.inspectorRect)}
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-[#282828] pb-2">
      <span class="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Edit Event</span>
      <div class="flex items-center gap-1">
        <button
          onclick={handleDelete}
          class="p-1 text-zinc-400 hover:text-rose-400 hover:bg-[#262626] rounded transition-colors"
          title="Delete Event"
        >
          <Trash2 size={14} />
        </button>
        <button
          onclick={() => calendarState.closeInspector()}
          class="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#262626] rounded transition-colors"
        >
          <X size={14} />
        </button>
      </div>
    </div>

    <!-- Title Input -->
    <input
      type="text"
      value={event.title}
      oninput={handleSaveTitle}
      class="w-full bg-[#141414] border border-[#2b2b2b] rounded-lg px-2.5 py-1.5 text-sm font-semibold text-zinc-100 focus:outline-none focus:border-blue-500"
      placeholder="Event Title"
    />

    <!-- Date & Time Info -->
    <div class="flex items-center gap-2.5 text-xs text-zinc-300">
      <Clock size={15} class="text-zinc-500 shrink-0" />
      <span>{format(parseISO(event.startTime), 'EEE, MMM d, yyyy · h:mm a')}</span>
    </div>

    <!-- Calendar Category Selector -->
    <div class="flex items-center gap-2.5 text-xs text-zinc-300">
      <CalIcon size={15} class="text-zinc-500 shrink-0" />
      <select
        class="bg-[#141414] border border-[#2b2b2b] rounded px-2 py-1 text-zinc-200 text-xs focus:outline-none focus:border-blue-500"
        value={event.calendarId}
        onchange={(e) => {
          if (event) eventStore.updateEvent({ ...event, calendarId: (e.target as HTMLSelectElement).value });
        }}
      >
        {#each calendarState.calendars as cal}
          <option value={cal.id}>{cal.name}</option>
        {/each}
      </select>
    </div>

    <!-- Description -->
    <div class="flex items-start gap-2.5 text-xs text-zinc-300 pt-1">
      <AlignLeft size={15} class="text-zinc-500 shrink-0 mt-1" />
      <textarea
        rows="2"
        placeholder="Add description or notes..."
        class="w-full bg-[#141414] border border-[#2b2b2b] rounded-lg p-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
      ></textarea>
    </div>
  </div>
{/if}