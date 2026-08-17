<script lang="ts">
  import { format, parseISO } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { timelineDragStore } from '../../stores/timelineDragStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import { getEventsForDay } from '../../utils/dateMath';
  import { computeTimedEventStyle, snapPointerToTime } from '../../utils/timeMath';
  import type { CalendarEvent, CalendarCategory } from '../../../types/event';

  let currentDay = $derived(calendarState.currentDate);
  let dateKey = $derived(format(currentDay, 'yyyy-MM-dd'));
  const hours = Array.from({ length: 24 }, (_, i) => i);

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

  function getEventToken(event: CalendarEvent) {
    const cal = findCalendar(event.calendarId);
    return resolveEventColorToken(event.colorOverride || cal?.colorHex);
  }

  let dayEvents = $derived(
    getEventsForDay(eventStore.events, currentDay).filter((e: CalendarEvent) => !e.isAllDay && isCalendarVisible(e.calendarId))
  );

  function handleEventClick(e: MouseEvent, event: CalendarEvent, dKey: string) {
    if (timelineDragStore.isDragging) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, rect, false, dKey);
  }

  function handleEventContextMenu(e: MouseEvent, event: CalendarEvent) {
    contextMenuStore.openForEvent(e, event);
  }

  function handleDayContextMenu(e: MouseEvent) {
    contextMenuStore.openForCell(e, currentDay);
  }

  function handleCanvasDoubleClick(e: MouseEvent) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const startTime = snapPointerToTime(offsetY, currentDay);
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    const targetCal = calendarState.calendars.find((c: CalendarCategory) => c.isPrimary && c.accessRole !== 'reader') 
      || calendarState.calendars.find((c: CalendarCategory) => c.accessRole !== 'reader') 
      || calendarState.calendars[0];

    const newEvent: CalendarEvent = {
      id: 'evt_' + Date.now(),
      calendarId: targetCal?.id || '1',
      title: '',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      isAllDay: false,
      timeZone: 'UTC',
      status: 'confirmed',
      busyStatus: 'busy',
      visibility: 'default',
      reminders: [settingsStore.defaultReminderOffset],
      creatorEmail: settingsStore.email || '',
      syncStatus: 'pending_insert',
      updatedAt: new Date().toISOString()
    };

    eventStore.addEvent(newEvent);
    calendarState.openInspector(newEvent, rect, true, dateKey);
  }
</script>

<div class="flex-1 flex flex-col h-full bg-[#121212] select-none overflow-hidden min-h-0">
  <div class="flex items-center gap-3 border-b border-[#242424] bg-[#141414] px-6 py-2.5 shrink-0">
    <span class="text-lg font-bold text-zinc-100">
      {format(currentDay, 'EEEE, MMMM d, yyyy')}
    </span>
  </div>

  <div class="flex-1 flex overflow-y-auto relative custom-scrollbar min-h-0">
    <div class="w-16 flex flex-col shrink-0 border-r border-[#222222] bg-[#131313]">
      {#each hours as hour}
        <div
          class="h-[48px] min-h-[48px] shrink-0 text-[11px] font-medium text-zinc-500 text-right pr-3 select-none box-border flex items-start justify-end pt-1"
        >
          {hour === 0 ? '' : format(new Date().setHours(hour, 0, 0, 0), 'h a')}
        </div>
      {/each}
    </div>

    <div
      data-timeline-col={dateKey}
      ondblclick={handleCanvasDoubleClick}
      oncontextmenu={handleDayContextMenu}
      class="flex-1 relative h-[1152px]"
      role="gridcell"
      tabindex="0"
    >
      <div class="absolute inset-0 flex flex-col pointer-events-none">
        {#each hours as _}
          <div class="h-[48px] min-h-[48px] shrink-0 border-b border-[#1c1c1c] box-border"></div>
        {/each}
      </div>

      {#each dayEvents as event (event.id + '_' + dateKey)}
        {@const style = computeTimedEventStyle(event)}
        {@const token = getEventToken(event)}
        {@const isSelected = calendarState.selectedEventId === event.id && calendarState.selectedDateKey === dateKey}
        {@const isBeingDragged = timelineDragStore.activeEvent?.id === event.id}
        {@const isReadOnly = isEventReadOnly(event)}

        <div
          data-calendar-event="true"
          onclick={(e) => handleEventClick(e, event, dateKey)}
          oncontextmenu={(e) => handleEventContextMenu(e, event)}
          onpointerdown={(e) => !isReadOnly && timelineDragStore.startTimelineDrag(e, event, currentDay, 'move')}
          class="absolute left-4 right-8 rounded-xl p-3 text-xs transition-all flex flex-col justify-between group select-none border
            {isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
            {isSelected 
              ? 'ring-2 ring-white/80 shadow-[0_0_20px_rgba(59,130,246,0.6)] font-bold' 
              : 'bg-[#181818] hover:bg-[#202020] border-[#282828]' }
            {isBeingDragged ? 'opacity-30' : 'opacity-100'}"
          style="top: {style.top}px; height: {style.height}px; {isSelected ? `background: linear-gradient(135deg, ${token.selectedBg} 0%, rgba(37,99,235,0.85) 100%); border-color: ${token.hex};` : `border-left: 4px solid ${token.hex};`}"
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event, dateKey)}
        >
          {#if !isReadOnly}
            <div
              onpointerdown={(e) => timelineDragStore.startTimelineDrag(e, event, currentDay, 'resize-top')}
              class="absolute top-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/40 transition-colors"
              role="slider"
              aria-label="Resize event start time"
              aria-valuenow={style.top}
              tabindex="0"
            ></div>
          {/if}

          <div class="flex items-center justify-between pointer-events-none">
            <span class="font-bold text-sm truncate" style="color: {isSelected ? '#ffffff' : '#ededed'};">
              {event.title || '(No Title)'}
            </span>
            <span class="text-[11px] font-semibold" style="color: {isSelected ? '#ffffff' : token.timeText};">
              {format(parseISO(event.startTime), 'h:mm a')} – {format(parseISO(event.endTime), 'h:mm a')}
            </span>
          </div>

          {#if !isReadOnly}
            <div
              onpointerdown={(e) => timelineDragStore.startTimelineDrag(e, event, currentDay, 'resize-bottom')}
              class="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/40 transition-colors"
              role="slider"
              aria-label="Resize event duration"
              aria-valuenow={style.height}
              tabindex="0"
            ></div>
          {/if}
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