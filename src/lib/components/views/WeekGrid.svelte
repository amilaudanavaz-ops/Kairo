<script lang="ts">
  import { format, parseISO, isSameDay, isToday } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { dragStore } from '../../stores/dragStore.svelte';
  import { getWeekDays, computeTimedEventStyle, snapPointerToTime, HOUR_HEIGHT_PX } from '../../utils/timeMath';
  import type { CalendarEvent } from '../../../types/event';

  let weekDays = $derived(getWeekDays(calendarState.currentDate));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  function getCalendarColor(calendarId: string): string {
    const cal = calendarState.calendars.find((c) => c.id === calendarId);
    return cal?.colorHex ?? '#3b82f6';
  }

  function handlePointerDown(e: PointerEvent, event: CalendarEvent) {
    dragStore.startDrag(e, event);
  }

  function handleEventClick(e: MouseEvent, event: CalendarEvent) {
    if (dragStore.isDragging) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, rect);
  }

  function handleColumnDoubleClick(e: MouseEvent, day: Date) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const startTime = snapPointerToTime(offsetY, day);
    const endTime = new Date(startTime.getTime() + 45 * 60 * 1000);

    const newEvent: CalendarEvent = {
      id: 'evt_' + Date.now(),
      calendarId: calendarState.calendars[0]?.id || '1',
      title: 'New Event',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      isAllDay: false,
      timeZone: 'UTC',
      status: 'confirmed',
      busyStatus: 'busy',
      syncStatus: 'pending_insert',
      updatedAt: new Date().toISOString()
    };

    eventStore.addEvent(newEvent);
  }
</script>

<div class="flex-1 flex flex-col h-full bg-[#121212] select-none overflow-hidden">
  <!-- Weekday Header Row -->
  <div class="flex border-b border-[#242424] bg-[#141414] pl-14">
    {#each weekDays as day (day.toISOString())}
      {@const activeToday = isToday(day)}
      <div class="flex-1 py-2 text-center border-r border-[#1f1f1f]">
        <div class="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          {format(day, 'EEE')}
        </div>
        <div class="flex justify-center mt-0.5">
          <span
            class="text-xs font-bold w-6 h-6 flex items-center justify-center rounded-full
              {activeToday ? 'bg-blue-600 text-white' : 'text-zinc-200'}"
          >
            {format(day, 'd')}
          </span>
        </div>
      </div>
    {/each}
  </div>

  <!-- Timed Grid Canvas -->
  <div class="flex-1 flex overflow-y-auto relative scrollbar-thin">
    <!-- Time Axis Labels -->
    <div class="w-14 flex flex-col shrink-0 border-r border-[#222222] bg-[#131313]">
      {#each hours as hour}
        <div
          class="text-[10px] font-medium text-zinc-500 text-right pr-2 select-none"
          style="height: {HOUR_HEIGHT_PX}px;"
        >
          {hour === 0 ? '' : format(new Date().setHours(hour, 0, 0, 0), 'ha').toLowerCase()}
        </div>
      {/each}
    </div>

    <!-- 7-Day Columns -->
    <div class="flex-1 flex relative">
      <!-- Horizontal Background Grid Lines -->
      <div class="absolute inset-0 flex flex-col pointer-events-none">
        {#each hours as _}
          <div class="border-b border-[#1c1c1c]" style="height: {HOUR_HEIGHT_PX}px;"></div>
        {/each}
      </div>

      <!-- Day Columns -->
      {#each weekDays as day (day.toISOString())}
        {@const dateKey = format(day, 'yyyy-MM-dd')}
        {@const dayEvents = eventStore.events.filter((e) => !e.isAllDay && isSameDay(parseISO(e.startTime), day))}
        {@const isDropTarget = dragStore.hoveredDateKey === dateKey}

        <div
          data-day-cell={dateKey}
          ondblclick={(e) => handleColumnDoubleClick(e, day)}
          class="flex-1 relative border-r border-[#1e1e1e] transition-colors
            {isDropTarget ? 'bg-[#1e293b]/40 ring-1 ring-blue-500/50' : ''}"
          style="height: {24 * HOUR_HEIGHT_PX}px;"
          role="gridcell"
          tabindex="0"
        >
          <!-- Timed Event Blocks -->
          {#each dayEvents as event (event.id)}
            {@const style = computeTimedEventStyle(event)}
            {@const color = getCalendarColor(event.calendarId)}
            {@const isDragging = dragStore.draggedEvent?.id === event.id}

            <div
              onpointerdown={(e) => handlePointerDown(e, event)}
              onclick={(e) => handleEventClick(e, event)}
              class="absolute left-1 right-1 rounded-md p-1.5 border border-[#2b2b2b]/60 bg-[#1e1e1e] hover:bg-[#262626] cursor-grab active:cursor-grabbing text-xs shadow-md transition-opacity overflow-hidden flex flex-col gap-0.5
                {isDragging ? 'opacity-30' : 'opacity-100'}"
              style="top: {style.top}px; height: {style.height}px; border-left: 3px solid {color};"
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event)}
            >
              <div class="flex items-center gap-1">
                <span class="text-[10px] text-zinc-400 font-medium pointer-events-none">
                  {format(parseISO(event.startTime), 'h:mm')}
                </span>
                <span class="font-semibold text-zinc-100 truncate text-[11px] pointer-events-none">
                  {event.title}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>