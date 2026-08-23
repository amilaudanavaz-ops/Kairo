<script lang="ts">
  import { Plus, Clock } from 'lucide-svelte';
  import { plannerStore } from '../../stores/plannerStore.svelte';

  let title = $state('');
  let duration = $state(30); // Default to 30 minutes

  async function handleAddTask() {
    if (!title.trim()) return;
    await plannerStore.createCustomTask(title.trim(), duration);
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
    <div class="flex items-center gap-1.5 bg-[#252525] rounded-xl px-3 py-1.5 border border-[#333333]">
      <Clock size={14} class="text-zinc-400" />
      <select 
        bind:value={duration} 
        class="bg-transparent text-xs font-semibold text-zinc-200 outline-none cursor-pointer"
      >
        <option value={15}>15 min</option>
        <option value={30}>30 min</option>
        <option value={45}>45 min</option>
        <option value={60}>1 hour</option>
        <option value={90}>1.5 hrs</option>
        <option value={120}>2 hrs</option>
      </select>
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