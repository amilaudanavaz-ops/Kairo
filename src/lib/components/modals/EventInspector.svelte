<script lang="ts">
  import { 
    format, 
    parseISO, 
    differenceInMinutes, 
    setHours, 
    setMinutes, 
    startOfDay, 
    endOfDay, 
    getWeekOfMonth,
    parse
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
    Search
  } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import type { CalendarEvent } from '../../../types/event';

  let event = $derived(calendarState.selectedEvent);
  let activeCalendar = $derived(
    calendarState.calendars.find((c) => c.id === event?.calendarId) || calendarState.calendars[0]
  );

  // Side-Docked Dropdowns (Opens to the Left of the Inspector)
  let activeSideMenu = $state<'none' | 'start_time' | 'end_time' | 'timezone' | 'repeat' | 'reminders' | 'calendar'>('none');
  let isTypeDropdownOpen = $state(false);
  let isActionMenuOpen = $state(false);

  // Interactive Form Inputs
  let startTimeInput = $state('');
  let endTimeInput = $state('');
  let isAddingParticipant = $state(false);
  let participantInput = $state('');
  let isAddingAttachment = $state(false);
  let attachmentInput = $state('');
  let timezoneQuery = $state('');

  $effect(() => {
    if (event) {
      startTimeInput = format(parseISO(event.startTime), 'h:mm a');
      endTimeInput = format(parseISO(event.endTime), 'h:mm a');
    }
  });

  const timePresets: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      const d = setMinutes(setHours(new Date(), h), m);
      timePresets.push(format(d, 'h:mm a'));
    }
  }

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
    { offset: 'GMT+09:00', name: 'Japan Standard Time — Tokyo', tz: 'Asia/Tokyo' }
  ];

  let filteredTimezones = $derived(
    timezoneList.filter(t => 
      t.name.toLowerCase().includes(timezoneQuery.toLowerCase()) || 
      t.offset.toLowerCase().includes(timezoneQuery.toLowerCase())
    )
  );

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
      { id: 'yearly', label: `Every year`, sub: `on ${monthDay}` }
    ];
  });

  const reminderOptions = [
    { id: '0m', label: 'At start of event' },
    { id: '5m', label: '5 min before' },
    { id: '10m', label: '10 min before' },
    { id: '15m', label: '15 min before' },
    { id: '30m', label: '30 min before' },
    { id: '1h', label: '1 hour before' },
    { id: '1d', label: '1 day before' }
  ];

  let durationText = $derived.by(() => {
    if (!event || event.isAllDay) return '';
    const diff = differenceInMinutes(parseISO(event.endTime), parseISO(event.startTime));
    if (diff < 60) return `${diff} min`;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
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

  function applyCustomTime(isStart: boolean, timeStr: string) {
    if (!event) return;
    try {
      const parsed = parse(timeStr.trim().toUpperCase(), 'h:mm a', new Date());
      if (!isNaN(parsed.getTime())) {
        const baseDate = parseISO(isStart ? event.startTime : event.endTime);
        const updated = setMinutes(setHours(baseDate, parsed.getHours()), parsed.getMinutes());
        if (isStart) {
          updateField('startTime', updated.toISOString());
        } else {
          updateField('endTime', updated.toISOString());
        }
      }
    } catch (e) {
      console.warn('Invalid time format', e);
    }
  }

  function selectPresetTime(isStart: boolean, preset: string) {
    applyCustomTime(isStart, preset);
    activeSideMenu = 'none';
  }

  function toggleAllDay() {
    if (!event) return;
    const next = !event.isAllDay;
    if (next) {
      updateField('isAllDay', true);
      updateField('startTime', startOfDay(parseISO(event.startTime)).toISOString());
      updateField('endTime', endOfDay(parseISO(event.startTime)).toISOString());
    } else {
      updateField('isAllDay', false);
      const start = setMinutes(setHours(parseISO(event.startTime), 9), 0);
      const end = setMinutes(setHours(parseISO(event.startTime), 10), 0);
      updateField('startTime', start.toISOString());
      updateField('endTime', end.toISOString());
    }
  }

  function toggleGoogleMeet() {
    if (!event) return;
    if (event.conferencingUrl) {
      updateField('conferencingUrl', undefined);
    } else {
      updateField('conferencingUrl', 'https://meet.google.com/' + Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5));
    }
  }

  function addAiMeetingNotes() {
    if (!event) return;
    const template = `\n\n### 🤖 AI Meeting Summary\n* Key Discussion Points:\n* Action Items:\n* Next Follow-up:`;
    updateField('description', (event.description || '') + template);
  }

  function calculatePosition(rect: DOMRect | null) {
    if (!rect) return 'top: 12%; right: 24px;';
    const width = 290;
    let left = rect.right + 10;
    if (left + width > window.innerWidth - 16) {
      left = Math.max(16, rect.left - width - 10);
    }
    const top = Math.min(window.innerHeight - 560, Math.max(16, rect.top - 20));
    return `top: ${top}px; left: ${left}px;`;
  }
</script>

{#if event}
  <!-- Global click-away backdrop -->
  {#if !calendarState.isInspectorDocked}
    <div
      class="fixed inset-0 z-40 bg-black/20"
      onclick={() => {
        calendarState.closeInspector();
        activeSideMenu = 'none';
      }}
      role="presentation"
    ></div>
  {/if}

  <!-- Click-away backdrop for side menus -->
  {#if activeSideMenu !== 'none'}
    <div
      class="fixed inset-0 z-50 bg-transparent"
      onclick={() => activeSideMenu = 'none'}
      role="presentation"
    ></div>
  {/if}

  <!-- Notion Sleek 290px Card -->
  <aside
    class="{calendarState.isInspectorDocked 
      ? 'w-[290px] h-full border-l border-[#262626] bg-[#161616] flex flex-col z-40 shrink-0 select-text relative' 
      : 'fixed z-50 w-[290px] max-h-[82vh] bg-[#181818] border border-[#2b2b2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col select-text animate-in fade-in zoom-in-95 duration-100'}"
    style={calendarState.isInspectorDocked ? '' : calculatePosition(calendarState.inspectorRect)}
  >
    <!-- Top Action Bar -->
    <div class="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-[#242424] shrink-0">
      <div class="relative">
        <button 
          onclick={() => isTypeDropdownOpen = !isTypeDropdownOpen}
          class="flex items-center gap-1 text-xs font-semibold text-zinc-300 hover:text-white px-1.5 py-0.5 rounded hover:bg-[#242424] transition-colors cursor-pointer"
        >
          <span>Event</span>
          <ChevronDown size={12} />
        </button>

        {#if isTypeDropdownOpen}
          <div class="absolute left-0 top-full mt-1 w-24 bg-[#202020] border border-[#2e2e2e] rounded-lg shadow-xl p-1 z-50 flex flex-col gap-0.5">
            {#each ['Event', 'Task', 'Reminder'] as t}
              <button
                onclick={() => isTypeDropdownOpen = false}
                class="text-left px-2 py-1 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded transition-colors cursor-pointer"
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
            onclick={() => isActionMenuOpen = !isActionMenuOpen}
            class="p-1 hover:text-zinc-200 hover:bg-[#242424] rounded transition-colors cursor-pointer"
          >
            <MoreHorizontal size={14} />
          </button>

          {#if isActionMenuOpen}
            <div class="absolute right-0 top-full mt-1 w-44 bg-[#1f1f1f] border border-[#2e2e2e] rounded-xl shadow-2xl p-1 z-50 flex flex-col gap-0.5">
              <button 
                onclick={() => {
                  calendarState.clipboardEvent = { ...event! };
                  eventStore.deleteEvent(event!.id);
                  calendarState.closeInspector();
                  isActionMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded-lg transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2"><Scissors size={13} /><span>Cut</span></div>
                <span class="text-[10px] text-zinc-500 font-mono">Ctrl X</span>
              </button>
              <button 
                onclick={() => {
                  calendarState.clipboardEvent = { ...event! };
                  isActionMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded-lg transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2"><Copy size={13} /><span>Copy</span></div>
                <span class="text-[10px] text-zinc-500 font-mono">Ctrl C</span>
              </button>
              <button 
                onclick={() => {
                  eventStore.addEvent({ ...event!, id: 'evt_' + Date.now(), title: event!.title + ' (Copy)' });
                  isActionMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded-lg transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2"><Files size={13} /><span>Duplicate</span></div>
                <span class="text-[10px] text-zinc-500 font-mono">Ctrl D</span>
              </button>
              <div class="h-[1px] bg-[#292929] my-0.5"></div>
              <button 
                onclick={() => {
                  eventStore.deleteEvent(event!.id);
                  calendarState.closeInspector();
                  isActionMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2"><Trash2 size={13} /><span>Delete</span></div>
                <span class="text-[10px] text-rose-500 font-mono">Del</span>
              </button>
            </div>
          {/if}
        </div>

        <button 
          onclick={() => calendarState.toggleInspectorDock()}
          class="p-1 hover:text-zinc-200 hover:bg-[#242424] rounded transition-colors cursor-pointer {calendarState.isInspectorDocked ? 'text-blue-400' : ''}"
        >
          <PanelRight size={14} />
        </button>

        <button 
          onclick={() => calendarState.closeInspector()} 
          class="p-1 hover:text-zinc-200 hover:bg-[#242424] rounded transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>

    <!-- Scrollable Body with Clean Visible Dark Scrollbar -->
    <div class="overflow-y-auto max-h-[calc(82vh-40px)] px-3.5 py-2.5 flex flex-col gap-2.5 custom-scrollbar">
      <!-- Title Input -->
      <input
        type="text"
        placeholder="Add title"
        value={event.title}
        oninput={(e) => updateField('title', (e.target as HTMLInputElement).value)}
        class="w-full bg-transparent text-sm font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-none"
      />

      <!-- Time & Date -->
      <div class="flex flex-col gap-1">
        <div class="flex items-center gap-1.5 text-xs">
          <Clock size={14} class="text-zinc-400 shrink-0" />
          
          {#if !event.isAllDay}
            <input
              type="text"
              bind:value={startTimeInput}
              onfocus={() => activeSideMenu = 'start_time'}
              onblur={() => applyCustomTime(true, startTimeInput)}
              onkeydown={(e) => e.key === 'Enter' && applyCustomTime(true, startTimeInput)}
              class="w-18 bg-[#222222] hover:bg-[#282828] focus:bg-[#1a2333] focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 text-xs font-semibold text-zinc-100 focus:outline-none transition-colors"
            />
            <span class="text-zinc-500 text-xs">→</span>
            
            <input
              type="text"
              bind:value={endTimeInput}
              onfocus={() => activeSideMenu = 'end_time'}
              onblur={() => applyCustomTime(false, endTimeInput)}
              onkeydown={(e) => e.key === 'Enter' && applyCustomTime(false, endTimeInput)}
              class="w-18 bg-[#222222] hover:bg-[#282828] focus:bg-[#1a2333] focus:ring-1 focus:ring-blue-500 rounded px-1.5 py-0.5 text-xs font-semibold text-zinc-100 focus:outline-none transition-colors"
            />

            {#if durationText}
              <span class="text-zinc-400 text-[10px] ml-0.5 truncate">{durationText}</span>
            {/if}
          {:else}
            <span class="text-zinc-300 font-semibold text-xs py-0.5">All Day</span>
          {/if}
        </div>

        <div class="pl-5 text-[11px] text-zinc-400 font-medium">
          {format(parseISO(event.startTime), 'EEE MMM d')}
        </div>
      </div>

      <!-- All-Day Toggle Switch -->
      <div class="flex items-center justify-between text-xs text-zinc-300">
        <span>All-day</span>
        <button
          type="button"
          onclick={toggleAllDay}
          class="w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer
            {event.isAllDay ? 'bg-blue-600' : 'bg-[#2b2b2b]'}"
        >
          <div
            class="w-3 h-3 bg-white rounded-full transition-transform
              {event.isAllDay ? 'translate-x-3' : 'translate-x-0'}"
          ></div>
        </button>
      </div>

      <!-- Timezone -->
      <button 
        onclick={() => { activeSideMenu = activeSideMenu === 'timezone' ? 'none' : 'timezone'; timezoneQuery = ''; }}
        class="w-full flex items-center justify-between text-xs text-zinc-300 hover:text-white py-0.5 rounded hover:bg-[#222222] transition-colors cursor-pointer"
      >
        <div class="flex items-center gap-2 truncate">
          <Globe size={13} class="shrink-0 text-zinc-400" />
          <span class="truncate">{event.timeZone || 'GMT+5:30 Colombo'}</span>
        </div>
        <ChevronDown size={12} class="text-zinc-500 shrink-0" />
      </button>

      <!-- Recurrence -->
      <button 
        onclick={() => activeSideMenu = activeSideMenu === 'repeat' ? 'none' : 'repeat'}
        class="w-full flex items-center justify-between text-xs text-zinc-300 hover:text-white py-0.5 rounded hover:bg-[#222222] transition-colors cursor-pointer"
      >
        <div class="flex items-center gap-2 truncate">
          <Repeat size={13} class="shrink-0 text-zinc-400" />
          <span class="truncate">{repeatLabel}</span>
        </div>
        <ChevronDown size={12} class="text-zinc-500 shrink-0" />
      </button>

      <div class="h-[1px] bg-[#242424] -mx-1"></div>

      <!-- Participants -->
      <div class="flex flex-col gap-1.5 text-xs">
        <div class="flex items-center gap-2 text-zinc-400 truncate">
          <User size={13} class="shrink-0 text-zinc-500" />
          <span class="truncate">Created by <strong class="text-zinc-300 font-medium">{event.creatorEmail || 'amilavaz2003@gmail.com'}</strong></span>
        </div>

        <div class="flex items-center gap-2 text-zinc-400">
          <Users size={13} class="shrink-0 text-zinc-500" />
          <input
            type="text"
            placeholder="Add participant"
            bind:value={participantInput}
            onkeydown={(e) => {
              if (e.key === 'Enter' && participantInput.trim()) {
                updateField('participants', [...(event.participants || []), participantInput.trim()]);
                participantInput = '';
              }
            }}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
          />
        </div>

        {#if event.participants && event.participants.length > 0}
          <div class="flex flex-wrap gap-1 pl-5">
            {#each event.participants as p, i}
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#252525] border border-[#2f2f2f] text-[10px] text-zinc-300">
                <span>{p}</span>
                <button 
                  onclick={() => updateField('participants', event.participants?.filter((_, idx) => idx !== i))}
                  class="hover:text-rose-400 cursor-pointer"
                >
                  <X size={10} />
                </button>
              </span>
            {/each}
          </div>
        {/if}
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1"></div>

      <!-- Conferencing, AI Notes, Location & Attachments -->
      <div class="flex flex-col gap-1.5 text-xs">
        <!-- Conferencing -->
        <button 
          onclick={toggleGoogleMeet}
          class="flex items-center justify-between text-zinc-400 hover:text-zinc-200 text-left py-0.5 cursor-pointer group"
        >
          <div class="flex items-center gap-2 truncate">
            <Video size={13} class="shrink-0 text-zinc-500 group-hover:text-zinc-300" />
            <span class="truncate {event.conferencingUrl ? 'text-blue-400 font-semibold underline' : ''}">
              {event.conferencingUrl ? 'Google Meet Call' : 'Conferencing'}
            </span>
          </div>
          {#if event.conferencingUrl}
            <ExternalLink size={11} class="text-zinc-500 shrink-0" />
          {/if}
        </button>

        <!-- AI Meeting Notes -->
        <button 
          onclick={addAiMeetingNotes}
          class="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 text-left py-0.5 cursor-pointer"
        >
          <Sparkles size={13} class="shrink-0 text-amber-500/80" />
          <span>Add AI meeting notes</span>
        </button>

        <!-- Location -->
        <div class="flex items-center gap-2 text-zinc-400 py-0.5">
          <MapPin size={13} class="shrink-0 text-zinc-500" />
          <input
            type="text"
            placeholder="Location"
            value={event.location || ''}
            oninput={(e) => updateField('location', (e.target as HTMLInputElement).value)}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
          />
        </div>

        <!-- Links and Attachments -->
        <div class="flex flex-col gap-1">
          {#if !isAddingAttachment}
            <button 
              onclick={() => isAddingAttachment = true}
              class="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 text-left py-0.5 cursor-pointer"
            >
              <Paperclip size={13} class="shrink-0 text-zinc-500" />
              <span>Add links and attachments</span>
            </button>
          {:else}
            <div class="flex items-center gap-1.5 pl-5">
              <input
                type="text"
                placeholder="Paste URL (press Enter)"
                bind:value={attachmentInput}
                onkeydown={(e) => {
                  if (e.key === 'Enter' && attachmentInput.trim()) {
                    updateField('attachments', [...(event.attachments || []), attachmentInput.trim()]);
                    attachmentInput = '';
                    isAddingAttachment = false;
                  }
                }}
                class="bg-[#141414] border border-[#2b2b2b] rounded px-1.5 py-0.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 w-full"
                autofocus
              />
              <button onclick={() => isAddingAttachment = false} class="text-zinc-500 hover:text-zinc-300">
                <X size={12} />
              </button>
            </div>
          {/if}

          {#if event.attachments && event.attachments.length > 0}
            <div class="flex flex-col gap-1 pl-5">
              {#each event.attachments as att, i}
                <div class="flex items-center justify-between p-1 rounded bg-[#202020] border border-[#2b2b2b] text-[10px] text-blue-400 truncate">
                  <span class="truncate underline cursor-pointer">{att}</span>
                  <button 
                    onclick={() => updateField('attachments', event.attachments?.filter((_, idx) => idx !== i))}
                    class="text-zinc-500 hover:text-rose-400 shrink-0 ml-1"
                  >
                    <X size={11} />
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1"></div>

      <!-- Description / Notes -->
      <div class="flex flex-col gap-1 text-xs">
        <div class="flex items-center gap-1.5 text-zinc-400">
          <AlignLeft size={13} class="text-zinc-500" />
          <span class="font-medium">Description</span>
        </div>
        <textarea
          rows="3"
          placeholder="Add description or notes..."
          value={event.description || ''}
          oninput={(e) => updateField('description', (e.target as HTMLTextAreaElement).value)}
          class="w-full bg-[#1c1c1c] border border-[#282828] rounded-lg p-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none custom-scrollbar"
        ></textarea>
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1"></div>

      <!-- Calendar Category & Notion Color Chip -->
      <button 
        onclick={() => activeSideMenu = activeSideMenu === 'calendar' ? 'none' : 'calendar'}
        class="w-full flex items-center justify-between p-1 rounded-md hover:bg-[#222222] transition-colors cursor-pointer"
      >
        <div class="flex items-center gap-2 truncate">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {event.colorOverride || activeCalendar.colorHex};"></span>
          <span class="text-xs font-semibold text-zinc-200 truncate">{activeCalendar.name}</span>
        </div>
        <ChevronDown size={12} class="text-zinc-500 shrink-0" />
      </button>

      <!-- Busy / Free & Visibility -->
      <div class="flex items-center justify-between text-xs text-zinc-300">
        <select
          value={event.busyStatus}
          onchange={(e) => updateField('busyStatus', (e.target as HTMLSelectElement).value as any)}
          class="bg-[#1f1f1f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none cursor-pointer"
        >
          <option value="busy" class="bg-[#181818]">Busy</option>
          <option value="free" class="bg-[#181818]">Free</option>
        </select>

        <select
          value={event.visibility || 'default'}
          onchange={(e) => updateField('visibility', (e.target as HTMLSelectElement).value as any)}
          class="bg-[#1f1f1f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none cursor-pointer"
        >
          <option value="default" class="bg-[#181818]">Default visibility</option>
          <option value="public" class="bg-[#181818]">Public</option>
          <option value="private" class="bg-[#181818]">Private</option>
        </select>
      </div>

      <!-- Reminders -->
      <button 
        onclick={() => activeSideMenu = activeSideMenu === 'reminders' ? 'none' : 'reminders'}
        class="w-full flex items-center justify-between text-xs text-zinc-400 bg-[#1f1f1f] hover:bg-[#242424] border border-[#2a2a2a] rounded-lg p-2 transition-colors cursor-pointer"
      >
        <div class="flex items-center gap-1.5">
          <Bell size={13} class="text-zinc-500" />
          <span>Reminders</span>
        </div>
        <span class="text-zinc-200 font-semibold text-[11px]">{reminderLabel}</span>
      </button>
    </div>

    <!-- ================= NOTION SIDE-DOCKED DROPDOWNS ================= -->

    <!-- 1. 15-Minute Time Interval Picker -->
    {#if activeSideMenu === 'start_time' || activeSideMenu === 'end_time'}
      {@const isStart = activeSideMenu === 'start_time'}
      <div 
        class="absolute -left-[160px] top-10 w-38 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.9)] p-1 z-[60] max-h-68 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
      >
        {#each timePresets as preset}
          <button
            onclick={() => selectPresetTime(isStart, preset)}
            class="px-2.5 py-1 text-xs text-zinc-200 hover:text-white hover:bg-[#2c2c2c] rounded text-left transition-colors font-mono cursor-pointer"
          >
            {preset}
          </button>
        {/each}
      </div>
    {/if}

    <!-- 2. Timezone Search Popover -->
    {#if activeSideMenu === 'timezone'}
      <div 
        class="absolute -left-[270px] top-24 w-66 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.9)] p-2 z-[60] flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100"
      >
        <div class="flex items-center gap-2 px-2 py-1 bg-[#141414] border border-[#2a2a2a] rounded-lg">
          <Search size={12} class="text-zinc-500" />
          <input
            type="text"
            placeholder="Search timezone..."
            bind:value={timezoneQuery}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
            autofocus
          />
        </div>
        <div class="max-h-56 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar">
          {#each filteredTimezones as tz}
            <button
              onclick={() => { updateField('timeZone', tz.tz); activeSideMenu = 'none'; }}
              class="flex items-center justify-between px-2 py-1.5 text-xs rounded-lg text-left transition-colors cursor-pointer
                {event.timeZone === tz.tz ? 'bg-[#282828] text-blue-400 font-semibold' : 'text-zinc-300 hover:bg-[#242424]'}"
            >
              <span class="text-zinc-500 font-mono text-[10px] w-14 shrink-0">{tz.offset}</span>
              <span class="truncate flex-1">{tz.name}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- 3. Recurrence Popover -->
    {#if activeSideMenu === 'repeat'}
      <div 
        class="absolute -left-[230px] top-32 w-54 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.9)] p-1.5 z-[60] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
      >
        {#each repeatOptions as opt}
          <button
            onclick={() => { updateField('rrule', opt.id); activeSideMenu = 'none'; }}
            class="flex items-center justify-between px-2 py-1.5 text-xs rounded-lg text-left transition-colors cursor-pointer
              {(event.rrule || 'none') === opt.id ? 'bg-[#282828] text-blue-400 font-semibold' : 'text-zinc-300 hover:bg-[#242424]'}"
          >
            <span>{opt.label}</span>
            {#if opt.sub}
              <span class="text-[10px] text-zinc-500">{opt.sub}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <!-- 4. Calendar & Color Swatches Popover -->
    {#if activeSideMenu === 'calendar'}
      <div 
        class="absolute -left-[240px] bottom-14 w-58 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.9)] p-2 z-[60] flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100"
      >
        <div class="text-[10px] font-semibold text-zinc-400 px-1">amilavaz2003@gmail.com</div>
        <div class="flex flex-col gap-0.5">
          {#each calendarState.calendars as cal}
            <button
              onclick={() => { updateField('calendarId', cal.id); activeSideMenu = 'none'; }}
              class="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-[#2a2a2a] transition-colors cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: {cal.colorHex};"></span>
                <span class="text-zinc-200">{cal.name}</span>
              </div>
              {#if event.calendarId === cal.id}
                <Check size={12} class="text-blue-400" />
              {/if}
            </button>
          {/each}
        </div>

        <div class="h-[1px] bg-[#292929]"></div>

        <div class="text-[10px] font-semibold text-zinc-400 px-1">Event color</div>
        <div class="flex items-center justify-between px-1">
          {#each [{ name: 'Red', hex: '#ef4444' }, { name: 'Orange', hex: '#f97316' }, { name: 'Amber', hex: '#f59e0b' }, { name: 'Green', hex: '#10b981' }, { name: 'Blue', hex: '#3b82f6' }, { name: 'Purple', hex: '#8b5cf6' }, { name: 'Default', hex: '#71717a' }] as c}
            <button
              onclick={() => { updateField('colorOverride', c.hex === '#71717a' ? undefined : c.hex); activeSideMenu = 'none'; }}
              class="w-3.5 h-3.5 rounded-full flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
              style="background-color: {c.hex};"
            >
              {#if (event.colorOverride === c.hex) || (!event.colorOverride && c.hex === '#71717a')}
                <Check size={9} class="text-white" />
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- 5. Reminders Popover -->
    {#if activeSideMenu === 'reminders'}
      <div 
        class="absolute -left-[200px] bottom-3 w-48 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.9)] p-1 z-[60] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100"
      >
        {#each reminderOptions as opt}
          <button
            onclick={() => { updateField('reminders', opt.id); activeSideMenu = 'none'; }}
            class="flex items-center justify-between px-2 py-1 text-xs rounded text-left transition-colors cursor-pointer
              {(event.reminders || '30m') === opt.id ? 'bg-[#282828] text-blue-400 font-semibold' : 'text-zinc-300 hover:bg-[#242424]'}"
          >
            <span>{opt.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </aside>
{/if}