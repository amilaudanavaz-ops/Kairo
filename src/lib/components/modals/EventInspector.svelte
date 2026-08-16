<script lang="ts">
  import { 
    format, 
    parseISO, 
    differenceInMinutes, 
    setHours, 
    setMinutes, 
    addHours,
    startOfDay,
    endOfDay,
    getWeekOfMonth
  } from 'date-fns';
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
    ChevronRight,
    Scissors,
    Copy,
    Files,
    ExternalLink,
    Check,
    Search,
    Calendar as CalIcon
  } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import type { CalendarEvent } from '../../../types/event';

  let event = $derived(calendarState.selectedEvent);
  let activeCalendar = $derived(
    calendarState.calendars.find((c) => c.id === event?.calendarId) || calendarState.calendars[0]
  );

  // Popover Toggle States
  let isMenuOpen = $state(false);
  let isTypeDropdownOpen = $state(false);
  let isTimezoneOpen = $state(false);
  let isRepeatOpen = $state(false);
  let isReminderOpen = $state(false);
  let isCalendarPickerOpen = $state(false);
  let isTimePickerOpen = $state(false);

  // Timezone search
  let timezoneQuery = $state('');

  // Notion Event Types
  let eventType = $state<'Event' | 'Task' | 'Reminder'>('Event');

  // New Participant / Attachment input states
  let newParticipant = $state('');
  let newAttachment = $state('');
  let isAddingAttachment = $state(false);

  const notionColors = [
    { name: 'Red', hex: '#ef4444' },
    { name: 'Orange', hex: '#f97316' },
    { name: 'Amber', hex: '#f59e0b' },
    { name: 'Green', hex: '#10b981' },
    { name: 'Blue', hex: '#3b82f6' },
    { name: 'Purple', hex: '#8b5cf6' },
    { name: 'Default', hex: '#71717a' }
  ];

  const timezoneList = [
    { offset: 'GMT+05:30', name: 'India Standard Time — Colombo', tz: 'GMT+5:30 Colombo' },
    { offset: 'GMT+05:30', name: 'India Standard Time — Kolkata', tz: 'GMT+5:30 Kolkata' },
    { offset: 'GMT+05:00', name: 'Pakistan Standard Time — Karachi', tz: 'GMT+5:00 Karachi' },
    { offset: 'GMT+05:00', name: 'Maldives Time — Maldives', tz: 'GMT+5:00 Maldives' },
    { offset: 'GMT+00:00', name: 'Coordinated Universal Time — UTC', tz: 'UTC' },
    { offset: 'GMT+01:00', name: 'British Summer Time — London', tz: 'Europe/London' },
    { offset: 'GMT+02:00', name: 'Central European Time — Berlin', tz: 'Europe/Berlin' },
    { offset: 'GMT-04:00', name: 'Eastern Daylight Time — New York', tz: 'America/New_York' },
    { offset: 'GMT-07:00', name: 'Pacific Daylight Time — Los Angeles', tz: 'America/Los_Angeles' },
    { offset: 'GMT+08:00', name: 'Singapore Standard Time — Singapore', tz: 'Asia/Singapore' },
    { offset: 'GMT+09:00', name: 'Japan Standard Time — Tokyo', tz: 'Asia/Tokyo' },
    { offset: 'GMT+10:00', name: 'Australian Eastern Time — Sydney', tz: 'Australia/Sydney' }
  ];

  let filteredTimezones = $derived(
    timezoneList.filter(t => 
      t.name.toLowerCase().includes(timezoneQuery.toLowerCase()) || 
      t.offset.toLowerCase().includes(timezoneQuery.toLowerCase())
    )
  );

  // Dynamic Notion Repeat Options Generator
  let repeatOptions = $derived.by(() => {
    if (!event) return [];
    const d = parseISO(event.startTime);
    const dayName = format(d, 'EEE');
    const dayOfMonth = format(d, 'do');
    const monthDay = format(d, 'MMM d');
    const weekNum = ['1st', '2nd', '3rd', '4th', '5th'][getWeekOfMonth(d) - 1] || 'last';

    return [
      { id: 'none', label: 'Does not repeat' },
      { id: 'daily', label: 'Every day' },
      { id: 'weekday', label: 'Every weekday', sub: 'Mon – Fri' },
      { id: 'weekly', label: `Every week`, sub: `on ${dayName}` },
      { id: 'biweekly', label: `Every 2 weeks`, sub: `on ${dayName}` },
      { id: 'monthly_date', label: `Every month`, sub: `on the ${dayOfMonth}` },
      { id: 'monthly_day', label: `Every month`, sub: `on the ${weekNum} ${dayName}` },
      { id: 'yearly', label: `Every year`, sub: `on ${monthDay}` },
      { id: 'custom', label: 'Custom...' }
    ];
  });

  // Reminder Presets
  const reminderOptions = [
    { id: '0m', label: 'At start of event' },
    { id: '5m', label: '5 min before' },
    { id: '10m', label: '10 min before' },
    { id: '15m', label: '15 min before' },
    { id: '30m', label: '30 min before' },
    { id: '1h', label: '1 hour before' },
    { id: '1d', label: '1 day before' },
    { id: '2d', label: '2 days before' }
  ];

  let durationText = $derived.by(() => {
    if (!event || event.isAllDay) return '';
    const diff = differenceInMinutes(parseISO(event.endTime), parseISO(event.startTime));
    if (diff < 60) return `${diff}m`;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
  });

  let reminderLabel = $derived.by(() => {
    const r = reminderOptions.find(opt => opt.id === event?.reminders);
    return r ? r.label : '30 min before';
  });

  let repeatLabel = $derived.by(() => {
    const target = repeatOptions.find(opt => opt.id === (event?.rrule || 'none'));
    if (!target) return 'Does not repeat';
    return target.sub ? `${target.label} ${target.sub}` : target.label;
  });

  function updateField<K extends keyof CalendarEvent>(field: K, value: CalendarEvent[K]) {
    if (!event) return;
    const updated = { ...event, [field]: value, updatedAt: new Date().toISOString() };
    eventStore.updateEvent(updated);
  }

  function toggleAllDay() {
    if (!event) return;
    const nextState = !event.isAllDay;
    if (nextState) {
      const start = startOfDay(parseISO(event.startTime));
      const end = endOfDay(start);
      eventStore.updateEvent({
        ...event,
        isAllDay: true,
        startTime: start.toISOString(),
        endTime: end.toISOString()
      });
    } else {
      const start = setMinutes(setHours(parseISO(event.startTime), 9), 0);
      const end = setMinutes(setHours(parseISO(event.startTime), 10), 0);
      eventStore.updateEvent({
        ...event,
        isAllDay: false,
        startTime: start.toISOString(),
        endTime: end.toISOString()
      });
    }
  }

  function handleTimePreset(hourStart: number, hourEnd: number) {
    if (!event) return;
    const base = parseISO(event.startTime);
    const newStart = setMinutes(setHours(base, hourStart), 0);
    const newEnd = setMinutes(setHours(base, hourEnd), 0);
    eventStore.updateEvent({
      ...event,
      isAllDay: false,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString()
    });
    isTimePickerOpen = false;
  }

  function toggleGoogleMeet() {
    if (!event) return;
    if (event.conferencingUrl) {
      updateField('conferencingUrl', undefined);
    } else {
      updateField('conferencingUrl', 'https://meet.google.com/' + Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5));
    }
  }

  function calculatePosition(rect: DOMRect | null) {
    if (!rect) return 'top: 10%; left: 50%; transform: translateX(-50%);';
    const inspectorWidth = 340;
    const inspectorHeight = 640;

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
  {#if !calendarState.isInspectorDocked}
    <div
      class="fixed inset-0 z-40 bg-black/20 backdrop-blur-[0.5px]"
      onclick={() => {
        calendarState.closeInspector();
        isTimezoneOpen = false;
        isRepeatOpen = false;
        isReminderOpen = false;
        isCalendarPickerOpen = false;
      }}
      role="presentation"
    ></div>
  {/if}

  <aside
    class="{calendarState.isInspectorDocked 
      ? 'w-80 h-full border-l border-[#262626] bg-[#161616] flex flex-col z-30 shrink-0 select-text' 
      : 'fixed z-50 w-[340px] max-h-[92vh] bg-[#181818] border border-[#2b2b2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] flex flex-col animate-in fade-in zoom-in-95 duration-100 select-text overflow-hidden'}"
    style={calendarState.isInspectorDocked ? '' : calculatePosition(calendarState.inspectorRect)}
  >
    <!-- Top Action Bar -->
    <div class="flex items-center justify-between px-3.5 pt-3 pb-2 border-b border-[#242424] relative">
      <div class="relative">
        <button 
          onclick={() => isTypeDropdownOpen = !isTypeDropdownOpen}
          class="flex items-center gap-1 text-xs font-semibold text-zinc-300 hover:text-white px-2 py-1 rounded hover:bg-[#242424] transition-colors"
        >
          <span>{eventType}</span>
          <ChevronDown size={13} />
        </button>

        {#if isTypeDropdownOpen}
          <div class="absolute left-0 top-full mt-1 w-28 bg-[#202020] border border-[#2e2e2e] rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5">
            {#each ['Event', 'Task', 'Reminder'] as t}
              <button
                onclick={() => { eventType = t as any; isTypeDropdownOpen = false; }}
                class="text-left px-2 py-1 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded transition-colors"
              >
                {t}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="flex items-center gap-0.5 text-zinc-400">
        <!-- More options '...' -->
        <div class="relative">
          <button 
            onclick={() => isMenuOpen = !isMenuOpen}
            class="p-1.5 hover:text-zinc-200 hover:bg-[#242424] rounded-md transition-colors" 
            title="More Options"
          >
            <MoreHorizontal size={15} />
          </button>

          {#if isMenuOpen}
            <div class="absolute right-0 top-full mt-1 w-44 bg-[#1f1f1f] border border-[#2e2e2e] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
              <button 
                onclick={() => {
                  calendarState.clipboardEvent = { ...event! };
                  eventStore.deleteEvent(event!.id);
                  calendarState.closeInspector();
                  isMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded-lg transition-colors"
              >
                <div class="flex items-center gap-2"><Scissors size={13} /><span>Cut</span></div>
                <span class="text-[10px] text-zinc-500">Ctrl X</span>
              </button>
              <button 
                onclick={() => {
                  calendarState.clipboardEvent = { ...event! };
                  isMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded-lg transition-colors"
              >
                <div class="flex items-center gap-2"><Copy size={13} /><span>Copy</span></div>
                <span class="text-[10px] text-zinc-500">Ctrl C</span>
              </button>
              <button 
                onclick={() => {
                  eventStore.addEvent({ ...event!, id: 'evt_' + Date.now(), title: event!.title + ' (Copy)' });
                  isMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded-lg transition-colors"
              >
                <div class="flex items-center gap-2"><Files size={13} /><span>Duplicate</span></div>
                <span class="text-[10px] text-zinc-500">Ctrl D</span>
              </button>
              <div class="h-[1px] bg-[#292929] my-0.5"></div>
              <button 
                onclick={() => {
                  eventStore.deleteEvent(event!.id);
                  calendarState.closeInspector();
                  isMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors"
              >
                <div class="flex items-center gap-2"><Trash2 size={13} /><span>Delete</span></div>
                <span class="text-[10px] text-rose-500">Del</span>
              </button>
            </div>
          {/if}
        </div>

        <button 
          onclick={() => calendarState.toggleInspectorDock()}
          class="p-1.5 hover:text-zinc-200 hover:bg-[#242424] rounded-md transition-colors {calendarState.isInspectorDocked ? 'text-blue-400' : ''}" 
          title="Toggle Context Panel"
        >
          <PanelRight size={14} />
        </button>

        <button 
          onclick={() => calendarState.closeInspector()} 
          class="p-1.5 hover:text-zinc-200 hover:bg-[#242424] rounded-md transition-colors" 
          title="Close (Esc)"
        >
          <X size={15} />
        </button>
      </div>
    </div>

    <!-- Scrollable Content -->
    <div class="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3.5 custom-scrollbar">
      <!-- Title Input -->
      <input
        type="text"
        placeholder="Add title"
        value={event.title}
        oninput={(e) => updateField('title', (e.target as HTMLInputElement).value)}
        class="w-full bg-transparent text-base font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-none"
        autofocus
      />

      <!-- Notion Clean Date & Time Row -->
      <div class="flex flex-col gap-1 relative">
        <button 
          onclick={() => isTimePickerOpen = !isTimePickerOpen}
          class="flex items-center gap-2 text-xs font-semibold text-zinc-100 hover:bg-[#222222] p-1.5 rounded-lg text-left transition-colors"
        >
          <Clock size={15} class="text-zinc-400 shrink-0" />
          {#if !event.isAllDay}
            <span>{format(parseISO(event.startTime), 'h a')}</span>
            <span class="text-zinc-500">→</span>
            <span>{format(parseISO(event.endTime), 'h a')}</span>
            {#if durationText}
              <span class="text-zinc-400 text-[11px] font-normal ml-0.5">{durationText}</span>
            {/if}
          {:else}
            <span>All Day</span>
          {/if}
        </button>

        <div class="pl-6 text-xs text-zinc-400 font-medium">
          {format(parseISO(event.startTime), 'EEE MMM d')}
        </div>

        {#if isTimePickerOpen}
          <div class="absolute left-0 top-full mt-1 w-48 bg-[#202020] border border-[#2e2e2e] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
            <button onclick={() => handleTimePreset(9, 10)} class="px-2.5 py-1 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded text-left">Morning (9 AM – 10 AM)</button>
            <button onclick={() => handleTimePreset(14, 15)} class="px-2.5 py-1 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded text-left">Afternoon (2 PM – 3 PM)</button>
            <button onclick={() => handleTimePreset(18, 21)} class="px-2.5 py-1 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded text-left">Evening (6 PM – 9 PM)</button>
          </div>
        {/if}
      </div>

      <!-- All-Day Toggle Switch -->
      <div class="flex items-center justify-between text-xs text-zinc-300">
        <span>All-day</span>
        <button
          type="button"
          onclick={toggleAllDay}
          class="w-8 h-4.5 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer
            {event.isAllDay ? 'bg-blue-600' : 'bg-[#2b2b2b]'}"
        >
          <div
            class="w-3.5 h-3.5 bg-white rounded-full transition-transform
              {event.isAllDay ? 'translate-x-3.5' : 'translate-x-0'}"
          ></div>
        </button>
      </div>

      <!-- Notion Timezone Selector Popover -->
      <div class="relative">
        <button 
          onclick={() => { isTimezoneOpen = !isTimezoneOpen; timezoneQuery = ''; }}
          class="w-full flex items-center justify-between text-xs text-zinc-300 hover:text-white p-1 rounded-md hover:bg-[#222222] transition-colors"
        >
          <div class="flex items-center gap-2.5 truncate">
            <Globe size={14} class="shrink-0 text-zinc-400" />
            <span class="truncate">{event.timeZone || 'GMT+5:30 Colombo'}</span>
          </div>
          <ChevronDown size={13} class="text-zinc-500 shrink-0" />
        </button>

        {#if isTimezoneOpen}
          <div class="absolute left-0 top-full mt-1 w-80 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.8)] p-2 z-50 flex flex-col gap-1.5">
            <div class="flex items-center gap-2 px-2 py-1 bg-[#141414] border border-[#2a2a2a] rounded-lg">
              <Search size={13} class="text-zinc-500" />
              <input
                type="text"
                placeholder="Search timezone..."
                bind:value={timezoneQuery}
                class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
                autofocus
              />
            </div>

            <div class="max-h-52 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar">
              {#each filteredTimezones as tz}
                <button
                  onclick={() => { updateField('timeZone', tz.tz); isTimezoneOpen = false; }}
                  class="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors
                    {event.timeZone === tz.tz ? 'bg-[#282828] text-blue-400 font-semibold' : 'text-zinc-300 hover:bg-[#242424]'}"
                >
                  <span class="text-zinc-500 font-mono text-[11px] w-20 shrink-0">{tz.offset}</span>
                  <span class="truncate flex-1">{tz.name}</span>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Notion Recurrence Options Popover -->
      <div class="relative">
        <button 
          onclick={() => isRepeatOpen = !isRepeatOpen}
          class="w-full flex items-center justify-between text-xs text-zinc-300 hover:text-white p-1 rounded-md hover:bg-[#222222] transition-colors"
        >
          <div class="flex items-center gap-2.5 truncate">
            <Repeat size={14} class="shrink-0 text-zinc-400" />
            <span class="truncate">{repeatLabel}</span>
          </div>
          <ChevronDown size={13} class="text-zinc-500 shrink-0" />
        </button>

        {#if isRepeatOpen}
          <div class="absolute left-0 top-full mt-1 w-64 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5">
            {#each repeatOptions as opt}
              <button
                onclick={() => { updateField('rrule', opt.id); isRepeatOpen = false; }}
                class="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors
                  {(event.rrule || 'none') === opt.id ? 'bg-[#282828] text-blue-400 font-semibold' : 'text-zinc-300 hover:bg-[#242424]'}"
              >
                <span>{opt.label}</span>
                {#if opt.sub}
                  <span class="text-[11px] text-zinc-500">{opt.sub}</span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1 my-0.5"></div>

      <!-- Account & Participants -->
      <div class="flex flex-col gap-2 text-xs">
        <div class="flex items-center gap-2.5 text-zinc-400">
          <User size={14} class="shrink-0 text-zinc-500" />
          <span class="truncate">Created by <strong class="text-zinc-300 font-medium">{event.creatorEmail || 'amilavaz2003@gmail.com'}</strong></span>
        </div>

        <div class="flex items-center gap-2.5 text-zinc-400">
          <Users size={14} class="shrink-0 text-zinc-500" />
          <input
            type="text"
            placeholder="Add participant (press Enter)"
            bind:value={newParticipant}
            onkeydown={(e) => {
              if (e.key === 'Enter' && newParticipant.trim()) {
                updateField('participants', [...(event.participants || []), newParticipant.trim()]);
                newParticipant = '';
              }
            }}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
          />
        </div>

        {#if event.participants && event.participants.length > 0}
          <div class="flex flex-wrap gap-1 pl-6">
            {#each event.participants as p, i}
              <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#252525] border border-[#2f2f2f] text-[11px] text-zinc-300">
                <span>{p}</span>
                <button 
                  onclick={() => updateField('participants', event.participants?.filter((_, idx) => idx !== i))}
                  class="hover:text-rose-400"
                >
                  <X size={11} />
                </button>
              </span>
            {/each}
          </div>
        {/if}
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1 my-0.5"></div>

      <!-- Conferencing, AI Notes, Location & Attachments -->
      <div class="flex flex-col gap-2 text-xs">
        <!-- Google Meet -->
        <button 
          onclick={toggleGoogleMeet}
          class="flex items-center justify-between text-zinc-400 hover:text-zinc-200 text-left group py-0.5"
        >
          <div class="flex items-center gap-2.5 truncate">
            <Video size={14} class="shrink-0 text-zinc-500 group-hover:text-zinc-300" />
            <span class="truncate {event.conferencingUrl ? 'text-blue-400 font-semibold underline' : ''}">
              {event.conferencingUrl ? 'Google Meet Video Call' : 'Conferencing'}
            </span>
          </div>
          {#if event.conferencingUrl}
            <ExternalLink size={12} class="text-zinc-500 shrink-0" />
          {/if}
        </button>

        <!-- AI Notes -->
        <button class="flex items-center gap-2.5 text-zinc-400 hover:text-zinc-200 text-left py-0.5">
          <Sparkles size={14} class="shrink-0 text-amber-500/80" />
          <span>Add AI meeting notes</span>
        </button>

        <!-- Location -->
        <div class="flex items-center gap-2.5 text-zinc-400 py-0.5">
          <MapPin size={14} class="shrink-0 text-zinc-500" />
          <input
            type="text"
            placeholder="Location"
            value={event.location || ''}
            oninput={(e) => updateField('location', (e.target as HTMLInputElement).value)}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
          />
        </div>

        <!-- Attachments -->
        <div class="flex flex-col gap-1.5 py-0.5">
          {#if !isAddingAttachment}
            <button 
              onclick={() => isAddingAttachment = true}
              class="flex items-center gap-2.5 text-zinc-400 hover:text-zinc-200 text-left"
            >
              <Paperclip size={14} class="shrink-0 text-zinc-500" />
              <span>Add links and attachments</span>
            </button>
          {:else}
            <div class="flex items-center gap-2 pl-6">
              <input
                type="text"
                placeholder="Paste URL (press Enter)"
                bind:value={newAttachment}
                onkeydown={(e) => {
                  if (e.key === 'Enter' && newAttachment.trim()) {
                    updateField('attachments', [...(event.attachments || []), newAttachment.trim()]);
                    newAttachment = '';
                    isAddingAttachment = false;
                  }
                }}
                class="bg-[#141414] border border-[#2b2b2b] rounded px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 w-full"
                autofocus
              />
              <button onclick={() => isAddingAttachment = false} class="text-zinc-500 hover:text-zinc-300">
                <X size={13} />
              </button>
            </div>
          {/if}
        </div>
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1 my-0.5"></div>

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

      <div class="h-[1px] bg-[#242424] -mx-1 my-0.5"></div>

      <!-- Calendar Category & Color Picker Popover -->
      <div class="relative">
        <button 
          onclick={() => isCalendarPickerOpen = !isCalendarPickerOpen}
          class="w-full flex items-center justify-between p-1 rounded-lg hover:bg-[#222222] transition-colors"
        >
          <div class="flex items-center gap-2.5">
            <span class="w-3 h-3 rounded-full shrink-0" style="background-color: {event.colorOverride || activeCalendar.colorHex};"></span>
            <span class="text-xs font-semibold text-zinc-200">{activeCalendar.name}</span>
          </div>
          <ChevronDown size={13} class="text-zinc-500" />
        </button>

        {#if isCalendarPickerOpen}
          <div class="absolute left-0 bottom-full mb-1 w-64 bg-[#1f1f1f] border border-[#2e2e2e] rounded-xl shadow-2xl p-2 z-50 flex flex-col gap-2">
            <div class="text-[11px] font-semibold text-zinc-400 px-1">amilavaz2003@gmail.com</div>
            <div class="flex flex-col gap-0.5">
              {#each calendarState.calendars as cal}
                <button
                  onclick={() => { updateField('calendarId', cal.id); isCalendarPickerOpen = false; }}
                  class="flex items-center justify-between px-2 py-1.5 rounded-lg text-xs hover:bg-[#2a2a2a] transition-colors"
                >
                  <div class="flex items-center gap-2">
                    <span class="w-2.5 h-2.5 rounded-full" style="background-color: {cal.colorHex};"></span>
                    <span class="text-zinc-200">{cal.name}</span>
                  </div>
                  {#if event.calendarId === cal.id}
                    <Check size={13} class="text-blue-400" />
                  {/if}
                </button>
              {/each}
            </div>

            <div class="h-[1px] bg-[#292929]"></div>

            <div class="text-[11px] font-semibold text-zinc-400 px-1">Event color</div>
            <div class="flex items-center justify-between px-1">
              {#each notionColors as c}
                <button
                  onclick={() => { updateField('colorOverride', c.hex === '#71717a' ? undefined : c.hex); isCalendarPickerOpen = false; }}
                  class="w-4 h-4 rounded-full flex items-center justify-center transition-transform hover:scale-125"
                  style="background-color: {c.hex};"
                >
                  {#if (event.colorOverride === c.hex) || (!event.colorOverride && c.hex === '#71717a')}
                    <Check size={10} class="text-white" />
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      <!-- Busy / Free & Visibility -->
      <div class="flex items-center justify-between text-xs text-zinc-300">
        <select
          value={event.busyStatus}
          onchange={(e) => updateField('busyStatus', (e.target as HTMLSelectElement).value as any)}
          class="bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg px-2.5 py-1 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="busy" class="bg-[#181818]">Busy</option>
          <option value="free" class="bg-[#181818]">Free</option>
        </select>

        <select
          value={event.visibility || 'default'}
          onchange={(e) => updateField('visibility', (e.target as HTMLSelectElement).value as any)}
          class="bg-[#1f1f1f] border border-[#2a2a2a] rounded-lg px-2.5 py-1 text-xs text-zinc-300 focus:outline-none"
        >
          <option value="default" class="bg-[#181818]">Default visibility</option>
          <option value="public" class="bg-[#181818]">Public</option>
          <option value="private" class="bg-[#181818]">Private</option>
        </select>
      </div>

      <!-- Notion Reminders Popover -->
      <div class="relative">
        <button 
          onclick={() => isReminderOpen = !isReminderOpen}
          class="w-full flex items-center justify-between text-xs text-zinc-400 bg-[#1f1f1f] hover:bg-[#242424] border border-[#2a2a2a] rounded-xl p-2.5 transition-colors"
        >
          <div class="flex items-center gap-2">
            <Bell size={14} class="text-zinc-500" />
            <span>Reminders</span>
          </div>
          <span class="text-zinc-200 font-semibold">{reminderLabel}</span>
        </button>

        {#if isReminderOpen}
          <div class="absolute left-0 bottom-full mb-1 w-64 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-2xl p-1.5 z-50 flex flex-col gap-0.5">
            {#each reminderOptions as opt}
              <button
                onclick={() => { updateField('reminders', opt.id); isReminderOpen = false; }}
                class="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors
                  {(event.reminders || '30m') === opt.id ? 'bg-[#282828] text-blue-400 font-semibold' : 'text-zinc-300 hover:bg-[#242424]'}"
              >
                <span>{opt.label}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  </aside>
{/if}