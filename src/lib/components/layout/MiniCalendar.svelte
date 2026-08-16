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

  let viewDate = $state(new Date(calendarState.currentDate));

  let monthTitle = $derived(format(viewDate, 'MMMM yyyy'));
  const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

  let days = $derived.by(() => {
    const mStart = startOfMonth(viewDate);
    const mEnd = endOfMonth(mStart);
    const cStart = startOfWeek(mStart, { weekStartsOn: 0 });
    const cEnd = endOfWeek(mEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: cStart, end: cEnd });
  });

  function selectDate(d: Date) {
    calendarState.setDate(d);
  }
</script>

<div class="flex flex-col gap-1.5 select-none">
  <!-- Month Header & Navigation -->
  <div class="flex items-center justify-between px-1 mb-1">
    <span class="text-xs font-semibold text-zinc-200">{monthTitle}</span>
    <div class="flex items-center gap-0.5">
      <button 
        onclick={() => viewDate = subMonths(viewDate, 1)}
        class="p-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-[#252525] rounded transition-colors"
      >
        <ChevronLeft size={14} />
      </button>
      <button 
        onclick={() => viewDate = addMonths(viewDate, 1)}
        class="p-0.5 text-zinc-400 hover:text-zinc-100 hover:bg-[#252525] rounded transition-colors"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  </div>

  <!-- Day-of-Week Initials -->
  <div class="grid grid-cols-7 text-center">
    {#each weekDays as wd}
      <span class="text-[10px] font-semibold text-zinc-500">{wd}</span>
    {/each}
  </div>

  <!-- 7x5/6 Date Matrix -->
  <div class="grid grid-cols-7 gap-y-1 text-center">
    {#each days as day (day.toISOString())}
      {@const isCurMonth = isSameMonth(day, viewDate)}
      {@const isSelected = isSameDay(day, calendarState.currentDate)}
      {@const isCurDay = isToday(day)}

      <button
        onclick={() => selectDate(day)}
        class="h-6 w-6 mx-auto rounded-full flex items-center justify-center text-[11px] font-medium transition-colors
          {isCurDay ? 'bg-rose-500 text-white font-bold' : ''}
          {isSelected && !isCurDay ? 'bg-[#333333] text-white' : ''}
          {!isCurDay && !isSelected && isCurMonth ? 'text-zinc-300 hover:bg-[#262626]' : ''}
          {!isCurDay && !isSelected && !isCurMonth ? 'text-zinc-600 hover:bg-[#202020]' : ''}"
      >
        {format(day, 'd')}
      </button>
    {/each}
  </div>
</div>