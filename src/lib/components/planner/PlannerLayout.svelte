<script lang="ts">
  import { format, parseISO, addDays, setHours, setMinutes } from 'date-fns';
  import { ChevronLeft, ChevronRight, Play } from 'lucide-svelte';
  import { plannerStore } from '../../stores/plannerStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import PlannerSidebar from './PlannerSidebar.svelte';
  import TaskFloatingBar from './TaskFloatingBar.svelte';
  import PlannerTimeline from './PlannerTimeline.svelte';
  import ExecutionHud from './ExecutionHud.svelte';
  import OverflowManager from './OverflowManager.svelte';

  $effect(() => {
    plannerStore.init(plannerStore.activeDateKey);
  });

  // THE MAGIC BULLET: Global drop tracking using coordinate piercing
  $effect(() => {
    const handlePointerUp = (e: PointerEvent) => {
      if (!plannerStore.isDragging || !plannerStore.dragPayload) return;

      // 1. Find all elements exactly under the mouse release coordinates
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      
      // 2. See if one of those elements is a timeline slot
      const slotEl = elements.find(el => el.hasAttribute('data-drop-slot'));

      if (slotEl) {
        const targetSlot = parseInt(slotEl.getAttribute('data-drop-slot')!, 10);
        const data = plannerStore.dragPayload;
        
        console.log(`[Layout] 📥 POINTER DROP on Slot ${targetSlot}! Payload:`, data);
        
        if (data.type === 'timeline') {
          plannerStore.moveBlockToSlot(data.id, data.sourceSlot!, targetSlot);
        } else if (data.type === 'inbox') {
          const block = plannerStore.inboxBlocks.find(b => b.id === data.id);
          if (block) plannerStore.addBlockToTimeline(block, targetSlot);
        }
      }

      // 3. Clear drag state
      plannerStore.clearDrag();
    };

    window.addEventListener('pointerup', handlePointerUp);
    return () => window.removeEventListener('pointerup', handlePointerUp);
  });

  function changeDate(days: number) {
    if (days === 0) {
      plannerStore.activeDateKey = format(new Date(), 'yyyy-MM-dd');
    } else {
      const current = parseISO(plannerStore.activeDateKey);
      const next = addDays(current, days);
      plannerStore.activeDateKey = format(next, 'yyyy-MM-dd');
    }
  }

  function parseDurationString(input: string): number | null {
    const str = input.toLowerCase().trim();
    if (!str) return null;
    let mins = 0;
    const hMatch = str.match(/([0-9.]+)\s*h/);
    const mMatch = str.match(/([0-9.]+)\s*m/);
    if (hMatch || mMatch) {
      if (hMatch) mins += parseFloat(hMatch[1]) * 60;
      if (mMatch) mins += parseFloat(mMatch[1]);
      return Math.round(mins);
    }
    const num = parseInt(str, 10);
    return !isNaN(num) ? num : null;
  }

  function formatDurationDisplay(minutes: number) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }

  function handleDurationChange(e: Event) {
    const target = e.target as HTMLInputElement;
    const val = parseDurationString(target.value);
    if (val && val > 0) {
      plannerStore.updateSessionDuration(val);
      target.value = formatDurationDisplay(val);
    } else if (plannerStore.activeSession) {
      target.value = formatDurationDisplay(plannerStore.activeSession.durationMinutes);
    }
  }
</script>

