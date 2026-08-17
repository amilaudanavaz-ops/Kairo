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
  import { format } from 'date-fns';

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
  class="h-11 bg-[#161616] border-b border-[#242424] flex items-center justify-between px-3 select-none shrink-0 z-50 relative"
>
  <!-- Left Controls -->
  <div class="flex items-center gap-2">
    <button 
      onclick={() => calendarState.toggleSidebar()}
      class="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-[#262626] rounded-lg transition-colors cursor-pointer"
      title="Toggle Sidebar"
    >
      <PanelLeft size={15} />
    </button>

    <div class="flex items-center gap-0.5 ml-1">
      <button 
        onclick={() => calendarState.navigatePrev()}
        class="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-[#262626] rounded-lg transition-colors cursor-pointer"
        title="Previous"
      >
        <ChevronLeft size={15} />
      </button>

      <button 
        onclick={() => calendarState.navigateNext()}
        class="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-[#262626] rounded-lg transition-colors cursor-pointer"
        title="Next"
      >
        <ChevronRight size={15} />
      </button>
    </div>

    <button 
      onclick={() => calendarState.setToday()}
      class="px-2.5 py-1 text-xs font-semibold text-zinc-200 hover:text-white bg-[#222222] hover:bg-[#2a2a2a] border border-[#2e2e2e] rounded-lg transition-colors cursor-pointer ml-1"
    >
      Today
    </button>

    <span class="text-xs font-bold text-zinc-100 ml-2 tracking-tight">
      {format(calendarState.currentDate, 'MMMM yyyy')}
    </span>
  </div>

  <!-- Center View Switcher -->
  <div class="flex items-center bg-[#1f1f1f] p-0.5 rounded-lg border border-[#2b2b2b]">
    <button
      onclick={() => calendarState.setViewMode('day')}
      class="px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer
        {calendarState.viewMode === 'day' ? 'bg-[#2b2b2b] text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
    >
      Day
    </button>

    <button
      onclick={() => calendarState.setViewMode('week')}
      class="px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer
        {calendarState.viewMode === 'week' ? 'bg-[#2b2b2b] text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
    >
      Week
    </button>

    <button
      onclick={() => calendarState.setViewMode('month')}
      class="px-2.5 py-0.5 text-xs font-medium rounded-md transition-colors cursor-pointer
        {calendarState.viewMode === 'month' ? 'bg-[#2b2b2b] text-white font-semibold shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}"
    >
      Month
    </button>
  </div>

  <!-- Right: Profile Button with Notion-Style Dropdown & Window Controls -->
  <div class="flex items-center gap-3">
    <!-- Profile Avatar Dropdown Trigger -->
    <div class="relative" bind:this={menuContainer}>
      <button
        onclick={() => isProfileMenuOpen = !isProfileMenuOpen}
        class="flex items-center gap-2 p-0.5 pr-1.5 rounded-full hover:bg-[#242424] transition-colors cursor-pointer border border-transparent hover:border-[#2e2e2e]"
      >
        <div class="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-[10px] font-bold text-white shadow">
          {settingsStore.preferredName ? settingsStore.preferredName.slice(0, 1).toUpperCase() : 'U'}
        </div>
      </button>

      <!-- Profile Dropdown Menu -->
      {#if isProfileMenuOpen}
        <div 
          class="absolute right-0 top-full mt-2 w-64 bg-[#1e1e1e] border border-[#2e2e2e] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.9)] p-1.5 z-[999] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
        >
          <!-- User info header -->
          <div class="flex flex-col px-3 py-2 border-b border-[#282828] mb-0.5">
            <span class="text-xs font-bold text-zinc-100">{settingsStore.preferredName || 'User'}</span>
            <span class="text-[11px] text-zinc-400 truncate">{settingsStore.email || 'Not connected'}</span>
          </div>

          <!-- Command Menu Item (Opens Command Palette) -->
          <button
            onclick={() => { 
              settingsStore.openCommandMenu(); 
              isProfileMenuOpen = false; 
            }}
            class="flex items-center justify-between px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-[#282828] rounded-xl transition-colors text-left cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <Terminal size={14} class="text-zinc-400" />
              <span>Command menu...</span>
            </div>
            <span class="text-[10px] text-zinc-500 font-mono">Ctrl K</span>
          </button>

          <!-- Settings Item -->
          <button
            onclick={() => { 
              settingsStore.open('general'); 
              isProfileMenuOpen = false; 
            }}
            class="flex items-center justify-between px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-[#282828] rounded-xl transition-colors text-left cursor-pointer"
          >
            <div class="flex items-center gap-2">
              <Settings size={14} class="text-zinc-400" />
              <span>Settings</span>
            </div>
            <span class="text-[10px] text-zinc-500 font-mono">Ctrl ,</span>
          </button>

          <!-- Manage Calendar Accounts -->
          <button
            onclick={() => { 
              settingsStore.open('accounts'); 
              isProfileMenuOpen = false; 
            }}
            class="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-[#282828] rounded-xl transition-colors text-left cursor-pointer"
          >
            <CalendarIcon size={14} class="text-zinc-400" />
            <span>Manage calendar accounts</span>
          </button>

          <div class="h-px bg-[#282828] my-0.5"></div>

          <!-- Log Out Option -->
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

    <div class="h-4 w-px bg-[#2a2a2a]"></div>

    <!-- Window Controls -->
    <div class="flex items-center gap-0.5">
      <button 
        onclick={minimize}
        class="p-1 text-zinc-400 hover:text-white hover:bg-[#262626] rounded transition-colors cursor-pointer"
      >
        <Minus size={13} />
      </button>

      <button 
        onclick={toggleMaximize}
        class="p-1 text-zinc-400 hover:text-white hover:bg-[#262626] rounded transition-colors cursor-pointer"
      >
        <Square size={11} />
      </button>

      <button 
        onclick={close}
        class="p-1 text-zinc-400 hover:text-rose-400 hover:bg-rose-950/40 rounded transition-colors cursor-pointer"
      >
        <X size={13} />
      </button>
    </div>
  </div>
</header>