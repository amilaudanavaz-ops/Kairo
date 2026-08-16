<script lang="ts">
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { 
    Scissors, 
    Copy, 
    Files, 
    Trash2, 
    Check, 
    Calendar as CalIcon,
    Plus,
    ClipboardPaste,
    ChevronRight 
  } from 'lucide-svelte';

  const notionColors = [
    { name: 'Red', hex: '#ef4444' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Green', hex: '#10b981' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Purple', hex: '#8b5cf6' },
    { name: 'Default', hex: '#71717a' }
  ];

  let activeColor = $derived(contextMenuStore.targetEvent?.colorOverride);
</script>

{#if contextMenuStore.isOpen}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-50 bg-transparent"
    onclick={() => contextMenuStore.close()}
    oncontextmenu={(e) => { e.preventDefault(); contextMenuStore.close(); }}
    role="presentation"
  ></div>

  <!-- Context Menu Card -->
  <div
    class="fixed z-50 bg-[#1f1f1f] border border-[#2e2e2e] rounded-xl shadow-[0_16px_36px_rgba(0,0,0,0.8)] p-1.5 flex flex-col gap-0.5 select-none animate-in fade-in zoom-in-95 duration-100"
    style="left: {contextMenuStore.x}px; top: {contextMenuStore.y}px; width: {contextMenuStore.mode === 'cell' ? '200px' : '224px'};"
  >
    {#if contextMenuStore.mode === 'cell'}
      <!-- Empty Slot Menu: Create Event / Paste Event -->
      <button 
        onclick={() => contextMenuStore.createEventAtCell()}
        class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-colors"
      >
        <div class="flex items-center gap-2">
          <Plus size={13} class="text-zinc-400" />
          <span class="font-medium">Create event</span>
        </div>
        <span class="text-[10px] text-zinc-500 font-mono">C</span>
      </button>

      <button 
        onclick={() => contextMenuStore.pasteEventAtCell()}
        disabled={!calendarState.clipboardEvent}
        class="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors
          {calendarState.clipboardEvent 
            ? 'text-zinc-200 hover:text-white hover:bg-[#2c2c2c]' 
            : 'text-zinc-600 cursor-not-allowed'}"
      >
        <div class="flex items-center gap-2">
          <ClipboardPaste size={13} class={calendarState.clipboardEvent ? "text-zinc-400" : "text-zinc-600"} />
          <span class="font-medium">Paste event</span>
        </div>
        <span class="text-[10px] text-zinc-500 font-mono">Ctrl V</span>
      </button>

    {:else if contextMenuStore.mode === 'event' && contextMenuStore.targetEvent}
      <!-- Event Item Menu: Colors, Block, Cut, Copy, Duplicate, Delete -->
      <div class="flex items-center justify-between px-2 py-1.5 border-b border-[#292929] mb-0.5">
        {#each notionColors as c}
          <button
            onclick={() => contextMenuStore.setColorOverride(c.hex === '#71717a' ? undefined : c.hex)}
            class="w-4 h-4 rounded-full flex items-center justify-center transition-transform hover:scale-125"
            style="background-color: {c.hex};"
            title={c.name}
          >
            {#if (activeColor === c.hex) || (!activeColor && c.hex === '#71717a')}
              <Check size={10} class="text-white drop-shadow" />
            {/if}
          </button>
        {/each}
      </div>

      <button 
        onclick={() => contextMenuStore.close()}
        class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-colors group"
      >
        <div class="flex items-center gap-2">
          <CalIcon size={13} class="text-zinc-400 group-hover:text-zinc-200" />
          <span>Block on calendar</span>
        </div>
        <ChevronRight size={13} class="text-zinc-500" />
      </button>

      <div class="h-[1px] bg-[#292929] my-0.5"></div>

      <button 
        onclick={() => contextMenuStore.cut()}
        class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-colors"
      >
        <div class="flex items-center gap-2">
          <Scissors size={13} class="text-zinc-400" />
          <span>Cut</span>
        </div>
        <span class="text-[10px] text-zinc-500 font-mono">Ctrl X</span>
      </button>

      <button 
        onclick={() => contextMenuStore.copy()}
        class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-colors"
      >
        <div class="flex items-center gap-2">
          <Copy size={13} class="text-zinc-400" />
          <span>Copy</span>
        </div>
        <span class="text-[10px] text-zinc-500 font-mono">Ctrl C</span>
      </button>

      <button 
        onclick={() => contextMenuStore.duplicate()}
        class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-300 hover:text-white hover:bg-[#2c2c2c] rounded-lg transition-colors"
      >
        <div class="flex items-center gap-2">
          <Files size={13} class="text-zinc-400" />
          <span>Duplicate</span>
        </div>
        <span class="text-[10px] text-zinc-500 font-mono">Ctrl D</span>
      </button>

      <div class="h-[1px] bg-[#292929] my-0.5"></div>

      <button 
        onclick={() => contextMenuStore.delete()}
        class="flex items-center justify-between px-2.5 py-1.5 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/40 rounded-lg transition-colors"
      >
        <div class="flex items-center gap-2">
          <Trash2 size={13} />
          <span>Delete</span>
        </div>
        <span class="text-[10px] text-rose-500 font-mono">delete</span>
      </button>
    {/if}
  </div>
{/if}