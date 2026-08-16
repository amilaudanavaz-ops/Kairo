<script lang="ts">
  import { format, parseISO, differenceInMinutes, setHours, setMinutes } from 'date-fns';
  import { 
    X, 
    MoreHorizontal, 
    PanelRight, 
    Trash2, 
    Clock, 
    Globe, 
    Repeat, 
    User, 
    Users, 
    Video, 
    Sparkles, 
    MapPin, 
    Paperclip, 
    AlignLeft, 
    Bell, 
    ChevronDown,
    ChevronLeft,
    ChevronRight
  } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';

  let event = $derived(calendarState.selectedEvent);
  let activeCalendar = $derived(
    calendarState.calendars.find((c) => c.id === event?.calendarId) || calendarState.calendars[0]
  );

  let durationText = $derived.by(() => {
    if (!event || event.isAllDay) return '';
    const diff = differenceInMinutes(parseISO(event.endTime), parseISO(event.startTime));
    if (diff < 60) return `${diff}m`;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  });

  function updateField<K extends keyof NonNullable<typeof event>>(field: K, value: any) {
    if (!event) return;
    const updated = { ...event, [field]: value, updatedAt: new Date().toISOString() };
    eventStore.updateEvent(updated);
  }

  function handleTimeChange(isStart: boolean, timeStr: string) {
    if (!event) return;
    const [hours, minutes] = timeStr.split(':').map(Number);
    const baseDate = parseISO(isStart ? event.startTime : event.endTime);
    const newDate = setMinutes(setHours(baseDate, hours), minutes);
    
    if (isStart) {
      updateField('startTime', newDate.toISOString());
    } else {
      updateField('endTime', newDate.toISOString());
    }
  }

  function handleDelete() {
    if (!event) return;
    eventStore.deleteEvent(event.id);
    calendarState.closeInspector();
  }

  function calculatePosition(rect: DOMRect | null) {
    if (!rect) return 'top: 15%; left: 50%; transform: translateX(-50%);';
    
    const inspectorWidth = 340;
    const inspectorHeight = 620;

    let left = rect.right + 12;
    if (left + inspectorWidth > window.innerWidth - 16) {
      left = rect.left - inspectorWidth - 12;
    }
    if (left < 16) {
      left = Math.max(16, (window.innerWidth - inspectorWidth) / 2);
    }

    let top = rect.top - 10;
    if (top + inspectorHeight > window.innerHeight - 16) {
      top = Math.max(16, window.innerHeight - inspectorHeight - 16);
    }
    if (top < 16) top = 16;

    return `top: ${top}px; left: ${left}px;`;
  }
</script>

