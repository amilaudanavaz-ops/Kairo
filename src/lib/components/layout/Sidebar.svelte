<script lang="ts">
  import MiniCalendar from './MiniCalendar.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { persistCalendarCategory } from '../../db/database';
  import { Plus, Eye, EyeOff, Link2, RefreshCw, Star, Lock } from 'lucide-svelte';
  import type { CalendarCategory } from '../../../types/event';

  const PRESET_COLORS = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', 
    '#ec4899', '#06b6d4', '#71717a', '#14b8a6', '#f97316', 
    '#6366f1', '#84cc16'
  ];

  let activeColorPickerCalId = $state<string | null>(null);

  function handleToggleVisibility(e: MouseEvent, calId: string) {
    e.stopPropagation();
    calendarState.toggleCalendarVisibility(calId);
  }

  async function handleRefreshSync(e: MouseEvent) {
    e.stopPropagation();
    await eventStore.syncGoogleEvents();
  }

  async function handleSetDefaultCalendar(e: MouseEvent, targetCalId: string) {
    e.stopPropagation();
    // Exclusively mark only the target calendar as primary across state and database
    calendarState.calendars = calendarState.calendars.map((c: CalendarCategory) => {
      const isPrimary = c.id === targetCalId;
      const updated = { ...c, isPrimary };
      persistCalendarCategory(updated).catch(console.error);
      return updated;
    });
  }

  async function handleColorChange(e: MouseEvent, targetCalId: string, newHex: string) {
    e.stopPropagation();
    activeColorPickerCalId = null;
    calendarState.calendars = calendarState.calendars.map((c: CalendarCategory) => {
      if (c.id === targetCalId) {
        const updated = { ...c, colorHex: newHex };
        persistCalendarCategory(updated).catch(console.error);
        return updated;
      }
      return c;
    });
  }

  let uniqueCalendars = $derived.by(() => {
    const seen = new Set<string>();
    const list: CalendarCategory[] = [];
    for (const c of calendarState.calendars) {
      const key = c.googleCalendarId || c.id;
      if (!seen.has(key)) {
        seen.add(key);
        list.push(c);
      }
    }
    return list;
  });

  let accountsWithCalendars = $derived.by(() => {
    if (settingsStore.accounts.length === 0) {
      return [{
        id: 'default',
        email: settingsStore.email || 'Personal',
        calendars: uniqueCalendars
      }];
    }

    return settingsStore.accounts.map((acc: any) => ({
      id: acc.id,
      email: acc.email,
      calendars: uniqueCalendars.filter((c: CalendarCategory) => c.accountId === acc.id)
    })).filter((group: any) => group.calendars.length > 0);
  });
</script>

<aside 
  class="w-60 bg-[#161616] border-r border-[#242424] flex flex-col justify-between shrink-0 select-none"
  onclick={() => { activeColorPickerCalId = null; }}
