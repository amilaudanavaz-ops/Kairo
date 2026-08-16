<script lang="ts">
  import { format, parseISO } from 'date-fns';
  import { X } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import type { CalendarEvent } from '../../../types/event';

  let overflow = $derived(calendarState.overflowData);

  function getCalendarColor(calendarId: string): string {
    const cal = calendarState.calendars.find((c) => c.id === calendarId);
    return cal?.colorHex ?? '#3b82f6';
  }

  function handleEventDragStart(e: DragEvent, eventId: string) {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData('text/plain', eventId);
    e.dataTransfer.effectAllowed = 'move';
    calendarState.closeOverflow();
  }

  function handleEventClick(e: MouseEvent, event: CalendarEvent) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, rect);
  }

  function calculatePosition(rect: DOMRect | undefined) {
    if (!rect) return 'top: 20%; left: 50%; transform: translateX(-50%);';
    const top = Math.min(window.innerHeight - 340, Math.max(10, rect.top - 20));
    const left = Math.min(window.innerWidth - 270, Math.max(10, rect.left));
    return `top: ${top}px; left: ${left}px;`;
  }
</script>

{#if overflow}
  <!-- Backdrop for popover dismissal -->
  <div
    class="fixed inset-0 z-40 bg-black/20"
    onclick={() => calendarState.closeOverflow()}
    role="presentation"
  ></div>

  <!-- Interactive Day Overflow List -->
  <div
    class="fixed z-50 w-64 bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl shadow-2xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100"
    style={calculatePosition(overflow.anchorRect)}
  >
    <!-- Header: Day Info & Close -->
    <div class="flex items-center justify-between border-b border-[#292929] pb-2">
      <div class="flex items-baseline gap-1.5">
        <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
          {format(overflow.date, 'EEE')}
        </span>
        <span class="text-sm font-bold text-zinc-100">
          {format(overflow.date, 'd')}
        </span>
      </div>
      <button
        onclick={() => calendarState.closeOverflow()}
        class="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#282828] rounded-md transition-colors"
      >
        <X size={14} />
      </button>
    </div>

    <!-- Complete Day Task List with Drag and Edit Triggers -->
    <div class="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-0.5">
      {#each overflow.events as event (event.id)}
        {@const color = getCalendarColor(event.calendarId)}
        <div
          draggable="true"
          ondragstart={(e) => handleEventDragStart(e, event.id)}
          onclick={(e) => handleEventClick(e, event)}
          class="flex items-center gap-2 p-1.5 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] border border-[#2d2d2d] cursor-grab active:cursor-grabbing transition-all text-xs group"
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event)}
        >
          <!-- Category Dot Indicator -->
          <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {color};"></span>

          <!-- Time & Title -->
          <div class="flex-1 truncate">
            <span class="text-[10px] text-zinc-400 font-medium mr-1">
              {format(parseISO(event.startTime), 'h:mma').toLowerCase()}
            </span>
            <span class="text-zinc-100 font-medium group-hover:underline truncate">
              {event.title}
            </span>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}