{#if event}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40 bg-black/25 backdrop-blur-[0.5px]"
    onclick={() => calendarState.closeInspector()}
    role="presentation"
  ></div>

  <!-- Notion Calendar Inspector Panel -->
  <div
    class="fixed z-50 w-[340px] max-h-[90vh] bg-[#181818] border border-[#2b2b2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col animate-in fade-in zoom-in-95 duration-100 select-text overflow-hidden"
    style={calculatePosition(calendarState.inspectorRect)}
  >
    <!-- Top Action Header -->
    <div class="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-[#242424]">
      <button class="flex items-center gap-1 text-xs font-semibold text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-[#242424] transition-colors">
        <span>Event</span>
        <ChevronDown size={13} />
      </button>

      <div class="flex items-center gap-0.5 text-zinc-400">
        <button onclick={handleDelete} class="p-1.5 hover:text-rose-400 hover:bg-[#242424] rounded-md transition-colors" title="Delete Event">
          <Trash2 size={14} />
        </button>
        <button class="p-1.5 hover:text-zinc-200 hover:bg-[#242424] rounded-md transition-colors" title="Options">
          <MoreHorizontal size={15} />
        </button>
        <button class="p-1.5 hover:text-zinc-200 hover:bg-[#242424] rounded-md transition-colors" title="Dock to Sidebar">
          <PanelRight size={14} />
        </button>
        <button onclick={() => calendarState.closeInspector()} class="p-1.5 hover:text-zinc-200 hover:bg-[#242424] rounded-md transition-colors" title="Close (Esc)">
          <X size={15} />
        </button>
      </div>
    </div>

    <!-- Scrollable Body Content -->
    <div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3.5 scrollbar-thin">
      <!-- Title Input -->
      <input
        type="text"
        placeholder="Add title"
        value={event.title}
        oninput={(e) => updateField('title', (e.target as HTMLInputElement).value)}
        class="w-full bg-transparent text-base font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-none"
        autofocus
      />

      <!-- Time Range & Duration Block -->
      <div class="flex flex-col gap-2 bg-[#1f1f1f] border border-[#292929] rounded-xl p-2.5">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <input
              type="time"
              value={format(parseISO(event.startTime), 'HH:mm')}
              onchange={(e) => handleTimeChange(true, (e.target as HTMLInputElement).value)}
              class="bg-[#181818] border border-[#2e2e2e] rounded px-2 py-1 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-blue-500"
            />
            <span class="text-zinc-500 text-xs">→</span>
            <input
              type="time"
              value={format(parseISO(event.endTime), 'HH:mm')}
              onchange={(e) => handleTimeChange(false, (e.target as HTMLInputElement).value)}
              class="bg-[#181818] border border-[#2e2e2e] rounded px-2 py-1 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-blue-500"
            />
          </div>
          {#if durationText}
            <span class="text-[11px] font-bold text-zinc-400">{durationText}</span>
          {/if}
        </div>

        <div class="text-xs text-zinc-400 font-medium px-1">
          {format(parseISO(event.startTime), 'EEE MMM d, yyyy')}
        </div>
      </div>

      <!-- All-Day Toggle -->
      <div class="flex items-center justify-between text-xs text-zinc-300">
        <span>All-day</span>
        <button
          onclick={() => updateField('isAllDay', !event.isAllDay)}
          class="w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5
            {event.isAllDay ? 'bg-blue-600' : 'bg-[#2b2b2b]'}"
        >
          <div
            class="w-3.5 h-3.5 bg-white rounded-full transition-transform
              {event.isAllDay ? 'translate-x-3.5' : 'translate-x-0'}"
          ></div>
        </button>
      </div>

      <!-- Timezone -->
      <div class="flex items-center gap-2.5 text-xs text-zinc-400">
        <Globe size={14} class="shrink-0 text-zinc-500" />
        <span class="truncate">{event.timeZone || 'GMT+5:30 Colombo'}</span>
      </div>

      <!-- Recurrence -->
      <div class="flex items-center justify-between text-xs text-zinc-300">
        <div class="flex items-center gap-2.5">
          <Repeat size={14} class="shrink-0 text-zinc-500" />
          <select
            value={event.rrule || 'none'}
            onchange={(e) => updateField('rrule', (e.target as HTMLSelectElement).value)}
            class="bg-transparent text-xs text-zinc-300 focus:outline-none cursor-pointer"
          >
            <option value="none" class="bg-[#1a1a1a]">Does not repeat</option>
            <option value="daily" class="bg-[#1a1a1a]">Every day</option>
            <option value="weekly" class="bg-[#1a1a1a]">Every week</option>
            <option value="monthly" class="bg-[#1a1a1a]">Every month</option>
            <option value="yearly" class="bg-[#1a1a1a]">Every year</option>
          </select>
        </div>
        {#if event.rrule && event.rrule !== 'none'}
          <div class="flex items-center gap-1 text-zinc-500">
            <button class="p-0.5 hover:text-zinc-200"><ChevronLeft size={13} /></button>
            <button class="p-0.5 hover:text-zinc-200"><ChevronRight size={13} /></button>
          </div>
        {/if}
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1 my-1"></div>

      <!-- Account & Participants -->
      <div class="flex flex-col gap-2 text-xs">
        <div class="flex items-center gap-2.5 text-zinc-400">
          <User size={14} class="shrink-0 text-zinc-500" />
          <span class="truncate">Created by <strong class="text-zinc-300 font-medium">{event.creatorEmail || 'amilavaz2003@gmail.com'}</strong></span>
        </div>

        <div class="flex items-center gap-2.5 text-zinc-400 hover:text-zinc-200 cursor-pointer">
          <Users size={14} class="shrink-0 text-zinc-500" />
          <input
            type="text"
            placeholder="Add participant"
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
          />
        </div>
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1 my-1"></div>

      <!-- Integrations & Metadata -->
      <div class="flex flex-col gap-2.5 text-xs">
        <!-- Conferencing -->
        <button class="flex items-center gap-2.5 text-zinc-400 hover:text-zinc-200 text-left">
          <Video size={14} class="shrink-0 text-zinc-500" />
          <span>Add Google Meet video conferencing</span>
        </button>

        <!-- AI Meeting Notes -->
        <button class="flex items-center gap-2.5 text-zinc-400 hover:text-zinc-200 text-left">
          <Sparkles size={14} class="shrink-0 text-amber-500/80" />
          <span>Add AI meeting notes</span>
        </button>

        <!-- Location -->
        <div class="flex items-center gap-2.5 text-zinc-400">
          <MapPin size={14} class="shrink-0 text-zinc-500" />
          <input
            type="text"
            placeholder="Add location"
            value={event.location || ''}
            oninput={(e) => updateField('location', (e.target as HTMLInputElement).value)}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
          />
        </div>

        <!-- Attachments -->
        <button class="flex items-center gap-2.5 text-zinc-400 hover:text-zinc-200 text-left">
          <Paperclip size={14} class="shrink-0 text-zinc-500" />
          <span>Add links and attachments</span>
        </button>
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1 my-1"></div>

      <!-- Description -->
      <div class="flex flex-col gap-1.5 text-xs">
        <div class="flex items-center gap-2 text-zinc-400">
          <AlignLeft size={14} class="text-zinc-500" />
          <span class="font-medium">Description</span>
        </div>
        <textarea
          rows="3"
          placeholder="Add description..."
          value={event.description || ''}
          oninput={(e) => updateField('description', (e.target as HTMLTextAreaElement).value)}
          class="w-full bg-[#1c1c1c] border border-[#282828] rounded-xl p-2.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none"
        ></textarea>
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1 my-1"></div>

      <!-- Calendar & Color Grade Selection -->
      <div class="flex items-center justify-between text-xs">
        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full shrink-0" style="background-color: {activeCalendar.colorHex};"></span>
          <select
            value={event.calendarId}
            onchange={(e) => updateField('calendarId', (e.target as HTMLSelectElement).value)}
            class="bg-transparent font-medium text-zinc-200 focus:outline-none cursor-pointer"
          >
            {#each calendarState.calendars as cal}
              <option value={cal.id} class="bg-[#181818]">{cal.name}</option>
            {/each}
          </select>
        </div>
      </div>

      <!-- Busy / Free & Visibility -->
      <div class="flex items-center justify-between text-xs text-zinc-300">
        <select
          value={event.busyStatus}
          onchange={(e) => updateField('busyStatus', (e.target as HTMLSelectElement).value)}
          class="bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg px-2.5 py-1 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="busy" class="bg-[#181818]">Busy</option>
          <option value="free" class="bg-[#181818]">Free</option>
        </select>

        <select
          value={event.visibility || 'default'}
          onchange={(e) => updateField('visibility', (e.target as HTMLSelectElement).value)}
          class="bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg px-2.5 py-1 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="default" class="bg-[#181818]">Default visibility</option>
          <option value="public" class="bg-[#181818]">Public</option>
          <option value="private" class="bg-[#181818]">Private</option>
        </select>
      </div>

      <!-- Reminders -->
      <div class="flex items-center justify-between text-xs text-zinc-400 bg-[#1f1f1f] border border-[#2a2a2a] rounded-xl p-2.5">
        <div class="flex items-center gap-2">
          <Bell size={14} class="text-zinc-500" />
          <span>Reminders</span>
        </div>
        <select
          value={event.reminders || '30m'}
          onchange={(e) => updateField('reminders', (e.target as HTMLSelectElement).value)}
          class="bg-transparent text-xs text-zinc-200 font-semibold focus:outline-none cursor-pointer"
        >
          <option value="5m" class="bg-[#181818]">5 minutes before</option>
          <option value="10m" class="bg-[#181818]">10 minutes before</option>
          <option value="30m" class="bg-[#181818]">30 minutes before</option>
          <option value="1h" class="bg-[#181818]">1 hour before</option>
          <option value="1d" class="bg-[#181818]">1 day before</option>
        </select>
      </div>
    </div>
  </div>
{/if}