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
    isValid 
  } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import type { CalendarEvent, CalendarCategory } from '../../../types/event';

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const HOUR_HEIGHT = 56;
  const todayStart = startOfDay(new Date());

  let currentDay = $derived(calendarState.currentDate);
  let dayKey = $derived(format(currentDay, 'yyyy-MM-dd'));
  let isPastDay = $derived(isBefore(startOfDay(currentDay), todayStart));

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
    calendarState.openInspector(newEvent, rect, true, dayKey);
  }

  let allDayEvents = $derived.by(() => {
    return eventStore.events.filter((e: CalendarEvent) => e.isAllDay && isSameDay(parseISO(e.startTime), currentDay) && isCalendarVisible(e.calendarId));
  });

  let timedEvents = $derived.by(() => {
    return eventStore.events.filter((e: CalendarEvent) => !e.isAllDay && isSameDay(parseISO(e.startTime), currentDay) && isCalendarVisible(e.calendarId));
  });
</script>

<div class="flex-1 flex flex-col h-full bg-[var(--bg-canvas)] select-none overflow-hidden text-[var(--text-primary)]">
  <div class="h-12 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center px-4 justify-between shrink-0 z-20">
    <div class="flex items-center gap-3">
      <span class="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider">
        {format(currentDay, 'EEEE')}
      </span>
      <span class="text-sm font-bold text-white bg-blue-600 w-7 h-7 rounded-full flex items-center justify-center shadow">
        {format(currentDay, 'd')}
      </span>
    </div>

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

  <div class="flex-1 overflow-y-auto custom-scrollbar flex relative bg-[var(--bg-canvas)]">
    <div class="w-16 shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-canvas)]">
      {#each hours as h}
        <div 
          class="text-[10px] font-mono text-[var(--text-muted)] pr-2.5 text-right -mt-2.5"
          style="height: {HOUR_HEIGHT}px;"
        >
          {formatTimeHeader(h)}
        </div>
      {/each}
    </div>

    <div 
      class="flex-1 relative h-[1344px]"
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
      {#each hours as h}
        <div 
          class="border-b border-[var(--border-subtle)] opacity-60 w-full"
          style="height: {HOUR_HEIGHT}px;"
        ></div>
      {/each}

      {#each timedEvents as event (event.id + '_' + dayKey)}
        {@const token = getEventToken(event)}
        {@const layout = calculateEventLayout(event)}
        {@const isSelected = calendarState.selectedEventId === event.id && calendarState.selectedDateKey === dayKey}
        {@const isReadOnly = isEventReadOnly(event)}

        <div
          data-calendar-event="true"
          onclick={(e) => {
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            calendarState.openInspector(event, rect, false, dayKey);
          }}
          oncontextmenu={(e) => contextMenuStore.openForEvent(e, event)}
          class="absolute left-3 right-3 rounded-lg p-2.5 overflow-hidden transition-all border
            {isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
            {isPastDay && !isSelected ? 'opacity-55 hover:opacity-100' : 'opacity-95 hover:opacity-100'}
            {isSelected ? 'ring-1 ring-white shadow-2xl z-20 bg-[var(--bg-card-hover)] !opacity-100' : 'z-10'}"
          style="
            top: {layout.top}px; 
            height: {layout.height}px; 
            border-color: {token.hex}; 
            background-color: {isSelected ? token.bannerBg : 'var(--bg-card)'};
          "
          role="button"
          tabindex="0"
          onkeydown={(e) => e.key === 'Enter' && calendarState.openInspector(event, (e.currentTarget as HTMLElement).getBoundingClientRect(), false, dayKey)}
        >
          <div class="flex items-center gap-2 truncate">
            <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: {token.hex};"></span>
            <span class="text-xs font-semibold truncate {isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}">
              {event.title || '(No Title)'}
            </span>
          </div>
          {#if event.description}
            <p class="text-[11px] text-[var(--text-muted)] mt-1 truncate">{event.description}</p>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>