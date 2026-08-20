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

    <!-- Sleek 1:1 In-Grid Match Floating Chip for Month View -->
    {#if dragStore.isDragging && dragStore.draggedEvent && !dragStore.isTimelineDrag && dragStore.currentX > 0 && dragStore.currentY > 0}
      {@const event = dragStore.draggedEvent}
      {@const cal = calendarState.calendars.find(c => c.id === event.calendarId || c.googleCalendarId === event.calendarId)}
      {@const token = resolveEventColorToken(event.colorOverride || cal?.colorHex)}

      {#if event.isAllDay}
        <div
          class="fixed pointer-events-none z-[99999] px-2 py-0.5 rounded text-[11px] font-semibold truncate shadow-[0_12px_28px_rgba(0,0,0,0.7)] border border-white/20 -translate-x-1/2 -translate-y-1/2 select-none max-w-[190px]"
          style="
            left: {dragStore.currentX}px; 
            top: {dragStore.currentY}px; 
            background-color: {token.hex}; 
            color: #ffffff;
          "
        >
          <span class="truncate">{event.title || '(No Title)'}</span>
        </div>
      {:else}
        <div
          class="fixed pointer-events-none z-[99999] px-2 py-1 rounded-md text-[11px] flex items-center gap-1.5 shadow-[0_14px_30px_rgba(0,0,0,0.75)] border border-white/15 bg-[#181818] -translate-x-1/2 -translate-y-1/2 select-none max-w-[210px]"
          style="
            left: {dragStore.currentX}px; 
            top: {dragStore.currentY}px;
          "
        >
          <span 
            class="w-[3px] h-3.5 rounded-full shrink-0" 
            style="background-color: {token.hex};"
          ></span>
          <span 
            class="text-[10px] font-bold shrink-0"
            style="color: {token.timeText};"
          >
            {settingsStore.timeFormat === '24h' 
              ? format(parseISO(event.startTime), 'HH:mm') 
              : format(parseISO(event.startTime), 'haaa').toLowerCase()}
          </span>
          <span class="truncate font-bold text-white">
            {event.title || '(No Title)'}
          </span>
        </div>
      {/if}
    {/if}
  </main>
{/if}