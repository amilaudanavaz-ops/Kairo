<script lang="ts">
  import TitleBar from './lib/components/layout/TitleBar.svelte';
  import Sidebar from './lib/components/layout/Sidebar.svelte';
  import MonthGrid from './lib/components/views/MonthGrid.svelte';
  import DayOverflowPopover from './lib/components/modals/DayOverflowPopover.svelte';
  import EventInspector from './lib/components/modals/EventInspector.svelte';
  import { calendarState } from './lib/stores/calendarState.svelte';
  import { dragStore } from './lib/stores/dragStore.svelte';
</script>

<main class="h-screen w-screen flex flex-col bg-[#121212] overflow-hidden">
  <TitleBar />

  <div class="flex-1 flex overflow-hidden">
    {#if calendarState.isSidebarOpen}
      <Sidebar />
    {/if}

    <section class="flex-1 flex flex-col bg-[#121212] overflow-hidden relative">
      {#if calendarState.viewMode === 'month'}
        <MonthGrid />
      {:else}
        <div class="flex-1 flex items-center justify-center text-zinc-500 text-sm">
          <span>{calendarState.viewMode.toUpperCase()} view implementation</span>
        </div>
      {/if}
    </section>
  </div>

  <!-- Global Floating Modals -->
  <DayOverflowPopover />
  <EventInspector />

  <!-- Floating Drag Ghost -->
  {#if dragStore.isDragging && dragStore.draggedEvent}
    <div
      class="fixed pointer-events-none z-[999] px-3 py-1.5 rounded-lg bg-[#242424] border border-blue-500/80 shadow-2xl text-xs font-semibold text-white flex items-center gap-2 transform -translate-x-1/2 -translate-y-1/2"
      style="left: {dragStore.currentX}px; top: {dragStore.currentY}px;"
    >
      <span class="w-2 h-2 rounded-full bg-blue-500"></span>
      <span>{dragStore.draggedEvent.title}</span>
    </div>
  {/if}
</main>