<script lang="ts">
  import { 
    format, 
    addDays, 
    startOfWeek, 
    isToday, 
    isSameDay, 
    isBefore,
    startOfDay,
    parseISO, 
    differenceInMinutes, 
    setHours, 
    setMinutes,
    isValid 
  } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import type { CalendarEvent, CalendarCategory } from '../../../types/event';

  let weekDays = $derived.by(() => {
    const start = startOfWeek(calendarState.currentDate, { 
      weekStartsOn: settingsStore.startWeekOn === 'Monday' ? 1 : 0 
    });
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i);
      if (!settingsStore.showWeekends && (d.getDay() === 0 || d.getDay() === 6)) {
        continue;
      }
      days.push(d);
    }
    return days;
  });

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const HOUR_HEIGHT = 56;
  const todayStart = startOfDay(new Date());

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

  function formatDisplayTime(isoString: string): string {
    try {
      const d = parseISO(isoString);
      if (!isValid(d)) return '';
      return settingsStore.timeFormat === '24h' ? format(d, 'HH:mm') : format(d, 'haaa').toLowerCase();
    } catch {
      return '';
    }
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

  function handleCellDoubleClick(e: MouseEvent, day: Date, hour: number) {
    e.stopPropagation();
    const startTime = setMinutes(setHours(day, hour), 0);
    const endTime = setMinutes(setHours(day, hour + 1), 0);

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
    calendarState.openInspector(newEvent, rect, true, format(day, 'yyyy-MM-dd'));
  }
</script>

<div class="flex-1 flex flex-col h-full bg-[var(--bg-canvas)] select-none overflow-hidden text-[var(--text-primary)]">
  <!-- Weekday Header Row -->
  <div 
    class="flex border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0 z-20"
    style="padding-left: 56px;"
  >
    <div class="flex-1 grid grid-cols-{weekDays.length} divide-x divide-[var(--border-subtle)]">
      {#each weekDays as day}
        {@const activeToday = isToday(day)}
        <div class="py-2 px-3 flex items-center justify-between">
          <span class="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            {format(day, 'EEE')}
          </span>
          <span 
            class="text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center
              {activeToday ? 'bg-blue-600 text-white font-bold' : 'text-[var(--text-primary)]'}"
          >
            {format(day, 'd')}
          </span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Scrollable Timeline -->
  <div class="flex-1 overflow-y-auto custom-scrollbar flex relative bg-[var(--bg-canvas)]">
    <div class="w-14 shrink-0 flex flex-col border-r border-[var(--border-subtle)] bg-[var(--bg-canvas)] select-none">
      {#each hours as h}
        <div 
          class="text-[10px] font-mono text-[var(--text-muted)] pr-2 text-right -mt-2.5"
          style="height: {HOUR_HEIGHT}px;"
        >
          {formatTimeHeader(h)}
        </div>
      {/each}
    </div>

    <!-- Day Columns Canvas -->
    <div class="flex-1 grid grid-cols-{weekDays.length} divide-x divide-[var(--border-subtle)] relative">
      {#each weekDays as day}
        {@const dayKey = format(day, 'yyyy-MM-dd')}
        {@const isPastDay = isBefore(startOfDay(day), todayStart)}
        {@const timedEvents = eventStore.events.filter((e: CalendarEvent) => !e.isAllDay && isSameDay(parseISO(e.startTime), day) && isCalendarVisible(e.calendarId))}

        <div 
          class="relative h-[1344px]"
          ondblclick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const y = e.clientY - rect.top;
            const hour = Math.floor(y / HOUR_HEIGHT);
            handleCellDoubleClick(e, day, hour);
          }}
          oncontextmenu={(e) => contextMenuStore.openForCell(e, day)}
          role="region"
          aria-label="Day column"
        >
          <!-- Grid lines -->
          {#each hours as h}
            <div 
              class="border-b border-[var(--border-subtle)] opacity-50 w-full"
              style="height: {HOUR_HEIGHT}px;"
            ></div>
          {/each}

          <!-- Timed Events with Hover Highlight -->
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
              class="absolute left-1 right-1 rounded-lg px-2 py-1 overflow-hidden transition-all border group
                {isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
                {isPastDay && !isSelected ? 'opacity-55 hover:opacity-100' : 'opacity-95 hover:opacity-100'}
                {isSelected 
                  ? 'ring-1 ring-white shadow-2xl z-20 bg-[#252525] !opacity-100' 
                  : 'bg-[#181818] hover:bg-[#202020] hover:border-current hover:shadow-lg z-10'}"
              style="
                top: {layout.top}px; 
                height: {layout.height}px; 
                border-color: {isSelected ? token.hex : 'rgba(255,255,255,0.08)'};
              "
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && calendarState.openInspector(event, (e.currentTarget as HTMLElement).getBoundingClientRect(), false, dayKey)}
            >
              <div class="flex items-center gap-1.5 truncate">
                <span class="w-2 h-2 rounded-full shrink-0 shadow-sm" style="background-color: {token.hex};"></span>
                <span 
                  class="text-[11px] font-semibold truncate font-sans group-hover:brightness-125 transition-colors"
                  style="color: {token.titleText};"
                >
                  {event.title || '(No Title)'}
                </span>
              </div>
              
              {#if layout.height > 36}
                <div 
                  class="text-[10px] font-semibold font-sans truncate mt-0.5 pl-3.5 opacity-90"
                  style="color: {token.timeText};"
                >
                  {formatDisplayTime(event.startTime)}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>