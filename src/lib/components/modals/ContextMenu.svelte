<script lang="ts">
  import { 
    Scissors, 
    Copy, 
    Files, 
    Trash2, 
    Plus, 
    Clipboard, 
    Check, 
    Eye, 
    ExternalLink, 
    ChevronRight,
    Square
  } from 'lucide-svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { NOTION_COLORS } from '../../utils/colors';

  let isColorHovered = $state(false);
  let closeTimeout: number | undefined;

  function handleTriggerEnter() {
    clearTimeout(closeTimeout);
    isColorHovered = true;
  }

  function handleTriggerLeave() {
    closeTimeout = window.setTimeout(() => {
      isColorHovered = false;
    }, 120);
  }

  // Close context menu on outside click
  $effect(() => {
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (contextMenuStore.isOpen && !target?.closest('[data-context-menu]')) {
        contextMenuStore.close();
        isColorHovered = false;
      }
    }
    window.addEventListener('pointerdown', handlePointerDown);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
    };
  });

  const calendarPalette = [
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Tangerine', hex: '#f4511e' },
    { name: 'Red', hex: '#d50000' },
    { name: 'Banana', hex: '#f6bf26' },
    { name: 'Basil', hex: '#0b8043' },
    { name: 'Peacock', hex: '#039be5' },
    { name: 'Graphite', hex: '#616161' },
    { name: 'Grape', hex: '#8e24aa' },
    { name: 'Flamingo', hex: '#e67c73' },
    { name: 'Sage', hex: '#33b679' }
  ];

  function openGoogleCalendarWebSettings() {
    const cal = contextMenuStore.targetCalendar;
    if (!cal) return;
    const encodedId = encodeURIComponent(cal.googleCalendarId || cal.name);
    window.open(`https://calendar.google.com/calendar/u/0/r/settings/calendar/${encodedId}`, '_blank');
    contextMenuStore.close();
  }
</script>

