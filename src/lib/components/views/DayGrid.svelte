<script lang="ts">
  import { format, parseISO, isSameDay } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { dragStore } from '../../stores/dragStore.svelte';
  import { computeTimedEventStyle, snapPointerToTime, HOUR_HEIGHT_PX } from '../../utils/timeMath';
  import type { CalendarEvent } from '../../../types/event';

  let currentDay = $derived(calendarState.currentDate);
  let dateKey = $derived(format(currentDay, 'yyyy-MM-dd'));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  let dayEvents = $derived(
    eventStore.events.filter((e) => !e.isAllDay && isSameDay(parseISO(e.startTime), currentDay))
  );

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

  function handleCanvasDoubleClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const startTime = snapPointerToTime(offsetY, currentDay);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

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
  <!-- Day Header -->
  <div class="flex items-center gap-3 border-b border-[#242424] bg-[#141414] px-6 py-2.5">
    <span class="text-xl font-bold text-zinc-100">
      {format(currentDay, 'EEEE, MMMM d, yyyy')}
    </span>
  </div>

  <!-- Timed Grid Canvas -->
  <div class="flex-1 flex overflow-y-auto relative scrollbar-thin">
    <!-- Time Axis -->
    <div class="w-16 flex flex-col shrink-0 border-r border-[#222222] bg-[#131313]">
      {#each hours as hour}
        <div
          class="text-[11px] font-medium text-zinc-500 text-right pr-3 select-none"
          style="height: {HOUR_HEIGHT_PX}px;"
        >
          {hour === 0 ? '' : format(new Date().setHours(hour, 0, 0, 0), 'h a')}
        </div>
      {/each}
    </div>

    <!-- Single Day Column -->
    <div
      data-day-cell={dateKey}
      ondblclick={handleCanvasDoubleClick}
      class="flex-1 relative"
      style="height: {24 * HOUR_HEIGHT_PX}px;"
      role="gridcell"
      tabindex="0"
    >
      <!-- Background Horizontal Lines -->
      <div class="absolute inset-0 flex flex-col pointer-events-none">
        {#each hours as _}
          <div class="border-b border-[#1c1c1c]" style="height: {HOUR_HEIGHT_PX}px;"></div>
        {/each}
      </div>

      <!-- Events -->
      {#each dayEvents as event (event.id)}
        {@const style = computeTimedEventStyle(event)}
        {@const color = getCalendarColor(event.calendarId)}
        {@const isDragging = dragStore.draggedEvent?.id === event.id}

        <div
          onpointerdown={(e) => handlePointerDown(e, event)}
          onclick={(e) => handleEventClick(e, event)}
          class="absolute left-3 right-6 rounded-lg p-2.5 border border-[#2b2b2b] bg-[#1a1a1a] hover:bg-[#222222] cursor-grab active:cursor-grabbing text-xs shadow-lg transition-opacity flex flex-col gap-1
            {isDragging ? 'opacity-30' : 'opacity-100'}"
          style="top: {style.top}px; height: {style.height}px; border-left: 4px solid {color};"
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event)}
        >
          <div class="flex items-center justify-between pointer-events-none">
            <span class="font-bold text-zinc-100 text-sm">{event.title}</span>
            <span class="text-[11px] text-zinc-400">
              {format(parseISO(event.startTime), 'h:mm a')} – {format(parseISO(event.endTime), 'h:mm a')}
            </span>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>