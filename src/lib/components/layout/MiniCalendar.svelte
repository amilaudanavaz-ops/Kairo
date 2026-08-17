<script lang="ts">
  import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    isToday,
    addMonths,
    subMonths
  } from 'date-fns';
  import { ChevronLeft, ChevronRight } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';

  let weekDays = $derived.by(() => {
    return settingsStore.startWeekOn === 'Monday'
      ? ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
      : ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  });

  let monthTitle = $derived(format(calendarState.currentDate, 'MMMM yyyy'));

  let days = $derived.by(() => {
    const mStart = startOfMonth(calendarState.currentDate);
    const mEnd = endOfMonth(mStart);
    const weekStartsOn = settingsStore.startWeekOn === 'Monday' ? 1 : 0;
    const cStart = startOfWeek(mStart, { weekStartsOn });
    const cEnd = endOfWeek(mEnd, { weekStartsOn });
    return eachDayOfInterval({ start: cStart, end: cEnd });
  });

  function selectDate(d: Date) {
    calendarState.setDate(d);
  }
</script>

<div class="flex flex-col gap-1.5 select-none shrink-0">
  <div class="flex items-center justify-between px-1 mb-1">
    <span class="text-xs font-semibold text-zinc-200">{monthTitle}</span>
    <div class="flex items-center gap-0.5">
      <button 
        onclick={() => calendarState.setDate(subMonths(calendarState.currentDate, 1))}
        class="p-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-[#252525] rounded transition-colors cursor-pointer"
        title="Previous month"
      >
        <ChevronLeft size={14} />
      </button>
      <button 
        onclick={() => calendarState.setDate(addMonths(calendarState.currentDate, 1))}
        class="p-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-[#252525] rounded transition-colors cursor-pointer"
        title="Next month"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  </div>

  <div class="grid grid-cols-7 text-center">
    {#each weekDays as wd}
      <span class="text-[10px] font-semibold text-zinc-500">{wd}</span>
    {/each}
  </div>

  <div class="grid grid-cols-7 gap-y-1 text-center">
    {#each days as day (day.toISOString())}
      {@const isCurMonth = isSameMonth(day, calendarState.currentDate)}
      {@const isSelected = isSameDay(day, calendarState.currentDate)}
      {@const isCurDay = isToday(day)}

      <button
        onclick={() => selectDate(day)}
        class="h-6 w-6 mx-auto rounded-full flex items-center justify-center text-[11px] font-medium transition-colors cursor-pointer
          {isCurDay ? 'bg-blue-600 text-white font-bold' : ''}
          {isSelected && !isCurDay ? 'bg-[#333333] text-white' : ''}
          {!isCurDay && !isSelected && isCurMonth ? 'text-zinc-300 hover:bg-[#262626]' : ''}
          {!isCurDay && !isSelected && !isCurMonth ? 'text-zinc-600 hover:bg-[#202020]' : ''}"
      >
        {format(day, 'd')}
      </button>
    {/each}
  </div>
</div>