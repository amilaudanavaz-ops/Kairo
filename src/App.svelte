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
  import { format, parseISO } from 'date-fns';
  import { resolveEventColorToken } from './lib/utils/colors';

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

    <!-- Floating Badge for Month View Dragging Only -->
    {#if dragStore.isDragging && dragStore.draggedEvent && !dragStore.projectedStartTime && dragStore.currentX > 0 && dragStore.currentY > 0}
      {@const event = dragStore.draggedEvent}
      {@const cal = calendarState.calendars.find(c => c.id === event.calendarId || c.googleCalendarId === event.calendarId)}
      {@const token = resolveEventColorToken(event.colorOverride || cal?.colorHex)}
      <div
        class="fixed pointer-events-none z-[99999] px-3 py-2 rounded-xl shadow-[0_16px_36px_rgba(0,0,0,0.85)] border border-white/20 backdrop-blur-md flex items-center gap-2.5 -translate-x-1/2 -translate-y-1/2 select-none rotate-2 scale-105"
        style="
          left: {dragStore.currentX}px; 
          top: {dragStore.currentY}px; 
          background-color: #1e1e1e;
          border-left: 4px solid {token.hex};
        "
      >
        <div class="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm" style="background-color: {token.hex};"></div>
        <div class="flex flex-col">
          <span class="text-xs font-bold text-white leading-tight">
            {event.title || '(No Title)'}
          </span>
          {#if !event.isAllDay}
            <span class="text-[10px] font-medium text-zinc-400">
              {format(parseISO(event.startTime), 'h:mm a')}
            </span>
          {/if}
        </div>
      </div>
    {/if}
  </main>
{/if}