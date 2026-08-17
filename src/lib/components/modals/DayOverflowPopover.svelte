<script lang="ts">
  import { format, parseISO } from 'date-fns';
  import { X } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { dragStore } from '../../stores/dragStore.svelte';
  import { getEventsForDay } from '../../utils/dateMath';
  import type { CalendarEvent, CalendarCategory } from '../../../types/event';

  let overflow = $derived(calendarState.overflowData);

  function findCalendar(calendarId: string): CalendarCategory | undefined {
    return calendarState.calendars.find(
      (c: CalendarCategory) => c.id === calendarId || c.googleCalendarId === calendarId
    );
  }

  function isCalendarVisible(calendarId: string): boolean {
    const cal = findCalendar(calendarId);
    return cal ? cal.isVisible : true;
  }

  function isEventReadOnly(event: CalendarEvent): boolean {
    const cal = findCalendar(event.calendarId);
    return cal?.accessRole === 'reader' || cal?.accessRole === 'freeBusyReader';
  }

  let currentEvents = $derived(
    overflow ? getEventsForDay(eventStore.events, overflow.date).filter((e: CalendarEvent) => isCalendarVisible(e.calendarId)) : []
  );

  function getCalendarColor(calendarId: string): string {
    const cal = findCalendar(calendarId);
    return cal?.colorHex ?? '#3b82f6';
  }

  function handlePointerDown(e: PointerEvent, event: CalendarEvent) {
    if (isEventReadOnly(event)) return;
    dragStore.startDrag(e, event, () => {
      calendarState.closeOverflow();
    });
  }

  function handleTaskClick(e: MouseEvent, event: CalendarEvent) {
    if (dragStore.isDragging) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, rect);
  }

  function calculatePosition(rect: DOMRect | undefined) {
    if (!rect) return 'top: 20%; left: 50%; transform: translateX(-50%);';
    const popoverWidth = 260;
    const popoverHeight = 340;

    let left = rect.left;
    if (left + popoverWidth > window.innerWidth - 10) {
      left = Math.max(10, window.innerWidth - popoverWidth - 10);
    }

    let top = Math.max(10, rect.top - 20);
    if (top + popoverHeight > window.innerHeight - 10) {
      top = Math.max(10, window.innerHeight - popoverHeight - 10);
    }

    return `top: ${top}px; left: ${left}px;`;
  }
</script>

{#if overflow}
  <!-- Backdrop for dismissing both overflow & inspector -->
  <div
    class="fixed inset-0 z-40 bg-black/30 backdrop-blur-[1px]"
    onclick={() => {
      calendarState.closeOverflow();
      calendarState.closeInspector();
    }}
    role="presentation"
  ></div>

  <!-- Popover Container -->
  <div
    class="fixed z-40 w-64 bg-[#181818] border border-[#2c2c2c] rounded-xl shadow-2xl p-3 flex flex-col gap-2.5 animate-in fade-in zoom-in-95 duration-100"
    style={calculatePosition(overflow.anchorRect)}
  >
    <!-- Header -->
    <div class="flex items-center justify-between border-b border-[#262626] pb-2">
      <div class="flex items-baseline gap-1.5">
        <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wide">
          {format(overflow.date, 'EEE')}
        </span>
        <span class="text-sm font-bold text-zinc-100">
          {format(overflow.date, 'd')}
        </span>
        <span class="text-[11px] text-zinc-500 font-medium">({currentEvents.length} tasks)</span>
      </div>
      <button
        onclick={() => {
          calendarState.closeOverflow();
          calendarState.closeInspector();
        }}
        class="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#262626] rounded-md transition-colors cursor-pointer"
      >
        <X size={14} />
      </button>
    </div>

    <!-- Interactive Task List -->
    <div class="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-0.5 scrollbar-thin">
      {#each currentEvents as event (event.id)}
        {@const color = getCalendarColor(event.calendarId)}
        {@const isSelected = calendarState.selectedEvent?.id === event.id}
        {@const isReadOnly = isEventReadOnly(event)}

        <div
          onpointerdown={(e) => handlePointerDown(e, event)}
          onclick={(e) => handleTaskClick(e, event)}
          class="flex items-center gap-2 p-2 rounded-lg border transition-all text-xs group
            {isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
            {isSelected 
              ? 'bg-[#262626] border-blue-500/80 ring-1 ring-blue-500/40 shadow-sm' 
              : 'bg-[#1f1f1f] hover:bg-[#252525] border-[#292929]'}"
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && handleTaskClick(e as any, event)}
        >
          <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {color};"></span>

          <div class="flex-1 truncate pointer-events-none">
            <span class="text-[10px] text-zinc-400 font-medium mr-1.5">
              {format(parseISO(event.startTime), 'h:mma').toLowerCase()}
            </span>
            <span class="font-medium truncate {isSelected ? 'text-blue-200' : 'text-zinc-100 group-hover:underline'}">
              {event.title}
            </span>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}