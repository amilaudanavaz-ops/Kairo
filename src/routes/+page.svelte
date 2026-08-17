<script lang="ts">
  import { onMount } from 'svelte';
  import TitleBar from '../lib/components/layout/TitleBar.svelte';
  import Sidebar from '../lib/components/layout/Sidebar.svelte';
  import MonthGrid from '../lib/components/views/MonthGrid.svelte';
  import WeekGrid from '../lib/components/views/WeekGrid.svelte';
  import DayGrid from '../lib/components/views/DayGrid.svelte';
  import DayOverflowPopover from '../lib/components/modals/DayOverflowPopover.svelte';
  import EventInspector from '../lib/components/modals/EventInspector.svelte';
  import ContextMenu from '../lib/components/modals/ContextMenu.svelte';
  import RecurrenceDialog from '../lib/components/modals/RecurrenceDialog.svelte';
  import SettingsModal from '../lib/components/modals/SettingsModal.svelte';
  import AddAccountModal from '../lib/components/modals/AddAccountModal.svelte';
  import { calendarState } from '../lib/stores/calendarState.svelte';
  import { settingsStore } from '../lib/stores/settingsStore.svelte';
  import { eventStore } from '../lib/stores/eventStore.svelte';
  import { dragStore } from '../lib/stores/dragStore.svelte';
  import { contextMenuStore } from '../lib/stores/contextMenuStore.svelte';
  import { loadInitialCalendars } from '../lib/db/database';

  onMount(async () => {
    try {
      const cals = await loadInitialCalendars();
      if (cals.length > 0) {
        calendarState.calendars = cals;
      }
      await eventStore.initDatabase();
    } catch (err) {
      console.error('Failed to initialize database:', err);
    }
  });

  $effect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      // Settings shortcut
      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        settingsStore.open('general');
        return;
      }

      // View mode shortcuts
      if (e.key === 'm' || e.key === 'M') calendarState.setViewMode('month');
      if (e.key === 'w' || e.key === 'W') calendarState.setViewMode('week');
      if (e.key === 'd' || e.key === 'D') calendarState.setViewMode('day');
      if (e.key === 't' || e.key === 'T') calendarState.setToday();
      
      // Quick event creation
      if (e.key === 'c' || e.key === 'C') {
        const today = new Date();
        contextMenuStore.targetDate = today;
        contextMenuStore.createEventAtCell();
      }

      // Sidebar inspector toggle
      if (e.key === '\\') calendarState.toggleInspectorDock();

      // Escape key clears all open popovers and inspectors
      if (e.key === 'Escape') {
        calendarState.closeInspector();
        calendarState.closeOverflow();
        calendarState.closeAddAccountModal();
        settingsStore.close();
        contextMenuStore.close();
      }
    };

    const handleGlobalContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('contextmenu', handleGlobalContextMenu);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('contextmenu', handleGlobalContextMenu);
    };
  });
</script>

<main class="h-screen w-screen flex flex-col bg-[#121212] overflow-hidden select-none font-sans text-[#ededed]">
  <TitleBar />

  <div class="flex-1 flex min-h-0 overflow-hidden relative">
    {#if calendarState.isSidebarOpen}
      <Sidebar />
    {/if}

    <section class="flex-1 flex flex-col min-h-0 bg-[#121212] overflow-hidden relative min-w-0">
      {#if calendarState.viewMode === 'month'}
        <MonthGrid />
      {:else if calendarState.viewMode === 'week'}
        <WeekGrid />
      {:else if calendarState.viewMode === 'day'}
        <DayGrid />
      {/if}
    </section>

    <!-- Docked Right Sidebar Inspector -->
    {#if calendarState.isInspectorDocked && calendarState.selectedEvent}
      <EventInspector />
    {/if}
  </div>

  <!-- Floating Inspector when undocked -->
  {#if !calendarState.isInspectorDocked && calendarState.selectedEvent}
    <EventInspector />
  {/if}

  <!-- Modals & Context Menus -->
  <DayOverflowPopover />
  <ContextMenu />
  <RecurrenceDialog />
  <SettingsModal />
  <AddAccountModal />

  <!-- Drag Preview Chip -->
  {#if dragStore.isDragging && dragStore.draggedEvent}
    <div
      class="fixed pointer-events-none z-999 px-3 py-1.5 rounded-lg bg-[#242424] border border-blue-500/80 shadow-2xl text-xs font-semibold text-white flex items-center gap-2 transform -translate-x-1/2 -translate-y-1/2"
      style="left: {dragStore.currentX}px; top: {dragStore.currentY}px;"
    >
      <span class="w-2 h-2 rounded-full bg-blue-500"></span>
      <span>{dragStore.draggedEvent.title || '(No Title)'}</span>
    </div>
  {/if}
</main>