<script lang="ts">
  import { 
    format, 
    parseISO, 
    differenceInMinutes, 
    setHours, 
    setMinutes, 
    isSameDay, 
    isBefore, 
    startOfDay, 
    isToday, 
    isValid 
  } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { dragStore } from '../../stores/dragStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import type { CalendarEvent, CalendarCategory } from '../../../types/event';

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const HOUR_HEIGHT = 56;
  const todayStart = startOfDay(new Date());

  let currentDay = $derived(calendarState.currentDate);
  let dayKey = $derived(format(currentDay, 'yyyy-MM-dd'));
  let isPastDay = $derived(isBefore(startOfDay(currentDay), todayStart));
  let isTodayActive = $derived(isToday(currentDay));

  let now = $state(new Date());
  $effect(() => {
    const timer = setInterval(() => {
      now = new Date();
    }, 60000);
    return () => clearInterval(timer);
  });

  let currentMinutesTop = $derived.by(() => {
    return ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT;
  });

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

  function formatTimeHeader(h: number): string {
    if (settingsStore.timeFormat === '24h') {
      return `${String(h).padStart(2, '0')}:00`;
    }
    if (h === 0) return '12 AM';
    if (h === 12) return '12 PM';
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
  }

  function calculateEventLayout(event: CalendarEvent) {
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);
    const topMinutes = start.getHours() * 60 + start.getMinutes();
    const duration = Math.max(15, differenceInMinutes(end, start));

    const top = (topMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max(26, (duration / 60) * HOUR_HEIGHT);

    return { top, height };
  }

  function handleDoubleClick(e: MouseEvent, hour: number) {
    e.stopPropagation();
    const startTime = setMinutes(setHours(currentDay, hour), 0);
    const endTime = setMinutes(setHours(currentDay, hour + 1), 0);

    const primaryCal = calendarState.calendars.find((c: CalendarCategory) => c.isPrimary && c.accessRole !== 'reader') 
      || calendarState.calendars.find((c: CalendarCategory) => c.accessRole !== 'reader')
      || calendarState.calendars[0];

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
    calendarState.openInspector(draftEvent, rect, true, dayKey);
  }

  let allDayEvents = $derived.by(() => {
    return eventStore.events.filter((e: CalendarEvent) => e.isAllDay && isSameDay(parseISO(e.startTime), currentDay) && isCalendarVisible(e.calendarId));
  });

  let timedEvents = $derived.by(() => {
    return eventStore.events.filter((e: CalendarEvent) => !e.isAllDay && isSameDay(parseISO(e.startTime), currentDay) && isCalendarVisible(e.calendarId));
  });
</script>

