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

  function changeDate(days: number) {
    const current = parseISO(plannerStore.activeDateKey);
    const next = addDays(current, days);
    plannerStore.activeDateKey = format(next, 'yyyy-MM-dd');
  }

  function handleDurationChange(e: Event) {
    const val = parseInt((e.target as HTMLSelectElement).value, 10);
    plannerStore.updateSessionDuration(val);
  }
</script>

<div class="w-full h-full flex bg-[#0d1017] relative overflow-hidden font-sans text-zinc-200">
  
  {#if !plannerStore.isExecutionMode}
    <!-- SIDEBAR ON LEFT -->
    <PlannerSidebar />

    <!-- MAIN CANVAS ON RIGHT -->
    <main class="flex-1 flex flex-col relative h-full min-w-0">
      
      <!-- Session Header -->
      <header class="h-24 shrink-0 flex items-center justify-between px-10 border-b border-white/5">
        <div class="flex items-center gap-6">
          <h1 class="text-3xl font-black text-[#5c8cff] tracking-tight">Session Plan</h1>
          
          <div class="flex items-center gap-2 bg-[#141820] border border-white/5 rounded-xl px-2 py-1.5">
            <button onclick={() => changeDate(-1)} class="p-1 text-zinc-500 hover:text-zinc-200 transition-colors"><ChevronLeft size={16} /></button>
            <div class="px-3 text-sm font-bold text-zinc-200 min-w-[120px] text-center">
              {format(parseISO(plannerStore.activeDateKey), 'dd/MM/yyyy')}
            </div>
            <button onclick={() => changeDate(1)} class="p-1 text-zinc-500 hover:text-zinc-200 transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>

        <div class="flex items-center gap-4">
          {#if plannerStore.activeSession}
            <div class="flex items-center gap-3 bg-[#141820] border border-white/5 rounded-full px-4 py-2">
              <span class="text-sm font-medium text-zinc-400">Dur</span>
              <select value={plannerStore.activeSession.durationMinutes} onchange={handleDurationChange} class="bg-transparent text-sm font-bold text-white outline-none cursor-pointer text-center appearance-none">
                <option value={60}>1</option>
                <option value={120}>2</option>
                <option value={180}>3</option>
                <option value={240}>4</option>
                <option value={300}>5</option>
                <option value={360}>6</option>
                <option value={420}>7</option>
                <option value={480}>8</option>
              </select>
              <span class="text-sm font-medium text-zinc-400">Hr</span>
            </div>
            
            <button 
              onclick={() => plannerStore.startSession()}
              disabled={plannerStore.timelineBlocks.length === 0}
              class="flex items-center gap-2 px-6 py-2.5 bg-[#5c8cff] hover:bg-[#4a7aeb] text-white text-sm font-bold rounded-full transition-colors cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Start Focus</span>
              <Play size={14} fill="currentColor" />
            </button>
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

  {:else}
    <!-- EXECUTION MODE -->
    <ExecutionHud />
    <OverflowManager />
  {/if}

</div>