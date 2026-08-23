<script lang="ts">
  import { Plus, Clock } from 'lucide-svelte';
  import { plannerStore } from '../../stores/plannerStore.svelte';

  let title = $state('');
  let durationText = $state('30m'); 
  let parsedDuration = $state(30);

  function formatDurationDisplay(minutes: number) {
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
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

  function handleDurationBlur() {
    const val = parseDurationString(durationText);
    if (val && val > 0) {
      parsedDuration = val;
      durationText = formatDurationDisplay(val);
    } else {
      durationText = formatDurationDisplay(parsedDuration); // Revert to last valid
    }
  }

  async function handleAddTask() {
    if (!title.trim()) return;
    handleDurationBlur(); // Ensure format is parsed
    await plannerStore.createCustomTask(title.trim(), parsedDuration);
    title = '';
  }
</script>

<div class="absolute bottom-6 left-1/2 -translate-x-1/2 w-[600px] bg-[#1a1a1a] border border-[#2e2e2e] rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.8)] flex items-center p-1.5 z-50">
  <input 
    type="text" 
    placeholder="What do you need to get done?" 
    bind:value={title}
    onkeydown={(e) => e.key === 'Enter' && handleAddTask()}
    class="flex-1 bg-transparent border-none outline-none text-sm text-zinc-100 placeholder-zinc-500 px-4 py-2"
  />
  
  <div class="flex items-center gap-2 pr-1">
    <div class="flex items-center gap-1.5 bg-[#252525] rounded-xl px-3 py-1.5 border border-[#333333] transition-colors focus-within:border-indigo-500">
      <Clock size={14} class="text-zinc-400" />
      <input 
        type="text"
        bind:value={durationText}
        onblur={handleDurationBlur}
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
            handleAddTask();
          }
        }}
        class="w-16 bg-transparent text-xs font-semibold text-zinc-200 outline-none cursor-text placeholder-zinc-500"
        placeholder="30m"
        title="Enter minutes (e.g. 80) or hours (e.g. 1h 20m)"
      />
    </div>
    
    <button 
      onclick={handleAddTask}
      disabled={!title.trim()}
      class="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-all shadow-md cursor-pointer"
    >
      <Plus size={18} strokeWidth={3} />
    </button>
  </div>
</div>