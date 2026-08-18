<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { 
    ChevronLeft, 
    ChevronRight, 
    PanelLeft, 
    Minus, 
    Square, 
    X,
    Calendar as CalendarIcon,
    Settings,
    LogOut,
    Terminal
  } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { format, addWeeks } from 'date-fns';

  const appWindow = getCurrentWindow();
  let isProfileMenuOpen = $state(false);
  let menuContainer: HTMLElement | null = $state(null);

  $effect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (isProfileMenuOpen && menuContainer && !menuContainer.contains(e.target as Node)) {
        isProfileMenuOpen = false;
      }
    }
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      window.removeEventListener('pointerdown', handleOutsideClick);
    };
  });

  // Calculate dominant header title based on center visible week in rolling month view
  let headerTitle = $derived.by(() => {
    if (calendarState.viewMode === 'month') {
      const dominantDate = addWeeks(calendarState.currentDate, 2);
      return format(dominantDate, 'MMMM yyyy');
    }
    return format(calendarState.currentDate, 'MMMM yyyy');
  });

  function minimize() {
    appWindow.minimize();
  }

  function toggleMaximize() {
    appWindow.toggleMaximize();
  }

  function close() {
    appWindow.close();
  }
</script>

<header 
  data-tauri-drag-region 
  class="h-11 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)] flex items-center justify-between px-3 select-none shrink-0 z-50 relative text-[var(--text-primary)]"
>
  <div class="flex items-center gap-2">
    <button 
      onclick={() => calendarState.toggleSidebar()}
      class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors cursor-pointer"
      title="Toggle Sidebar"
    >
      <PanelLeft size={15} />
    </button>

    <div class="flex items-center gap-0.5 ml-1">
      <button 
        onclick={() => calendarState.navigatePrev()}
        class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors cursor-pointer"
        title="Previous"
      >
        <ChevronLeft size={15} />
      </button>

      <button 
        onclick={() => calendarState.navigateNext()}
        class="p-1.5 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-lg transition-colors cursor-pointer"
        title="Next"
      >
        <ChevronRight size={15} />
      </button>
    </div>

    <button 
      onclick={() => calendarState.setToday()}
      class="px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] border border-[var(--border-subtle)] rounded-lg transition-colors cursor-pointer ml-1"
    >
      Today
    </button>

    <span class="text-xs font-bold text-[var(--text-primary)] ml-2 tracking-tight">
      {headerTitle}
    </span>
  </div>

  <div class="flex items-center bg-[var(--bg-canvas)] p-0.5 rounded-lg border border-[var(--border-subtle)]">
    <button
      onclick={() => calendarState.setViewMode('day')}
      class="px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer
        {calendarState.viewMode === 'day' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
    >
      Day
    </button>

    <button
      onclick={() => calendarState.setViewMode('week')}
      class="px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer
        {calendarState.viewMode === 'week' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
    >
      Week
    </button>

    <button
      onclick={() => calendarState.setViewMode('month')}
      class="px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer
        {calendarState.viewMode === 'month' ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold shadow-sm' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'}"
    >
      Month
    </button>
  </div>

  <div class="flex items-center gap-3">
    <div class="relative" bind:this={menuContainer}>
      <button
        onclick={() => isProfileMenuOpen = !isProfileMenuOpen}
        class="flex items-center gap-2 p-0.5 pr-1.5 rounded-full hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer border border-transparent hover:border-[var(--border-subtle)]"
      >
        <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow">
          {settingsStore.preferredName ? settingsStore.preferredName.slice(0, 1).toUpperCase() : 'U'}
        </div>
      </button>

      {#if isProfileMenuOpen}
        <div 
          class="absolute right-0 top-full mt-2 w-64 bg-[var(--bg-overlay)] border border-[var(--border-default)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-1.5 z-[999] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
        >
          <div class="flex flex-col px-3 py-2 border-b border-[var(--border-subtle)] mb-0.5">
            <span class="text-xs font-bold text-[var(--text-primary)]">{settingsStore.preferredName || 'User'}</span>
            <span class="text-[11px] text-[var(--text-muted)] truncate">{settingsStore.email || 'Not connected'}</span>
          </div>

          <button
            onclick={() => { 
              settingsStore.openCommandMenu(); 
              isProfileMenuOpen = false; 
            }}
            class="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-xl transition-colors text-left cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <Terminal size={14} class="text-[var(--text-muted)]" />
              <span>Command menu...</span>
            </div>
            <span class="text-[10px] text-[var(--text-muted)] font-mono">Ctrl K</span>
          </button>

          <button
            onclick={() => { 
              settingsStore.open('general'); 
              isProfileMenuOpen = false; 
            }}
            class="flex items-center justify-between px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-xl transition-colors text-left cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <Settings size={14} class="text-[var(--text-muted)]" />
              <span>Settings</span>
            </div>
            <span class="text-[10px] text-[var(--text-muted)] font-mono">Ctrl ,</span>
          </button>

          <button
            onclick={() => { 
              settingsStore.open('accounts'); 
              isProfileMenuOpen = false; 
            }}
            class="flex items-center gap-2 px-3 py-1.5 text-xs text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded-xl transition-colors text-left cursor-pointer"
          >
            <CalendarIcon size={14} class="text-[var(--text-muted)]" />
            <span>Manage calendar accounts</span>
          </button>

          <div class="h-px bg-[var(--border-subtle)] my-0.5"></div>

          <button
            onclick={() => { 
              settingsStore.logout(); 
              isProfileMenuOpen = false; 
            }}
            class="flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 rounded-xl transition-colors text-left cursor-pointer"
          >
            <LogOut size={14} />
            <span>Log out</span>
          </button>
        </div>
      {/if}
    </div>

    <div class="h-4 w-px bg-[var(--border-subtle)]"></div>

    <div class="flex items-center gap-0.5">
      <button 
        onclick={minimize}
        class="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded transition-colors cursor-pointer"
      >
        <Minus size={13} />
      </button>

      <button 
        onclick={toggleMaximize}
        class="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card-hover)] rounded transition-colors cursor-pointer"
      >
        <Square size={11} />
      </button>

      <button 
        onclick={close}
        class="p-1 text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
      >
        <X size={13} />
      </button>
    </div>
  </div>
</header>