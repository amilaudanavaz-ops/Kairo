<script lang="ts">
  import { format, parseISO } from 'date-fns';
  import { X } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { dragStore } from '../../stores/dragStore.svelte';
  import { getEventsForDay } from '../../utils/dateMath';
  import type { CalendarEvent } from '../../../types/event';

  let overflow = $derived(calendarState.overflowData);
  let currentEvents = $derived(
    overflow ? getEventsForDay(eventStore.events, overflow.date) : []
  );

  function getCalendarColor(calendarId: string): string {
    const cal = calendarState.calendars.find((c) => c.id === calendarId);
    return cal?.colorHex ?? '#3b82f6';
  }

  function handlePointerDown(e: PointerEvent, event: CalendarEvent) {
    calendarState.closeOverflow();
    dragStore.startDrag(e, event);
  }

  function handleEventClick(e: MouseEvent, event: CalendarEvent) {
    if (dragStore.isDragging) return;
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

{#if overflow && !dragStore.isDragging}
  <div
    class="fixed inset-0 z-40 bg-black/20"
    onclick={() => calendarState.closeOverflow()}
    role="presentation"
  ></div>

  <div
    class="fixed z-50 w-64 bg-[#1a1a1a] border border-[#2e2e2e] rounded-xl shadow-2xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100"
    style={calculatePosition(overflow.anchorRect)}
  >
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

    <div class="flex flex-col gap-1.5 max-h-64 overflow-y-auto pr-0.5">
      {#each currentEvents as event (event.id)}
        {@const color = getCalendarColor(event.calendarId)}
        <div
          onpointerdown={(e) => handlePointerDown(e, event)}
          onclick={(e) => handleEventClick(e, event)}
          class="flex items-center gap-2 p-1.5 rounded-lg bg-[#222222] hover:bg-[#2a2a2a] border border-[#2d2d2d] cursor-grab active:cursor-grabbing text-xs group"
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event)}
        >
          <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {color};"></span>

          <div class="flex-1 truncate pointer-events-none">
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