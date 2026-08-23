
<script lang="ts">
  import { X, ArrowUpRight, AlertTriangle } from 'lucide-svelte';
  import { plannerStore } from '../../stores/plannerStore.svelte';

  // Calculate exactly which tasks cross the capacity boundary
  let overflowDetails = $derived.by(() => {
    if (!plannerStore.activeSession) return [];
    
    const capacity = plannerStore.activeSession.durationMinutes;
    let runningTotal = 0;
    const details = [];

    for (const block of plannerStore.timelineBlocks) {
      const blockStart = runningTotal;
      const blockEnd = runningTotal + block.durationMinutes;
      runningTotal += block.durationMinutes;

      if (blockEnd > capacity) {
        // Find exactly how many minutes of this task are past the finish line
        const overflowAmount = Math.min(block.durationMinutes, blockEnd - capacity);
        details.push({
          block,
          overflowAmount
        });
      }
    }
    return details;
  });
</script>

{#if plannerStore.isOverflowManagerOpen && plannerStore.activeSession}
  <div class="fixed inset-y-0 right-0 w-96 bg-[#161616] border-l border-[#2e2e2e] shadow-2xl z-[150] flex flex-col animate-in slide-in-from-right duration-200">
    <div class="flex items-center justify-between p-4 border-b border-[#2e2e2e]">
      <div class="flex items-center gap-2 text-orange-400">
        <AlertTriangle size={18} />
        <h2 class="text-sm font-bold">Overflow Manager</h2>
      </div>
      <button 
        onclick={() => plannerStore.isOverflowManagerOpen = false}
        class="p-1 text-zinc-500 hover:text-white hover:bg-[#2a2a2a] rounded cursor-pointer transition-colors"
      >
        <X size={16} />
      </button>
    </div>

    <div class="p-4 bg-orange-950/20 border-b border-orange-900/30">
      <p class="text-xs text-orange-200/80 leading-relaxed">
        Your timeline has stretched beyond its original <span class="font-bold text-orange-400">{plannerStore.activeSession.durationMinutes / 60}-hour</span> limit. Review the overflow blocks below.
      </p>
    </div>

    <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
      {#if overflowDetails.length === 0}
        <div class="text-center text-xs text-zinc-500 mt-10">No tasks currently in overflow.</div>
      {/if}

      {#each overflowDetails as detail}
        <div class="bg-[#1c1c1c] border border-orange-500/30 rounded-xl p-3 flex flex-col gap-3">
          <div class="flex flex-col gap-0.5">
            <span class="text-sm font-bold text-zinc-100">{detail.block.title}</span>
            <span class="text-xs text-zinc-500">Total duration: {detail.block.durationMinutes}m</span>
          </div>

          <div class="flex items-center justify-between bg-[#121212] rounded-lg p-2 border border-[#2a2a2a]">
            <span class="text-xs font-bold text-orange-400">{detail.overflowAmount}m in overflow</span>
            <button 
              onclick={() => plannerStore.bounceOverflow(detail.block.id, detail.overflowAmount)}
              class="flex items-center gap-1.5 px-2 py-1 bg-[#252525] hover:bg-[#333] text-xs font-semibold text-zinc-300 rounded transition-colors cursor-pointer"
            >
              <ArrowUpRight size={12} class="text-indigo-400" />
              <span>Bounce Back</span>
            </button>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}