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
    Plus, 
    ChevronDown,
    Scissors,
    Copy,
    Files,
    ExternalLink,
    Check,
    Search
  } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { resolveEventColorToken, NOTION_COLORS } from '../../utils/colors';
  import { dispatchEventReminder } from '../../utils/notifications';
  import type { CalendarEvent } from '../../../types/event';

  // 1. Declare state variables first
  let draft = $state<CalendarEvent | null>(null);
  let initialEventSnapshot: CalendarEvent | null = null;

  // 2. Derived reactive bindings
  let masterEvent = $derived(calendarState.selectedEvent);
  let activeCalendar = $derived(
    calendarState.calendars.find((c) => c.id === (draft?.calendarId || masterEvent?.calendarId)) || calendarState.calendars[0]
  );
  let colorToken = $derived(resolveEventColorToken(draft?.colorOverride || activeCalendar?.colorHex));

  let activeSideMenu = $state<'none' | 'start_time' | 'end_time' | 'timezone' | 'repeat' | 'reminders' | 'calendar'>('none');
  let isTypeDropdownOpen = $state(false);
  let isActionMenuOpen = $state(false);

  let startTimeInput = $state('');
  let endTimeInput = $state('');
  let participantInput = $state('');
  let isAddingAttachment = $state(false);
  let attachmentInput = $state('');
  let timezoneQuery = $state('');

  $effect(() => {
    if (masterEvent && (!draft || draft.id !== masterEvent.id)) {
      const projected = { ...masterEvent };
      if (calendarState.selectedDateKey && masterEvent.rrule && masterEvent.rrule !== 'none') {
        const [y, m, d] = calendarState.selectedDateKey.split('-').map(Number);
        const origStart = parseISO(masterEvent.startTime);
        const origEnd = parseISO(masterEvent.endTime);
        const duration = differenceInMinutes(origEnd, origStart);

        const newStart = new Date(y, m - 1, d, origStart.getHours(), origStart.getMinutes());
        const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);
        projected.startTime = newStart.toISOString();
        projected.endTime = newEnd.toISOString();
        projected.occurrenceDate = calendarState.selectedDateKey;
      }
      draft = JSON.parse(JSON.stringify(projected));
      initialEventSnapshot = JSON.parse(JSON.stringify(projected));
      startTimeInput = format(parseISO(projected.startTime), 'h:mm a');
      endTimeInput = format(parseISO(projected.endTime), 'h:mm a');
    }
  });

  let sideMenuOnRight = $derived.by(() => {
    if (!calendarState.inspectorRect) return false;
    return calendarState.inspectorRect.left < 310;
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
    if (!draft) return [];
    const d = parseISO(draft.startTime);
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

  const reminderPresets = [
    { id: '0m', label: 'At start of event' },
    { id: '5m', label: '5 min before' },
    { id: '10m', label: '10 min before' },
    { id: '15m', label: '15 min before' },
    { id: '30m', label: '30 min before' },
    { id: '1h', label: '1 hour before' },
    { id: '1d', label: '1 day before' }
  ];

  let durationText = $derived.by(() => {
    if (!draft || draft.isAllDay) return '';
    const diff = differenceInMinutes(parseISO(draft.endTime), parseISO(draft.startTime));
    if (diff < 60) return `${diff} min`;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
  });

  let repeatLabel = $derived.by(() => {
    const target = repeatOptions.find(opt => opt.id === (draft?.rrule || 'none'));
    if (!target) return 'Does not repeat';
    return target.sub ? `${target.label} ${target.sub}` : target.label;
  });

  function updateDraft<K extends keyof CalendarEvent>(field: K, value: CalendarEvent[K]) {
    if (!draft) return;
    draft = { ...draft, [field]: value, updatedAt: new Date().toISOString() };
  }

  function handleInspectorClose() {
    if (!draft || !masterEvent) {
      calendarState.closeInspector();
      activeSideMenu = 'none';
      return;
    }

    if (calendarState.isCreatingNewEvent) {
      eventStore.updateEvent(draft);
      calendarState.closeInspector();
      activeSideMenu = 'none';
      draft = null;
      initialEventSnapshot = null;
      return;
    }

    if (!masterEvent.rrule || masterEvent.rrule === 'none') {
      eventStore.updateEvent(draft);
      calendarState.closeInspector();
      activeSideMenu = 'none';
      draft = null;
      initialEventSnapshot = null;
      return;
    }

    if (initialEventSnapshot) {
      const hasChanged = (
        initialEventSnapshot.title !== draft.title ||
        initialEventSnapshot.startTime !== draft.startTime ||
        initialEventSnapshot.endTime !== draft.endTime ||
        initialEventSnapshot.description !== draft.description ||
        initialEventSnapshot.colorOverride !== draft.colorOverride ||
        initialEventSnapshot.calendarId !== draft.calendarId ||
        initialEventSnapshot.rrule !== draft.rrule
      );

      if (hasChanged) {
        contextMenuStore.promptRecurringAction(
          'update',
          masterEvent,
          draft,
          calendarState.selectedDateKey || undefined
        );
      }
    }

    calendarState.closeInspector();
    activeSideMenu = 'none';
    draft = null;
    initialEventSnapshot = null;
  }

  function applyCustomTime(isStart: boolean, timeStr: string) {
    if (!draft) return;
    try {
      const parsed = parse(timeStr.trim().toUpperCase(), 'h:mm a', new Date());
      if (!isNaN(parsed.getTime())) {
        const baseDate = parseISO(isStart ? draft.startTime : draft.endTime);
        const updated = setMinutes(setHours(baseDate, parsed.getHours()), parsed.getMinutes());
        if (isStart) {
          updateDraft('startTime', updated.toISOString());
        } else {
          updateDraft('endTime', updated.toISOString());
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
    if (!draft) return;
    const next = !draft.isAllDay;
    if (next) {
      updateDraft('isAllDay', true);
      updateDraft('startTime', startOfDay(parseISO(draft.startTime)).toISOString());
      updateDraft('endTime', endOfDay(parseISO(draft.startTime)).toISOString());
    } else {
      updateDraft('isAllDay', false);
      const start = setMinutes(setHours(parseISO(draft.startTime), 9), 0);
      const end = setMinutes(setHours(parseISO(draft.startTime), 10), 0);
      updateDraft('startTime', start.toISOString());
      updateDraft('endTime', end.toISOString());
    }
  }

  function toggleGoogleMeet() {
    if (!draft) return;
    if (draft.conferencingUrl) {
      updateDraft('conferencingUrl', undefined);
    } else {
      updateDraft('conferencingUrl', 'https://meet.google.com/' + Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5));
    }
  }

  function addAiMeetingNotes() {
    if (!draft) return;
    const template = `\n\n### 🤖 AI Meeting Summary\n* Key Discussion Points:\n* Action Items:\n* Next Follow-up:`;
    updateDraft('description', (draft.description || '') + template);
  }

  function addReminder(remId: string) {
    if (!draft) return;
    const current = Array.isArray(draft.reminders) ? draft.reminders : [];
    if (!current.includes(remId)) {
      updateDraft('reminders', [...current, remId]);
      dispatchEventReminder(draft);
    }
    activeSideMenu = 'none';
  }

  function removeReminder(remId: string) {
    if (!draft) return;
    const current = Array.isArray(draft.reminders) ? draft.reminders : [];
    updateDraft('reminders', current.filter(r => r !== remId));
  }

  function calculatePosition(rect: DOMRect | null) {
    const width = 280;
    const targetHeight = 480;
    const topNavOffset = 48;
    const bottomPadding = 16;
    const maxAvailableHeight = Math.max(300, window.innerHeight - topNavOffset - bottomPadding);
    const cardHeight = Math.min(targetHeight, maxAvailableHeight);

    if (!rect) {
      return `top: ${topNavOffset + 12}px; right: 24px; height: ${cardHeight}px;`;
    }

    let left = rect.right + 10;
    if (left + width > window.innerWidth - 16) {
      left = Math.max(16, rect.left - width - 10);
    }

    let top = rect.top - 10;
    if (top + cardHeight > window.innerHeight - bottomPadding) {
      top = window.innerHeight - bottomPadding - cardHeight;
    }
    if (top < topNavOffset) {
      top = topNavOffset;
    }

    return `top: ${top}px; left: ${left}px; height: ${cardHeight}px;`;
  }
</script>

{#if draft}
  <!-- Global click-away backdrop for floating inspector -->
  {#if !calendarState.isInspectorDocked}
    <div
      class="fixed inset-0 z-40 bg-black/20"
      onclick={handleInspectorClose}
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

  <!-- Notion 280px Compact Inspector Card -->
  <aside
    class="{calendarState.isInspectorDocked 
      ? 'w-[280px] h-full border-l border-[#262626] bg-[#161616] flex flex-col z-40 shrink-0 select-text relative' 
      : 'fixed z-50 w-[280px] bg-[#181818] border border-[#2b2b2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col select-text overflow-visible animate-in fade-in zoom-in-95 duration-100'}"
    style={calendarState.isInspectorDocked ? '' : calculatePosition(calendarState.inspectorRect)}
  >
    <!-- Top Action Bar -->
    <div class="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-[#242424] shrink-0 rounded-t-2xl bg-[#181818]">
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
                  if (draft) {
                    calendarState.clipboardEvent = { ...draft };
                    eventStore.deleteEvent(draft.id);
                  }
                  handleInspectorClose();
                  isActionMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded-lg transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2"><Scissors size={13} /><span>Cut</span></div>
                <span class="text-[10px] text-zinc-500 font-mono">Ctrl X</span>
              </button>
              <button 
                onclick={() => {
                  if (draft) calendarState.clipboardEvent = { ...draft };
                  isActionMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded-lg transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2"><Copy size={13} /><span>Copy</span></div>
                <span class="text-[10px] text-zinc-500 font-mono">Ctrl C</span>
              </button>
              <button 
                onclick={() => {
                  if (draft) eventStore.addEvent({ ...draft, id: 'evt_' + Date.now(), title: draft.title + ' (Copy)' });
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
                  if (draft?.rrule && draft.rrule !== 'none') {
                    contextMenuStore.promptRecurringAction('delete', draft);
                  } else if (draft) {
                    eventStore.deleteEvent(draft.id);
                    handleInspectorClose();
                  }
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
          onclick={handleInspectorClose} 
          class="p-1 hover:text-zinc-200 hover:bg-[#242424] rounded transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>

    <!-- Scrollable Form Body -->
    <div class="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 flex flex-col gap-2.5 custom-scrollbar">
      <input
        type="text"
        placeholder="Add title"
        value={draft.title}
        oninput={(e) => updateDraft('title', (e.target as HTMLInputElement).value)}
        class="w-full bg-transparent text-sm font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-none shrink-0"
      />

      <div class="flex flex-col gap-1 shrink-0">
        <div class="flex items-center gap-1.5 text-xs">
          <Clock size={14} class="text-zinc-400 shrink-0" />
          
          {#if !draft.isAllDay}
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
              <span class="text-[10px] ml-0.5 truncate font-semibold" style="color: {colorToken.timeText};">{durationText}</span>
            {/if}
          {:else}
            <span class="text-zinc-300 font-semibold text-xs py-0.5">All Day</span>
          {/if}
        </div>

        <div class="pl-5 text-[11px] text-zinc-400 font-medium">
          {format(parseISO(draft.startTime), 'EEE MMM d')}
        </div>
      </div>

      <div class="flex items-center justify-between text-xs text-zinc-300 shrink-0">
        <span>All-day</span>
        <button
          type="button"
          onclick={toggleAllDay}
          class="w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 cursor-pointer
            {draft.isAllDay ? 'bg-blue-600' : 'bg-[#2b2b2b]'}"
        >
          <div
            class="w-3 h-3 bg-white rounded-full transition-transform
              {draft.isAllDay ? 'translate-x-3' : 'translate-x-0'}"
          ></div>
        </button>
      </div>

      <button 
        onclick={() => { activeSideMenu = activeSideMenu === 'timezone' ? 'none' : 'timezone'; timezoneQuery = ''; }}
        class="w-full flex items-center justify-between text-xs text-zinc-300 hover:text-white py-0.5 rounded hover:bg-[#222222] transition-colors cursor-pointer shrink-0"
      >
        <div class="flex items-center gap-2 truncate">
          <Globe size={13} class="shrink-0 text-zinc-400" />
          <span class="truncate">{draft.timeZone || 'GMT+5:30 Colombo'}</span>
        </div>
        <ChevronDown size={12} class="text-zinc-500 shrink-0" />
      </button>

      <button 
        onclick={() => activeSideMenu = activeSideMenu === 'repeat' ? 'none' : 'repeat'}
        class="w-full flex items-center justify-between text-xs text-zinc-300 hover:text-white py-0.5 rounded hover:bg-[#222222] transition-colors cursor-pointer shrink-0"
      >
        <div class="flex items-center gap-2 truncate">
          <Repeat size={13} class="shrink-0 text-zinc-400" />
          <span class="truncate">{repeatLabel}</span>
        </div>
        <ChevronDown size={12} class="text-zinc-500 shrink-0" />
      </button>

      <div class="h-[1px] bg-[#242424] -mx-1 shrink-0"></div>

      <div class="flex flex-col gap-1.5 text-xs shrink-0">
        <div class="flex items-center gap-2 text-zinc-400 truncate">
          <User size={13} class="shrink-0 text-zinc-500" />
          <span class="truncate">Created by <strong class="text-zinc-300 font-medium">{draft.creatorEmail || 'amilavaz2003@gmail.com'}</strong></span>
        </div>

        <div class="flex items-center gap-2 text-zinc-400">
          <Users size={13} class="shrink-0 text-zinc-500" />
          <input
            type="text"
            placeholder="Add participant"
            bind:value={participantInput}
            onkeydown={(e) => {
              if (e.key === 'Enter' && participantInput.trim()) {
                updateDraft('participants', [...(draft?.participants || []), participantInput.trim()]);
                participantInput = '';
              }
            }}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
          />
        </div>

        {#if draft.participants && draft.participants.length > 0}
          <div class="flex flex-wrap gap-1 pl-5">
            {#each draft.participants as p, i}
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#252525] border border-[#2f2f2f] text-[10px] text-zinc-300">
                <span>{p}</span>
                <button 
                  onclick={() => updateDraft('participants', draft?.participants?.filter((_, idx) => idx !== i))}
                  class="hover:text-rose-400 cursor-pointer"
                >
                  <X size={10} />
                </button>
              </span>
            {/each}
          </div>
        {/if}
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1 shrink-0"></div>

      <div class="flex flex-col gap-1.5 text-xs shrink-0">
        <button 
          onclick={toggleGoogleMeet}
          class="flex items-center justify-between text-zinc-400 hover:text-zinc-200 text-left py-0.5 cursor-pointer group"
        >
          <div class="flex items-center gap-2 truncate">
            <Video size={13} class="shrink-0 text-zinc-500 group-hover:text-zinc-300" />
            <span class="truncate {draft.conferencingUrl ? 'text-blue-400 font-semibold underline' : ''}">
              {draft.conferencingUrl ? 'Google Meet Call' : 'Conferencing'}
            </span>
          </div>
          {#if draft.conferencingUrl}
            <ExternalLink size={11} class="text-zinc-500 shrink-0" />
          {/if}
        </button>

        <button 
          onclick={addAiMeetingNotes}
          class="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 text-left py-0.5 cursor-pointer"
        >
          <Sparkles size={13} class="shrink-0 text-amber-500/80" />
          <span>Add AI meeting notes</span>
        </button>

        <div class="flex items-center gap-2 text-zinc-400 py-0.5">
          <MapPin size={13} class="shrink-0 text-zinc-500" />
          <input
            type="text"
            placeholder="Location"
            value={draft.location || ''}
            oninput={(e) => updateDraft('location', (e.target as HTMLInputElement).value)}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
          />
        </div>

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
                    updateDraft('attachments', [...(draft?.attachments || []), attachmentInput.trim()]);
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

          {#if draft.attachments && draft.attachments.length > 0}
            <div class="flex flex-col gap-1 pl-5">
              {#each draft.attachments as att, i}
                <div class="flex items-center justify-between p-1 rounded bg-[#202020] border border-[#2b2b2b] text-[10px] text-blue-400 truncate">
                  <span class="truncate underline cursor-pointer">{att}</span>
                  <button 
                    onclick={() => updateDraft('attachments', draft?.attachments?.filter((_, idx) => idx !== i))}
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

      <div class="h-[1px] bg-[#242424] -mx-1 shrink-0"></div>

      <div class="flex flex-col gap-1 text-xs shrink-0">
        <div class="flex items-center gap-1.5 text-zinc-400">
          <AlignLeft size={13} class="text-zinc-500" />
          <span class="font-medium">Description</span>
        </div>
        <textarea
          rows="3"
          placeholder="Add description or notes..."
          value={draft.description || ''}
          oninput={(e) => updateDraft('description', (e.target as HTMLTextAreaElement).value)}
          class="w-full bg-[#1c1c1c] border border-[#282828] rounded-lg p-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 resize-none custom-scrollbar"
        ></textarea>
      </div>

      <div class="h-[1px] bg-[#242424] -mx-1 shrink-0"></div>

      <button 
        onclick={() => activeSideMenu = activeSideMenu === 'calendar' ? 'none' : 'calendar'}
        class="w-full flex items-center justify-between p-1 rounded-md hover:bg-[#222222] transition-colors cursor-pointer shrink-0"
      >
        <div class="flex items-center gap-2 truncate">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {colorToken.hex};"></span>
          <span class="text-xs font-semibold text-zinc-200 truncate">{activeCalendar.name}</span>
        </div>
        <ChevronDown size={12} class="text-zinc-500 shrink-0" />
      </button>

      <div class="flex items-center justify-between text-xs text-zinc-300 shrink-0">
        <select
          value={draft.busyStatus}
          onchange={(e) => updateDraft('busyStatus', (e.target as HTMLSelectElement).value as any)}
          class="bg-[#1f1f1f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none cursor-pointer"
        >
          <option value="busy" class="bg-[#181818]">Busy</option>
          <option value="free" class="bg-[#181818]">Free</option>
        </select>

        <select
          value={draft.visibility || 'default'}
          onchange={(e) => updateDraft('visibility', (e.target as HTMLSelectElement).value as any)}
          class="bg-[#1f1f1f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none cursor-pointer"
        >
          <option value="default" class="bg-[#181818]">Default visibility</option>
          <option value="public" class="bg-[#181818]">Public</option>
          <option value="private" class="bg-[#181818]">Private</option>
        </select>
      </div>

      <div class="flex flex-col gap-1 shrink-0">
        <button 
          onclick={() => activeSideMenu = activeSideMenu === 'reminders' ? 'none' : 'reminders'}
          class="w-full flex items-center justify-between p-1 rounded hover:bg-[#222222] transition-colors cursor-pointer text-xs text-zinc-400 hover:text-zinc-200"
        >
          <div class="flex items-center gap-1.5">
            <Bell size={13} class="text-zinc-500" />
            <span class="font-medium">Reminders</span>
          </div>
          <Plus size={13} class="text-zinc-500" />
        </button>

        {#if draft.reminders && draft.reminders.length > 0}
          <div class="flex flex-col gap-1 pl-5">
            {#each draft.reminders as rem}
              {@const label = reminderPresets.find(r => r.id === rem)?.label || rem}
              <div class="flex items-center justify-between py-0.5 text-xs text-zinc-300 hover:text-white group">
                <span>{label}</span>
                <button 
                  onclick={() => removeReminder(rem)}
                  class="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-rose-400 transition-opacity cursor-pointer"
                  title="Remove reminder"
                >
                  <X size={11} />
                </button>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Side-Docked Dropdowns -->
    {#if activeSideMenu === 'start_time' || activeSideMenu === 'end_time'}
      {@const isStart = activeSideMenu === 'start_time'}
      <div 
        class="absolute top-10 w-38 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] p-1 z-[999] max-h-68 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-[160px]'}"
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

    {#if activeSideMenu === 'timezone'}
      <div 
        class="absolute top-24 w-66 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] p-2 z-[999] flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-[270px]'}"
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
              onclick={() => { updateDraft('timeZone', tz.tz); activeSideMenu = 'none'; }}
              class="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors cursor-pointer
                {draft.timeZone === tz.tz ? 'bg-[#282828] text-blue-400 font-semibold' : 'text-zinc-300 hover:bg-[#242424]'}"
            >
              <span class="text-zinc-500 font-mono text-[10px] w-14 shrink-0">{tz.offset}</span>
              <span class="truncate flex-1">{tz.name}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if activeSideMenu === 'repeat'}
      <div 
        class="absolute top-32 w-54 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] p-1.5 z-[999] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-[230px]'}"
      >
        {#each repeatOptions as opt}
          <button
            onclick={() => { updateDraft('rrule', opt.id); activeSideMenu = 'none'; }}
            class="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors cursor-pointer
              {(draft.rrule || 'none') === opt.id ? 'bg-[#282828] text-blue-400 font-semibold' : 'text-zinc-300 hover:bg-[#242424]'}"
          >
            <span>{opt.label}</span>
            {#if opt.sub}
              <span class="text-[10px] text-zinc-500">{opt.sub}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    {#if activeSideMenu === 'calendar'}
      <div 
        class="absolute bottom-14 w-58 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] p-2 z-[999] flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-[240px]'}"
      >
        <div class="text-[10px] font-semibold text-zinc-400 px-1">amilavaz2003@gmail.com</div>
        <div class="flex flex-col gap-0.5">
          {#each calendarState.calendars as cal}
            <button
              onclick={() => { updateDraft('calendarId', cal.id); activeSideMenu = 'none'; }}
              class="flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-[#2a2a2a] transition-colors cursor-pointer"
            >
              <div class="flex items-center gap-2">
                <span class="w-2.5 h-2.5 rounded-full" style="background-color: {cal.colorHex};"></span>
                <span class="text-zinc-200">{cal.name}</span>
              </div>
              {#if draft.calendarId === cal.id}
                <Check size={12} class="text-blue-400" />
              {/if}
            </button>
          {/each}
        </div>

        <div class="h-[1px] bg-[#292929]"></div>

        <div class="text-[10px] font-semibold text-zinc-400 px-1">Event color</div>
        <div class="flex items-center justify-between px-1">
          {#each Object.values(NOTION_COLORS) as c}
            <button
              onclick={() => { updateDraft('colorOverride', c.id === 'charcoal' ? undefined : c.hex); activeSideMenu = 'none'; }}
              class="w-3.5 h-3.5 rounded-full flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
              style="background-color: {c.hex};"
              title={c.name}
            >
              {#if (draft.colorOverride === c.hex) || (!draft.colorOverride && c.id === 'charcoal')}
                <Check size={9} class="text-white" />
              {/if}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    {#if activeSideMenu === 'reminders'}
      <div 
        class="absolute bottom-3 w-48 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] p-1 z-[999] flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-[200px]'}"
      >
        {#each reminderPresets as opt}
          <button
            onclick={() => addReminder(opt.id)}
            class="flex items-center justify-between px-2 py-1 text-xs rounded text-left transition-colors cursor-pointer text-zinc-300 hover:bg-[#242424] hover:text-white"
          >
            <span>{opt.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </aside>
{/if}