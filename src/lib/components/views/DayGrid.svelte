<script lang="ts">
  import { format, parseISO } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { timelineDragStore } from '../../stores/timelineDragStore.svelte';
  import { getEventsForDay } from '../../utils/dateMath';
  import { computeTimedEventStyle, snapPointerToTime, HOUR_HEIGHT_PX } from '../../utils/timeMath';
  import type { CalendarEvent } from '../../../types/event';

  let currentDay = $derived(calendarState.currentDate);
  let dateKey = $derived(format(currentDay, 'yyyy-MM-dd'));
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

  let dayEvents = $derived(
    getEventsForDay(eventStore.events, currentDay).filter((e) => !e.isAllDay && isCalendarVisible(e.calendarId))
  );

  function handleEventClick(e: MouseEvent, event: CalendarEvent) {
    if (timelineDragStore.isDragging) return;
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

<div class="flex-1 flex flex-col h-full bg-[#121212] select-none overflow-hidden min-h-0">
  <div class="flex items-center gap-3 border-b border-[#242424] bg-[#141414] px-6 py-2.5 shrink-0">
    <span class="text-lg font-bold text-zinc-100">
      {format(currentDay, 'EEEE, MMMM d, yyyy')}
    </span>
  </div>

  <div class="flex-1 flex overflow-y-auto relative custom-scrollbar min-h-0">
    <!-- Time Axis with Rigid Row Heights -->
    <div class="w-16 flex flex-col shrink-0 border-r border-[#222222] bg-[#131313]">
      {#each hours as hour}
        <div
          class="h-[48px] min-h-[48px] shrink-0 text-[11px] font-medium text-zinc-500 text-right pr-3 select-none box-border flex items-start justify-end pt-1"
        >
          {hour === 0 ? '' : format(new Date().setHours(hour, 0, 0, 0), 'h a')}
        </div>
      {/each}
    </div>

    <!-- Day Canvas Column -->
    <div
      data-timeline-col={dateKey}
      ondblclick={handleCanvasDoubleClick}
      class="flex-1 relative h-[1152px]"
      role="gridcell"
      tabindex="0"
    >
      <div class="absolute inset-0 flex flex-col pointer-events-none">
        {#each hours as _}
          <div class="h-[48px] min-h-[48px] shrink-0 border-b border-[#1c1c1c] box-border"></div>
        {/each}
      </div>

      {#each dayEvents as event (event.id)}
        {@const style = computeTimedEventStyle(event)}
        {@const color = getCalendarColor(event)}
        {@const isBeingDragged = timelineDragStore.activeEvent?.id === event.id}

        <div
          onclick={(e) => handleEventClick(e, event)}
          onpointerdown={(e) => timelineDragStore.startTimelineDrag(e, event, currentDay, 'move')}
          class="absolute left-4 right-8 rounded-xl p-3 bg-[#1a1a1a] hover:bg-[#222222] border border-[#2b2b2b] cursor-grab active:cursor-grabbing text-xs shadow-lg transition-opacity flex flex-col justify-between group select-none
            {isBeingDragged ? 'opacity-30' : 'opacity-100'}"
          style="top: {style.top}px; height: {style.height}px; border-left: 4px solid {color};"
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event)}
        >
          <div
            onpointerdown={(e) => timelineDragStore.startTimelineDrag(e, event, currentDay, 'resize-top')}
            class="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-500/50 transition-colors"
            role="slider"
            aria-label="Resize event start time"
            aria-valuenow={style.top}
            tabindex="0"
          ></div>

          <div class="flex items-center justify-between pointer-events-none">
            <span class="font-bold text-zinc-100 text-sm">{event.title || '(No Title)'}</span>
            <span class="text-[11px] text-zinc-400 font-medium">
              {format(parseISO(event.startTime), 'h:mm a')} – {format(parseISO(event.endTime), 'h:mm a')}
            </span>
          </div>

          <div
            onpointerdown={(e) => timelineDragStore.startTimelineDrag(e, event, currentDay, 'resize-bottom')}
            class="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-blue-500/50 transition-colors"
            role="slider"
            aria-label="Resize event duration"
            aria-valuenow={style.height}
            tabindex="0"
          ></div>
        </div>
      {/each}

      {#if timelineDragStore.isDragging && timelineDragStore.activeEvent}
        <div
          class="absolute left-4 right-8 rounded-xl p-3 bg-blue-600/30 border-2 border-blue-500 pointer-events-none z-30 shadow-2xl flex items-center justify-between"
          style="top: {timelineDragStore.previewTop}px; height: {timelineDragStore.previewHeight}px;"
        >
          <span class="font-bold text-blue-200 text-sm truncate">{timelineDragStore.activeEvent.title || '(Moving Event)'}</span>
        </div>
      {/if}
    </div>
  </div>
</div>