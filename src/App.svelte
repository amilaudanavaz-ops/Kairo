<script lang="ts">
  import TitleBar from './lib/components/layout/TitleBar.svelte';
  import Sidebar from './lib/components/layout/Sidebar.svelte';
  import MonthGrid from './lib/components/views/MonthGrid.svelte';
  import DayOverflowPopover from './lib/components/modals/DayOverflowPopover.svelte';
  import EventInspector from './lib/components/modals/EventInspector.svelte';
  import { calendarState } from './lib/stores/calendarState.svelte';
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

  <!-- Global Floating Panels -->
  <DayOverflowPopover />
  <EventInspector />
</main>