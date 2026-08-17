<script lang="ts">
  import { 
    Plus, 
    Eye, 
    EyeOff, 
    Link, 
    Settings,
    RefreshCw
  } from 'lucide-svelte';
  import MiniCalendar from './MiniCalendar.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';

  let isSchedulingExpanded = $state(true);
</script>

<aside class="w-60 bg-[#141414] border-r border-[#222222] flex flex-col justify-between shrink-0 select-none overflow-hidden text-zinc-300 font-sans">
  <div class="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-3">
    <!-- Mini Calendar -->
    <div class="px-1 pt-1">
      <MiniCalendar />
    </div>

    <div class="h-px bg-[#222222] -mx-2"></div>

    <!-- Scheduling Section -->
    <div class="flex flex-col gap-1">
      <button 
        onclick={() => isSchedulingExpanded = !isSchedulingExpanded}
        class="flex items-center justify-between px-2 py-1 text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
      >
        <div class="flex items-center gap-1.5">
          <Link size={13} class="text-zinc-500" />
          <span>Scheduling</span>
        </div>
        <Eye size={12} class="text-zinc-600 hover:text-zinc-400" />
      </button>
    </div>

    <div class="h-px bg-[#222222] -mx-2"></div>

    <!-- Connected Accounts & Calendars -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between px-2 py-0.5">
        <span class="text-[10px] font-bold tracking-wider uppercase text-zinc-500">Calendars</span>
        <div class="flex items-center gap-1">
          <button
            onclick={() => settingsStore.syncGoogleAccount()}
            class="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-[#202020] rounded transition-colors cursor-pointer"
            title="Sync with Google"
          >
            <RefreshCw size={12} class={settingsStore.isAuthenticating ? 'animate-spin text-blue-400' : ''} />
          </button>
          <button
            onclick={() => calendarState.openAddAccountModal()}
            class="p-1 text-zinc-500 hover:text-zinc-300 hover:bg-[#202020] rounded transition-colors cursor-pointer"
            title="Add Calendar Account"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {#each settingsStore.accounts as acc}
        {@const accCalendars = calendarState.calendars.filter(c => c.accountId === acc.id || c.accountId.startsWith('acc_'))}
        
        <div class="flex flex-col gap-0.5">
          <!-- Account Email Header -->
          <div class="px-2 py-1 text-[11px] font-medium text-zinc-400 truncate">
            {acc.email}
          </div>

          <!-- Calendar List -->
          <div class="flex flex-col gap-0.5 pl-1">
            {#each accCalendars as cal (cal.id)}
              <div 
                oncontextmenu={(e) => contextMenuStore.openForCalendar(e, cal)}
                class="flex items-center justify-between px-2 py-1 rounded-md hover:bg-[#202020] transition-colors group relative"
              >
                <!-- Click row to toggle visibility, right-click opens Notion-style context menu -->
                <button
                  onclick={() => calendarState.toggleCalendarVisibility(cal.id)}
                  class="flex items-center gap-2 flex-1 text-left cursor-pointer truncate mr-1"
                >
                  <span 
                    class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm transition-opacity"
                    style="background-color: {cal.colorHex}; opacity: {cal.isVisible ? 1 : 0.35};"
                  ></span>
                  
                  <span class="text-xs truncate {cal.isVisible ? 'text-zinc-200' : 'text-zinc-500 line-through'}">
                    {cal.name}
                  </span>

                  <!-- Exclusive Default Badge -->
                  {#if cal.isPrimary}
                    <span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-[#1d3356] text-[#60a5fa] border border-[#2563eb]/30 shrink-0">
                      Default
                    </span>
                  {/if}
                </button>

                <button
                  onclick={() => calendarState.toggleCalendarVisibility(cal.id)}
                  class="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-zinc-300 transition-opacity cursor-pointer shrink-0"
                  title={cal.isVisible ? 'Hide calendar' : 'Show calendar'}
                >
                  {#if cal.isVisible}
                    <Eye size={12} />
                  {:else}
                    <EyeOff size={12} />
                  {/if}
                </button>
              </div>
            {/each}
          </div>
        </div>
      {/each}

      <button
        onclick={() => calendarState.openAddAccountModal()}
        class="flex items-center gap-2 px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#202020] rounded-md transition-colors cursor-pointer mt-1"
      >
        <Plus size={13} class="text-zinc-500" />
        <span>Add calendar account</span>
      </button>
    </div>
  </div>

  <!-- Bottom Workspace / Settings trigger -->
  <div class="p-2 border-t border-[#222222] bg-[#141414]">
    <button
      onclick={() => settingsStore.open('general')}
      class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-[#202020] transition-colors cursor-pointer"
    >
      <Settings size={14} class="text-zinc-500" />
      <span>Settings</span>
    </button>
  </div>
</aside>