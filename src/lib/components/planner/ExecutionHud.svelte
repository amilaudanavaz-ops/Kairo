<script lang="ts">
  import { plannerStore } from '../../stores/plannerStore.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { Check, Plus, Timer, FastForward, Pause, Play, Square, LayoutDashboard } from 'lucide-svelte';
  import { onDestroy } from 'svelte';

  let decisionCountdown = $state(15);
  let decisionInterval: number | undefined;

  // Reactively monitor the timer to trigger the 5-second decision overlay
  $effect(() => {
    if (plannerStore.isExecutionMode && plannerStore.timerRemainingSeconds <= 0 && !plannerStore.isOvertime) {
      if (!decisionInterval) {
        decisionCountdown = 15;
        decisionInterval = window.setInterval(() => {
          decisionCountdown--;
          if (decisionCountdown <= 0) {
            clearDecisionTimer();
            plannerStore.completeCurrentTask(); // Auto-complete
          }
        }, 1000);
      }
    } else {
      clearDecisionTimer();
    }
  });

  function clearDecisionTimer() {
    if (decisionInterval) {
      clearInterval(decisionInterval);
      decisionInterval = undefined;
    }
  }

  onDestroy(() => {
    clearDecisionTimer();
  });

  let formattedTime = $derived.by(() => {
    const totalSeconds = Math.abs(plannerStore.timerRemainingSeconds);
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    
    const pad = (num: number) => num.toString().padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  });

  let activeBlock = $derived(plannerStore.timelineBlocks.find(b => b.id === plannerStore.activeBlockId));
  let isDecisionTime = $derived(plannerStore.timerRemainingSeconds <= 0 && !plannerStore.isOvertime);
</script>

