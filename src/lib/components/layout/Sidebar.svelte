<script lang="ts">
  import { calendarState } from '../../stores/calendarState.svelte';
  import { 
    Plus, 
    Calendar as CalendarIcon, 
    Eye, 
    EyeOff,
    Link2
  } from 'lucide-svelte';
</script>

<aside 
  class="w-60 bg-[#161616] border-r border-[#242424] flex flex-col justify-between shrink-0 select-none transition-all duration-200"
>
  <div class="p-3 flex flex-col gap-4 overflow-y-auto">
    <!-- Mini Navigation Card -->
    <div class="bg-[#1c1c1c] border border-[#262626] rounded-lg p-2.5 text-center">
      <div class="flex items-center justify-between text-xs text-zinc-400 font-medium mb-2">
        <span>Quick Jump</span>
        <button 
          onclick={() => calendarState.setToday()} 
          class="hover:text-zinc-100 text-[11px] underline"
        >
          Reset
        </button>
      </div>
      <div class="text-xs text-zinc-500 py-4 border border-dashed border-[#2d2d2d] rounded bg-[#181818]">
        Mini-Calendar Picker
      </div>
    </div>

    <!-- Calendar Categories & Accounts -->
    <div>
      <div class="flex items-center justify-between text-xs font-semibold text-zinc-400 px-1 mb-2 tracking-wide uppercase">
        <span>Calendars</span>
        <button class="p-1 hover:text-zinc-100 hover:bg-[#242424] rounded">
          <Plus size={14} />
        </button>
      </div>

      <div class="flex flex-col gap-1">
        {#each calendarState.calendars as cal (cal.id)}
          <button 
            onclick={() => calendarState.toggleCalendarVisibility(cal.id)}
            class="flex items-center justify-between px-2 py-1.5 rounded-md hover:bg-[#202020] transition-colors text-left group"
          >
            <div class="flex items-center gap-2.5 truncate">
              <!-- Notion-style Color Chip -->
              <span 
                class="w-2.5 h-2.5 rounded-full shrink-0" 
                style="background-color: {cal.colorHex};"
              ></span>
              <span class="text-xs font-medium text-zinc-300 group-hover:text-zinc-100 truncate">
                {cal.name}
              </span>
            </div>

            <div class="text-zinc-500 group-hover:text-zinc-300">
              {#if cal.isVisible}
                <Eye size={13} />
              {:else}
                <EyeOff size={13} class="text-zinc-600" />
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Bottom Google Integration Footer -->
  <div class="p-3 border-t border-[#242424] bg-[#141414]">
    <button 
      class="w-full flex items-center justify-center gap-2 py-1.5 px-3 bg-[#202020] hover:bg-[#282828] border border-[#2d2d2d] text-zinc-200 rounded-md text-xs font-medium transition-colors"
    >
      <Link2 size={14} />
      <span>Add Google Account</span>
    </button>
  </div>
</aside>