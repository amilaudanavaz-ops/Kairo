<script lang="ts">
  import { 
    format, 
    parseISO, 
    setHours, 
    setMinutes, 
    getISOWeek, 
    addWeeks, 
    subWeeks, 
    startOfWeek, 
    startOfMonth, 
    addDays,
    isSameMonth
  } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { dragStore } from '../../stores/dragStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import { generateMonthGrid } from '../../utils/dateMath';
  import type { CalendarEvent, CalendarCategory } from '../../../types/event';
  import { formatInTimeZone } from 'date-fns-tz';

  let activeWeekDays = $derived.by(() => {
    let days = settingsStore.startWeekOn === 'Monday'
      ? ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
      : ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    if (!settingsStore.showWeekends) {
      days = days.filter((d: string) => d !== 'SUN' && d !== 'SAT');
    }
    return days;
  });

  const MAX_VISIBLE_EVENTS = 3;
  const TOTAL_BUFFER_ROWS = 7;

  let weekStartsOnNumber = $derived<0 | 1>(settingsStore.startWeekOn === 'Monday' ? 1 : 0);

  let rollingAnchor = $state<Date>(
    startOfWeek(startOfMonth(calendarState.currentDate), { 
      weekStartsOn: settingsStore.startWeekOn === 'Monday' ? 1 : 0 
    })
  );

  let isWheelScrolling = false;

  $effect(() => {
    const activeDate = calendarState.currentDate;
    if (isWheelScrolling) return;

    const defaultMonthStartWeek = startOfWeek(startOfMonth(activeDate), { 
      weekStartsOn: weekStartsOnNumber 
    });

    const currentDominantMonth = addDays(rollingAnchor, 17);
    if (!isSameMonth(activeDate, currentDominantMonth)) {
      rollingAnchor = defaultMonthStartWeek;
    }
  });

  let rawGridCells = $derived.by(() => {
    return generateMonthGrid(rollingAnchor, weekStartsOnNumber, TOTAL_BUFFER_ROWS);
  });
  
  let gridCells = $derived.by(() => {
    if (settingsStore.showWeekends) return rawGridCells;
    return rawGridCells.filter((c: any) => {
      const day = c.date.getDay();
      return day !== 0 && day !== 6;
    });
  });

  let colsCount = $derived(settingsStore.showWeekends ? 7 : 5);
  let translateYPercent = $state(0);
  let isRolling = $state(false);

  // --- PERSISTENT MEMORY CACHE ---
  const cellEventsCache = new Map<string, CalendarEvent[]>();
  let lastEventsRef: any = null;
  let lastCalsRef: any = null;

  let cellEventsMap = $derived.by(() => {
    // SECURITY INVALIDATOR: We only clear the cache if an event was actually created, 
    // dragged/edited, deleted, or if a calendar was hidden via the eye icon!
    if (eventStore.events !== lastEventsRef || calendarState.calendars !== lastCalsRef) {
      cellEventsCache.clear();
      lastEventsRef = eventStore.events;
      lastCalsRef = calendarState.calendars;
    }

    const map = new Map<string, CalendarEvent[]>();
    
    for (const cell of gridCells) {
      if (cellEventsCache.has(cell.dateKey)) {
        // INSTANT LOAD: This day was calculated in a previous frame (0ms)
        map.set(cell.dateKey, cellEventsCache.get(cell.dateKey)!);
      } else {
        // ONLY calculate brand new days scrolling into view from the top/bottom
        const dayEvents = eventStore.getEventsForDateKey(cell.dateKey).sort((a, b) => {
          if (a.isAllDay && !b.isAllDay) return -1;
          if (!a.isAllDay && b.isAllDay) return 1;
          return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
        });
        
        cellEventsCache.set(cell.dateKey, dayEvents);
        map.set(cell.dateKey, dayEvents);
      }
    }
    return map;
  });

  function getEventToken(event: CalendarEvent) {
    const cal = calendarState.calendars.find((c: CalendarCategory) => c.id === event.calendarId || c.googleCalendarId === event.calendarId);
    return resolveEventColorToken(event.colorOverride || cal?.colorHex);
  }

  function formatDisplayTime(isoString: string): string {
    try {
      const tz = settingsStore.timeZone;
      if (settingsStore.timeFormat === '24h') {
        return formatInTimeZone(isoString, tz, 'HH:mm');
      } else {
        // Extract the exact minutes
        const mins = formatInTimeZone(isoString, tz, 'mm');
        // Smart Format: Drop the :00 if it's exactly on the hour to save space!
        if (mins === '00') {
          return formatInTimeZone(isoString, tz, 'haaa').toLowerCase(); // e.g. "6am"
        } else {
          return formatInTimeZone(isoString, tz, 'h:mmaaa').toLowerCase(); // e.g. "6:15am"
        }
      }
    } catch {
      return '';
    }
  }

  function handleDayDoubleClick(e: MouseEvent, date: Date) {
    e.stopPropagation();
    const currentNow = new Date();
    const startTime = setMinutes(setHours(date, currentNow.getHours()), 0);
    const endTime = setMinutes(setHours(date, currentNow.getHours() + 1), 0);

    const primaryCal = calendarState.calendars.find((c: CalendarCategory) => c.isPrimary) || calendarState.calendars[0];

    const draftEvent: CalendarEvent = {
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
      creatorEmail: settingsStore.primaryAccount?.email || '',
      syncStatus: 'pending_insert',
      updatedAt: new Date().toISOString()
    };

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(draftEvent, rect, true, format(date, 'yyyy-MM-dd'));
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

  let wheelAccumulator = 0;
  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    if (isRolling) return;

    wheelAccumulator += e.deltaY;

    if (Math.abs(wheelAccumulator) >= 24) {
      isRolling = true;
      isWheelScrolling = true;
      const direction = wheelAccumulator > 0 ? 1 : -1;
      wheelAccumulator = 0;

      translateYPercent = direction === 1 ? -14.2857 : 14.2857;

      setTimeout(() => {
        if (direction === 1) {
          rollingAnchor = addWeeks(rollingAnchor, 1);
        } else {
          rollingAnchor = subWeeks(rollingAnchor, 1);
        }

        const dominantCenterDate = addDays(rollingAnchor, 17);
        calendarState.setDate(dominantCenterDate);

        translateYPercent = 0;
        isRolling = false;
        setTimeout(() => {
          isWheelScrolling = false;
        }, 150);
      }, 120);
    }
  }
