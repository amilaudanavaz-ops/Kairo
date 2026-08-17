<script lang="ts">
  import { format, parseISO, setHours, setMinutes, getISOWeek, addWeeks, subWeeks } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { dragStore } from '../../stores/dragStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import { generateMonthGrid } from '../../utils/dateMath';
  import type { CalendarEvent } from '../../../types/event';

  let activeWeekDays = $derived.by(() => {
    let days = settingsStore.startWeekOn === 'Monday'
      ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
      : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    if (!settingsStore.showWeekends) {
      days = days.filter(d => d !== 'SUN' && d !== 'SAT');
    }
    return days;
  });

  const MAX_VISIBLE_EVENTS = 3;

  let rawGridCells = $derived.by(() => {
    const weekStartsOn = settingsStore.startWeekOn === 'Monday' ? 1 : 0;
    return generateMonthGrid(calendarState.currentDate, weekStartsOn, 5);
  });
  
  let gridCells = $derived.by(() => {
    if (settingsStore.showWeekends) return rawGridCells;
    return rawGridCells.filter(c => {
      const day = c.date.getDay();
      return day !== 0 && day !== 6;
    });
  });

  let colsCount = $derived(settingsStore.showWeekends ? 7 : 5);
  let totalWeeks = $derived(Math.ceil(gridCells.length / colsCount));

  function getEventToken(event: CalendarEvent) {
    const cal = calendarState.calendars.find((c) => c.id === event.calendarId);
    return resolveEventColorToken(event.colorOverride || cal?.colorHex);
  }

  function isCalendarVisible(calendarId: string): boolean {
    const cal = calendarState.calendars.find((c) => c.id === calendarId);
    return cal ? cal.isVisible : true;
  }

  function formatDisplayTime(isoString: string): string {
    const d = parseISO(isoString);
    return settingsStore.timeFormat === '24h' ? format(d, 'HH:mm') : format(d, 'h:mmaaa').toLowerCase();
  }

  function handlePointerDown(e: PointerEvent, event: CalendarEvent) {
    dragStore.startDrag(e, event);
  }

  function handleDayDoubleClick(e: MouseEvent, date: Date) {
    e.stopPropagation();
    const currentNow = new Date();
    const startTime = setMinutes(setHours(date, currentNow.getHours()), 0);
    const endTime = setMinutes(setHours(date, currentNow.getHours() + 1), 0);

    const primaryCal = calendarState.calendars.find(c => c.isPrimary) || calendarState.calendars[0];

    const newEvent: CalendarEvent = {
      id: 'evt_' + Date.now(),
      calendarId: primaryCal?.id || '1',
      title: '',
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      isAllDay: false,
      timeZone: 'GMT+5:30 Colombo',
      status: 'confirmed',
      busyStatus: 'busy',
      visibility: 'default',
      reminders: [settingsStore.defaultReminderOffset],
      creatorEmail: settingsStore.email || '',
      syncStatus: 'pending_insert',
      updatedAt: new Date().toISOString()
    };

    eventStore.addEvent(newEvent);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(newEvent, rect, true, format(date, 'yyyy-MM-dd'));
  }

  function handleEventClick(e: MouseEvent, event: CalendarEvent, dateKey: string) {
    if (dragStore.isDragging) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, rect, false, dateKey);
  }

  function handleEventContextMenu(e: MouseEvent, event: CalendarEvent) {
    contextMenuStore.openForEvent(e, event);
  }

  function handleCellContextMenu(e: MouseEvent, date: Date) {
    contextMenuStore.openForCell(e, date);
  }

  function handleOverflowClick(e: MouseEvent, day: Date, dayEvents: CalendarEvent[]) {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openOverflow(day, dayEvents, rect);
  }

  // Smooth, Debounced 1-Row (1-Week) Rolling Stepper
  let isScrolling = false;
  function handleWheel(e: WheelEvent) {
    if (isScrolling) return;
    if (Math.abs(e.deltaY) > 18) {
      isScrolling = true;
      requestAnimationFrame(() => {
        if (e.deltaY > 0) {
          calendarState.setDate(addWeeks(calendarState.currentDate, 1));
        } else {
          calendarState.setDate(subWeeks(calendarState.currentDate, 1));
        }
        setTimeout(() => {
          isScrolling = false;
        }, 70);
      });
    }
  }
</script>

<div 
  onwheel={handleWheel}
  class="flex-1 flex flex-col h-full bg-[#121212] select-none overflow-hidden"
