<script lang="ts">
  import { 
    format, 
    addDays, 
    startOfWeek, 
    isToday, 
    isSameDay, 
    parseISO, 
    differenceInMinutes, 
    setHours, 
    setMinutes 
  } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { timelineDragStore } from '../../stores/timelineDragStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import type { CalendarEvent } from '../../../types/event';

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
  const HOUR_HEIGHT = 52;

  function isCalendarVisible(calendarId: string): boolean {
    const cal = calendarState.calendars.find((c) => c.id === calendarId);
    return cal ? cal.isVisible : true;
  }

  function getEventToken(event: CalendarEvent) {
    const cal = calendarState.calendars.find((c) => c.id === event.calendarId);
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

  function handleCellDoubleClick(e: MouseEvent, day: Date, hour: number) {
    e.stopPropagation();
    const startTime = setMinutes(setHours(day, hour), 0);
    const endTime = setMinutes(setHours(day, hour + 1), 0);

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
    calendarState.openInspector(newEvent, rect, true, format(day, 'yyyy-MM-dd'));
  }

  function calculateEventLayout(event: CalendarEvent) {
    const start = parseISO(event.startTime);
    const end = parseISO(event.endTime);
    const topMinutes = start.getHours() * 60 + start.getMinutes();
    const duration = Math.max(15, differenceInMinutes(end, start));

    const top = (topMinutes / 60) * HOUR_HEIGHT;
    const height = Math.max(20, (duration / 60) * HOUR_HEIGHT);

    return { top, height };
  }
</script>

<div class="flex-1 flex flex-col h-full bg-[#121212] select-none overflow-hidden text-zinc-200">
  <!-- Weekday Header Row -->
  <div 
    class="flex border-b border-[#242424] bg-[#141414] shrink-0"
    style="padding-left: 56px;"
  >
    <div class="flex-1 grid grid-cols-{weekDays.length} divide-x divide-[#242424]">
      {#each weekDays as day}
        {@const activeToday = isToday(day)}
        <div class="py-2 px-3 flex items-center justify-between">
          <span class="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">
            {format(day, 'EEE')}
          </span>
          <span 
            class="text-xs font-semibold rounded-full w-6 h-6 flex items-center justify-center
              {activeToday ? 'bg-blue-600 text-white font-bold' : 'text-zinc-200'}"
          >
            {format(day, 'd')}
          </span>
        </div>
      {/each}
    </div>
  </div>

  <!-- Scrollable Hours Timeline -->
  <div class="flex-1 overflow-y-auto custom-scrollbar flex relative">
    <!-- Hour Column Labels -->
    <div class="w-14 shrink-0 flex flex-col border-r border-[#242424] bg-[#121212]">
      {#each hours as h}
        <div 
          class="text-[10px] font-mono text-zinc-500 pr-2 text-right -mt-2.5 h-[52px]"
          style="height: {HOUR_HEIGHT}px;"
        >
          {formatTimeHeader(h)}
        </div>
      {/each}
    </div>

    <!-- Day Columns -->
    <div class="flex-1 grid grid-cols-{weekDays.length} divide-x divide-[#222222] relative">
      {#each weekDays as day}
        {@const dayKey = format(day, 'yyyy-MM-dd')}
        {@const timedEvents = eventStore.events.filter(e => !e.isAllDay && isSameDay(parseISO(e.startTime), day) && isCalendarVisible(e.calendarId))}

        <div 
          class="relative h-[1248px]"
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
          <!-- Hour Grid Dividers -->
          {#each hours as h}
            <div 
              class="border-b border-[#1c1c1c] w-full"
              style="height: {HOUR_HEIGHT}px;"
            ></div>
          {/each}

          <!-- Timed Events -->
          {#each timedEvents as event (event.id + '_' + dayKey)}
            {@const token = getEventToken(event)}
            {@const layout = calculateEventLayout(event)}
            {@const isSelected = calendarState.selectedEventId === event.id && calendarState.selectedDateKey === dayKey}

            <div
              data-calendar-event="true"
              onclick={(e) => {
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                calendarState.openInspector(event, rect, false, dayKey);
              }}
              oncontextmenu={(e) => contextMenuStore.openForEvent(e, event)}
              class="absolute left-1 right-1 rounded-md px-2 py-1 overflow-hidden cursor-pointer transition-all border
                {isSelected ? 'ring-1 ring-white shadow-xl z-20 bg-[#252525]' : 'opacity-90 hover:opacity-100 z-10'}"
              style="top: {layout.top}px; height: {layout.height}px; border-color: {token.hex}; background-color: {isSelected ? token.bannerBg : '#181818'};"
              role="button"
              tabindex="0"
              onkeydown={(e) => e.key === 'Enter' && calendarState.openInspector(event, (e.currentTarget as HTMLElement).getBoundingClientRect(), false, dayKey)}
            >
              <div class="flex items-center gap-1.5 truncate">
                <span class="w-2 h-2 rounded-full shrink-0" style="background-color: {token.hex};"></span>
                <span class="text-xs font-semibold truncate {isSelected ? 'text-white' : 'text-zinc-200'}">
                  {event.title || '(No Title)'}
                </span>
              </div>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  </div>
</div>