</script>

<div 
  onwheel={handleWheel}
  class="flex-1 flex flex-col h-full bg-[var(--bg-canvas)] select-none overflow-hidden text-[var(--text-primary)]"
>
  <!-- Weekday Header -->
  <div 
    class="grid border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 z-20"
    style="grid-template-columns: repeat({colsCount}, minmax(0, 1fr));"
  >
    {#each activeWeekDays as day}
      <div class="py-2 text-center text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
        {day}
      </div>
    {/each}
  </div>

  <!-- Animated Rolling Month Viewport -->
  <div class="flex-1 relative overflow-hidden bg-[var(--border-subtle)]">
    <div 
      class="absolute left-0 right-0 grid gap-[1px] bg-[var(--border-subtle)] no-scrollbar"
      style="
        top: -20%;
        height: 140%;
        grid-template-columns: repeat({colsCount}, minmax(0, 1fr)); 
        grid-template-rows: repeat({TOTAL_BUFFER_ROWS}, minmax(0, 1fr));
        transform: translate3d(0, {translateYPercent}%, 0);
        transition: {isRolling ? 'transform 120ms cubic-bezier(0.2, 0, 1)' : 'none'};
        will-change: transform;
      "
    >
      {#each gridCells as cell, i (cell.dateKey)}
        {@const allDayEvents = cellEventsMap.get(cell.dateKey) || []}
        {@const visibleEvents = allDayEvents.slice(0, MAX_VISIBLE_EVENTS)}
        {@const overflowCount = allDayEvents.length - MAX_VISIBLE_EVENTS}
        {@const isHighlighted = dragStore.dropTargetDateKey === cell.dateKey}
        {@const showWeekNum = settingsStore.showWeekNumbers && i % colsCount === 0}
        {@const isFirstDayOfMonth = cell.date.getDate() === 1}

        <div
          data-day-cell={cell.dateKey}
          ondblclick={(e) => handleDayDoubleClick(e, cell.date)}
          oncontextmenu={(e) => handleCellContextMenu(e, cell.date)}
          class="bg-[var(--bg-card)] p-1.5 flex flex-col gap-0.5 relative overflow-hidden transition-colors h-full text-[var(--text-primary)]
            {isHighlighted && dragStore.isDragging ? '!bg-blue-950/40 ring-1 ring-blue-500 z-10' : ''}"
          role="gridcell"
          tabindex="0"
        >
          <!-- Date Label -->
          <div class="flex items-center justify-between pointer-events-none px-1 pt-0.5 pb-1">
            {#if cell.isCurrentDay}
              <span class="text-[11px] font-bold rounded-full flex items-center justify-center bg-[#ea4335] text-white px-1.5 min-w-5 h-5 shadow-sm">
                {format(cell.date, 'd')}
              </span>
            {:else if isFirstDayOfMonth}
              <span class="text-[10px] font-bold rounded-md flex items-center justify-center bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 tracking-wide uppercase">
                {format(cell.date, 'MMM d')}
              </span>
            {:else}
              <span class="text-[11px] font-semibold text-[var(--text-primary)] flex items-center justify-center">
                {format(cell.date, 'd')}
              </span>
            {/if}

            {#if showWeekNum}
              <span class="text-[9px] font-mono text-[var(--text-muted)]">W{getISOWeek(cell.date)}</span>
            {/if}
          </div>

          <!-- Event Chips Matrix -->
          <div class="flex-1 flex flex-col gap-1 overflow-hidden">
            {#each visibleEvents as event (event.id + '_' + cell.dateKey)}
              {@const token = getEventToken(event)}
              {@const isSelected = calendarState.selectedEventId === event.id && calendarState.selectedDateKey === cell.dateKey}
              {@const isBeingDragged = dragStore.draggedEvent?.id === event.id && dragStore.isDragging}

              <!-- 1. All-Day Event Banner -->
              {#if event.isAllDay}
                <div
                  data-calendar-event="true"
                  onpointerdown={(e) => dragStore.initDrag(event, cell.dateKey, e)}
                  onclick={(e) => handleEventClick(e, event, cell.dateKey)}
                  oncontextmenu={(e) => handleEventContextMenu(e, event)}
                  title="All Day - {event.title || '(No Title)'}"
                  class="px-2 py-0.5 rounded text-[11px] font-semibold truncate cursor-grab active:cursor-grabbing transition-all
                    {cell.isPast && !isSelected ? 'opacity-55 hover:opacity-100' : 'opacity-100'}
                    {isSelected ? 'ring-2 ring-white shadow-xl !opacity-100' : ''}
                    {isBeingDragged ? '!opacity-30' : ''}"
                  style="background-color: {token.hex}; color: #ffffff;"
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event, cell.dateKey)}
                >
                  <span class="truncate pointer-events-none">{event.title || '(No Title)'}</span>
                </div>
              
              <!-- 2. Timed Event Item -->
              {:else}
                <div
                  data-calendar-event="true"
                  onpointerdown={(e) => dragStore.initDrag(event, cell.dateKey, e)}
                  onclick={(e) => handleEventClick(e, event, cell.dateKey)}
                  oncontextmenu={(e) => handleEventContextMenu(e, event)}
                  title="{formatDisplayTime(event.startTime)} - {event.title || '(No Title)'}"
                  class="px-1.5 py-0.5 rounded text-[11px] truncate cursor-grab active:cursor-grabbing flex items-center border transition-all group
                    {cell.isPast && !isSelected ? 'opacity-55 hover:opacity-100' : 'opacity-100'}
                    {isSelected 
                      ? 'ring-1 ring-white shadow-lg bg-[var(--bg-card-hover)] !opacity-100' 
                      : 'bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border-[var(--border-subtle)] hover:border-current' }
                    {isBeingDragged ? '!opacity-30' : ''}"
                  style="border-color: {isSelected ? token.hex : 'var(--border-subtle)'};"
                  role="button"
                  tabindex="0"
                  onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event, cell.dateKey)}
                >
                  <span 
                    class="w-[3.5px] h-3.5 rounded-full mr-1.5 shrink-0 transition-transform group-hover:scale-110" 
                    style="background-color: {token.hex};"
                  ></span>

                  <!-- Time Text -->
                  <span 
                    class="text-[10px] font-bold mr-1.5 shrink-0 pointer-events-none transition-colors group-hover:brightness-125"
                    style="color: {token.timeText};"
                  >
                    {formatDisplayTime(event.startTime)}
                  </span>

                  <!-- Title Text -->
                  <span 
                    class="truncate pointer-events-none font-bold transition-colors group-hover:!text-white"
                    style="color: {isSelected ? '#ffffff' : token.titleText};"
                  >
                    {event.title || '(No Title)'}
                  </span>
                </div>
              {/if}
            {/each}

            <!-- Full-width "X more" Button Trigger -->
            {#if overflowCount > 0}
              <button
                onclick={(e) => handleOverflowClick(e, cell.date, allDayEvents)}
                class="w-full text-[10px] font-bold text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] px-1.5 py-0.5 rounded text-left transition-colors flex items-center gap-1 cursor-pointer mt-0.5"
              >
                <span>{overflowCount} more</span>
              </button>
            {/if}
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>