<script lang="ts">
  import { format, parseISO } from 'date-fns';
  import { X } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { resolveEventColorToken } from '../../utils/colors';
  import type { CalendarEvent } from '../../../types/event';

  let popoverElement: HTMLElement | null = $state(null);

  // Close on outside pointer click
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
    const cal = calendarState.calendars.find((c) => c.id === event.calendarId);
    return resolveEventColorToken(event.colorOverride || cal?.colorHex);
  }

  function formatDisplayTime(isoString: string): string {
    const d = parseISO(isoString);
    return settingsStore.timeFormat === '24h' ? format(d, 'HH:mm') : format(d, 'h:mmaaa').toLowerCase();
  }

  function calculatePosition(rect: DOMRect | null, isDocked: boolean): string {
    if (!rect) return '';
    const popoverWidth = 260;
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
    class="fixed z-[180] w-[260px] max-h-[340px] bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-3 flex flex-col gap-2 select-none animate-in fade-in zoom-in-95 duration-100 text-zinc-200"
    style={calculatePosition(data.anchorRect, calendarState.isInspectorDocked && Boolean(calendarState.selectedEvent))}
    onclick={(e) => e.stopPropagation()}
    role="dialog"
  >
    <!-- Header: Date (e.g. SAT 22) + Task Count + Close Button -->
    <div class="flex items-center justify-between pb-1 border-b border-[#262626]">
      <div class="flex items-center gap-1.5">
        <span class="text-[11px] font-bold text-zinc-400 uppercase tracking-wider">{format(data.date, 'EEE')}</span>
        <span class="text-sm font-bold text-zinc-100">{format(data.date, 'd')}</span>
        <span class="text-[10px] text-zinc-500 font-medium">({data.events.length} tasks)</span>
      </div>

      <button
        onclick={() => calendarState.closeOverflow()}
        class="p-1 text-zinc-500 hover:text-white rounded-lg hover:bg-[#252525] transition-colors cursor-pointer"
      >
        <X size={13} />
      </button>
    </div>

    <!-- Event List -->
    <div class="flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-1 pr-0.5">
      {#each data.events as event (event.id)}
        {@const token = getEventToken(event)}
        <button
          onclick={(e) => handleEventClick(e, event, dateKey)}
          class="flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#252525] transition-colors text-left cursor-pointer group"
        >
          <span class="w-2 h-2 rounded-full shrink-0 shadow-sm" style="background-color: {token.hex};"></span>
          
          {#if !event.isAllDay}
            <span class="text-[10px] font-semibold text-zinc-400 shrink-0">
              {formatDisplayTime(event.startTime)}
            </span>
          {/if}

          <span class="text-xs font-medium text-zinc-200 group-hover:text-white truncate flex-1">
            {event.title || '(No Title)'}
          </span>
        </button>
      {/each}
    </div>
  </div>
{/if}