<div class="flex-1 flex flex-col h-full bg-[var(--bg-canvas)] select-none overflow-hidden text-[var(--text-primary)]">
  <!-- Day Header -->
  <div class="h-12 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center px-4 justify-between shrink-0 z-20">
    <div class="flex items-center gap-3">
      <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
        {format(currentDay, 'EEEE')}
      </span>
      <span class="text-sm font-bold text-white bg-blue-600 w-7 h-7 rounded-full flex items-center justify-center shadow">
        {format(currentDay, 'd')}
      </span>
    </div>

    <!-- All-Day Events Strip -->
    {#if allDayEvents.length > 0}
      <div class="flex items-center gap-1.5 max-w-xl overflow-x-auto custom-scrollbar">
        {#each allDayEvents as event (event.id)}
          {@const token = getEventToken(event)}
          <span 
            class="px-2.5 py-0.5 rounded text-xs font-semibold shadow-sm text-white shrink-0 {isPastDay ? 'opacity-60' : 'opacity-100'}"
            style="background-color: {token.hex};"
          >
            {event.title || '(No Title)'}
          </span>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Timeline Body -->
  <div class="flex-1 overflow-y-auto custom-scrollbar flex relative bg-[var(--bg-canvas)]">
    <!-- Hour Labels Column -->
    <div class="w-16 shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
      {#each hours as h}
        <div 
          class="relative w-full shrink-0"
          style="height: {HOUR_HEIGHT}px;"
        >
          {#if h > 0}
            <span class="absolute -top-[7px] right-2.5 text-[10px] font-mono text-[var(--text-muted)] select-none leading-none">
              {formatTimeHeader(h)}
            </span>
          {/if}
        </div>
      {/each}
    </div>

    <!-- Day Canvas -->
    <div 
      class="flex-1 relative h-[1344px] {dragStore.isDragging ? 'bg-white/[0.01]' : ''}"
      ondragover={(e) => {
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
        dragStore.updatePosition(e.clientX, e.clientY);
      }}
      ondrop={(e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        const y = Math.max(0, e.clientY - rect.top);
        const totalMinutes = (y / HOUR_HEIGHT) * 60;
        const snappedMinutes = Math.floor(totalMinutes / 15) * 15;
        const hour = Math.min(23, Math.max(0, Math.floor(snappedMinutes / 60)));
        const minute = Math.min(45, Math.max(0, snappedMinutes % 60));
        dragStore.handleDropOnTime(dayKey, hour, minute);
      }}
      ondblclick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const hour = Math.floor(y / HOUR_HEIGHT);
        handleDoubleClick(e, hour);
      }}
      oncontextmenu={(e) => contextMenuStore.openForCell(e, currentDay)}
      role="region"
      aria-label="Day canvas"
    >
      <!-- Hour Dividers -->
      {#each hours as h}
        <div 
          class="border-b border-[var(--border-subtle)] opacity-50 w-full pointer-events-none"
          style="height: {HOUR_HEIGHT}px;"
        ></div>
      {/each}

      <!-- Live Time Indicator Line -->
      {#if isTodayActive}
        <div 
          class="absolute left-0 right-0 z-30 pointer-events-none flex items-center"
          style="top: {currentMinutesTop}px;"
        >
          <span class="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1.5 shadow-sm"></span>
          <div class="h-[2px] bg-red-500 flex-1 shadow"></div>
        </div>
      {/if}

      <!-- Timed Events -->
      {#each timedEvents as event (event.id + '_' + dayKey)}
        {@const token = getEventToken(event)}
        {@const layout = calculateEventLayout(event)}
        {@const isSelected = calendarState.selectedEventId === event.id && calendarState.selectedDateKey === dayKey}
        {@const isReadOnly = isEventReadOnly(event)}

        <div
          data-calendar-event="true"
          draggable={!isReadOnly}
          ondragstart={(e) => dragStore.startDrag(event, dayKey, e)}
          ondrag={(e) => dragStore.updatePosition(e.clientX, e.clientY)}
          ondragend={() => dragStore.endDrag()}
          onclick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            calendarState.openInspector(event, rect, false, dayKey);
          }}
          oncontextmenu={(e) => contextMenuStore.openForEvent(e, event)}
          class="absolute left-3 right-3 rounded-lg p-2.5 overflow-hidden transition-all border group
            {isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
            {isPastDay && !isSelected ? 'opacity-55 hover:opacity-100' : 'opacity-95 hover:opacity-100'}
            {isSelected 
              ? 'ring-1 ring-white shadow-2xl z-20 bg-[#252525] !opacity-100' 
              : 'bg-[#181818] hover:bg-[#222222] hover:shadow-xl z-10'}"
          style="
            top: {layout.top}px; 
            height: {layout.height}px; 
            border-color: {isSelected ? token.hex : 'rgba(255,255,255,0.08)'};
          "
          onmouseenter={(e) => {
            if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = token.hex;
          }}
          onmouseleave={(e) => {
            if (!isSelected) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
          }}
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && calendarState.openInspector(event, (e.currentTarget as HTMLElement).getBoundingClientRect(), false, dayKey)}
        >
          <div class="flex items-center gap-2 truncate">
            <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm transition-transform group-hover:scale-125" style="background-color: {token.hex};"></span>
            <span 
              class="text-xs font-bold truncate font-sans transition-colors group-hover:!text-white"
              style="color: {isSelected ? '#ffffff' : token.titleText};"
            >
              {event.title || '(No Title)'}
            </span>
          </div>
          {#if event.description}
            <p class="text-[11px] text-[var(--text-muted)] mt-1 truncate group-hover:text-zinc-300">{event.description}</p>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>