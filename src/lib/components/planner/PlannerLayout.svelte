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
    if (days === 0) {
      plannerStore.activeDateKey = format(new Date(), 'yyyy-MM-dd');
    } else {
      const current = parseISO(plannerStore.activeDateKey);
      const next = addDays(current, days);
      plannerStore.activeDateKey = format(next, 'yyyy-MM-dd');
    }
  }

  function handleDurationChange(e: Event) {
    const val = parseInt((e.target as HTMLInputElement).value, 10);
    if (!isNaN(val) && val > 0) {
      plannerStore.updateSessionDuration(val);
    }
  }
</script>

<div class="w-full h-full flex bg-[#111111] relative overflow-hidden font-sans text-zinc-200">
  
  {#if !plannerStore.isExecutionMode}
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
              <select 
                value={plannerStore.activeSession.durationMinutes} 
                onchange={handleDurationChange}
                class="bg-[#181818] border border-[#2a2a2a] text-zinc-200 text-[13px] font-medium rounded-md px-3 py-1.5 outline-none cursor-pointer hover:border-[#444] transition-colors"
              >
                <option value={60}>1 Hour</option>
                <option value={120}>2 Hours</option>
                <option value={180}>3 Hours</option>
                <option value={240}>4 Hours</option>
                <option value={300}>5 Hours</option>
                <option value={360}>6 Hours</option>
                <option value={420}>7 Hours</option>
                <option value={480}>8 Hours</option>
              </select>
            </div>
            
            <button 
              onclick={() => plannerStore.startSession()}
              disabled={plannerStore.timelineBlocks.length === 0}
              class="flex items-center gap-2 px-5 py-1.5 bg-[#5b5fdb] hover:bg-[#6c70ed] text-white text-[13px] font-semibold rounded-md transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>Start Session</span>
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

    <!-- SIDEBAR ON RIGHT -->
    <PlannerSidebar />

  {:else}
    <!-- EXECUTION MODE -->
    <ExecutionHud />
    <OverflowManager />
  {/if}

</div>