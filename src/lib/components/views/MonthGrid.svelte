<script lang="ts">
  import { format, parseISO } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { generateMonthGrid, getEventsForDay } from '../../utils/dateMath';
  import type { CalendarEvent } from '../../../types/event';

  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MAX_VISIBLE_EVENTS = 3;

  let gridCells = $derived(generateMonthGrid(calendarState.currentDate));

  let draggedEventId = $state<string | null>(null);
  let dragOverDateKey = $state<string | null>(null);

  function getCalendarColor(calendarId: string): string {
    const cal = calendarState.calendars.find((c) => c.id === calendarId);
    return cal?.colorHex ?? '#3b82f6';
  }

  function handleEventDragStart(e: DragEvent, eventId: string) {
    if (!e.dataTransfer) return;
    draggedEventId = eventId;
    e.dataTransfer.setData('text/plain', eventId);
    e.dataTransfer.effectAllowed = 'move';
  }

  function handleDragOver(e: DragEvent, dateKey: string) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    dragOverDateKey = dateKey;
  }

  function handleDragLeave() {
    dragOverDateKey = null;
  }

  function handleDrop(e: DragEvent, targetDate: Date) {
    e.preventDefault();
    dragOverDateKey = null;
    const eventId = e.dataTransfer?.getData('text/plain') || draggedEventId;
    if (eventId) {
      eventStore.rescheduleEvent(eventId, targetDate);
    }
    draggedEventId = null;
  }

  function handleDayDoubleClick(date: Date) {
    const newEvent: CalendarEvent = {
      id: 'evt_' + Date.now(),
      calendarId: calendarState.calendars[0]?.id || '1',
      title: 'New Event',
      startTime: date.toISOString(),
      endTime: new Date(date.getTime() + 60 * 60 * 1000).toISOString(),
      isAllDay: false,
      timeZone: 'UTC',
      status: 'confirmed',
      busyStatus: 'busy',
      syncStatus: 'pending_insert',
      updatedAt: new Date().toISOString()
    };
    eventStore.addEvent(newEvent);
  }

  function handleEventClick(e: MouseEvent, event: CalendarEvent) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, rect);
  }

  function handleOverflowClick(e: MouseEvent, day: Date, dayEvents: CalendarEvent[]) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openOverflow(day, dayEvents, rect);
  }
</script>

<div class="flex-1 flex flex-col h-full bg-[#121212] select-none">
  <!-- Weekday Columns Header -->
  <div class="grid grid-cols-7 border-b border-[#242424] bg-[#141414]">
    {#each weekDays as day}
      <div class="py-1.5 text-center text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
        {day}
      </div>
    {/each}
  </div>

  <!-- Month Grid (7 Columns) -->
  <div class="flex-1 grid grid-cols-7 grid-rows-5 lg:grid-rows-6 gap-[1px] bg-[#222222] overflow-hidden">
    {#each gridCells as cell (cell.dateKey)}
      {@const dayEvents = getEventsForDay(eventStore.events, cell.date)}
      {@const visibleEvents = dayEvents.slice(0, MAX_VISIBLE_EVENTS)}
      {@const overflowCount = dayEvents.length - MAX_VISIBLE_EVENTS}

      <!-- Day Cell Container -->
      <div
        class="bg-[#141414] p-1.5 flex flex-col gap-1 relative overflow-hidden group transition-colors
          {cell.isCurrentMonth ? 'text-zinc-200' : 'text-zinc-600 bg-[#101010]'}
          {dragOverDateKey === cell.dateKey ? 'ring-2 ring-blue-500/60 bg-[#1a1f2c]' : ''}"
        ondblclick={() => handleDayDoubleClick(cell.date)}
        ondragover={(e) => handleDragOver(e, cell.dateKey)}
        ondragleave={handleDragLeave}
        ondrop={(e) => handleDrop(e, cell.date)}
        role="gridcell"
        tabindex="0"
      >
        <!-- Day Number Header -->
        <div class="flex items-center justify-between pointer-events-none px-1">
          <span
            class="text-xs font-semibold rounded-full w-5 h-5 flex items-center justify-center
              {cell.isCurrentDay ? 'bg-blue-600 text-white font-bold' : ''}"
          >
            {format(cell.date, 'd')}
          </span>
        </div>

        <!-- Rendered Event Strips -->
        <div class="flex-1 flex flex-col gap-1 overflow-hidden">
          {#each visibleEvents as event (event.id)}
            {@const color = getCalendarColor(event.calendarId)}
            <div
              draggable="true"
              ondragstart={(e) => handleEventDragStart(e, event.id)}
              onclick={(e) => handleEventClick(e, event)}
              class="px-2 py-0.5 rounded text-[11px] font-medium truncate cursor-pointer transition-transform active:scale-95 flex items-center gap-1.5 border border-[#2b2b2b]/40 bg-[#1c1c1c] hover:bg-[#252525] text-zinc-100"
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event)}
            >
              <!-- Color Indicator -->
              <span class="w-1.5 h-1.5 rounded-full shrink-0" style="background-color: {color};"></span>

              {#if !event.isAllDay}
                <span class="text-zinc-400 text-[10px] shrink-0">
                  {format(parseISO(event.startTime), 'ha').toLowerCase()}
                </span>
              {/if}

              <span class="truncate">{event.title}</span>
            </div>
          {/each}

          <!-- Interactive "+X more" Pill -->
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