<div class="w-full h-full flex bg-[#111111] relative overflow-hidden font-sans text-zinc-200">
  
  {#if !plannerStore.isExecutionMode || plannerStore.isHudMinimized}
  
    <!-- MAIN CANVAS ON LEFT -->
    <main class="flex-1 flex flex-col relative h-full min-w-0 border-r border-[#1e1e1e]">
      
      <!-- Session Header -->
      <header class="h-16 shrink-0 flex items-center justify-between px-8 border-b border-[#1e1e1e] bg-[#111111]">
        <div class="flex items-center gap-5">
          <div class="flex items-center bg-[#181818] border border-[#2a2a2a] rounded-md overflow-hidden">
            <button onclick={() => changeDate(-1)} class="px-2.5 py-1.5 text-zinc-400 hover:text-white hover:bg-[#222] transition-colors"><ChevronLeft size={16} /></button>
            <div class="w-px h-4 bg-[#2a2a2a]"></div>
            <button onclick={() => changeDate(0)} class="px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white hover:bg-[#222] transition-colors">Today</button>
            <div class="w-px h-4 bg-[#2a2a2a]"></div>
            <button onclick={() => changeDate(1)} class="px-2.5 py-1.5 text-zinc-400 hover:text-white hover:bg-[#222] transition-colors"><ChevronRight size={16} /></button>
          </div>
          <h1 class="text-[17px] font-bold text-white tracking-wide">
            {format(parseISO(plannerStore.activeDateKey), 'EEEE, MMMM do')}
          </h1>
        </div>

        <div class="flex items-center gap-4">
          {#if plannerStore.activeSession}
            <div class="flex items-center gap-2">
              <span class="text-[13px] font-medium text-zinc-500">Session Duration:</span>
              <div class="flex items-center bg-[#181818] border border-[#2a2a2a] rounded-md overflow-hidden hover:border-[#444] focus-within:border-indigo-500 transition-colors">
                <button 
                  onclick={() => plannerStore.updateSessionDuration(Math.max(60, plannerStore.activeSession!.durationMinutes - 60))}
                  class="px-2 py-1.5 text-zinc-400 hover:text-white hover:bg-[#222] transition-colors font-bold text-xs cursor-pointer"
                  title="Subtract 1 Hour"
                >
                  -1h
                </button>
                <div class="w-px h-4 bg-[#2a2a2a]"></div>
                <input 
                  type="text"
                  value={formatDurationDisplay(plannerStore.activeSession.durationMinutes)} 
                  onblur={handleDurationChange}
                  onkeydown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  class="w-16 bg-transparent text-center text-zinc-200 text-[13px] font-medium outline-none"
                  title="Enter minutes (e.g. 80) or hours (e.g. 1.5h, 1h 20m)"
                />
                <div class="w-px h-4 bg-[#2a2a2a]"></div>
                <button 
                  onclick={() => plannerStore.updateSessionDuration(plannerStore.activeSession!.durationMinutes + 60)}
                  class="px-2 py-1.5 text-zinc-400 hover:text-white hover:bg-[#222] transition-colors font-bold text-xs cursor-pointer"
                  title="Add 1 Hour"
                >
                  +1h
                </button>
              </div>
            </div>
            
            {#if plannerStore.isExecutionMode}
              <button 
                onclick={() => plannerStore.isHudMinimized = false}
                class="flex items-center gap-2 px-5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold rounded-md transition-colors cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
              >
                <span>Return to HUD</span>
              </button>
            {:else}
              <button 
                onclick={() => plannerStore.startSession()}
                disabled={plannerStore.timelineBlocks.length === 0}
                class="flex items-center gap-2 px-5 py-1.5 bg-[#5b5fdb] hover:bg-[#6c70ed] text-white text-[13px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>Start Session</span>
              </button>
            {/if}
          {/if}
        </div>
      </header>

      <!-- Timeline Scroll Area -->
      <div class="flex-1 overflow-y-auto custom-scrollbar relative p-10 flex flex-col">
        <PlannerTimeline />
      </div>

      <!-- Quick Add Bar Centered at Bottom -->
      <TaskFloatingBar />
    </main>

    <!-- SIDEBAR ON RIGHT -->
    <PlannerSidebar />

  {:else}
    <!-- EXECUTION MODE -->
    <ExecutionHud />
    <OverflowManager />
  {/if}

  <!-- Allow viewing Overflow dynamically from Canvas -->
  {#if plannerStore.isExecutionMode && plannerStore.isHudMinimized}
    <OverflowManager />
  {/if}

</div>