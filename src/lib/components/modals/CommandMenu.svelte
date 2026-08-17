<script lang="ts">
  import { 
    Search, 
    Calendar, 
    Settings, 
    Plus, 
    Video, 
    Layers, 
    User, 
    LogOut,
    Sun,
    Moon,
    Clock,
    RefreshCw
  } from 'lucide-svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';

  let searchQuery = $state('');
  let selectedIndex = $state(0);

  const commands = [
    { id: 'create', title: 'Create new event', icon: Plus, shortcut: 'C', action: () => { contextMenuStore.targetDate = new Date(); contextMenuStore.createEventAtCell(); } },
    { id: 'today', title: 'Go to today', icon: Calendar, shortcut: 'T', action: () => calendarState.setToday() },
    { id: 'month', title: 'Switch to Month view', icon: Layers, shortcut: 'M', action: () => calendarState.setViewMode('month') },
    { id: 'week', title: 'Switch to Week view', icon: Layers, shortcut: 'W', action: () => calendarState.setViewMode('week') },
    { id: 'day', title: 'Switch to Day view', icon: Layers, shortcut: 'D', action: () => calendarState.setViewMode('day') },
    { id: 'theme-dark', title: 'Switch to Dark theme', icon: Moon, shortcut: '', action: () => settingsStore.applyTheme('dark') },
    { id: 'theme-light', title: 'Switch to Light theme', icon: Sun, shortcut: '', action: () => settingsStore.applyTheme('light') },
    { id: 'settings', title: 'Open Settings', icon: Settings, shortcut: 'Ctrl ,', action: () => settingsStore.open('general') },
    { id: 'profile', title: 'Edit User Profile', icon: User, shortcut: '', action: () => settingsStore.open('profile') },
    { id: 'accounts', title: 'Manage Calendar Accounts', icon: User, shortcut: '', action: () => settingsStore.open('accounts') },
    { id: 'conferencing', title: 'Conferencing Settings', icon: Video, shortcut: '', action: () => settingsStore.open('conferencing') },
    { id: 'sidebar', title: 'Toggle Inspector dock', icon: Layers, shortcut: '\\', action: () => calendarState.toggleInspectorDock() },
    { id: 'logout', title: 'Log out', icon: LogOut, shortcut: '', action: () => settingsStore.logout() }
  ];

  let filteredCommands = $derived(
    commands.filter(c => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  function execute(cmd: typeof commands[0]) {
    cmd.action();
    settingsStore.closeCommandMenu();
    searchQuery = '';
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedIndex = (selectedIndex + 1) % filteredCommands.length;
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedIndex = (selectedIndex - 1 + filteredCommands.length) % filteredCommands.length;
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        execute(filteredCommands[selectedIndex]);
      }
    }
  }
</script>

{#if settingsStore.isCommandMenuOpen}
  <div 
    class="fixed inset-0 z-[200] bg-black/75 backdrop-blur-[2px] flex items-start justify-center pt-24 select-none"
    onclick={() => settingsStore.closeCommandMenu()}
    role="presentation"
  >
    <div 
      class="w-[520px] bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl shadow-[0_24px_70px_rgba(0,0,0,0.95)] overflow-hidden text-zinc-200 animate-in fade-in zoom-in-95 duration-100 flex flex-col"
      onclick={(e) => e.stopPropagation()}
      role="dialog"
    >
      <!-- Search Input -->
      <div class="flex items-center gap-3 px-4 py-3 border-b border-[#282828] bg-[#151515]">
        <Search size={15} class="text-zinc-500 shrink-0" />
        <input 
          type="text" 
          placeholder="Type a command or search..."
          bind:value={searchQuery}
          onkeydown={handleKeyDown}
          class="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
        />
        <kbd class="text-[10px] font-mono text-zinc-500 bg-[#222222] border border-[#2e2e2e] px-1.5 py-0.5 rounded">ESC</kbd>
      </div>

      <!-- Action Items List -->
      <div class="max-h-72 overflow-y-auto p-1.5 flex flex-col gap-0.5 custom-scrollbar">
        {#each filteredCommands as cmd, i}
          {@const Icon = cmd.icon}
          {@const isSelected = i === selectedIndex}
          <button
            onclick={() => execute(cmd)}
            onmouseenter={() => selectedIndex = i}
            class="flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors text-left cursor-pointer group
              {isSelected ? 'bg-blue-600 text-white font-semibold' : 'text-zinc-300 hover:bg-[#252525]'}"
          >
            <div class="flex items-center gap-2.5">
              <Icon size={14} class={isSelected ? 'text-white' : 'text-zinc-400 group-hover:text-blue-400'} />
              <span>{cmd.title}</span>
            </div>
            {#if cmd.shortcut}
              <kbd class="text-[10px] font-mono px-1.5 py-0.5 rounded {isSelected ? 'bg-blue-700 text-blue-100' : 'text-zinc-500 bg-[#202020] border border-[#2b2b2b]'}">
                {cmd.shortcut}
              </kbd>
            {/if}
          </button>
        {/each}

        {#if filteredCommands.length === 0}
          <div class="p-4 text-center text-xs text-zinc-500">
            No matching commands found.
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}