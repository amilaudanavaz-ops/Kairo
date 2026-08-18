<script lang="ts">
  import { 
    Plus, 
    Eye, 
    EyeOff, 
    Link, 
    Settings,
    RefreshCw,
    Check
  } from 'lucide-svelte';
  import MiniCalendar from './MiniCalendar.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import type { CalendarCategory } from '../../../types/event';

  let isSchedulingExpanded = $state(true);
  let isCopied = $state(false);

  function copySchedulingLink() {
    const link = `https://kairo.app/${settingsStore.username || 'user'}/meet`;
    navigator.clipboard.writeText(link).catch(() => {});
    isCopied = true;
    setTimeout(() => {
      isCopied = false;
    }, 1200);
  }
</script>

<aside class="w-60 bg-[var(--bg-surface)] border-r border-[var(--border-subtle)] flex flex-col justify-between shrink-0 select-none overflow-hidden text-[var(--text-primary)] font-sans">
  <div class="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-3">
    <!-- Mini Calendar -->
    <div class="px-1 pt-1">
      <MiniCalendar />
    </div>

    <div class="h-px bg-[var(--border-subtle)] -mx-2"></div>

    <!-- Scheduling Links Section -->
    <div class="flex flex-col gap-1">
      <button 
        onclick={() => isSchedulingExpanded = !isSchedulingExpanded}
        class="flex items-center justify-between px-2 py-1 text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-md transition-colors cursor-pointer"
      >
        <div class="flex items-center gap-1.5">
          <Link size={13} class="text-[var(--text-muted)]" />
          <span>Scheduling</span>
        </div>
        <Eye size={12} class="text-[var(--text-muted)] hover:text-[var(--text-primary)]" />
      </button>

      {#if isSchedulingExpanded}
        <div class="flex flex-col gap-0.5 pl-2 animate-in fade-in duration-100">
          <button
            onclick={copySchedulingLink}
            class="flex items-center justify-between px-2 py-1 rounded text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer group"
          >
            <span class="truncate">30 min meeting</span>
            {#if isCopied}
              <span class="text-[10px] text-emerald-400 font-bold flex items-center gap-0.5"><Check size={10} /> Copied</span>
            {:else}
              <span class="text-[10px] text-zinc-500 opacity-0 group-hover:opacity-100 font-medium">Copy link</span>
            {/if}
          </button>
        </div>
      {/if}
    </div>

    <div class="h-px bg-[var(--border-subtle)] -mx-2"></div>

    <!-- Connected Accounts & Calendars -->
    <div class="flex flex-col gap-2">
      <div class="flex items-center justify-between px-2 py-0.5">
        <span class="text-[10px] font-bold tracking-wider uppercase text-[var(--text-muted)]">Calendars</span>
        <div class="flex items-center gap-1">
          <!-- Live Animated Sync Button -->
          <button
            onclick={() => settingsStore.syncGoogleAccount()}
            class="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded transition-colors cursor-pointer"
            title="Sync with Google"
          >
            <RefreshCw size={12} class={settingsStore.isAuthenticating ? 'animate-spin text-blue-500' : ''} />
          </button>
          
          <button
            onclick={() => calendarState.openAddAccountModal()}
            class="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded transition-colors cursor-pointer"
            title="Add Calendar Account"
          >
            <Plus size={13} />
          </button>
        </div>
      </div>

      {#each settingsStore.accounts as acc (acc.id)}
        {@const accCalendars = calendarState.calendars.filter((c: CalendarCategory) => c.accountId === acc.id || c.accountId.startsWith('acc_'))}
        
        <div class="flex flex-col gap-0.5">
          <div class="px-2 py-1 text-[11px] font-semibold text-[var(--text-primary)] truncate">
            {acc.email}
          </div>

          <div class="flex flex-col gap-0.5 pl-1">
            {#each accCalendars as cal (cal.id)}
              <div 
                oncontextmenu={(e) => contextMenuStore.openForCalendar(e, cal)}
                class="flex items-center justify-between px-2 py-1 rounded-md hover:bg-[var(--bg-card-hover)] transition-colors group relative"
              >
                <button
                  onclick={() => calendarState.toggleCalendarVisibility(cal.id)}
                  class="flex items-center gap-2 flex-1 text-left cursor-pointer truncate mr-1"
                >
                  <span 
                    class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm transition-opacity"
                    style="background-color: {cal.colorHex}; opacity: {cal.isVisible ? 1 : 0.35};"
                  ></span>
                  
                  <span class="text-xs truncate font-medium {cal.isVisible ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] line-through'}">
                    {cal.name}
                  </span>

                  {#if cal.isPrimary}
                    <span class="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-blue-950/60 text-blue-400 border border-blue-500/30 shrink-0">
                      Default
                    </span>
                  {/if}
                </button>

                <button
                  onclick={() => calendarState.toggleCalendarVisibility(cal.id)}
                  class="opacity-0 group-hover:opacity-100 p-0.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-opacity cursor-pointer shrink-0"
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
        class="flex items-center gap-2 px-2 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-md transition-colors cursor-pointer mt-1"
      >
        <Plus size={13} class="text-[var(--text-muted)]" />
        <span>Add calendar account</span>
      </button>
    </div>
  </div>

  <div class="p-2 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)]">
    <button
      onclick={() => settingsStore.open('general')}
      class="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
    >
      <Settings size={14} class="text-[var(--text-muted)]" />
      <span>Settings</span>
    </button>
  </div>
</aside>