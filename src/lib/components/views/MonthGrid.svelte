<script lang="ts">
  import { format, parseISO, setHours, setMinutes } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { dragStore } from '../../stores/dragStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { generateMonthGrid, getEventsForDay } from '../../utils/dateMath';
  import type { CalendarEvent } from '../../../types/event';

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MAX_VISIBLE_EVENTS = 3;

  let gridCells = $derived(generateMonthGrid(calendarState.currentDate));

  function getCalendarColor(event: CalendarEvent): string {
    if (event.colorOverride) return event.colorOverride;
    const cal = calendarState.calendars.find((c) => c.id === event.calendarId);
    return cal?.colorHex ?? '#3b82f6';
  }

  function handlePointerDown(e: PointerEvent, event: CalendarEvent) {
    dragStore.startDrag(e, event);
  }

  function handleDayDoubleClick(e: MouseEvent, date: Date) {
    e.stopPropagation();
    const currentNow = new Date();
    const startTime = setMinutes(setHours(date, currentNow.getHours()), 0);
    const endTime = setMinutes(setHours(date, currentNow.getHours() + 1), 0);

    const newEvent: CalendarEvent = {
      id: 'evt_' + Date.now(),
      calendarId: calendarState.calendars[0]?.id || '1',
      title: '',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      isAllDay: false,
      timeZone: 'GMT+5:30 Colombo',
      status: 'confirmed',
      busyStatus: 'busy',
      visibility: 'default',
      reminders: '30m',
      creatorEmail: 'amilavaz2003@gmail.com',
      syncStatus: 'pending_insert',
      updatedAt: new Date().toISOString()
    };

    eventStore.addEvent(newEvent);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(newEvent, rect);
  }

  function handleEventClick(e: MouseEvent, event: CalendarEvent) {
    if (dragStore.isDragging) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, rect);
  }

  function handleEventContextMenu(e: MouseEvent, event: CalendarEvent) {
    contextMenuStore.open(e, event);
  }

  function handleOverflowClick(e: MouseEvent, day: Date, dayEvents: CalendarEvent[]) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openOverflow(day, dayEvents, rect);
  }
</script>

<div class="flex-1 flex flex-col h-full bg-[#121212] select-none">
  <div class="grid grid-cols-7 border-b border-[#242424] bg-[#141414]">
    {#each weekDays as day}
      <div class="py-1.5 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
        {day}
      </div>
    {/each}
  </div>

  <div class="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6 gap-[1px] bg-[#222222] overflow-hidden">
    {#each gridCells as cell (cell.dateKey)}
      {@const dayEvents = getEventsForDay(eventStore.events, cell.date)}
      {@const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS)}
      {@const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS}
      {@const isHighlighted = dragStore.hoveredDateKey === cell.dateKey}

      <div
        data-day-cell={cell.dateKey}
        ondblclick={(e) => handleDayDoubleClick(e, cell.date)}
        class="bg-[#141414] p-1.5 flex flex-col gap-1 relative overflow-hidden transition-colors
          {cell.isCurrentMonth ? 'text-zinc-200' : 'text-zinc-600 bg-[#101010]'}
          {isHighlighted ? '!bg-[#1e293b] ring-2 ring-blue-500 z-10' : ''}"
        role="gridcell"
        tabindex="0"
      >
        <div class="flex items-center justify-between pointer-events-none px-1">
          <span
            class="text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center
              {cell.isCurrentDay ? 'bg-blue-600 text-white font-bold' : ''}"
          >
            {format(cell.date, 'd')}
          </span>
        </div>

        <div class="flex-1 flex flex-col gap-1 overflow-hidden">
          {#each visibleEvents as event (event.id)}
            {@const color = getCalendarColor(event)}
            {@const isBeingDragged = dragStore.draggedEvent?.id === event.id}

            <div
              onpointerdown={(e) => handlePointerDown(e, event)}
              onclick={(e) => handleEventClick(e, event)}
              oncontextmenu={(e) => handleEventContextMenu(e, event)}
              class="px-2 py-0.5 rounded text-[11px] font-medium truncate cursor-grab active:cursor-grabbing flex items-center gap-1.5 border border-[#2b2b2b]/40 bg-[#1c1c1c] hover:bg-[#252525] text-zinc-100 transition-opacity
                {isBeingDragged ? 'opacity-30' : 'opacity-100'}"
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event)}
            >
              <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: {color};"></span>

              {#if !event.isAllDay}
                <span class="text-zinc-400 text-[10px] shrink-0 pointer-events-none">
                  {format(parseISO(event.startTime), 'ha').toLowerCase()}
                </span>
              {/if}

              <span class="truncate pointer-events-none">
                {event.title || '(No Title)'}
              </span>
            </div>
          {/each}

          {#if overflowCount > 0}
            <button
              onclick={(e) => handleOverflowClick(e, cell.date, dayEvents)}
              class="text-[11px] font-semibold text-zinc-400 hover:text-zinc-100 hover:bg-[#222222] px-1.5 py-0.5 rounded text-left transition-colors flex items-center gap-1"
            >
              <span>{overflowCount} more</span>
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>