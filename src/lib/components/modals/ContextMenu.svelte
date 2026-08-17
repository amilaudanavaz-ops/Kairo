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
    Menu, 
    ExternalLink, 
    ChevronRight,
    Square
  } from 'lucide-svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { NOTION_COLORS } from '../../utils/colors';

  let showColorSubmenu = $state(false);

  // Close context menu on outside click
  $effect(() => {
    function handlePointerDown(e: MouseEvent) {
      if (contextMenuStore.isOpen) {
        contextMenuStore.close();
        showColorSubmenu = false;
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
    class="fixed z-[160] bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-1 text-xs text-zinc-200 select-none animate-in fade-in zoom-in-95 duration-100"
    style="left: {contextMenuStore.x}px; top: {contextMenuStore.y}px;"
    onclick={(e) => e.stopPropagation()}
    role="menu"
    tabindex="0"
  >
    <!-- ================= 1. CALENDAR CONTEXT MENU (Matching Notion image_1eaa25.png) ================= -->
    {#if contextMenuStore.mode === 'calendar' && contextMenuStore.targetCalendar}
      {@const cal = contextMenuStore.targetCalendar}
      <div class="w-58 flex flex-col gap-0.5 relative">
        
        <!-- Color Flyout Trigger -->
        <div 
          class="relative"
          onmouseenter={() => showColorSubmenu = true}
          onmouseleave={() => showColorSubmenu = false}
        >
          <button
            class="w-full flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#282828] text-left transition-colors cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {cal.colorHex};"></span>
              <span>Color</span>
            </div>
            <div class="flex items-center gap-1 text-zinc-400">
              <ChevronRight size={13} />
            </div>
          </button>

          <!-- Color Palette Submenu -->
          {#if showColorSubmenu}
            <div 
              class="absolute left-full top-0 ml-1 w-38 bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl shadow-2xl p-1 z-50 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-75"
            >
              {#each calendarPalette as color}
                <button
                  onclick={() => {
                    calendarState.updateCalendarColor(cal.id, color.hex);
                    contextMenuStore.close();
                  }}
                  class="flex items-center justify-between px-2.5 py-1.5 rounded-xl hover:bg-[#282828] text-xs transition-colors cursor-pointer"
                >
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: color.hex;"></span>
                    <span class="text-zinc-200">{color.name}</span>
                  </div>
                  {#if cal.colorHex.toLowerCase() === color.hex.toLowerCase()}
                    <Check size={12} class="text-blue-400" />
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        <!-- Make Default Calendar (Disabled if already default) -->
        <button
          onclick={() => {
            if (!cal.isPrimary) {
              calendarState.setDefaultCalendar(cal.id);
              contextMenuStore.close();
            }
          }}
          disabled={cal.isPrimary}
          class="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-colors text-left
            {cal.isPrimary ? 'text-zinc-500 cursor-not-allowed' : 'text-zinc-200 hover:bg-[#282828] cursor-pointer'}"
        >
          <Square size={13} class="text-zinc-400" />
          <span>Make default calendar</span>
        </button>

        <!-- Show Only This Calendar -->
        <button
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

        <!-- Google Calendar Settings (Opens Web) -->
        <button
          onclick={openGoogleCalendarWebSettings}
          class="flex items-center justify-between px-3 py-1.5 rounded-xl text-zinc-200 hover:bg-[#282828] transition-colors text-left cursor-pointer"
        >
          <div class="flex items-center gap-2">
            <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
            </svg>
            <span>Google Calendar settings</span>
          </div>
          <ExternalLink size={12} class="text-zinc-500" />
        </button>

        <div class="h-px bg-[#282828] my-0.5"></div>

        <!-- Remove Calendar from list -->
        <button
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
          onclick={() => contextMenuStore.cut()}
          class="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#282828] text-zinc-200 hover:text-white transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2"><Scissors size={13} /><span>Cut</span></div>
          <span class="text-[10px] text-zinc-500 font-mono">Ctrl X</span>
        </button>
        <button
          onclick={() => contextMenuStore.copy()}
          class="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#282828] text-zinc-200 hover:text-white transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2"><Copy size={13} /><span>Copy</span></div>
          <span class="text-[10px] text-zinc-500 font-mono">Ctrl C</span>
        </button>
        <button
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
          onclick={() => contextMenuStore.createEventAtCell()}
          class="flex items-center justify-between px-3 py-1.5 rounded-xl hover:bg-[#282828] text-zinc-200 hover:text-white transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2"><Plus size={13} /><span>New event</span></div>
          <span class="text-[10px] text-zinc-500 font-mono">C</span>
        </button>

        {#if calendarState.clipboardEvent}
          <button
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