{#if contextMenuStore.isOpen}
  <div
    data-context-menu="true"
    class="fixed z-[250] bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-1 text-xs text-zinc-200 select-none animate-in fade-in zoom-in-95 duration-75"
    style="left: {contextMenuStore.x}px; top: {contextMenuStore.y}px;"
    onpointerdown={(e) => e.stopPropagation()}
    onclick={(e) => e.stopPropagation()}
    role="menu"
    tabindex="0"
  >
    <!-- ================= 1. CALENDAR CONTEXT MENU ================= -->
    {#if contextMenuStore.mode === 'calendar' && contextMenuStore.targetCalendar}
      {@const cal = contextMenuStore.targetCalendar}
      <div class="w-60 flex flex-col gap-0.5 relative">
        
        <!-- Color Flyout Trigger with Hover Bridge -->
        <div 
          class="relative"
          onmouseenter={handleTriggerEnter}
          onmouseleave={handleTriggerLeave}
        >
          <button
            type="button"
            class="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#282828] text-left transition-colors cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <span class="w-3 h-3 rounded-full shrink-0 shadow-sm" style="background-color: {cal.colorHex};"></span>
              <span>Color</span>
            </div>
            <ChevronRight size={13} class="text-zinc-500" />
          </button>

          <!-- Color Palette Submenu with Zero-Gap Bridge -->
          {#if isColorHovered}
            <div 
              class="absolute left-[calc(100%-2px)] top-0 pl-1 z-[260]"
              onmouseenter={handleTriggerEnter}
              onmouseleave={handleTriggerLeave}
            >
              <div class="w-36 bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl shadow-2xl p-1 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-75">
                {#each calendarPalette as color}
                  <button
                    type="button"
                    onclick={() => {
                      calendarState.updateCalendarColor(cal.id, color.hex);
                      contextMenuStore.close();
                      isColorHovered = false;
                    }}
                    class="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-[#282828] text-xs transition-colors cursor-pointer group"
                  >
                    <div class="flex items-center gap-2">
                      <span class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: {color.hex};"></span>
                      <span class="text-zinc-200 group-hover:text-white">{color.name}</span>
                    </div>
                    {#if cal.colorHex.toLowerCase() === color.hex.toLowerCase()}
                      <Check size={12} class="text-blue-400 shrink-0" />
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {/if}
        </div>

        <!-- Make Default Calendar -->
        <button
          type="button"
          onclick={() => {
            if (!cal.isPrimary) {
              calendarState.setDefaultCalendar(cal.id);
              contextMenuStore.close();
            }
          }}
          disabled={cal.isPrimary}
          class="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors text-left
            {cal.isPrimary ? 'text-zinc-600 cursor-not-allowed' : 'text-zinc-200 hover:bg-[#282828] cursor-pointer'}"
        >
          <Square size={13} class="text-zinc-400" />
          <span>Make default calendar</span>
        </button>

        <!-- Show Only This Calendar -->
        <button
          type="button"
          onclick={() => {
            calendarState.showOnlyCalendar(cal.id);
            contextMenuStore.close();
          }}
          class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-zinc-200 hover:bg-[#282828] transition-colors text-left cursor-pointer"
        >
          <Eye size={13} class="text-zinc-400" />
          <span>Show only this calendar</span>
        </button>

        <div class="h-px bg-[#282828] my-0.5"></div>

        <!-- Google Calendar Settings -->
        <button
          type="button"
          onclick={openGoogleCalendarWebSettings}
          class="flex items-center justify-between px-3 py-1.5 rounded-xl text-zinc-200 hover:bg-[#282828] transition-colors text-left cursor-pointer"
        >
          <span>Google Calendar settings</span>
          <ExternalLink size={12} class="text-zinc-500" />
        </button>

        <div class="h-px bg-[#282828] my-0.5"></div>

        <!-- Remove Calendar -->
        <button
          type="button"
          onclick={() => {
            calendarState.removeCalendar(cal.id);
            contextMenuStore.close();
          }}
          class="flex items-center gap-2 px-3 py-1.5 rounded-xl text-rose-400 hover:bg-rose-950/40 transition-colors text-left cursor-pointer"
        >
          <Trash2 size={13} />
          <span>Remove calendar from list</span>
        </button>
      </div>

    <!-- ================= 2. EVENT CONTEXT MENU ================= -->
    {:else if contextMenuStore.mode === 'event' && contextMenuStore.targetEvent}
      <div class="w-48 flex flex-col gap-0.5">
        <button
          type="button"
          onclick={() => contextMenuStore.cut()}
          class="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#282828] text-zinc-200 hover:text-white transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2"><Scissors size={13} /><span>Cut</span></div>
          <span class="text-[10px] text-zinc-500 font-mono">Ctrl X</span>
        </button>
        <button
          type="button"
          onclick={() => contextMenuStore.copy()}
          class="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#282828] text-zinc-200 hover:text-white transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2"><Copy size={13} /><span>Copy</span></div>
          <span class="text-[10px] text-zinc-500 font-mono">Ctrl C</span>
        </button>
        <button
          type="button"
          onclick={() => contextMenuStore.duplicate()}
          class="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#282828] text-zinc-200 hover:text-white transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2"><Files size={13} /><span>Duplicate</span></div>
          <span class="text-[10px] text-zinc-500 font-mono">Ctrl D</span>
        </button>

        <div class="h-px bg-[#282828] my-0.5"></div>

        <div class="text-[10px] font-semibold text-zinc-400 px-3 py-0.5">Event color</div>
        <div class="flex items-center justify-between px-3 py-1">
          {#each Object.values(NOTION_COLORS) as c}
            <button
              type="button"
              onclick={() => contextMenuStore.setColorOverride(c.id === 'charcoal' ? undefined : c.hex)}
              class="w-3.5 h-3.5 rounded-full flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
              style="background-color: {c.hex};"
              title={c.name}
            >
              {#if contextMenuStore.targetEvent.colorOverride === c.hex || (!contextMenuStore.targetEvent.colorOverride && c.id === 'charcoal')}
                <Check size={9} class="text-white" />
              {/if}
            </button>
          {/each}
        </div>

        <div class="h-px bg-[#282828] my-0.5"></div>

        <button
          type="button"
          onclick={() => contextMenuStore.delete()}
          class="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-rose-950/40 text-rose-400 transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2"><Trash2 size={13} /><span>Delete</span></div>
          <span class="text-[10px] text-rose-500 font-mono">Del</span>
        </button>
      </div>

    <!-- ================= 3. GRID CELL CONTEXT MENU ================= -->
    {:else if contextMenuStore.mode === 'cell' && contextMenuStore.targetDate}
      <div class="w-44 flex flex-col gap-0.5">
        <button
          type="button"
          onclick={() => contextMenuStore.createEventAtCell()}
          class="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#282828] text-zinc-200 hover:text-white transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2"><Plus size={13} /><span>New event</span></div>
          <span class="text-[10px] text-zinc-500 font-mono">C</span>
        </button>

        {#if calendarState.clipboardEvent}
          <button
            type="button"
            onclick={() => contextMenuStore.pasteEventAtCell()}
            class="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#282828] text-zinc-200 hover:text-white transition-colors cursor-pointer"
          >
            <div class="flex items-center gap-2"><Clipboard size={13} /><span>Paste event</span></div>
            <span class="text-[10px] text-zinc-500 font-mono">Ctrl V</span>
          </button>
        {/if}
      </div>
    {/if}
  </div>
{/if}