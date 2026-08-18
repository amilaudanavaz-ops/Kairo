<script lang="ts">
  import { untrack } from 'svelte';
  import { 
    format, 
    parseISO, 
    differenceInMinutes, 
    setHours, 
    setMinutes, 
    startOfDay, 
    endOfDay, 
    getWeekOfMonth,
    addMinutes,
    addMonths,
    subMonths,
    addDays,
    subDays,
    addWeeks,
    subWeeks,
    addYears,
    subYears,
    isSameDay,
    isToday,
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
    Users, 
    Video, 
    Sparkles, 
    MapPin, 
    Paperclip, 
    AlignLeft, 
    Bell, 
    Plus, 
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Scissors,
    Copy,
    Files,
    Check,
    Search,
    ArrowRight,
    Eye,
    EyeOff,
    Lock
  } from 'lucide-svelte';
  import { calendarState } from '../../stores/calendarState.svelte';
  import { eventStore } from '../../stores/eventStore.svelte';
  import { settingsStore } from '../../stores/settingsStore.svelte';
  import { contextMenuStore } from '../../stores/contextMenuStore.svelte';
  import { resolveEventColorToken, KAIRO_COLORS } from '../../utils/colors';
  import { generateMonthGrid, formatRRuleLabel } from '../../utils/dateMath';
  import { dispatchEventReminder } from '../../utils/notifications';
  import type { CalendarEvent, CalendarCategory, ParticipantContact, LocationSuggestion } from '../../../types/event';

  let inspectorElement: HTMLElement | null = $state(null);
  let draft = $state<CalendarEvent | null>(null);
  let initialEventSnapshot: CalendarEvent | null = null;

  let masterEvent = $derived(calendarState.selectedEvent);
  let activeCalendar = $derived(
    calendarState.calendars.find((c: CalendarCategory) => c.id === (draft?.calendarId || masterEvent?.calendarId)) || calendarState.calendars[0]
  );
  let isReadOnly = $derived(
    activeCalendar?.accessRole === 'reader' || activeCalendar?.accessRole === 'freeBusyReader'
  );
  let colorToken = $derived(resolveEventColorToken(draft?.colorOverride || activeCalendar?.colorHex));

  let activeSideMenu = $state<'none' | 'date' | 'start_time' | 'end_time' | 'timezone' | 'repeat' | 'reminders' | 'calendar' | 'participants' | 'conferencing' | 'location'>('none');
  let isTypeDropdownOpen = $state(false);
  let isActionMenuOpen = $state(false);

  let pickerMonth = $state(new Date());
  let startTimeInput = $state('');
  let endTimeInput = $state('');
  let dateInput = $state('');
  let participantQuery = $state('');
  let locationQuery = $state('');
  let isAddingAttachment = $state(false);
  let attachmentInput = $state('');
  let timezoneQuery = $state('');

  // Live Location Suggestions via OpenStreetMap Photon
  let liveLocations = $state<LocationSuggestion[]>([]);
  let locationFetchTimeout: number | undefined;

  function handleLocationInput(val: string) {
    if (isReadOnly) return;
    locationQuery = val;
    updateDraft('location', val);
    clearTimeout(locationFetchTimeout);
    if (!val.trim()) {
      liveLocations = calendarState.locations;
      return;
    }

    locationFetchTimeout = window.setTimeout(async () => {
      try {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(val)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          liveLocations = (data.features || []).map((f: any) => ({
            title: f.properties.name || f.properties.street || val,
            subtitle: [f.properties.city, f.properties.state, f.properties.country].filter(Boolean).join(', ')
          }));
        }
      } catch {
        liveLocations = calendarState.locations.filter((l: LocationSuggestion) => 
          l.title.toLowerCase().includes(val.toLowerCase())
        );
      }
    }, 200);
  }

  let filteredContacts = $derived.by(() => {
    if (!participantQuery.trim()) return calendarState.contacts;
    const q = participantQuery.toLowerCase();
    return calendarState.contacts.filter((c: ParticipantContact) => 
      c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
    );
  });

  $effect(() => {
    const currentEvent = masterEvent;
    const dateKey = calendarState.selectedDateKey;

    if (!currentEvent) {
      untrack(() => {
        draft = null;
        initialEventSnapshot = null;
      });
      return;
    }

    const targetKey = `${currentEvent.id}_${dateKey || ''}`;

    untrack(() => {
      if (!draft || `${draft.id}_${draft.occurrenceDate || ''}` !== targetKey) {
        const projected = { ...currentEvent };
        if (dateKey && currentEvent.rrule && currentEvent.rrule !== 'none') {
          const [y, m, d] = dateKey.split('-').map(Number);
          const origStart = parseISO(currentEvent.startTime);
          const origEnd = parseISO(currentEvent.endTime);
          const duration = differenceInMinutes(origEnd, origStart);

          const newStart = new Date(y, m - 1, d, origStart.getHours(), origStart.getMinutes());
          const newEnd = new Date(newStart.getTime() + duration * 60 * 1000);
          projected.startTime = newStart.toISOString();
          projected.endTime = newEnd.toISOString();
          projected.occurrenceDate = dateKey;
        }
        draft = JSON.parse(JSON.stringify(projected));
        initialEventSnapshot = JSON.parse(JSON.stringify(projected));
        pickerMonth = parseISO(projected.startTime);
        startTimeInput = format(parseISO(projected.startTime), 'h:mm a');
        endTimeInput = format(parseISO(projected.endTime), 'h:mm a');
        dateInput = format(parseISO(projected.startTime), 'EEE MMM d');
        locationQuery = projected.location || '';
        liveLocations = calendarState.locations;
      }
    });
  });

  $effect(() => {
    function handleGlobalPointerDown(e: MouseEvent) {
      if (contextMenuStore.isRecurrenceModalOpen || settingsStore.isOpen) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;

      if (inspectorElement && inspectorElement.contains(target)) return;
      if (target.closest('.recurrence-modal') || target.closest('.dialog-overlay') || target.closest('.settings-modal')) return;

      if (activeSideMenu !== 'none') {
        activeSideMenu = 'none';
      }

      if (calendarState.isInspectorDocked) {
        commitDraftChanges(false);
      } else {
        if (target.closest('[data-calendar-event]')) {
          commitDraftChanges(false);
        } else {
          handleInspectorClose();
        }
      }
    }

    window.addEventListener('pointerdown', handleGlobalPointerDown);
    return () => {
      window.removeEventListener('pointerdown', handleGlobalPointerDown);
    };
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
    const d = draft.originalStartTime ? parseISO(draft.originalStartTime) : parseISO(draft.startTime);
    const dayName = format(d, 'EEE');
    const dayOfMonth = format(d, 'do');
    const monthDay = format(d, 'MMM d');
    const weekNum = ['1st', '2nd', '3rd', '4th', '5th'][getWeekOfMonth(d) - 1] || 'last';

    const list = [
      { id: 'none', label: 'Does not repeat' },
      { id: 'daily', label: 'Every day' },
      { id: 'weekday', label: 'Every weekday', sub: 'Mon – Fri' },
      { id: 'weekly', label: `Every week`, sub: `on ${dayName}` },
      { id: 'biweekly', label: `Every 2 weeks`, sub: `on ${dayName}` },
      { id: 'monthly_date', label: `Every month`, sub: `on the ${dayOfMonth}` },
      { id: 'monthly_day', label: `Every month`, sub: `on the ${weekNum} ${dayName}` },
      { id: 'yearly', label: `Every year`, sub: `on ${monthDay}` }
    ];

    if (draft.rrule && draft.rrule !== 'none') {
      const parsed = formatRRuleLabel(draft.rrule, d);
      const exists = list.some(o => o.id === parsed.id || (o.label === parsed.label && o.sub === parsed.sub));
      if (!exists && parsed.id !== 'none') {
        list.push({ id: draft.rrule, label: parsed.label, sub: parsed.sub });
      }
    }

    return list;
  });

  let parsedRRuleDisplay = $derived.by(() => {
    if (!draft) return { id: 'none', label: 'Does not repeat' };
    if (draft.rrule && draft.rrule !== 'none') {
      const refDate = draft.originalStartTime ? parseISO(draft.originalStartTime) : parseISO(draft.startTime);
      return formatRRuleLabel(draft.rrule, refDate);
    }
    if (draft.recurringEventId || draft.isRecurringInstance) {
      return { id: 'weekly', label: 'Every week', sub: `on ${format(parseISO(draft.startTime), 'EEE')}` };
    }
    return { id: 'none', label: 'Does not repeat' };
  });

  let repeatLabel = $derived.by(() => {
    const d = parsedRRuleDisplay;
    if (d.id === 'none') return d.label;
    return d.sub ? `${d.label} ${d.sub}` : d.label;
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
    if (diff < 0) return '0 min';
    if (diff < 60) return `${diff} min`;
    const hrs = Math.floor(diff / 60);
    const mins = diff % 60;
    return mins > 0 ? `${hrs}h ${mins}min` : `${hrs}h`;
  });

  function updateDraft<K extends keyof CalendarEvent>(field: K, value: CalendarEvent[K]) {
    if (!draft || isReadOnly) return;
    draft = { ...draft, [field]: value, updatedAt: new Date().toISOString() };
  }

  function parseTime12h(timeStr: string): { hours: number; minutes: number } | null {
    const clean = timeStr.trim().toUpperCase().replace(/\s+/g, ' ');
    const match = clean.match(/^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)$/);
    if (!match) return null;
    let h = parseInt(match[1], 10);
    const m = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3];
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    if (h < 0 || h > 23 || m < 0 || m > 59) return null;
    return { hours: h, minutes: m };
  }

  function applyCustomTime(isStart: boolean, timeStr: string) {
    if (!draft || isReadOnly) return;
    const parsed = parseTime12h(timeStr);
    if (!parsed) return;

    const baseStart = parseISO(draft.startTime);
    const baseEnd = parseISO(draft.endTime);
    const currentDuration = Math.max(15, differenceInMinutes(baseEnd, baseStart));

    if (isStart) {
      const newStart = setMinutes(setHours(baseStart, parsed.hours), parsed.minutes);
      const newEnd = addMinutes(newStart, currentDuration);
      draft = {
        ...draft,
        startTime: newStart.toISOString(),
        endTime: newEnd.toISOString(),
        updatedAt: new Date().toISOString()
      };
      startTimeInput = format(newStart, 'h:mm a');
      endTimeInput = format(newEnd, 'h:mm a');
    } else {
      let newEnd = setMinutes(setHours(baseEnd, parsed.hours), parsed.minutes);
      if (newEnd <= baseStart) {
        newEnd = addMinutes(baseStart, 15);
      }
      draft = {
        ...draft,
        endTime: newEnd.toISOString(),
        updatedAt: new Date().toISOString()
      };
      endTimeInput = format(newEnd, 'h:mm a');
    }
  }

  function selectPresetTime(isStart: boolean, preset: string) {
    if (isReadOnly) return;
    applyCustomTime(isStart, preset);
    activeSideMenu = 'none';
  }

  function applyCustomDate(str: string) {
    if (!draft || isReadOnly) return;
    try {
      let parsed: Date | null = null;
      const clean = str.trim();
      const formatsToTry = ['EEE MMM d', 'MMM d', 'EEE MMM d yyyy', 'MMM d yyyy', 'yyyy-MM-dd', 'M/d/yyyy', 'M/d'];

      for (const fmt of formatsToTry) {
        const d = parse(clean, fmt, new Date());
        if (!isNaN(d.getTime())) {
          parsed = d;
          break;
        }
      }

      if (!parsed) {
        const d = new Date(clean);
        if (!isNaN(d.getTime())) parsed = d;
      }

      if (parsed) {
        selectNewDate(parsed);
      } else {
        dateInput = format(parseISO(draft.startTime), 'EEE MMM d');
      }
    } catch {
      dateInput = format(parseISO(draft.startTime), 'EEE MMM d');
    }
  }

  function selectNewDate(targetDay: Date) {
    if (!draft || isReadOnly) return;
    const baseStart = parseISO(draft.startTime);
    const baseEnd = parseISO(draft.endTime);
    const duration = differenceInMinutes(baseEnd, baseStart);

    const newStart = new Date(
      targetDay.getFullYear(),
      targetDay.getMonth(),
      targetDay.getDate(),
      baseStart.getHours(),
      baseStart.getMinutes()
    );
    const newEnd = addMinutes(newStart, duration);

    draft = {
      ...draft,
      startTime: newStart.toISOString(),
      endTime: newEnd.toISOString(),
      occurrenceDate: format(newStart, 'yyyy-MM-dd'),
      updatedAt: new Date().toISOString()
    };
    dateInput = format(newStart, 'EEE MMM d');
    pickerMonth = newStart;
    activeSideMenu = 'none';
  }

  function navigateOccurrence(direction: 'prev' | 'next') {
    if (!draft || (!draft.recurringEventId && parsedRRuleDisplay.id === 'none') || !masterEvent) return;

    commitDraftChanges(false);

    if (draft.recurringEventId) {
      const siblings = eventStore.events
        .filter((e: CalendarEvent) => e.recurringEventId === draft?.recurringEventId && e.calendarId === draft?.calendarId)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

      const currentIdx = siblings.findIndex((s) => s.id === draft?.id);
      if (currentIdx !== -1) {
        const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
        if (nextIdx >= 0 && nextIdx < siblings.length) {
          const targetEvent = siblings[nextIdx];
          const targetDate = parseISO(targetEvent.startTime);
          const dateKey = format(targetDate, 'yyyy-MM-dd');
          calendarState.selectedEventId = targetEvent.id;
          calendarState.selectedDateKey = dateKey;
          calendarState.setDate(targetDate);
          return;
        }
      }
    }

    const currentOcc = parseISO(draft.startTime);
    let targetDate = currentOcc;
    const ruleId = parsedRRuleDisplay.id;

    if (ruleId === 'daily') targetDate = direction === 'prev' ? subDays(currentOcc, 1) : addDays(currentOcc, 1);
    else if (ruleId === 'weekday') {
      let d = direction === 'prev' ? subDays(currentOcc, 1) : addDays(currentOcc, 1);
      while (d.getDay() === 0 || d.getDay() === 6) {
        d = direction === 'prev' ? subDays(d, 1) : addDays(d, 1);
      }
      targetDate = d;
    }
    else if (ruleId === 'biweekly') targetDate = direction === 'prev' ? subWeeks(currentOcc, 2) : addWeeks(currentOcc, 2);
    else if (ruleId.startsWith('monthly')) targetDate = direction === 'prev' ? subMonths(currentOcc, 1) : addMonths(currentOcc, 1);
    else if (ruleId === 'yearly') targetDate = direction === 'prev' ? subYears(currentOcc, 1) : addYears(currentOcc, 1);
    else targetDate = direction === 'prev' ? subWeeks(currentOcc, 1) : addWeeks(currentOcc, 1);

    const masterStart = parseISO(masterEvent.startTime);
    if (direction === 'prev' && targetDate < startOfDay(masterStart)) return;

    const dateKey = format(targetDate, 'yyyy-MM-dd');
    calendarState.selectedDateKey = dateKey;
    calendarState.setDate(targetDate);
  }

  function selectParticipant(contact: ParticipantContact) {
    if (!draft || isReadOnly) return;
    const current = draft.participants || [];
    if (!current.includes(contact.email)) {
      updateDraft('participants', [...current, contact.email]);
    }
    participantQuery = '';
    activeSideMenu = 'none';
  }

  function selectLocation(loc: LocationSuggestion) {
    if (!draft || isReadOnly) return;
    const formatted = `${loc.title}, ${loc.subtitle}`;
    updateDraft('location', formatted);
    locationQuery = formatted;
    activeSideMenu = 'none';
  }

  function setGoogleMeet() {
    if (!draft || isReadOnly) return;
    const meetId = Math.random().toString(36).substring(2, 5) + '-' + Math.random().toString(36).substring(2, 6) + '-' + Math.random().toString(36).substring(2, 5);
    updateDraft('conferencingUrl', `https://meet.google.com/${meetId}`);
    updateDraft('conferencingProvider', 'google_meet');
    activeSideMenu = 'none';
  }

  function setZoom() {
    if (!draft || isReadOnly) return;
    const zoomId = Math.floor(100000000 + Math.random() * 900000000);
    updateDraft('conferencingUrl', `https://zoom.us/j/${zoomId}`);
    updateDraft('conferencingProvider', 'zoom');
    activeSideMenu = 'none';
  }

  function toggleAllDay() {
    if (!draft || isReadOnly) return;
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
      startTimeInput = format(start, 'h:mm a');
      endTimeInput = format(end, 'h:mm a');
    }
  }

  function addAiMeetingNotes() {
    if (!draft || isReadOnly) return;
    const template = `\n\n### 🤖 AI Meeting Summary\n* Key Discussion Points:\n* Action Items:\n* Next Follow-up:`;
    updateDraft('description', (draft.description || '') + template);
  }

  function addReminder(remId: string) {
    if (!draft || isReadOnly) return;
    const current = Array.isArray(draft.reminders) ? draft.reminders : [];
    if (!current.includes(remId)) {
      updateDraft('reminders', [...current, remId]);
      dispatchEventReminder(draft);
    }
    activeSideMenu = 'none';
  }

  function removeReminder(remId: string) {
    if (!draft || isReadOnly) return;
    const current = Array.isArray(draft.reminders) ? draft.reminders : [];
    updateDraft('reminders', current.filter((r: string) => r !== remId));
  }

  function calculatePosition(rect: DOMRect | null): string {
    const width = 300;
    const targetHeight = 500;
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

  function hasEventChanged(a: CalendarEvent, b: CalendarEvent): boolean {
    if ((a.title || '') !== (b.title || '')) return true;
    if (a.startTime !== b.startTime) return true;
    if (a.endTime !== b.endTime) return true;
    if ((a.description || '') !== (b.description || '')) return true;
    if (a.colorOverride !== b.colorOverride) return true;
    if (a.calendarId !== b.calendarId) return true;
    if (a.rrule !== b.rrule) return true;
    if (a.isAllDay !== b.isAllDay) return true;
    if (a.busyStatus !== b.busyStatus) return true;
    if (a.visibility !== b.visibility) return true;
    if (a.timeZone !== b.timeZone) return true;
    if (a.location !== b.location) return true;
    if (a.conferencingUrl !== b.conferencingUrl) return true;
    if (JSON.stringify(a.reminders || []) !== JSON.stringify(b.reminders || [])) return true;
    if (JSON.stringify(a.participants || []) !== JSON.stringify(b.participants || [])) return true;
    if (JSON.stringify(a.attachments || []) !== JSON.stringify(b.attachments || [])) return true;
    return false;
  }

  function commitDraftChanges(closeWhenClean: boolean = true) {
    if (!draft || !masterEvent || isReadOnly) {
      if (closeWhenClean) calendarState.closeInspector();
      return;
    }

    if (calendarState.isCreatingNewEvent) {
      eventStore.updateEvent(draft);
      calendarState.isCreatingNewEvent = false;
      initialEventSnapshot = JSON.parse(JSON.stringify(draft));
      if (closeWhenClean) calendarState.closeInspector();
      return;
    }

    if (!masterEvent.rrule || masterEvent.rrule === 'none') {
      if (initialEventSnapshot && hasEventChanged(initialEventSnapshot, draft)) {
        eventStore.updateEvent(draft);
        initialEventSnapshot = JSON.parse(JSON.stringify(draft));
      }
      if (closeWhenClean) calendarState.closeInspector();
      return;
    }

    if (initialEventSnapshot && hasEventChanged(initialEventSnapshot, draft)) {
      contextMenuStore.promptRecurringAction(
        'update',
        masterEvent,
        draft,
        calendarState.selectedDateKey || undefined,
        initialEventSnapshot
      );
    } else {
      if (closeWhenClean) calendarState.closeInspector();
    }
  }

  function handleInspectorClose() {
    commitDraftChanges(true);
    activeSideMenu = 'none';
  }
</script>

{#if masterEvent && draft}
  <aside
    bind:this={inspectorElement}
    class="{calendarState.isInspectorDocked 
      ? 'w-76 h-full border-l border-[#262626] bg-[#161616] flex flex-col z-60 shrink-0 select-text relative overflow-visible' 
      : 'fixed z-60 w-76 bg-[#181818] border border-[#2b2b2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.85)] flex flex-col select-text overflow-visible animate-in fade-in zoom-in-95 duration-100'}"
    style={calendarState.isInspectorDocked ? '' : calculatePosition(calendarState.inspectorRect)}
  >
    <!-- Top Toolbar -->
    <div class="flex items-center justify-between px-3 pt-2.5 pb-2 border-b border-[#242424] shrink-0 rounded-t-2xl bg-[#181818]">
      <div class="flex items-center gap-1.5">
        <div class="relative">
          <button 
            onpointerdown={(e) => { if (!isReadOnly) { e.stopPropagation(); isTypeDropdownOpen = !isTypeDropdownOpen; } }}
            class="flex items-center gap-1 text-xs font-semibold text-zinc-300 hover:text-white px-1.5 py-0.5 rounded hover:bg-[#242424] transition-colors {isReadOnly ? 'cursor-default' : 'cursor-pointer'}"
          >
            <span>Event</span>
            {#if !isReadOnly}
              <ChevronDown size={12} />
            {/if}
          </button>

          {#if isTypeDropdownOpen && !isReadOnly}
            <div class="absolute left-0 top-full mt-1 w-24 bg-[#202020] border border-[#2e2e2e] rounded-lg shadow-xl p-1 z-999 flex flex-col gap-0.5">
              {#each ['Event', 'Task', 'Reminder'] as t}
                <button
                  onpointerdown={(e) => { e.stopPropagation(); isTypeDropdownOpen = false; }}
                  class="text-left px-2 py-1 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded transition-colors cursor-pointer"
                >
                  {t}
                </button>
              {/each}
            </div>
          {/if}
        </div>

        {#if isReadOnly}
          <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] font-semibold text-zinc-400 select-none">
            <Lock size={10} />
            <span>Read-only</span>
          </span>
        {/if}
      </div>

      <div class="flex items-center gap-0.5 text-zinc-400">
        <div class="relative">
          <button 
            onpointerdown={(e) => { e.stopPropagation(); isActionMenuOpen = !isActionMenuOpen; }}
            class="p-1 hover:text-zinc-200 hover:bg-[#242424] rounded transition-colors cursor-pointer"
          >
            <MoreHorizontal size={14} />
          </button>

          {#if isActionMenuOpen}
            <div class="absolute right-0 top-full mt-1 w-44 bg-[#1f1f1f] border border-[#2e2e2e] rounded-xl shadow-2xl p-1 z-999 flex flex-col gap-0.5">
              {#if !isReadOnly}
                <button 
                  onpointerdown={(e) => {
                    e.stopPropagation();
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
              {/if}
              <button 
                onpointerdown={(e) => {
                  e.stopPropagation();
                  if (draft) calendarState.clipboardEvent = { ...draft };
                  isActionMenuOpen = false;
                }} 
                class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded-lg transition-colors cursor-pointer"
              >
                <div class="flex items-center gap-2"><Copy size={13} /><span>Copy</span></div>
                <span class="text-[10px] text-zinc-500 font-mono">Ctrl C</span>
              </button>
              {#if !isReadOnly}
                <button 
                  onpointerdown={(e) => {
                    e.stopPropagation();
                    if (draft) eventStore.addEvent({ ...draft, id: 'evt_' + Date.now(), title: draft.title + ' (Copy)' });
                    isActionMenuOpen = false;
                  }} 
                  class="flex items-center justify-between px-2.5 py-1.5 text-xs text-zinc-200 hover:bg-[#2c2c2c] rounded-lg transition-colors cursor-pointer"
                >
                  <div class="flex items-center gap-2"><Files size={13} /><span>Duplicate</span></div>
                  <span class="text-[10px] text-zinc-500 font-mono">Ctrl D</span>
                </button>
                <div class="h-px bg-[#292929] my-0.5"></div>
                <button 
                  onpointerdown={(e) => {
                    e.stopPropagation();
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
              {/if}
            </div>
          {/if}
        </div>

        <button 
          onpointerdown={(e) => { e.stopPropagation(); calendarState.toggleInspectorDock(); }}
          class="p-1 hover:text-zinc-200 hover:bg-[#242424] rounded transition-colors cursor-pointer {calendarState.isInspectorDocked ? 'text-blue-400' : ''}"
        >
          <PanelRight size={14} />
        </button>

        <button 
          onpointerdown={(e) => { e.stopPropagation(); handleInspectorClose(); }} 
          class="p-1 hover:text-zinc-200 hover:bg-[#242424] rounded transition-colors cursor-pointer"
        >
          <X size={14} />
        </button>
      </div>
    </div>

    <!-- Scrollable Body with Clean Inputs -->
    <div class="flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 flex flex-col gap-2.5 custom-scrollbar">
      <input
        type="text"
        placeholder="Add title"
        value={draft.title}
        disabled={isReadOnly}
        oninput={(e) => updateDraft('title', (e.target as HTMLInputElement).value)}
        class="w-full bg-transparent text-sm font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-none shrink-0 {isReadOnly ? 'cursor-default opacity-90' : ''}"
      />

      <!-- Time & Duration Row -->
      <div class="flex flex-col gap-1 shrink-0">
        <div class="flex items-center gap-2 text-xs">
          <Clock size={14} class="text-zinc-400 shrink-0" />
          
          {#if !draft.isAllDay}
            <div class="flex items-center gap-1.5 shrink-0">
              <input
                type="text"
                bind:value={startTimeInput}
                disabled={isReadOnly}
                onfocus={() => !isReadOnly && (activeSideMenu = 'start_time')}
                onblur={() => applyCustomTime(true, startTimeInput)}
                onkeydown={(e) => e.key === 'Enter' && applyCustomTime(true, startTimeInput)}
                class="w-[66px] shrink-0 bg-[#222222] {isReadOnly ? 'cursor-default' : 'hover:bg-[#282828] focus:bg-[#1a2333] focus:ring-1 focus:ring-blue-500'} rounded-md px-1 py-0.5 text-xs font-semibold text-zinc-100 focus:outline-none transition-colors text-center"
              />
              <span class="text-zinc-500 text-xs shrink-0">→</span>
              
              <input
                type="text"
                bind:value={endTimeInput}
                disabled={isReadOnly}
                onfocus={() => !isReadOnly && (activeSideMenu = 'end_time')}
                onblur={() => applyCustomTime(false, endTimeInput)}
                onkeydown={(e) => e.key === 'Enter' && applyCustomTime(false, endTimeInput)}
                class="w-[66px] shrink-0 bg-[#222222] {isReadOnly ? 'cursor-default' : 'hover:bg-[#282828] focus:bg-[#1a2333] focus:ring-1 focus:ring-blue-500'} rounded-md px-1 py-0.5 text-xs font-semibold text-zinc-100 focus:outline-none transition-colors text-center"
              />
            </div>

            {#if durationText}
              <span class="text-xs font-medium text-zinc-400 shrink-0 whitespace-nowrap">{durationText}</span>
            {/if}
          {:else}
            <span class="text-zinc-300 font-semibold text-xs py-0.5">All Day</span>
          {/if}
        </div>

        <!-- Date Input -->
        <div class="pl-5.5">
          <input
            type="text"
            bind:value={dateInput}
            disabled={isReadOnly}
            onfocus={() => {
              if (!isReadOnly && draft) {
                activeSideMenu = 'date';
                pickerMonth = parseISO(draft.startTime);
              }
            }}
            onblur={() => applyCustomDate(dateInput)}
            onkeydown={(e) => {
              if (e.key === 'Enter') {
                applyCustomDate(dateInput);
                activeSideMenu = 'none';
              }
            }}
            class="w-28 bg-[#222222] {isReadOnly ? 'cursor-default' : 'hover:bg-[#282828] focus:bg-[#1a2333] focus:ring-1 focus:ring-blue-500 cursor-pointer'} {activeSideMenu === 'date' ? 'bg-[#1a2333] ring-1 ring-blue-500 text-white' : 'text-zinc-200'} rounded-md px-2 py-0.5 text-xs font-semibold focus:outline-none transition-all"
          />
        </div>
      </div>

      <!-- All-Day Toggle -->
      <div class="flex items-center justify-between text-xs text-zinc-300 shrink-0">
        <span>All-day</span>
        <button
          type="button"
          aria-label="Toggle all day event"
          disabled={isReadOnly}
          onclick={toggleAllDay}
          class="w-7 h-4 rounded-full transition-colors relative flex items-center p-0.5 {isReadOnly ? 'opacity-60 cursor-default' : 'cursor-pointer'}
            {draft.isAllDay ? 'bg-blue-600' : 'bg-[#2b2b2b]'}"
        >
          <div
            class="w-3 h-3 bg-white rounded-full transition-transform
              {draft.isAllDay ? 'translate-x-3' : 'translate-x-0'}"
          ></div>
        </button>
      </div>

      <!-- Timezone -->
      <button 
        disabled={isReadOnly}
        onpointerdown={(e) => { if (!isReadOnly) { e.stopPropagation(); activeSideMenu = activeSideMenu === 'timezone' ? 'none' : 'timezone'; timezoneQuery = ''; } }}
        class="w-full flex items-center justify-between text-xs text-zinc-300 {isReadOnly ? 'cursor-default' : 'hover:text-white hover:bg-[#222222] cursor-pointer'} py-0.5 rounded transition-colors shrink-0"
      >
        <div class="flex items-center gap-2 truncate">
          <Globe size={13} class="shrink-0 text-zinc-400" />
          <span class="truncate">{draft.timeZone || 'GMT+5:30 Colombo'}</span>
        </div>
        {#if !isReadOnly}
          <ChevronDown size={12} class="text-zinc-500 shrink-0" />
        {/if}
      </button>

      <!-- Recurrence with Series Navigators -->
      <div class="flex items-center justify-between py-0.5 rounded {isReadOnly ? '' : 'hover:bg-[#222222]'} transition-colors group">
        <button 
          disabled={isReadOnly}
          onpointerdown={(e) => { if (!isReadOnly) { e.stopPropagation(); activeSideMenu = activeSideMenu === 'repeat' ? 'none' : 'repeat'; } }}
          class="flex items-center gap-2 text-xs text-zinc-300 {isReadOnly ? 'cursor-default' : 'hover:text-white cursor-pointer'} truncate flex-1"
        >
          <Repeat size={13} class="shrink-0 text-zinc-400" />
          <span class="truncate">{repeatLabel}</span>
        </button>

        {#if parsedRRuleDisplay.id !== 'none' || draft.recurringEventId || draft.isRecurringInstance}
          <div class="flex items-center gap-0.5 text-zinc-400">
            <button
              onpointerdown={(e) => { e.stopPropagation(); navigateOccurrence('prev'); }}
              class="p-1 hover:text-white hover:bg-[#2c2c2c] rounded transition-colors cursor-pointer"
              title="Previous occurrence"
            >
              <ChevronLeft size={13} />
            </button>
            <button
              onpointerdown={(e) => { e.stopPropagation(); navigateOccurrence('next'); }}
              class="p-1 hover:text-white hover:bg-[#2c2c2c] rounded transition-colors cursor-pointer"
              title="Next occurrence"
            >
              <ChevronRight size={13} />
            </button>
          </div>
        {:else if !isReadOnly}
          <button 
            onpointerdown={(e) => { e.stopPropagation(); activeSideMenu = activeSideMenu === 'repeat' ? 'none' : 'repeat'; }}
            class="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer"
          >
            <ChevronDown size={12} />
          </button>
        {/if}
      </div>

      <div class="h-px bg-[#242424] -mx-1 shrink-0"></div>

      <!-- Participants Directory Input -->
      <div class="flex flex-col gap-1.5 text-xs shrink-0">
        <div class="flex items-center gap-2 text-zinc-400">
          <Users size={13} class="shrink-0 text-zinc-500" />
          <input
            type="text"
            placeholder={isReadOnly ? "No participants" : "Add participant"}
            disabled={isReadOnly}
            bind:value={participantQuery}
            onfocus={() => !isReadOnly && (activeSideMenu = 'participants')}
            onkeydown={(e) => {
              if (e.key === 'Enter' && participantQuery.trim()) {
                selectParticipant({ name: participantQuery.trim(), email: participantQuery.trim() });
              }
            }}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full {isReadOnly ? 'cursor-default' : ''}"
          />
        </div>

        {#if draft.participants && draft.participants.length > 0}
          <div class="flex flex-wrap gap-1 pl-5">
            {#each draft.participants as p, i}
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#252525] border border-[#2f2f2f] text-[10px] text-zinc-300">
                <span>{p}</span>
                {#if !isReadOnly}
                  <button 
                    onclick={() => updateDraft('participants', draft?.participants?.filter((_: string, idx: number) => idx !== i))}
                    class="hover:text-rose-400 cursor-pointer"
                  >
                    <X size={10} />
                  </button>
                {/if}
              </span>
            {/each}
          </div>
        {/if}
      </div>

      <div class="h-px bg-[#242424] -mx-1 shrink-0"></div>

      <!-- Conferencing Row -->
      <div class="flex flex-col gap-1.5 text-xs shrink-0">
        <button 
          disabled={isReadOnly}
          onpointerdown={(e) => { if (!isReadOnly) { e.stopPropagation(); activeSideMenu = activeSideMenu === 'conferencing' ? 'none' : 'conferencing'; } }}
          class="flex items-center justify-between text-zinc-400 {isReadOnly ? 'cursor-default' : 'hover:text-zinc-200 cursor-pointer'} text-left py-0.5 group"
        >
          <div class="flex items-center gap-2 truncate">
            {#if draft.conferencingProvider === 'google_meet'}
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#00832d" d="M12 7v5l4.5 2.5.8-1.2-3.8-2.3V7z"/>
                <path fill="#0066da" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 15c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7z"/>
              </svg>
            {:else if draft.conferencingProvider === 'zoom'}
              <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                <path fill="#2D8CFF" d="M4.5 4h10c1.38 0 2.5 1.12 2.5 2.5v7c0 1.38-1.12 2.5-2.5 2.5h-10A2.5 2.5 0 0 1 2 13.5v-7C2 5.12 3.12 4 4.5 4zm14.5 3.5 4-2.5v12l-4-2.5v-7z"/>
              </svg>
            {:else}
              <Video size={13} class="shrink-0 text-zinc-500 group-hover:text-zinc-300" />
            {/if}

            {#if draft.conferencingUrl}
              <a 
                href={draft.conferencingUrl} 
                target="_blank" 
                rel="noreferrer"
                onclick={(e) => e.stopPropagation()}
                class="truncate text-blue-400 font-semibold underline hover:text-blue-300"
              >
                {draft.conferencingProvider === 'google_meet' ? 'Google Meet Call' : 'Zoom Call'}
              </a>
            {:else}
              <span class="truncate">Conferencing</span>
            {/if}
          </div>
          {#if !isReadOnly}
            <ChevronDown size={12} class="text-zinc-500 shrink-0" />
          {/if}
        </button>

        {#if !isReadOnly}
          <button 
            onclick={addAiMeetingNotes}
            class="flex items-center gap-2 text-zinc-400 hover:text-zinc-200 text-left py-0.5 cursor-pointer"
          >
            <Sparkles size={13} class="shrink-0 text-amber-500/80" />
            <span>Add AI meeting notes</span>
          </button>
        {/if}

        <!-- Location Search -->
        <div class="flex items-center gap-2 text-zinc-400 py-0.5">
          <MapPin size={13} class="shrink-0 text-zinc-500" />
          <input
            type="text"
            placeholder="Location"
            disabled={isReadOnly}
            bind:value={locationQuery}
            onfocus={() => !isReadOnly && (activeSideMenu = 'location')}
            oninput={(e) => handleLocationInput((e.target as HTMLInputElement).value)}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full {isReadOnly ? 'cursor-default' : ''}"
          />
        </div>

        <div class="flex flex-col gap-1">
          {#if !isReadOnly}
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
                />
                <button onclick={() => isAddingAttachment = false} class="text-zinc-500 hover:text-zinc-300">
                  <X size={12} />
                </button>
              </div>
            {/if}
          {/if}

          {#if draft.attachments && draft.attachments.length > 0}
            <div class="flex flex-col gap-1 pl-5">
              {#each draft.attachments as att, i}
                <div class="flex items-center justify-between p-1 rounded bg-[#202020] border border-[#2b2b2b] text-[10px] text-blue-400 truncate">
                  <a href={att} target="_blank" rel="noreferrer" class="truncate underline cursor-pointer hover:text-blue-300">{att}</a>
                  {#if !isReadOnly}
                    <button 
                      onclick={() => updateDraft('attachments', draft?.attachments?.filter((_: string, idx: number) => idx !== i))}
                      class="text-zinc-500 hover:text-rose-400 shrink-0 ml-1 cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>

      <div class="h-px bg-[#242424] -mx-1 shrink-0"></div>

      <!-- Description -->
      <div class="flex flex-col gap-1 text-xs shrink-0">
        <div class="flex items-center gap-1.5 text-zinc-400">
          <AlignLeft size={13} class="text-zinc-500" />
          <span class="font-medium">Description</span>
        </div>
        <textarea
          rows="3"
          placeholder={isReadOnly ? "No description" : "Add description or notes..."}
          disabled={isReadOnly}
          value={draft.description || ''}
          oninput={(e) => updateDraft('description', (e.target as HTMLTextAreaElement).value)}
          class="w-full bg-[#1c1c1c] border border-[#282828] rounded-lg p-2 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none {isReadOnly ? 'cursor-default opacity-85' : 'focus:border-blue-500'} resize-none custom-scrollbar"
        ></textarea>
      </div>

      <div class="h-px bg-[#242424] -mx-1 shrink-0"></div>

      <!-- Calendar Category Button -->
      <button 
        disabled={isReadOnly}
        onpointerdown={(e) => { if (!isReadOnly) { e.stopPropagation(); activeSideMenu = activeSideMenu === 'calendar' ? 'none' : 'calendar'; } }}
        class="w-full flex items-center justify-between p-1 rounded-md {isReadOnly ? 'cursor-default' : 'hover:bg-[#222222] cursor-pointer'} transition-colors shrink-0"
      >
        <div class="flex items-center gap-2 truncate">
          <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {colorToken.hex};"></span>
          <span class="text-xs font-semibold text-zinc-200 truncate">{activeCalendar.name}</span>
        </div>
        {#if !isReadOnly}
          <ChevronDown size={12} class="text-zinc-500 shrink-0" />
        {/if}
      </button>

      <!-- Status & Visibility -->
      <div class="flex items-center justify-between text-xs text-zinc-300 shrink-0">
        <select
          value={draft.busyStatus}
          disabled={isReadOnly}
          onchange={(e) => updateDraft('busyStatus', (e.target as HTMLSelectElement).value as any)}
          class="bg-[#1f1f1f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none {isReadOnly ? 'cursor-default opacity-70' : 'cursor-pointer'}"
        >
          <option value="busy" class="bg-[#181818]">Busy</option>
          <option value="free" class="bg-[#181818]">Free</option>
        </select>

        <select
          value={draft.visibility || 'default'}
          disabled={isReadOnly}
          onchange={(e) => updateDraft('visibility', (e.target as HTMLSelectElement).value as any)}
          class="bg-[#1f1f1f] border border-[#2a2a2a] rounded px-2 py-1 text-xs text-zinc-300 focus:outline-none {isReadOnly ? 'cursor-default opacity-70' : 'cursor-pointer'}"
        >
          <option value="default" class="bg-[#181818]">Default visibility</option>
          <option value="public" class="bg-[#181818]">Public</option>
          <option value="private" class="bg-[#181818]">Private</option>
        </select>
      </div>

      <!-- Reminders -->
      <div class="flex flex-col gap-1 shrink-0">
        <button 
          disabled={isReadOnly}
          onpointerdown={(e) => { if (!isReadOnly) { e.stopPropagation(); activeSideMenu = activeSideMenu === 'reminders' ? 'none' : 'reminders'; } }}
          class="w-full flex items-center justify-between p-1 rounded {isReadOnly ? 'cursor-default' : 'hover:bg-[#222222] cursor-pointer hover:text-zinc-200'} transition-colors text-xs text-zinc-400"
        >
          <div class="flex items-center gap-1.5">
            <Bell size={13} class="text-zinc-500" />
            <span class="font-medium">Reminders</span>
          </div>
          {#if !isReadOnly}
            <Plus size={13} class="text-zinc-500" />
          {/if}
        </button>

        {#if draft.reminders && draft.reminders.length > 0}
          <div class="flex flex-col gap-1 pl-5">
            {#each draft.reminders as rem}
              {@const label = reminderPresets.find(r => r.id === rem)?.label || rem}
              <div class="flex items-center justify-between py-0.5 text-xs text-zinc-300 hover:text-white group">
                <span>{label}</span>
                {#if !isReadOnly}
                  <button 
                    onclick={() => removeReminder(rem)}
                    class="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-rose-400 transition-opacity cursor-pointer"
                    title="Remove reminder"
                  >
                    <X size={11} />
                  </button>
                {/if}
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- SIDE-DOCKED POPUPS -->

    <!-- 1. Participant Autocomplete Popover -->
    {#if activeSideMenu === 'participants' && !isReadOnly}
      <div 
        class="absolute top-28 w-68 bg-[#181818] border border-[#2b2b2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-1.5 z-999 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-70'}"
      >
        <div class="max-h-60 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar">
          {#each filteredContacts as contact}
            <button
              onpointerdown={(e) => { e.stopPropagation(); selectParticipant(contact); }}
              class="flex flex-col px-3 py-1.5 rounded-xl hover:bg-[#282828] text-left transition-colors cursor-pointer group"
            >
              <span class="font-semibold text-xs text-zinc-100 group-hover:text-blue-400">{contact.name}</span>
              <span class="text-[11px] text-zinc-400 truncate">{contact.email}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- 2. Location Autocomplete Popover -->
    {#if activeSideMenu === 'location' && !isReadOnly}
      <div 
        class="absolute top-44 w-72 bg-[#181818] border border-[#2b2b2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-1.5 z-999 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-75'}"
      >
        <div class="max-h-60 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar">
          {#each liveLocations as loc}
            <button
              onpointerdown={(e) => { e.stopPropagation(); selectLocation(loc); }}
              class="flex flex-col px-3 py-1.5 rounded-xl hover:bg-[#282828] text-left transition-colors cursor-pointer group"
            >
              <span class="font-semibold text-xs text-zinc-100 group-hover:text-blue-400">{loc.title}</span>
              <span class="text-[11px] text-zinc-400 truncate">{loc.subtitle}</span>
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- 3. Conferencing Provider Popover -->
    {#if activeSideMenu === 'conferencing' && !isReadOnly}
      <div 
        class="absolute top-40 w-54 bg-[#181818] border border-[#2b2b2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-1.5 z-999 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-57.5'}"
      >
        <button
          onpointerdown={(e) => { e.stopPropagation(); setGoogleMeet(); }}
          class="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-[#282828] text-xs font-semibold text-zinc-200 hover:text-white text-left transition-colors cursor-pointer"
        >
          <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
            <path fill="#00832d" d="M12 7v5l4.5 2.5.8-1.2-3.8-2.3V7z"/>
            <path fill="#0066da" d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 15c-3.9 0-7-3.1-7-7s3.1-7 7-7 7 3.1 7 7-3.1 7-7 7z"/>
          </svg>
          <span>Google Meet</span>
        </button>

        <button
          onpointerdown={(e) => { e.stopPropagation(); setZoom(); }}
          class="flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#282828] text-xs font-semibold text-zinc-200 hover:text-white text-left transition-colors cursor-pointer"
        >
          <div class="flex items-center gap-2.5">
            <svg class="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
              <path fill="#2D8CFF" d="M4.5 4h10c1.38 0 2.5 1.12 2.5 2.5v7c0 1.38-1.12 2.5-2.5 2.5h-10A2.5 2.5 0 0 1 2 13.5v-7C2 5.12 3.12 4 4.5 4zm14.5 3.5 4-2.5v12l-4-2.5v-7z"/>
            </svg>
            <span>Zoom</span>
          </div>
        </button>

        <div class="h-px bg-[#292929] my-0.5"></div>

        <button
          onpointerdown={(e) => { e.stopPropagation(); settingsStore.open('conferencing'); activeSideMenu = 'none'; }}
          class="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-[#282828] text-xs font-medium text-zinc-300 hover:text-white text-left transition-colors cursor-pointer"
        >
          <ArrowRight size={13} />
          <span>Manage conferencing</span>
        </button>
      </div>
    {/if}

    <!-- 4. Calendar & Color Popover -->
    {#if activeSideMenu === 'calendar' && !isReadOnly}
      <div 
        class="absolute bottom-14 w-62 bg-[#181818] border border-[#2b2b2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-2.5 z-999 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-64'}"
      >
        <div class="text-[11px] font-semibold text-zinc-400 px-1 truncate">{activeCalendar?.name || 'Calendars'}</div>
        
        <div class="flex flex-col gap-0.5">
          {#each calendarState.calendars as cal}
            {@const isCalReadOnly = cal.accessRole === 'reader' || cal.accessRole === 'freeBusyReader'}
            <div class="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-[#262626] transition-colors group">
              <button
                disabled={isCalReadOnly}
                onpointerdown={(e) => { if (!isCalReadOnly) { e.stopPropagation(); updateDraft('calendarId', cal.id); activeSideMenu = 'none'; } }}
                class="flex items-center gap-2 flex-1 text-left {isCalReadOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'} truncate"
              >
                <div class="w-3.5 flex items-center justify-center">
                  {#if draft.calendarId === cal.id}
                    <Check size={12} class="text-blue-400 shrink-0" />
                  {/if}
                </div>
                <span class="w-2.5 h-2.5 rounded-full shrink-0" style="background-color: {cal.colorHex};"></span>
                <span class="text-xs text-zinc-200 truncate">{cal.name}</span>
                {#if isCalReadOnly}
                  <Lock size={10} class="text-zinc-500 shrink-0" />
                {/if}
              </button>

              <button 
                onpointerdown={(e) => { e.stopPropagation(); calendarState.toggleCalendarVisibility(cal.id); }}
                class="text-zinc-500 hover:text-zinc-300 p-0.5 rounded cursor-pointer"
              >
                {#if cal.isVisible}
                  <Eye size={12} />
                {:else}
                  <EyeOff size={12} />
                {/if}
              </button>
            </div>
          {/each}
        </div>

        <div class="h-px bg-[#292929]"></div>

        <div class="text-[10px] font-semibold text-zinc-400 px-1">Event color</div>
        <div class="flex items-center justify-between px-1">
          {#each Object.values(KAIRO_COLORS) as c (c.id)}
            <button
              onpointerdown={(e) => { e.stopPropagation(); updateDraft('colorOverride', c.id === 'charcoal' ? undefined : c.hex); activeSideMenu = 'none'; }}
              class="w-4 h-4 rounded-full flex items-center justify-center transition-transform hover:scale-125 cursor-pointer"
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

    <!-- 5. Mini Calendar Popover -->
    {#if activeSideMenu === 'date' && !isReadOnly}
      {@const grid = generateMonthGrid(pickerMonth)}
      <div 
        class="absolute top-14 w-60 bg-[#181818] border border-[#2b2b2b] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.95)] p-3 z-999 flex flex-col gap-2 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-62.5'}"
      >
        <div class="flex items-center justify-between px-1">
          <span class="text-xs font-bold text-zinc-200">{format(pickerMonth, 'MMMM yyyy')}</span>
          <div class="flex items-center gap-1 text-zinc-400">
            <button onpointerdown={(e) => { e.stopPropagation(); pickerMonth = subMonths(pickerMonth, 1); }} class="p-1 hover:bg-[#282828] rounded-md hover:text-white cursor-pointer">
              <ChevronLeft size={13} />
            </button>
            <button onpointerdown={(e) => { e.stopPropagation(); pickerMonth = addMonths(pickerMonth, 1); }} class="p-1 hover:bg-[#282828] rounded-md hover:text-white cursor-pointer">
              <ChevronRight size={13} />
            </button>
          </div>
        </div>

        <div class="grid grid-cols-7 text-[10px] font-semibold text-zinc-500 text-center">
          {#each ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'] as d}
            <div>{d}</div>
          {/each}
        </div>

        <div class="grid grid-cols-7 gap-0.5">
          {#each grid as cell}
            {@const activeToday = isToday(cell.date)}
            {@const isSelectedDate = isSameDay(cell.date, parseISO(draft.startTime))}
            <button
              onpointerdown={(e) => { e.stopPropagation(); selectNewDate(cell.date); }}
              class="h-7 w-7 mx-auto rounded-lg text-xs flex items-center justify-center transition-colors cursor-pointer
                {activeToday 
                  ? 'bg-[#ea4335] text-white font-bold' 
                  : isSelectedDate 
                    ? 'bg-[#333333] text-white font-bold' 
                    : cell.isCurrentMonth 
                      ? 'text-zinc-200 hover:bg-[#282828]' 
                      : 'text-zinc-600 hover:bg-[#222222]'}"
            >
              {format(cell.date, 'd')}
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <!-- 6. Time Interval Pickers -->
    {#if (activeSideMenu === 'start_time' || activeSideMenu === 'end_time') && !isReadOnly}
      {@const isStart = activeSideMenu === 'start_time'}
      <div 
        class="absolute top-10 w-38 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] p-1 z-999 max-h-68 overflow-y-auto custom-scrollbar flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-40'}"
      >
        {#each timePresets as preset}
          <button
            onpointerdown={(e) => { e.stopPropagation(); selectPresetTime(isStart, preset); }}
            class="px-2.5 py-1 text-xs text-zinc-200 hover:text-white hover:bg-[#2c2c2c] rounded text-left transition-colors font-mono cursor-pointer"
          >
            {preset}
          </button>
        {/each}
      </div>
    {/if}

    <!-- 7. Timezone Popover -->
    {#if activeSideMenu === 'timezone' && !isReadOnly}
      <div 
        class="absolute top-24 w-66 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] p-2 z-999 flex flex-col gap-1.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-67.5'}"
      >
        <div class="flex items-center gap-2 px-2 py-1 bg-[#141414] border border-[#2a2a2a] rounded-lg">
          <Search size={12} class="text-zinc-500" />
          <input
            type="text"
            placeholder="Search timezone..."
            bind:value={timezoneQuery}
            class="bg-transparent text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none w-full"
          />
        </div>
        <div class="max-h-56 overflow-y-auto flex flex-col gap-0.5 custom-scrollbar">
          {#each filteredTimezones as tz}
            <button
              onpointerdown={(e) => { e.stopPropagation(); updateDraft('timeZone', tz.tz); activeSideMenu = 'none'; }}
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

    <!-- 8. Recurrence Popover -->
    {#if activeSideMenu === 'repeat' && !isReadOnly}
      <div 
        class="absolute top-32 w-56 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] p-1.5 z-999 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-60'}"
      >
        {#each repeatOptions as opt}
          {@const isChecked = parsedRRuleDisplay.id === opt.id || (draft?.rrule === opt.id) || (opt.label === parsedRRuleDisplay.label && opt.sub === parsedRRuleDisplay.sub)}
          <button
            onpointerdown={(e) => { e.stopPropagation(); updateDraft('rrule', opt.id); activeSideMenu = 'none'; }}
            class="flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg text-left transition-colors cursor-pointer
              {isChecked ? 'bg-[#282828] text-white font-semibold' : 'text-zinc-300 hover:bg-[#242424]'}"
          >
            <div class="flex items-center gap-2">
              <div class="w-3 flex items-center justify-center">
                {#if isChecked}
                  <Check size={12} class="text-blue-400 shrink-0" />
                {/if}
              </div>
              <span>{opt.label}</span>
            </div>
            {#if opt.sub}
              <span class="text-[10px] text-zinc-500 font-normal">{opt.sub}</span>
            {/if}
          </button>
        {/each}
      </div>
    {/if}

    <!-- 9. Reminders Popover -->
    {#if activeSideMenu === 'reminders' && !isReadOnly}
      <div 
        class="absolute bottom-3 w-48 bg-[#1c1c1c] border border-[#2e2e2e] rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.95)] p-1 z-999 flex flex-col gap-0.5 animate-in fade-in zoom-in-95 duration-100
          {sideMenuOnRight ? 'left-full ml-2' : '-left-50'}"
      >
        {#each reminderPresets as opt}
          <button
            onpointerdown={(e) => { e.stopPropagation(); addReminder(opt.id); }}
            class="flex items-center justify-between px-2 py-1 text-xs rounded text-left transition-colors cursor-pointer text-zinc-300 hover:bg-[#242424] hover:text-white"
          >
            <span>{opt.label}</span>
          </button>
        {/each}
      </div>
    {/if}
  </aside>
{/if}