{#if plannerStore.isExecutionMode && activeBlock}
  <div class="fixed inset-0 z-[200] bg-[#0a0a0a]/95 backdrop-blur-md flex flex-col select-none animate-in fade-in duration-300">
    
    <!-- HUD Header -->
    <header class="w-full flex items-center justify-between p-6 absolute top-0 left-0">
      <div class="flex items-center gap-3">
        <button 
          onclick={() => {
            calendarState.setAppMode('calendar');
          }}
          class="px-4 py-2 bg-[#222] hover:bg-[#2a2a2a] border border-[#333] text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer"
        >
          ← Back to Calendar
        </button>
        <button 
          onclick={() => plannerStore.isHudMinimized = true}
          class="px-4 py-2 bg-[#222] hover:bg-[#2a2a2a] border border-[#333] text-zinc-300 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-2"
        >
          <LayoutDashboard size={14} class="text-indigo-400" />
          View Planner Canvas
        </button>
      </div>

      <div class="flex items-center gap-3">
        <button 
          onclick={() => plannerStore.stopSession()}
          class="p-2.5 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 rounded-xl transition-all cursor-pointer"
          title="End Session"
        >
          <Square size={16} fill="currentColor" />
        </button>
        <button 
          onclick={() => plannerStore.isOverflowManagerOpen = true}
          class="px-4 py-2.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/50 text-indigo-400 text-xs font-bold rounded-xl transition-all cursor-pointer"
        >
          Session Tasks
        </button>
      </div>
    </header>
    <!-- Main Content Centered -->
    <div class="flex-1 flex flex-col items-center justify-center w-full">
      <div class="flex flex-col items-center gap-6 max-w-xl w-full px-6">
      
      <!-- Status Badge -->
      {#if plannerStore.isOvertime}
        <div class="px-3 py-1 bg-orange-500/20 border border-orange-500/50 text-orange-400 text-[10px] font-black tracking-widest uppercase rounded-full animate-pulse">
          Overtime Tracking
        </div>
      {:else if isDecisionTime}
        <div class="px-3 py-1 bg-rose-500/20 border border-rose-500/50 text-rose-400 text-[10px] font-black tracking-widest uppercase rounded-full">
          Time's Up
        </div>
      {:else}
        <div class="px-3 py-1 bg-indigo-500/20 border border-indigo-500/50 text-indigo-400 text-[10px] font-black tracking-widest uppercase rounded-full">
          In Flow
        </div>
      {/if}

      <!-- Task Title -->
      <h1 class="text-4xl font-black text-white text-center tracking-tight leading-tight">
        {activeBlock.title}
      </h1>

      <!-- Massive Timer -->
      <div class="text-[120px] font-black tracking-tighter tabular-nums leading-none {plannerStore.isPaused ? 'text-amber-500 opacity-50' : plannerStore.isOvertime ? 'text-orange-500' : isDecisionTime ? 'text-rose-500' : 'text-zinc-100'} drop-shadow-2xl transition-all">
        {plannerStore.isOvertime ? '+' : ''}{formattedTime}
      </div>

      <!-- Controls -->
      {#if isDecisionTime}
        <!-- The 5-Second Decision Overlay -->
        <div class="flex flex-col items-center gap-4 mt-8 w-full animate-in slide-in-from-bottom-4 duration-300">
          <div class="text-xs font-bold text-zinc-500 uppercase tracking-widest">
            Auto-completing in {decisionCountdown}s
          </div>
          <div class="flex items-center gap-4 w-full justify-center">
            <button 
              onclick={() => plannerStore.triggerOvertime()}
              class="flex-1 max-w-[140px] py-4 bg-[#222] hover:bg-[#2a2a2a] border border-[#333] rounded-2xl flex flex-col items-center gap-2 transition-all cursor-pointer"
            >
              <Timer size={20} class="text-orange-400" />
              <span class="text-xs font-bold text-zinc-300">Overtime</span>
            </button>

            <button 
              onclick={() => { clearDecisionTimer(); plannerStore.completeCurrentTask(); }}
              class="flex-1 max-w-[160px] py-4 bg-emerald-600 hover:bg-emerald-500 rounded-2xl flex flex-col items-center gap-2 transition-all shadow-[0_0_30px_rgba(16,185,129,0.3)] cursor-pointer"
            >
              <Check size={24} class="text-white" strokeWidth={3} />
              <span class="text-xs font-black text-white">Complete</span>
            </button>

            <button 
              onclick={() => plannerStore.add15MinutesToCurrent()}
              class="flex-1 max-w-[140px] py-4 bg-[#222] hover:bg-[#2a2a2a] border border-[#333] rounded-2xl flex flex-col items-center gap-2 transition-all cursor-pointer"
            >
              <Plus size={20} class="text-indigo-400" />
              <span class="text-xs font-bold text-zinc-300">+15 Mins</span>
            </button>
          </div>
        </div>
      {:else}
        <!-- Standard Active Controls -->
        <div class="flex items-center gap-4 mt-8">
          <button 
            onclick={() => plannerStore.togglePause()}
            class="px-5 py-3 bg-[#222] hover:bg-[#2a2a2a] border border-[#333] {plannerStore.isPaused ? 'text-amber-400' : 'text-zinc-300'} text-sm font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer w-[120px] justify-center"
          >
            {#if plannerStore.isPaused}
              <Play size={16} fill="currentColor" /> Resume
            {:else}
              <Pause size={16} fill="currentColor" /> Pause
            {/if}
          </button>

          <button 
            onclick={() => plannerStore.add15MinutesToCurrent()}
            disabled={plannerStore.isOvertime}
            class="px-5 py-3 bg-[#222] hover:bg-[#2a2a2a] border border-[#333] text-zinc-300 text-sm font-bold rounded-xl flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={16} class={plannerStore.isOvertime ? "text-zinc-500" : "text-indigo-400"} />
            +15 Mins
          </button>

          <button 
            onclick={() => plannerStore.completeCurrentTask()}
            class="px-8 py-3 bg-zinc-100 hover:bg-white text-black text-sm font-black rounded-xl flex items-center gap-2 transition-all cursor-pointer shadow-lg"
          >
            <FastForward size={16} />
            {plannerStore.isOvertime ? 'Lock In & Next' : 'Finish Early'}
          </button>
        </div>
      {/if}
      
    </div>
    </div>
  </div>
{/if}