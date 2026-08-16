<script lang="ts">
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { format } from 'date-fns';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { 
    ChevronLeft, 
    ChevronRight, 
    PanelLeft, 
    Minus, 
    Square, 
    X,
    ChevronDown 
  } from 'lucide-svelte';

  const appWindow = getCurrentWindow();

  let formattedTitle = $derived(
    format(calendarState.currentDate, 'MMMM yyyy')
  );

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
  class="h-11 bg-[#141414] border-b border-[#242424] flex items-center justify-between px-3 select-none z-30"
>
  <!-- Left Section: Sidebar Toggle & Date Navigation -->
  <div class="flex items-center gap-2">
    <button 
      onclick={() => calendarState.toggleSidebar()}
      class="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-[#222222] rounded-md transition-colors"
      title="Toggle Sidebar (Ctrl+\)"
    >
      <PanelLeft size={16} />
    </button>

    <div class="h-4 w-[1px] bg-[#2a2a2a] mx-1"></div>

    <div class="flex items-center gap-1">
      <button 
        onclick={() => calendarState.navigatePrev()} 
        class="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#222222] rounded-md transition-colors"
      >
        <ChevronLeft size={16} />
      </button>
      <button 
        onclick={() => calendarState.navigateNext()} 
        class="p-1 text-zinc-400 hover:text-zinc-100 hover:bg-[#222222] rounded-md transition-colors"
      >
        <ChevronRight size={16} />
      </button>
      <button 
        onclick={() => calendarState.setToday()} 
        class="px-2.5 py-1 text-xs font-medium text-zinc-300 hover:text-zinc-100 hover:bg-[#222222] rounded-md transition-colors border border-[#2c2c2c]"
      >
        Today
      </button>
    </div>

    <span class="text-sm font-semibold text-zinc-100 ml-2 tracking-tight">
      {formattedTitle}
    </span>
  </div>

  <!-- Center Draggable Region -->
  <div data-tauri-drag-region class="flex-1 h-full mx-4"></div>

  <!-- Right Section: View Switcher & Window Controls -->
  <div class="flex items-center gap-2">
    <!-- View Switcher -->
    <div class="flex items-center bg-[#1c1c1c] p-0.5 rounded-lg border border-[#282828] text-xs">
      <button 
        onclick={() => calendarState.setViewMode('day')}
        class="px-2.5 py-1 rounded-md transition-colors {calendarState.viewMode === 'day' ? 'bg-[#2b2b2b] text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        Day
      </button>
      <button 
        onclick={() => calendarState.setViewMode('week')}
        class="px-2.5 py-1 rounded-md transition-colors {calendarState.viewMode === 'week' ? 'bg-[#2b2b2b] text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        Week
      </button>
      <button 
        onclick={() => calendarState.setViewMode('month')}
        class="px-2.5 py-1 rounded-md transition-colors {calendarState.viewMode === 'month' ? 'bg-[#2b2b2b] text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200'}"
      >
        Month
      </button>
    </div>

    <div class="h-4 w-[1px] bg-[#2a2a2a] mx-1"></div>

    <!-- Window Management Buttons -->
    <div class="flex items-center">
      <button 
        onclick={minimize} 
        class="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-[#242424] rounded transition-colors"
      >
        <Minus size={14} />
      </button>
      <button 
        onclick={toggleMaximize} 
        class="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-[#242424] rounded transition-colors"
      >
        <Square size={13} />
      </button>
      <button 
        onclick={close} 
        class="p-1.5 text-zinc-400 hover:text-white hover:bg-rose-600 rounded transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  </div>
</header>