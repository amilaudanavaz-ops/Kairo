<script lang="ts">
  import { format, parseISO, isToday } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { timelineDragStore } from '../../stores/timelineDragStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import { getEventsForDay } from '../../utils/dateMath';
  import { getWeekDays, computeTimedEventStyle, snapPointerToTime } from '../../utils/timeMath';
  import type { CalendarEvent, CalendarCategory } from '../../../types/event';

  let weekDays = $derived(getWeekDays(calendarState.currentDate));
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

  function handleEventClick(e: MouseEvent, event: CalendarEvent, dateKey: string) {
    if (timelineDragStore.isDragging) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, rect, false, dateKey);
  }

  function handleEventContextMenu(e: MouseEvent, event: CalendarEvent) {
    contextMenuStore.openForEvent(e, event);
  }

  function handleColumnContextMenu(e: MouseEvent, day: Date) {
    contextMenuStore.openForCell(e, day);
  }

  function handleColumnDoubleClick(e: MouseEvent, day: Date) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    const startTime = snapPointerToTime(offsetY, day);
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
    calendarState.openInspector(newEvent, rect, true, format(day, 'yyyy-MM-dd'));
  }
</script>

<div class="flex-1 flex flex-col h-full bg-[#121212] select-none overflow-hidden min-h-0">
  <!-- Weekday Header -->
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
  <div class="flex-1 flex overflow-y-auto relative custom-scrollbar min-h-0">
    <div class="w-14 flex flex-col shrink-0 border-r border-[#222222] bg-[#131313]">
      {#each hours as hour}
        <div
          class="h-[48px] min-h-[48px] shrink-0 text-[10px] font-medium text-zinc-500 text-right pr-2 select-none box-border flex items-start justify-end pt-1"
        >
          {hour === 0 ? '' : format(new Date().setHours(hour, 0, 0, 0), 'ha').toLowerCase()}
        </div>
      {/each}
    </div>

    <div class="flex-1 flex relative h-[1152px]">
      <div class="absolute inset-0 flex flex-col pointer-events-none">
        {#each hours as _}
          <div class="h-[48px] min-h-[48px] shrink-0 border-b border-[#1c1c1c] box-border"></div>
        {/each}
      </div>

      {#each weekDays as day (day.toISOString())}
        {@const dateKey = format(day, 'yyyy-MM-dd')}
        {@const dayEvents = getEventsForDay(eventStore.events, day).filter((e: CalendarEvent) => !e.isAllDay && isCalendarVisible(e.calendarId))}

        <div
          data-timeline-col={dateKey}
          ondblclick={(e) => handleColumnDoubleClick(e, day)}
          oncontextmenu={(e) => handleColumnContextMenu(e, day)}
          class="flex-1 relative border-r border-[#1e1e1e] h-full"
          role="gridcell"
          tabindex="0"
        >
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
              onpointerdown={(e) => !isReadOnly && timelineDragStore.startTimelineDrag(e, event, day, 'move')}
              class="absolute left-1 right-1 rounded-lg px-2 py-1 text-xs transition-all overflow-hidden flex flex-col justify-between group select-none border
                {isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
                {isSelected 
                  ? 'ring-2 ring-white/80 shadow-[0_0_18px_rgba(59,130,246,0.6)] font-bold' 
                  : 'bg-[#181818] hover:bg-[#202020] border-[#282828]' }
                {isBeingDragged ? 'opacity-30' : 'opacity-100'}"
              style="top: {style.top}px; height: {style.height}px; {isSelected ? `background: linear-gradient(135deg, ${token.selectedBg} 0%, rgba(37,99,235,0.85) 100%); border-color: ${token.hex};` : `border-left: 3.5px solid ${token.hex};`}"
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event, dateKey)}
            >
              {#if !isReadOnly}
                <div
                  onpointerdown={(e) => timelineDragStore.startTimelineDrag(e, event, day, 'resize-top')}
                  class="absolute top-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-white/40 transition-colors"
                  role="slider"
                  aria-label="Resize event start time"
                  aria-valuenow={style.top}
                  tabindex="0"
                ></div>
              {/if}

              <div class="flex flex-col truncate pointer-events-none">
                <span class="text-[10px] font-semibold" style="color: {isSelected ? '#ffffff' : token.timeText};">
                  {format(parseISO(event.startTime), 'h:mm a')}
                </span>
                <span class="font-semibold text-[11px] truncate" style="color: {isSelected ? '#ffffff' : '#ededed'};">
                  {event.title || '(No Title)'}
                </span>
              </div>

              {#if !isReadOnly}
                <div
                  onpointerdown={(e) => timelineDragStore.startTimelineDrag(e, event, day, 'resize-bottom')}
                  class="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-white/40 transition-colors"
                  role="slider"
                  aria-label="Resize event duration"
                  aria-valuenow={style.height}
                  tabindex="0"
                ></div>
              {/if}
            </div>
          {/each}

          {#if timelineDragStore.isDragging && timelineDragStore.previewDateKey === dateKey && timelineDragStore.activeEvent}
            <div
              class="absolute left-1 right-1 rounded-lg px-2 py-1 bg-blue-600/30 border-2 border-blue-500 pointer-events-none z-30 flex flex-col justify-between shadow-2xl"
              style="top: {timelineDragStore.previewTop}px; height: {timelineDragStore.previewHeight}px;"
            >
              <span class="text-[10px] font-semibold text-blue-200 truncate">
                {timelineDragStore.activeEvent.title || '(Moving Event)'}
              </span>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>