<script lang="ts">
  import { format, parseISO, isValid } from 'date-fns';
  import { X } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import type { CalendarEvent, CalendarCategory } from '../../../types/event';

  let popoverElement: HTMLElement | null = $state(null);

  // Close on outside click
  $effect(() => {
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (calendarState.overflowData && popoverElement && !popoverElement.contains(target)) {
        calendarState.closeOverflow();
      }
    }
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  });

  function getEventToken(event: CalendarEvent) {
    const cal = calendarState.calendars.find(
      (c: CalendarCategory) => c.id === event.calendarId || c.googleCalendarId === event.calendarId
    );
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
    const popoverWidth = 230;
    const popoverHeight = 280;
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

  function handleEventClick(e: MouseEvent, event: CalendarEvent, dateKey: string) {
    e.stopPropagation();
    const itemRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    calendarState.openInspector(event, itemRect, false, dateKey);
    calendarState.closeOverflow();
  }
</script>

{#if calendarState.overflowData}
  {@const data = calendarState.overflowData}
  {@const dateKey = format(data.date, 'yyyy-MM-dd')}

  <div
    bind:this={popoverElement}
    class="fixed z-[180] w-[230px] max-h-[310px] bg-[#1e1e1e] border border-[#2e2e2e] rounded-3xl shadow-[0_24px_60px_rgba(0,0,0,0.95)] p-3.5 flex flex-col select-none animate-in fade-in zoom-in-95 duration-100 text-white"
    style={calculatePosition(data.anchorRect, calendarState.isInspectorDocked && Boolean(calendarState.selectedEvent))}
    onclick={(e) => e.stopPropagation()}
    role="dialog"
  >
    <!-- Header: Centered Day & Large Date (SAT 19) -->
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

    <!-- Event List -->
    <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-0.5">
      {#each data.events as event (event.id)}
        {@const token = getEventToken(event)}

        {#if event.isAllDay}
          <button
            onclick={(e) => handleEventClick(e, event, dateKey)}
            class="w-full flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors text-left cursor-pointer group"
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: {token.hex};"></span>
            
            <span class="text-xs font-semibold truncate flex-1 text-white">
              {event.title || '(No Title)'}
            </span>
          </button>
        {:else}
          <button
            onclick={(e) => handleEventClick(e, event, dateKey)}
            class="w-full flex items-center gap-2 py-1 px-1.5 rounded-lg hover:bg-[#2a2a2a] transition-colors text-left cursor-pointer group"
          >
            <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: {token.hex};"></span>
            
            <span class="text-xs font-semibold shrink-0" style="color: {token.timeText};">
              {formatDisplayTime(event.startTime)}
            </span>

            <span class="text-xs font-semibold truncate flex-1 text-white">
              {event.title || '(No Title)'}
            </span>
          </button>
        {/if}
      {/each}
    </div>
  </div>
{/if}