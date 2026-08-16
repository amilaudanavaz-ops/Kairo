<script lang="ts">
  import { format, parseISO, isSameDay, isToday } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { timelineDragStore } from '../../stores/timelineDragStore.svelte';
  import { getWeekDays, computeTimedEventStyle, snapPointerToTime, HOUR_HEIGHT_PX } from '../../utils/timeMath';
  import type { CalendarEvent } from '../../../types/event';

  let weekDays = $derived(getWeekDays(calendarState.currentDate));
  const hours = Array.from({ length: 24 }, (_, i) => i);

  function getCalendarColor(event: CalendarEvent): string {
    if (event.colorOverride) return event.colorOverride;
    const cal = calendarState.calendars.find((c) => c.id === event.calendarId);
    return cal?.colorHex ?? '#3b82f6';
  }

  function isCalendarVisible(calendarId: string): boolean {
    const cal = calendarState.calendars.find((c) => c.id === calendarId);
    return cal ? cal.isVisible : true;
  }

  function handleEventClick(e: MouseEvent, event: CalendarEvent) {
    if (timelineDragStore.isDragging) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, rect);
  }

  function handleColumnDoubleClick(e: MouseEvent, day: Date) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const startTime = snapPointerToTime(offsetY, day);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

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
    calendarState.openInspector(newEvent, rect);
  }
</script>

<div class="flex-1 flex flex-col h-full bg-[#121212] select-none overflow-hidden">
  <!-- Weekday Header Row -->
  <div class="flex border-b border-[#242424] bg-[#141414] pl-14 shrink-0">
    {#each weekDays as day (day.toISOString())}
      {@const activeToday = isToday(day)}
      <div class="flex-1 py-2 text-center border-r border-[#1f1f1f]">
        <div class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
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
  <div class="flex-1 flex overflow-y-auto relative custom-scrollbar">
    <!-- Time Axis -->
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

    <!-- 7 Day Columns -->
    <div class="flex-1 flex relative">
      <!-- Background Hour Grid Lines -->
      <div class="absolute inset-0 flex flex-col pointer-events-none">
        {#each hours as _}
          <div class="border-b border-[#1c1c1c]" style="height: {HOUR_HEIGHT_PX}px;"></div>
        {/each}
      </div>

      <!-- Columns -->
      {#each weekDays as day (day.toISOString())}
        {@const dateKey = format(day, 'yyyy-MM-dd')}
        {@const dayEvents = eventStore.events.filter((e) => !e.isAllDay && isSameDay(parseISO(e.startTime), day) && isCalendarVisible(e.calendarId))}

        <div
          data-timeline-col={dateKey}
          ondblclick={(e) => handleColumnDoubleClick(e, day)}
          class="flex-1 relative border-r border-[#1e1e1e]"
          style="height: {24 * HOUR_HEIGHT_PX}px;"
          role="gridcell"
          tabindex="0"
        >
          {#each dayEvents as event (event.id)}
            {@const style = computeTimedEventStyle(event)}
            {@const color = getCalendarColor(event)}
            {@const isBeingDragged = timelineDragStore.activeEvent?.id === event.id}

            <!-- Timed Event Card with Top/Bottom Resize Handles -->
            <div
              onclick={(e) => handleEventClick(e, event)}
              onpointerdown={(e) => timelineDragStore.startTimelineDrag(e, event, day, 'move')}
              class="absolute left-1 right-1 rounded-lg px-2 py-1 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2d2d2d] cursor-grab active:cursor-grabbing text-xs shadow-md transition-opacity overflow-hidden flex flex-col justify-between group select-none
                {isBeingDragged ? 'opacity-30' : 'opacity-100'}"
              style="top: {style.top}px; height: {style.height}px; border-left: 3.5px solid {color};"
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event)}
            >
              <!-- Top Resize Handle -->
              <div
                onpointerdown={(e) => timelineDragStore.startTimelineDrag(e, event, day, 'resize-top')}
                class="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-blue-500/50 transition-colors"
                role="slider"
                aria-label="Resize event start time"
                aria-valuenow={style.top}
                tabindex="0"
              ></div>

              <div class="flex flex-col truncate pointer-events-none">
                <span class="text-[10px] text-zinc-400 font-medium">
                  {format(parseISO(event.startTime), 'h:mm a')}
                </span>
                <span class="font-semibold text-zinc-100 text-[11px] truncate">
                  {event.title || '(No Title)'}
                </span>
              </div>

              <!-- Bottom Resize Handle -->
              <div
                onpointerdown={(e) => timelineDragStore.startTimelineDrag(e, event, day, 'resize-bottom')}
                class="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-blue-500/50 transition-colors"
                role="slider"
                aria-label="Resize event duration"
                aria-valuenow={style.height}
                tabindex="0"
              ></div>
            </div>
          {/each}

          <!-- Live Drag & Resize Ghost Preview -->
          {#if timelineDragStore.isDragging && timelineDragStore.previewDateKey === dateKey && timelineDragStore.activeEvent}
            <div
              class="absolute left-1 right-1 rounded-lg px-2 py-1 bg-blue-600/30 border-2 border-blue-500 pointer-events-none z-30 flex flex-col justify-between shadow-2xl"
              style="top: {timelineDragStore.previewTop}px; height: {timelineDragStore.previewHeight}px;"
            >
              <span class="text-[10px] font-semibold text-blue-200">
                {timelineDragStore.activeEvent.title || '(Moving Event)'}
              </span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>