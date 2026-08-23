<script lang="ts">
  import { Clock, Calendar, CheckSquare, X } from 'lucide-svelte';
  import { plannerStore } from '../../stores/plannerStore.svelte';
  import { format, parseISO } from 'date-fns';

  // 1 minute = 2 pixels for a nice visual scale
  const PIXELS_PER_MINUTE = 2; 
</script>

<div class="w-full max-w-2xl mx-auto mt-6 mb-32 flex flex-col gap-1 select-none">
  {#if plannerStore.activeSession}
    <div class="flex items-center justify-between mb-4 px-2">
      <div class="text-xs font-bold tracking-widest uppercase text-zinc-500">Session Canvas</div>
      <div class="text-[11px] font-semibold bg-[#222] border border-[#333] px-2 py-1 rounded text-zinc-300">
        Capacity: {plannerStore.activeSession.durationMinutes / 60} hrs
      </div>
    </div>

    <!-- Add HTML5 Drop Attributes -->
    <div 
      ondragover={(e) => { e.preventDefault(); e.dataTransfer && (e.dataTransfer.dropEffect = 'move'); }}
      ondrop={(e) => {
        e.preventDefault();
        const dataStr = e.dataTransfer?.getData('application/json');
        if (dataStr) {
          try {
            const data = JSON.parse(dataStr);
            const block = plannerStore.inboxBlocks.find(b => b.id === data.id);
            if (block) plannerStore.addBlockToTimeline(block, data.duration);
          } catch (err) {}
        }
      }}
      class="relative w-full rounded-2xl border border-[#2a2a2a] hover:border-indigo-500/50 bg-[#121212] overflow-hidden transition-colors"
      style="height: {Math.max(plannerStore.activeSession.durationMinutes * PIXELS_PER_MINUTE, 300)}px;"
    >
      <!-- Background 1-hour slots -->
      <div class="absolute inset-0 pointer-events-none flex flex-col">
        {#each Array(Math.ceil(plannerStore.activeSession.durationMinutes / 60)) as _, i}
          <div class="w-full border-b border-[#242424]" style="height: {60 * PIXELS_PER_MINUTE}px;">
            <span class="text-[10px] text-zinc-600 font-bold ml-2 mt-1 block tracking-wider uppercase">Slot {i + 1} (1h)</span>
          </div>
        {/each}
      </div>

      {#if plannerStore.timelineBlocks.length === 0}
        <div class="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-3">
          <CheckSquare size={32} class="opacity-30" />
          <span class="text-sm font-medium bg-[#121212] px-3 py-1">Drag tasks here to build your session</span>
        </div>
      {/if}

      <div class="flex flex-col relative z-10 w-full h-full">
        {#each plannerStore.timelineBlocks as block}
          <div 
            class="w-full px-3 py-1.5 flex flex-col justify-between transition-all group relative overflow-hidden
              {block.isOverflow ? 'bg-orange-950/20 border-b border-orange-500/50' : 'bg-[#1c1c1c]/90 border-b border-[#2b2b2b] hover:bg-[#222]'}"
            style="height: {block.durationMinutes * PIXELS_PER_MINUTE}px;"
          >
            <!-- Left accent color bar -->
            <div 
              class="absolute left-0 top-0 bottom-0 w-1 {block.isOverflow ? 'bg-orange-500' : ''}" 
              style={!block.isOverflow && block.type === 'calendar_event' ? `background-color: ${block.colorHex || '#3b82f6'};` : ''}
            ></div>

            <div class="flex items-start justify-between pl-2">
              <div class="flex flex-col gap-0.5 truncate">
                <span class="text-sm font-bold text-zinc-100 truncate">{block.title}</span>
                <div class="flex items-center gap-2 text-[10px] text-zinc-500 font-medium">
                  <div class="flex items-center gap-1">
                    <Clock size={10} />
                    <span>{block.durationMinutes}m</span>
                  </div>
                  <span class="text-zinc-700">•</span>
                  <span>{format(parseISO(block.calculatedStart), 'h:mm a')} - {format(parseISO(block.calculatedEnd), 'h:mm a')}</span>
                </div>
              </div>

              <button 
                onclick={() => plannerStore.removeBlockFromTimeline(block.id)}
                class="opacity-0 group-hover:opacity-100 p-1 text-rose-400/70 hover:text-rose-400 hover:bg-rose-400/10 rounded transition-all cursor-pointer"
                title="Remove from session"
              >
                <X size={14} strokeWidth={2.5} />
              </button>
            </div>
            
            {#if block.isOverflow}
              <div class="pl-2 text-[10px] font-bold text-orange-400 uppercase tracking-wider mt-auto">
                Pushed into overflow
              </div>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>