>
  <div 
    class="grid border-b border-[#242424] bg-[#141414] shrink-0"
    style="grid-template-columns: repeat({colsCount}, minmax(0, 1fr));"
  >
    {#each activeWeekDays as day}
      <div class="py-2 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
        {day}
      </div>
    {/each}
  </div>

  <div 
    class="flex-1 grid gap-[1px] bg-[#1e1e1e] overflow-hidden no-scrollbar"
    style="grid-template-columns: repeat({colsCount}, minmax(0, 1fr)); grid-template-rows: repeat({totalWeeks}, minmax(0, 1fr));"
  >
    {#each gridCells as cell, i (cell.dateKey)}
      {@const allDayEvents = eventStore.getEventsForDateKey(cell.dateKey).filter(e => isCalendarVisible(e.calendarId))}
      {@const visibleEvents = allDayEvents.slice(0, MAX_VISIBLE_EVENTS)}
      {@const overflowCount = allDayEvents.length - MAX_VISIBLE_EVENTS}
      {@const isHighlighted = dragStore.hoveredDateKey === cell.dateKey}
      {@const showWeekNum = settingsStore.showWeekNumbers && i % colsCount === 0}

      <div
        data-day-cell={cell.dateKey}
        ondblclick={(e) => handleDayDoubleClick(e, cell.date)}
        oncontextmenu={(e) => handleCellContextMenu(e, cell.date)}
        class="bg-[#141414] p-1.5 flex flex-col gap-0.5 relative overflow-hidden transition-colors h-full
          {cell.isCurrentMonth ? 'text-zinc-200' : 'text-zinc-600 bg-[#101010]'}
          {isHighlighted ? '!bg-[#1a2333] ring-1 ring-blue-500 z-10' : ''}"
        role="gridcell"
        tabindex="0"
      >
        <div class="flex items-center justify-between pointer-events-none px-1 pt-0.5 pb-1">
          <span
            class="text-[11px] font-semibold rounded-full w-5 h-5 flex items-center justify-center
              {cell.isCurrentDay ? 'bg-blue-600 text-white font-bold' : ''}"
          >
            {format(cell.date, 'd')}
          </span>

          {#if showWeekNum}
            <span class="text-[9px] font-mono text-zinc-600">W{getISOWeek(cell.date)}</span>
          {/if}
        </div>

        <div class="flex-1 flex flex-col gap-1 overflow-hidden">
          {#each visibleEvents as event (event.id + '_' + cell.dateKey)}
            {@const token = getEventToken(event)}
            {@const isSelected = calendarState.selectedEventId === event.id && calendarState.selectedDateKey === cell.dateKey}
            {@const isBeingDragged = dragStore.draggedEvent?.id === event.id}

            {#if event.isAllDay}
              <div
                data-calendar-event="true"
                onpointerdown={(e) => handlePointerDown(e, event)}
                onclick={(e) => handleEventClick(e, event, cell.dateKey)}
                oncontextmenu={(e) => handleEventContextMenu(e, event)}
                class="px-2 py-0.5 rounded text-[11px] font-semibold truncate cursor-grab active:cursor-grabbing transition-all
                  {isSelected ? 'ring-2 ring-white shadow-xl' : 'opacity-90 hover:opacity-100'}
                  {isBeingDragged ? 'opacity-30' : ''}"
                style="background-color: {token.hex}; color: #ffffff;"
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event, cell.dateKey)}
              >
                <span class="truncate pointer-events-none">{event.title || '(No Title)'}</span>
              </div>
            
            {:else}
              <div
                data-calendar-event="true"
                onpointerdown={(e) => handlePointerDown(e, event)}
                onclick={(e) => handleEventClick(e, event, cell.dateKey)}
                oncontextmenu={(e) => handleEventContextMenu(e, event)}
                class="px-1.5 py-0.5 rounded text-[11px] truncate cursor-grab active:cursor-grabbing flex items-center border transition-all
                  {isSelected 
                    ? 'ring-1 ring-white shadow-lg bg-[#242424]' 
                    : 'bg-[#181818]/95 hover:bg-[#222222] border-[#262626]' }
                  {isBeingDragged ? 'opacity-30' : 'opacity-100'}"
                style="border-color: {isSelected ? token.hex : '#262626'};"
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event, cell.dateKey)}
              >
                <span 
                  class="w-[3.5px] h-3.5 rounded-full mr-1.5 shrink-0" 
                  style="background-color: {token.hex};"
                ></span>

                <span 
                  class="text-[10px] font-semibold mr-1.5 shrink-0 pointer-events-none text-zinc-400"
                >
                  {formatDisplayTime(event.startTime)}
                </span>

                <span 
                  class="truncate pointer-events-none font-medium {isSelected ? 'text-white' : 'text-zinc-200'}"
                >
                  {event.title || '(No Title)'}
                </span>
              </div>
            {/if}
          {/each}

          {#if overflowCount > 0}
            <button
              onclick={(e) => handleOverflowClick(e, cell.date, allDayEvents)}
              class="text-[10px] font-bold text-zinc-500 hover:text-zinc-200 hover:bg-[#202020] px-1.5 py-0.5 rounded text-left transition-colors flex items-center gap-1 mt-auto cursor-pointer"
            >
              <span>{overflowCount} more</span>
            </button>
          {/if}
        </div>
      </div>
    {/each}
  </div>
</div>