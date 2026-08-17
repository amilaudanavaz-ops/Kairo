<script lang="ts">
  import { onMount } from 'svelte';
  import TitleBar from './lib/components/layout/TitleBar.svelte';
  import Sidebar from './lib/components/layout/Sidebar.svelte';
  import MonthGrid from './lib/components/views/MonthGrid.svelte';
  import WeekGrid from './lib/components/views/WeekGrid.svelte';
  import DayGrid from './lib/components/views/DayGrid.svelte';
  import DayOverflowPopover from './lib/components/modals/DayOverflowPopover.svelte';
  import EventInspector from './lib/components/modals/EventInspector.svelte';
  import ContextMenu from './lib/components/modals/ContextMenu.svelte';
  import RecurrenceDialog from './lib/components/modals/RecurrenceDialog.svelte';
  import SettingsModal from './lib/components/modals/SettingsModal.svelte';
  import CommandMenu from './lib/components/modals/CommandMenu.svelte';
  import AuthScreen from './lib/components/modals/AuthScreen.svelte';
  import AddAccountModal from './lib/components/modals/AddAccountModal.svelte';
  import { calendarState } from './lib/stores/calendarState.svelte';
  import { settingsStore } from './lib/stores/settingsStore.svelte';
  import { eventStore } from './lib/stores/eventStore.svelte';
  import { dragStore } from './lib/stores/dragStore.svelte';
  import { contextMenuStore } from './lib/stores/contextMenuStore.svelte';
  import { loadInitialCalendars } from './lib/db/database';

  onMount(async () => {
    try {
      await settingsStore.init();
      const cals = await loadInitialCalendars();
      if (cals.length > 0) {
        calendarState.calendars = cals;
      }
      await eventStore.initDatabase();
    } catch (err) {
      console.error('Failed to initialize application:', err);
    }
  });

  $effect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = (document.activeElement?.tagName || '').toLowerCase();
      
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        settingsStore.toggleCommandMenu();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        settingsStore.open('general');
        return;
      }

      if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

      if (e.key === 'm' || e.key === 'M') calendarState.setViewMode('month');
      if (e.key === 'w' || e.key === 'W') calendarState.setViewMode('week');
      if (e.key === 'd' || e.key === 'D') calendarState.setViewMode('day');
      if (e.key === 't' || e.key === 'T') {
        if (settingsStore.pressTAction === 'today') calendarState.setToday();
      }
      
      if (e.key === 'c' || e.key === 'C') {
        const today = new Date();
        contextMenuStore.targetDate = today;
        contextMenuStore.createEventAtCell();
      }

      if (e.key === '\\') calendarState.toggleInspectorDock();

      if (e.key === 'Escape') {
        settingsStore.closeCommandMenu();
        settingsStore.close();
        calendarState.closeInspector();
        calendarState.closeOverflow();
        calendarState.closeAddAccountModal();
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

{#if !settingsStore.isLoggedIn}
  <AuthScreen />
{:else}
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

      {#if calendarState.isInspectorDocked && calendarState.selectedEvent}
        <EventInspector />
      {/if}
    </div>

    <DayOverflowPopover />
    {#if !calendarState.isInspectorDocked && calendarState.selectedEvent}
      <EventInspector />
    {/if}
    <ContextMenu />
    <RecurrenceDialog />
    <SettingsModal />
    <CommandMenu />
    <AddAccountModal />

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
{/if}