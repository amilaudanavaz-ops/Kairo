<script lang="ts">
  import { Trash2, CheckSquare } from 'lucide-svelte';
  import { plannerStore } from '../../stores/plannerStore.svelte';
  import { format } from 'date-fns';
  import { onMount, onDestroy } from 'svelte';

  const PIXELS_PER_MINUTE = 2; 

  // Live Ticking Clock for Labels
  let liveTime = $state(new Date());
  let timer: ReturnType<typeof setInterval>;

  onMount(() => {
    timer = setInterval(() => { liveTime = new Date(); }, 60000); // Update every minute
  });
  
  onDestroy(() => {
    if (timer) clearInterval(timer);
  });

  // Calculate dynamic hour labels starting from NOW
  function getSlotTime(slotIndex: number) {
    const d = new Date(liveTime);
    d.setHours(d.getHours() + slotIndex);
    return format(d, 'HH:mm');
  }

  // NATIVE DOM ACTION: Bypasses Svelte's event delegation to fix Tauri/WebView2 OS intercepts
  function dropZone(node: HTMLElement, slotIndex: number) {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      node.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
    };
    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      node.style.backgroundColor = '';
    };
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault(); // Synchronous native preventDefault required by WebView2
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    };
    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      node.style.backgroundColor = '';
      
      // Read directly from the global bypass
      const data = (window as any).__kflowDragPayload;
      console.log(`[Timeline] 📥 DROP detected in Slot ${slotIndex}! Payload:`, data);
      
      if (data) {
        try {
          if (data.type === 'timeline') {
            plannerStore.moveBlockToSlot(data.id, data.sourceSlot, slotIndex);
          } else if (data.type === 'inbox') {
            const block = plannerStore.inboxBlocks.find(b => b.id === data.id);
            if (block) plannerStore.addBlockToTimeline(block, slotIndex);
          }
        } catch (err) {
          console.error("[Timeline] 💥 Drop processing error:", err);
        }
      } else {
        console.warn('[Timeline] ⚠️ No drag payload found in global state!');
      }
      
      (window as any).__kflowDragPayload = null;
    };

    node.addEventListener('dragenter', handleDragEnter);
    node.addEventListener('dragleave', handleDragLeave);
    node.addEventListener('dragover', handleDragOver);
    node.addEventListener('drop', handleDrop);

    return {
      destroy() {
        node.removeEventListener('dragenter', handleDragEnter);
        node.removeEventListener('dragleave', handleDragLeave);
        node.removeEventListener('dragover', handleDragOver);
        node.removeEventListener('drop', handleDrop);
      }
    };
  }
</script>

<div class="w-full max-w-5xl mx-auto mt-6 mb-32 flex gap-8 select-none relative">
  {#if plannerStore.activeSession}
    
    <!-- Header Capacity Badge -->
    <div class="absolute -top-8 right-0 text-[10px] font-semibold bg-[#222] border border-[#333] px-2 py-1 rounded text-zinc-300">
      Capacity: {plannerStore.activeSession.durationMinutes / 60} hrs
    </div>
    <div class="absolute -top-8 left-16 text-[10px] font-bold tracking-widest uppercase text-zinc-500">
      Session Canvas
    </div>

    <!-- LEFT AXIS (Live Time) matching the screenshot -->
    <div class="w-16 shrink-0 flex flex-col border-r border-[#1e1e1e] relative pt-2">
      {#each Array(Math.ceil(plannerStore.activeSession.durationMinutes / 60)) as _, i}
        <div class="relative w-full flex justify-end pr-3" style="height: {60 * PIXELS_PER_MINUTE}px;">
          <span class="text-xs font-bold text-zinc-400 mt-[-8px]">{getSlotTime(i)}</span>
          <!-- The Circle on the axis line -->
          <div class="absolute -right-[5px] top-[-4px] w-[9px] h-[9px] rounded-full border-2 border-[#1e1e1e] bg-[#111111]"></div>
        </div>
      {/each}
    </div>

    <!-- RIGHT CANVAS (1-Hour Slot Drop Zones) -->
    <div class="flex-1 flex flex-col relative pt-2 z-10">
      {#if plannerStore.timelineBlocks.length === 0}
        <div class="absolute inset-0 flex flex-col items-center justify-center text-zinc-600 gap-4 border-2 border-dashed border-[#222] rounded-2xl m-2 pointer-events-none -z-10">
          <CheckSquare size={32} class="opacity-30" />
          <span class="text-sm font-medium">Drag tasks here to build your session</span>
        </div>
      {/if}

      {#each Array.from({ length: Math.ceil(plannerStore.activeSession.durationMinutes / 60) }) as _, i}
        <div 
          data-drop-slot={i}
          class="w-full relative border-b border-[#1e1e1e] bg-[rgba(255,255,255,0.01)] hover:bg-white/5 transition-colors flex flex-col gap-1.5 p-2"
          style="height: {60 * PIXELS_PER_MINUTE}px;"
        >
          <!-- Render blocks specifically assigned to this slot -->
          {#each plannerStore.timelineBlocks.filter(b => b.slotIndex === i) as block}
            <div 
              onpointerdown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                e.preventDefault();
                plannerStore.startDrag({ type: 'timeline', id: block.id, sourceSlot: i });
              }}
              class="w-full px-3 py-1.5 flex items-center justify-between bg-[#1a1a1a]/90 border border-[#333] hover:border-[#555] rounded-lg cursor-grab group shadow-md select-none {plannerStore.isDragging && plannerStore.dragPayload?.id === block.id ? 'opacity-40 ring-2 ring-indigo-500' : ''}"
              style="height: {(block.durationMinutes / 60) * 100}%; min-height: 32px;"
            >
              <div class="flex flex-col truncate">
                <span class="text-sm font-bold text-zinc-100 truncate">{block.title}</span>
                <span class="text-[10px] text-zinc-500 font-medium">{block.durationMinutes}m</span>
              </div>
              <button 
                onclick={() => plannerStore.removeBlockFromTimeline(block.id)}
                class="opacity-0 group-hover:opacity-100 p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-400/10 rounded transition-all cursor-pointer"
                title="Remove from timeline"
              >
                <Trash2 size={14} strokeWidth={2.5} />
              </button>
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>