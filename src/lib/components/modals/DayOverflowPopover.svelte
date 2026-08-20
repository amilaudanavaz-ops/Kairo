<script lang="ts">
  import { format, parseISO, isValid } from 'date-fns';
  import { X, Lock } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { dragStore } from '../../stores/dragStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import type { CalendarEvent, CalendarCategory } from '../../../types/event';

  let popoverElement: HTMLElement | null = $state(null);

  // Close only on genuine canvas clicks (ignores clicks inside Inspector, Modals, or Drag Preview)
  $effect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (dragStore.isDragging) return;
      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (popoverElement && popoverElement.contains(target)) return;

      if (
        target.closest('aside') || 
        target.closest('[role="dialog"]') || 
        target.closest('.dialog-overlay') || 
        target.closest('.recurrence-modal') ||
        target.closest('[data-calendar-event]')
      ) {
        return;
      }

      calendarState.closeOverflow();
    }

    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
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

  function formatDisplayTime(isoString: string): string {
    try {
      const d = parseISO(isoString);
      if (!isValid(d)) return '';
      return settingsStore.timeFormat === '24h' ? format(d, 'HH:mm') : format(d, 'haaa').toLowerCase();
    } catch {
      return '';
    }
  }

  function calculatePosition(rect: DOMRect | null, isDocked: boolean): string {
    if (!rect) return '';
    const popoverWidth = 240;
    const popoverHeight = 310;
    const rightMargin = isDocked ? 292 : 16;
    const maxAvailableX = window.innerWidth - rightMargin;

    let left = rect.left;
    if (left + popoverWidth > maxAvailableX) {
      left = Math.max(16, rect.right - popoverWidth);
    }

    let top = rect.top;
    if (top + popoverHeight > window.innerHeight - 16) {
      top = Math.max(48, window.innerHeight - popoverHeight - 16);
    }

    return `top: ${top}px; left: ${left}px;`;
  }

  function handlePointerDown(e: PointerEvent, event: CalendarEvent, dateKey: string) {
    if (isEventReadOnly(event)) return;
    dragStore.initDrag(event, dateKey, e);
  }

  function handleEventClick(e: MouseEvent, event: CalendarEvent, dateKey: string) {
    if (dragStore.isDragging) return;
    e.stopPropagation();
    const itemRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, itemRect, false, dateKey);
  }

  // Reactively track events for the currently opened day
  let dayEvents = $derived.by(() => {
    if (!calendarState.overflowData) return [];
    const dateKey = format(calendarState.overflowData.date, 'yyyy-MM-dd');
    return eventStore.getEventsForDateKey(dateKey).filter((e: CalendarEvent) => isCalendarVisible(e.calendarId));
  });
</script>

{#if calendarState.overflowData}
  {@const data = calendarState.overflowData}
  {@const dateKey = format(data.date, 'yyyy-MM-dd')}

  <div
    bind:this={popoverElement}
    class="fixed z-[180] w-[240px] max-h-[320px] bg-[#1e1e1e] border border-[#2e2e2e] rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.95)] p-3.5 flex flex-col select-none animate-in fade-in zoom-in-95 duration-100 text-white"
    style={calculatePosition(data.anchorRect, calendarState.isInspectorDocked && Boolean(calendarState.selectedEvent))}
    onclick={(e) => e.stopPropagation()}
    role="dialog"
  >
    <div class="relative flex flex-col items-center pb-2 mb-1">
      <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-widest leading-none">
        {format(data.date, 'EEE')}
      </span>
      <span class="text-2xl font-bold text-white leading-tight mt-0.5">
        {format(data.date, 'd')}
      </span>

      <button
        onclick={() => calendarState.closeOverflow()}
        class="absolute top-0 right-0 p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-[#2c2c2c] transition-colors cursor-pointer"
        title="Close"
      >
        <X size={14} />
      </button>
    </div>

    <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-0.5">
      {#each dayEvents as event (event.id + '_' + dateKey)}
        {@const token = getEventToken(event)}
        {@const isSelected = calendarState.selectedEventId === event.id && calendarState.selectedDateKey === dateKey}
        {@const isBeingDragged = dragStore.draggedEvent?.id === event.id && dragStore.isDragging}
        {@const isReadOnly = isEventReadOnly(event)}

        {#if event.isAllDay}
          <div
            data-calendar-event="true"
            onpointerdown={(e) => handlePointerDown(e, event, dateKey)}
            onclick={(e) => handleEventClick(e, event, dateKey)}
            class="w-full flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-[#2a2a2a] transition-all text-left select-none
              {isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
              {isSelected ? 'bg-[#2a2a2a] ring-1 ring-white/70 font-semibold' : ''}
              {isBeingDragged ? 'opacity-30' : 'opacity-100'}"
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event, dateKey)}
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: {token.hex};"></span>
            
            <span class="text-xs font-semibold truncate flex-1 text-white">
              {event.title || '(No Title)'}
            </span>

            {#if isReadOnly}
              <Lock size={10} class="text-zinc-500 shrink-0" />
            {/if}
          </div>
        {:else}
          <div
            data-calendar-event="true"
            onpointerdown={(e) => handlePointerDown(e, event, dateKey)}
            onclick={(e) => handleEventClick(e, event, dateKey)}
            class="w-full flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-[#2a2a2a] transition-all text-left select-none
              {isReadOnly ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'}
              {isSelected ? 'bg-[#2a2a2a] ring-1 ring-white/70 font-semibold' : ''}
              {isBeingDragged ? 'opacity-30' : 'opacity-100'}"
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && handleEventClick(e as any, event, dateKey)}
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: {token.hex};"></span>
            
            <span class="text-xs font-semibold shrink-0" style="color: {token.timeText};">
              {formatDisplayTime(event.startTime)}
            </span>

            <span class="text-xs font-semibold truncate flex-1 text-white">
              {event.title || '(No Title)'}
            </span>

            {#if isReadOnly}
              <Lock size={10} class="text-zinc-500 shrink-0" />
            {/if}
          </div>
        {/if}
      {/each}
    </div>
  </div>
{/if}