<script lang="ts">
  import MiniCalendar from './MiniCalendar.svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { Plus, Eye, EyeOff, Link2 } from 'lucide-svelte';

  function handleToggleVisibility(e: MouseEvent, calId: string) {
    e.stopPropagation();
    calendarState.toggleCalendarVisibility(calId);
  }
</script>

<aside class="w-56 bg-[#161616] border-r border-[#242424] flex flex-col justify-between shrink-0 select-none">
  <div class="p-3 flex flex-col gap-4 overflow-y-auto">
    <MiniCalendar />

    <div class="h-[1px] bg-[#242424] -mx-1"></div>

    <!-- Calendars List -->
    <div>
      <div class="flex items-center justify-between text-[11px] font-bold text-zinc-400 px-1 mb-2 tracking-wide uppercase">
        <span>Calendars</span>
        <button 
          onclick={() => calendarState.openAddAccountModal()}
          class="p-1 hover:text-zinc-100 hover:bg-[#242424] rounded"
          title="Add Calendar Account"
        >
          <Plus size={13} />
        </button>
      </div>

      <div class="flex flex-col gap-1">
        {#each calendarState.calendars as cal (cal.id)}
          <div 
            class="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#202020] transition-colors group cursor-pointer
              {cal.isVisible ? 'opacity-100' : 'opacity-40'}"
            onclick={(e) => handleToggleVisibility(e, cal.id)}
            role="button"
            tabindex="0"
            onkeydown={(e) => e.key === 'Enter' && handleToggleVisibility(e as any, cal.id)}
          >
            <div class="flex items-center gap-2 truncate">
              <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {cal.colorHex};"></span>
              <span class="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 truncate">
                {cal.name}
              </span>
            </div>

            <!-- Eye Icon Toggle -->
            <button 
              onclick={(e) => handleToggleVisibility(e, cal.id)}
              class="text-zinc-500 hover:text-zinc-200 p-0.5 rounded transition-colors"
              title={cal.isVisible ? "Hide calendar" : "Show calendar"}
            >
              {#if cal.isVisible}
                <Eye size={13} />
              {:else}
                <EyeOff size={13} class="text-zinc-500" />
              {/if}
            </button>
          </div>
        {/each}
      </div>
    </div>
  </div>

  <!-- Bottom Add Account Trigger -->
  <div class="p-3 border-t border-[#242424] bg-[#141414]">
    <button 
      onclick={() => calendarState.openAddAccountModal()}
      class="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-[#202020] hover:bg-[#282828] border border-[#2d2d2d] text-zinc-200 rounded-md text-xs font-medium transition-colors cursor-pointer"
    >
      <Link2 size={14} />
      <span>Add Google Account</span>
    </button>
  </div>
</aside>