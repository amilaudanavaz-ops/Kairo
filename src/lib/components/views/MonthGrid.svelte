<script lang="ts">
  import { format, parseISO, setHours, setMinutes } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { dragStore } from '../../stores/dragStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import { generateMonthGrid, getEventsForDay, moveEventDate } from '../../utils/dateMath';
  import type { CalendarEvent } from '../../../types/event';

  const weekDays = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
  const MAX_VISIBLE_EVENTS = 3;

  let gridCells = $derived(generateMonthGrid(calendarState.currentDate));
  let totalWeeks = $derived(Math.ceil(gridCells.length / 7));

  function getEventToken(event: CalendarEvent) {
    const cal = calendarState.calendars.find((c) => c.id === event.calendarId);
    return resolveEventColorToken(event.colorOverride || cal?.colorHex);
  }

  function isCalendarVisible(calendarId: string): boolean {
    const cal = calendarState.calendars.find((c) => c.id === calendarId);
    return cal ? cal.isVisible : true;
  }

  function handlePointerDown(e: PointerEvent, event: CalendarEvent) {
    dragStore.startDrag(e, event, () => {
      // If recurring, drop listener will prompt scope
    });
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
      reminders: ['15m'],
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

  let wheelLock = false;
  function handleWheel(e: WheelEvent) {
    if (wheelLock) return;
    if (Math.abs(e.deltaY) > 25) {
      wheelLock = true;
      if (e.deltaY > 0) calendarState.navigateNext();
      else calendarState.navigatePrev();
      setTimeout(() => {
        wheelLock = false;
      }, 200);
    }
  }
</script>

<div 
  onwheel={handleWheel}
  class="flex-1 flex flex-col h-full bg-[#121212] select-none overflow-hidden"
>
  <!-- Weekday Header -->
  <div class="grid grid-cols-7 border-b border-[#242424] bg-[#141414] shrink-0">
    {#each weekDays as day}
      <div class="py-2 text-center text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
        {day}
      </div>
    {/each}
  </div>

  <!-- Dynamic Month Matrix -->
  <div 
    class="flex-1 grid grid-cols-7 gap-[1px] bg-[#1e1e1e] overflow-hidden no-scrollbar"
    style="grid-template-rows: repeat({totalWeeks}, minmax(0, 1fr));"
  >
    {#each gridCells as cell (cell.dateKey)}
      {@const allDayEvents = getEventsForDay(eventStore.events, cell.date).filter(e => isCalendarVisible(e.calendarId))}
      {@const visibleEvents = allDayEvents.slice(0, MAX_VISIBLE_EVENTS)}
      {@const overflowCount = allDayEvents.length - MAX_VISIBLE_EVENTS}
      {@const isHighlighted = dragStore.hoveredDateKey === cell.dateKey}

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
        </div>

        <div class="flex-1 flex flex-col gap-1 overflow-hidden">
          {#each visibleEvents as event (event.id)}
            {@const token = getEventToken(event)}
            {@const isSelected = calendarState.selectedEventId === event.id}
            {@const isBeingDragged = dragStore.draggedEvent?.id === event.id}

            {#if event.isAllDay}
              <div
                onpointerdown={(e) => handlePointerDown(e, event)}
                onclick={(e) => handleEventClick(e, event)}
                oncontextmenu={(e) => handleEventContextMenu(e, event)}
                class="px-2 py-0.5 rounded text-[11px] font-semibold truncate cursor-grab active:cursor-grabbing transition-all
                  {isSelected ? 'ring-2 ring-white/80 shadow-[0_0_15px_rgba(59,130,246,0.5)]' : ''}
                  {isBeingDragged ? 'opacity-30' : 'opacity-100'}"
                style="background-color: {isSelected ? token.selectedBg : token.bannerBg}; border: 1px solid {token.bannerBorder}; color: {token.selectedText};"
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event)}
              >
                <span class="truncate pointer-events-none">{event.title || '(No Title)'}</span>
              </div>
            {:else}
              <!-- Notion Luminous Glass Selected & Unselected Strip -->
              <div
                onpointerdown={(e) => handlePointerDown(e, event)}
                onclick={(e) => handleEventClick(e, event)}
                oncontextmenu={(e) => handleEventContextMenu(e, event)}
                class="px-1.5 py-0.5 rounded text-[11px] truncate cursor-grab active:cursor-grabbing flex items-center border transition-all
                  {isSelected 
                    ? 'shadow-[0_0_16px_rgba(59,130,246,0.6)] ring-1 ring-white/70 font-semibold' 
                    : 'bg-[#181818]/95 hover:bg-[#222222] border-[#262626]' }
                  {isBeingDragged ? 'opacity-30' : 'opacity-100'}"
                style={isSelected ? `background: linear-gradient(135deg, ${token.selectedBg} 0%, rgba(37,99,235,0.85) 100%); border-color: ${token.hex};` : ''}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event)}
              >
                <!-- Left Vertical Curved Pill -->
                <span 
                  class="w-[3.5px] h-3.5 rounded-full mr-1.5 shrink-0" 
                  style="background-color: {isSelected ? '#ffffff' : token.hex};"
                ></span>

                <!-- Notion Light Tinted Formatted Time -->
                <span 
                  class="text-[10px] font-semibold mr-1.5 shrink-0 pointer-events-none"
                  style="color: {isSelected ? '#ffffff' : token.timeText};"
                >
                  {format(parseISO(event.startTime), 'h:mm a')}
                </span>

                <!-- Event Title -->
                <span 
                  class="truncate pointer-events-none font-medium"
                  style="color: {isSelected ? '#ffffff' : '#ededed'};"
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