>
  <div class="p-3 flex flex-col gap-4 overflow-y-auto flex-1 no-scrollbar">
    <MiniCalendar />

    <div class="h-[1px] bg-[#242424] -mx-1"></div>

    <!-- Calendars Section Header -->
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between text-[11px] font-bold text-zinc-400 px-1 tracking-wide uppercase">
        <span>Calendars</span>
        <div class="flex items-center gap-1">
          <button 
            onclick={handleRefreshSync}
            class="p-1 hover:text-zinc-100 hover:bg-[#242424] rounded text-zinc-400 transition-colors cursor-pointer"
            title="Sync with Google"
            disabled={eventStore.isSyncing}
          >
            <RefreshCw size={12} class={eventStore.isSyncing ? 'animate-spin text-blue-400' : ''} />
          </button>
          <button 
            onclick={() => calendarState.openAddAccountModal()}
            class="p-1 hover:text-zinc-100 hover:bg-[#242424] rounded text-zinc-400 transition-colors cursor-pointer"
            title="Add Calendar Account"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      <!-- Account-grouped Calendar Lists -->
      {#each accountsWithCalendars as group (group.id)}
        <div class="flex flex-col gap-1">
          {#if accountsWithCalendars.length > 1 || group.email}
            <div class="px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 truncate">
              {group.email}
            </div>
          {/if}

          <div class="flex flex-col gap-0.5">
            {#each group.calendars as cal (cal.id)}
              {@const isReadOnly = cal.accessRole === 'reader' || cal.accessRole === 'freeBusyReader'}
              
              <div 
                class="relative flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#202020] transition-colors group cursor-pointer
                  {cal.isVisible ? 'opacity-100' : 'opacity-40'}"
                onclick={(e) => handleToggleVisibility(e, cal.id)}
                role="button"
                tabindex="0"
                onkeydown={(e) => e.key === 'Enter' && handleToggleVisibility(e as any, cal.id)}
              >
                <div class="flex items-center gap-2 truncate flex-1 mr-1">
                  <!-- Color Dot & Picker Trigger -->
                  <button
                    onclick={(e) => {
                      e.stopPropagation();
                      activeColorPickerCalId = activeColorPickerCalId === cal.id ? null : cal.id;
                    }}
                    class="w-3 h-3 rounded-full shrink-0 hover:scale-125 transition-transform cursor-pointer border border-white/10"
                    style="background-color: {cal.colorHex};"
                    title="Change calendar color"
                  ></button>

                  <span class="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 truncate">
                    {cal.name}
                  </span>

                  {#if cal.isPrimary}
                    <span class="text-[9px] px-1 py-0.2 rounded bg-blue-500/20 text-blue-400 font-bold tracking-tight shrink-0">
                      Default
                    </span>
                  {/if}

                  {#if isReadOnly}
                    <span title="Read-only calendar" class="flex items-center">
                      <Lock size={10} class="text-zinc-500 shrink-0" />
                    </span>
                  {/if}
                </div>

                <!-- Hover Actions -->
                <div class="flex items-center gap-1">
                  {#if !cal.isPrimary && !isReadOnly}
                    <button 
                      onclick={(e) => handleSetDefaultCalendar(e, cal.id)}
                      class="text-zinc-600 hover:text-amber-400 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Set as Default Calendar"
                    >
                      <Star size={12} />
                    </button>
                  {/if}

                  <!-- Eye Toggle -->
                  <button 
                    onclick={(e) => handleToggleVisibility(e, cal.id)}
                    class="text-zinc-500 hover:text-zinc-200 p-0.5 rounded transition-colors cursor-pointer"
                    title={cal.isVisible ? "Hide calendar" : "Show calendar"}
                  >
                    {#if cal.isVisible}
                      <Eye size={13} />
                    {:else}
                      <EyeOff size={13} class="text-zinc-500" />
                    {/if}
                  </button>
                </div>

                <!-- Color Palette Popover -->
                {#if activeColorPickerCalId === cal.id}
                  <div 
                    class="absolute left-6 top-8 z-50 p-2 bg-[#222222] border border-[#333333] rounded-xl shadow-2xl grid grid-cols-4 gap-1.5 animate-in fade-in zoom-in-95 duration-100"
                    onclick={(e) => e.stopPropagation()}
                    role="dialog"
                  >
                    {#each PRESET_COLORS as color}
                      <button
                        onclick={(e) => handleColorChange(e, cal.id, color)}
                        class="w-5 h-5 rounded-full hover:scale-115 transition-transform border border-black/30 cursor-pointer {cal.colorHex === color ? 'ring-2 ring-white' : ''}"
                        style="background-color: {color};"
                        title={color}
                      ></button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Bottom Add Account Trigger -->
  <div class="p-3 border-t border-[#242424] bg-[#141414]">
    <button 
      onclick={() => calendarState.openAddAccountModal()}
      class="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-[#202020] hover:bg-[#282828] border border-[#2d2d2d] text-zinc-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
    >
      <Link2 size={14} />
      <span>Add Google Account</span>
    </button>
  </div>
</aside>