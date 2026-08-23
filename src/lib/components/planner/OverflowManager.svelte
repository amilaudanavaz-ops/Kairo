<script lang="ts">
  import { X, ArrowUpRight, GripVertical, ListOrdered } from 'lucide-svelte';
  import { plannerStore } from '../../stores/plannerStore.svelte';

  let draggedIndex = $state<number | null>(null);
  let dragOverIndex = $state<number | null>(null);

  // Calculate the running total to find which tasks cross the capacity boundary
  let sessionTasks = $derived.by(() => {
    if (!plannerStore.activeSession) return [];
    
    const capacity = plannerStore.activeSession.durationMinutes;
    let runningTotal = 0;

    return plannerStore.executionSequence.map((seq, index) => {
      const start = runningTotal;
      runningTotal += seq.durationMinutes;
      const overflowAmount = Math.max(0, runningTotal - capacity);
      
      return {
        ...seq,
        index,
        isOverflow: overflowAmount > 0,
        overflowAmount: Math.min(seq.durationMinutes, overflowAmount)
      };
    });
  });
</script>

{#if plannerStore.isOverflowManagerOpen && plannerStore.activeSession}
  <div class="fixed inset-y-0 right-0 w-96 bg-[#161616] border-l border-[#2e2e2e] shadow-2xl z-[250] flex flex-col animate-in slide-in-from-right duration-200">
    
    <!-- Header -->
    <div class="flex items-center justify-between p-4 border-b border-[#2e2e2e]">
      <div class="flex items-center gap-2 text-indigo-400">
        <ListOrdered size={18} />
        <h2 class="text-sm font-bold">Session Tasks</h2>
      </div>
      <button 
        onclick={() => plannerStore.isOverflowManagerOpen = false}
        class="p-1 text-zinc-500 hover:text-white hover:bg-[#2a2a2a] rounded cursor-pointer transition-colors"
      >
        <X size={16} />
      </button>
    </div>

    <!-- Description -->
    <div class="p-4 bg-indigo-950/20 border-b border-indigo-900/30">
      <p class="text-xs text-indigo-200/80 leading-relaxed">
        Drag to reorder your execution sequence. Your timeline capacity is <span class="font-bold text-indigo-400">{plannerStore.activeSession.durationMinutes / 60}-hours</span>.
      </p>
    </div>

    <!-- Draggable Task List -->
    <div class="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
      {#if sessionTasks.length === 0}
        <div class="text-center text-xs text-zinc-500 mt-10">No tasks in this session yet.</div>
      {/if}

      {#each sessionTasks as task (task.id)}
        <div 
          draggable="true"
          style="-webkit-app-region: no-drag;"
          ondragstart={(e) => {
            draggedIndex = task.index;
            if (e.dataTransfer) {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', task.index.toString());
            }
          }}
          ondragover={(e) => {
            e.preventDefault();
            dragOverIndex = task.index;
          }}
          ondragleave={() => { dragOverIndex = null; }}
          ondrop={async (e) => {
            e.preventDefault();
            dragOverIndex = null;
            if (draggedIndex !== null && draggedIndex !== task.index) {
              await plannerStore.reorderTimeline(draggedIndex, task.index);
            }
            draggedIndex = null;
          }}
          class="bg-[#1c1c1c] border {task.isOverflow ? 'border-orange-500/50' : 'border-[#333] hover:border-[#555]'} rounded-xl p-3 flex flex-col gap-3 cursor-grab active:cursor-grabbing transition-all {dragOverIndex === task.index ? 'border-t-2 border-t-indigo-500 -mt-0.5' : ''} {draggedIndex === task.index ? 'opacity-50' : ''}"
        >
          <!-- Task Info -->
          <div class="flex items-start gap-3">
            <GripVertical size={16} class="text-zinc-600 mt-0.5 shrink-0" />
            <div class="flex flex-col gap-0.5 min-w-0 flex-1">
              <span class="text-sm font-bold text-zinc-100 truncate">{task.title}</span>
              <span class="text-xs text-zinc-500">{task.durationMinutes}m duration</span>
            </div>
          </div>

          <!-- Overflow Details (if applicable) -->
          {#if task.isOverflow}
            <div class="flex items-center justify-between bg-orange-950/30 rounded-lg p-2 border border-orange-900/50 ml-7">
              <span class="text-xs font-bold text-orange-400">{task.overflowAmount}m in overflow</span>
              <button 
                onclick={(e) => { e.stopPropagation(); plannerStore.bounceOverflow(task.id, task.overflowAmount); }}
                class="flex items-center gap-1.5 px-2 py-1 bg-[#252525] hover:bg-[#333] text-xs font-semibold text-zinc-300 rounded transition-colors cursor-pointer"
              >
                <ArrowUpRight size={12} class="text-indigo-400" />
                <span>Bounce Back</span>
              </button>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>
{/if}