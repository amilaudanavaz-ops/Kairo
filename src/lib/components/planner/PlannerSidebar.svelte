<script lang="ts">
  import { Plus, Calendar, CheckSquare, Clock } from 'lucide-svelte';
  import { plannerStore } from '../../stores/plannerStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { format, parseISO } from 'date-fns';

  function formatDuration(minutes: number) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
</script>

<aside class="w-80 h-full bg-[#161616] border-l border-[#242424] flex flex-col shrink-0">
  <div class="p-4 border-b border-[#242424]">
    <h2 class="text-sm font-bold text-zinc-100 flex items-center gap-2">
      <CheckSquare size={16} class="text-indigo-400" />
      My Day Inbox
    </h2>
    <p class="text-[11px] text-zinc-500 mt-1">Add tasks to your active session.</p>
  </div>

  <div class="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2">
    {#if plannerStore.inboxBlocks.length === 0}
      <div class="flex flex-col items-center justify-center h-40 text-zinc-500 gap-2">
        <CheckSquare size={24} class="opacity-40" />
        <span class="text-xs">Your inbox is empty.</span>
      </div>
    {:else}
      {#each plannerStore.inboxBlocks as block (block.id)}
        <!-- Add HTML5 Drag Attributes -->
        <div 
          draggable="true"
          ondragstart={(e) => {
            if (e.dataTransfer) {
              e.dataTransfer.setData('text/plain', block.id);
              e.dataTransfer.effectAllowed = 'move';
            }
          }}
          class="bg-[#1e1e1e] border border-[#2b2b2b] hover:border-[#404040] rounded-xl p-3 flex flex-col gap-2 transition-colors group cursor-grab active:cursor-grabbing"
        >
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 truncate">
              {#if block.type === 'calendar_event'}
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {block.colorHex || '#3b82f6'};"></span>
              {:else}
                <div class="w-2.5 h-2.5 rounded-sm border border-zinc-500 shrink-0"></div>
              {/if}
              <span class="text-xs font-semibold text-zinc-200 truncate">{block.title}</span>
            </div>
            
            <button 
              onclick={() => plannerStore.addBlockToTimeline(block)}
              disabled={!plannerStore.activeSession}
              class="opacity-0 group-hover:opacity-100 disabled:opacity-0 p-1 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 rounded transition-all cursor-pointer"
              title="Add to session"
            >
              <Plus size={14} strokeWidth={3} />
            </button>
          </div>

          <div class="flex items-center gap-3 text-[10px] text-zinc-500 font-medium pl-4.5">
            <div class="flex items-center gap-1">
              <Clock size={11} />
              <span>{formatDuration(block.durationMinutes)}</span>
            </div>
            {#if block.type === 'calendar_event' && block.originalStartTime}
              <div class="flex items-center gap-1 text-blue-400/80">
                <Calendar size={11} />
                <span>{format(parseISO(block.originalStartTime), 'h:mm a')}</span>
              </div>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>

  <!-- Exit KFlow Toggle -->
  <div class="p-3 border-t border-[#242424] bg-[#161616]">
    <button 
      onclick={() => {
        calendarState.setAppMode('calendar');
      }}
      class="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-indigo-500/40 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 shadow-[0_0_15px_rgba(99,102,241,0.1)] transition-all cursor-pointer hover:from-indigo-500/20 hover:to-purple-500/20"
    >
      <div class="flex items-center gap-2.5">
        <div class="w-5 h-5 rounded-md flex items-center justify-center shadow-sm bg-gradient-to-tr from-indigo-500 to-purple-500">
          <svg class="w-3 h-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
        </div>
        <span class="font-black tracking-wide text-[13px] text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">KFlow</span>
      </div>
      <div class="text-[9px] font-bold uppercase tracking-wider text-zinc-300 bg-indigo-500/40 px-1.5 py-0.5 rounded">Active</div>
    </button>
  </div>
</aside>