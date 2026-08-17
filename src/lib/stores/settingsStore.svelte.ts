import { invoke } from '@tauri-apps/api/core';
import type { SettingsTab, UserAccount, CalendarCategory, CalendarEvent } from '../../types/event';
import { 
  loadDbSettings, 
  persistDbSetting, 
  loadDbAccounts, 
  persistDbAccount, 
  deleteDbAccount, 
  clearAllDbAccounts,
  clearAllGoogleEvents,
  persistCalendarCategory,
  persistUpsertEvent,
  loadInitialCalendars,
  loadStoredEvents,
  getAccountAccessToken
} from '../db/database';
import { calendarState } from './calendarState.svelte';
import { eventStore } from './eventStore.svelte';
import { parseISO, addMinutes } from 'date-fns';

class SettingsStore {
  isOpen = $state(false);
  activeTab = $state<SettingsTab>('general');
  isCommandMenuOpen = $state(false);

  // Authentication State
  isLoggedIn = $state(false);
  preferredName = $state('');
  email = $state('');
  username = $state('');
  avatarUrl = $state('');
  isAuthenticating = $state(false);

  // Preferences
  showWeekends = $state(true);
  showDeclinedEvents = $state(true);
  showWeekNumbers = $state(false);
  startWeekOn = $state<'Sunday' | 'Monday'>('Sunday');
  pressTAction = $state<'today' | 'selected'>('today');
  upcomingMeetingContext = $state<'15m' | '30m' | '1h' | '2h' | '4h'>('4h');
  language = $state('English');
  timeFormat = $state<'12h' | '24h'>('12h');
  theme = $state<'auto' | 'light' | 'dark'>('dark');

  // Notifications
  notificationsEnabled = $state(true);
  playNotificationSound = $state(true);
  defaultReminderOffset = $state('15m');

  // Menubar
  menuBarEnabled = $state(true);
  menuBarDaysSpan = $state<'1 day' | '2 days' | '3 days' | '7 days'>('3 days');
  menuBarIncludeAllDay = $state(false);
  menuBarIncludeNoParticipants = $state(true);

  // Conferencing
  defaultConferencing = $state<'google_meet' | 'zoom' | 'custom'>('google_meet');
  zoomPmiLink = $state('');
  zoomConnected = $state(false);

  // Accounts List
  accounts = $state<UserAccount[]>([]);

  async init(): Promise<void> {
    try {
      const saved = await loadDbSettings();
      if (saved.showWeekends !== undefined) this.showWeekends = saved.showWeekends === 'true';
      if (saved.showDeclinedEvents !== undefined) this.showDeclinedEvents = saved.showDeclinedEvents === 'true';
      if (saved.showWeekNumbers !== undefined) this.showWeekNumbers = saved.showWeekNumbers === 'true';
      if (saved.startWeekOn) this.startWeekOn = saved.startWeekOn as any;
      if (saved.pressTAction) this.pressTAction = saved.pressTAction as any;
      if (saved.language) this.language = saved.language;
      if (saved.timeFormat) this.timeFormat = saved.timeFormat as any;
      if (saved.theme) {
        this.theme = saved.theme as any;
        this.applyTheme(this.theme);
      }
      if (saved.notificationsEnabled !== undefined) this.notificationsEnabled = saved.notificationsEnabled === 'true';
      if (saved.playNotificationSound !== undefined) this.playNotificationSound = saved.playNotificationSound === 'true';
      if (saved.defaultReminderOffset) this.defaultReminderOffset = saved.defaultReminderOffset;
      if (saved.defaultConferencing) this.defaultConferencing = saved.defaultConferencing as any;
      if (saved.zoomPmiLink) {
        this.zoomPmiLink = saved.zoomPmiLink;
        this.zoomConnected = Boolean(saved.zoomPmiLink);
      }

      const storedAccounts = await loadDbAccounts();
      this.accounts = storedAccounts;

      const sessionActive = saved.isLoggedIn === 'true';
      if (sessionActive && storedAccounts.length > 0) {
        const primary = storedAccounts.find(a => a.isPrimary) || storedAccounts[0];
        this.isLoggedIn = true;
        this.preferredName = primary.name;
        this.email = primary.email;
        this.username = primary.email.split('@')[0].toLowerCase();
        this.avatarUrl = primary.avatarUrl || '';
      } else {
        this.isLoggedIn = false;
        this.preferredName = '';
        this.email = '';
        this.username = '';
        this.avatarUrl = '';
      }
    } catch (err) {
      console.error('Failed to load settings from DB:', err);
    }
  }

  async updateSetting(key: string, value: string): Promise<void> {
    try {
      await persistDbSetting(key, value);
    } catch (err) {
      console.error(`Failed to save setting ${key}:`, err);
    }
  }

  applyTheme(selectedTheme: 'auto' | 'light' | 'dark') {
    this.theme = selectedTheme;
    this.updateSetting('theme', selectedTheme);

    const root = document.documentElement;
    if (selectedTheme === 'dark') {
      root.classList.add('dark');
      root.style.colorScheme = 'dark';
    } else if (selectedTheme === 'light') {
      root.classList.remove('dark');
      root.style.colorScheme = 'light';
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    }
  }

  open(tab: SettingsTab = 'general') {
    this.activeTab = tab;
    this.isOpen = true;
  }

  close() {
    this.isOpen = false;
  }

  openCommandMenu() {
    this.isCommandMenuOpen = true;
  }

  closeCommandMenu() {
    this.isCommandMenuOpen = false;
  }

  toggleCommandMenu() {
    this.isCommandMenuOpen = !this.isCommandMenuOpen;
  }

  async login(email: string, name: string = ''): Promise<void> {
    const cleanEmail = email.trim();
    const cleanName = name.trim() || cleanEmail.split('@')[0];
    this.email = cleanEmail;
    this.preferredName = cleanName;
    this.username = cleanEmail.split('@')[0].toLowerCase();
    this.isLoggedIn = true;
    await this.updateSetting('isLoggedIn', 'true');
  }

  async connectGoogleOAuth(): Promise<void> {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';
    const clientSecret = import.meta.env.VITE_GOOGLE_CLIENT_SECRET || '';

    if (!clientId) {
      alert('VITE_GOOGLE_CLIENT_ID is missing from your .env file!');
      return;
    }

    this.isAuthenticating = true;
    try {
      const authResult = await invoke<any>('start_google_auth', {
        clientId,
        clientSecret
      });

      const profile = authResult.profile;
      const isPrimary = this.accounts.length === 0;

      const candidate: UserAccount = {
        id: 'acc_' + profile.id,
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        provider: 'google',
        avatarUrl: profile.picture,
        isPrimary,
        syncEnabled: true
      };

      const savedAccount = await persistDbAccount(candidate, authResult.accessToken, authResult.refreshToken);
      this.accounts = [...this.accounts.filter(a => a.email !== savedAccount.email), savedAccount];

      this.isLoggedIn = true;
      await this.updateSetting('isLoggedIn', 'true');
      this.preferredName = savedAccount.name;
      this.email = savedAccount.email;
      this.username = savedAccount.email.split('@')[0].toLowerCase();
      this.avatarUrl = savedAccount.avatarUrl || '';

      // 1. Wipe stale imported events
      await clearAllGoogleEvents();

      // 2. Map Google Calendars with authentic colors
      const calendarMap = new Map<string, string>();
      if (Array.isArray(authResult.calendars) && authResult.calendars.length > 0) {
        for (const cal of authResult.calendars) {
          const calId = 'cal_' + cal.id.replace(/[^a-zA-Z0-9_]/g, '_');
          calendarMap.set(cal.id, calId);

          const newCal: CalendarCategory = {
            id: calId,
            accountId: savedAccount.id,
            googleCalendarId: cal.id,
            name: cal.summary || savedAccount.email,
            colorId: 'google',
            colorHex: cal.backgroundColor || cal.background_color || '#3b82f6',
            isPrimary: Boolean(cal.primary),
            isVisible: true
          };
          await persistCalendarCategory(newCal);
        }
      }

      // 3. Parse and insert Google Calendar Event occurrences
      if (Array.isArray(authResult.events) && authResult.events.length > 0) {
        for (const gEvt of authResult.events) {
          if (gEvt.status === 'cancelled') continue;

          const targetCalId = calendarMap.get(gEvt.calendarId || gEvt.calendar_id || '') || calendarMap.values().next().value || 'cal_default';
          
          let startTime = '';
          let endTime = '';
          let isAllDay = false;

          const startDt = gEvt.start?.dateTime || gEvt.start?.date_time;
          const endDt = gEvt.end?.dateTime || gEvt.end?.date_time;
          const startDate = gEvt.start?.date;
          const endDate = gEvt.end?.date;

          if (startDt) {
            startTime = parseISO(startDt).toISOString();
            endTime = endDt ? parseISO(endDt).toISOString() : addMinutes(parseISO(startTime), 60).toISOString();
            isAllDay = false;
          } else if (startDate) {
            startTime = new Date(startDate + 'T00:00:00').toISOString();
            endTime = endDate ? new Date(endDate + 'T00:00:00').toISOString() : new Date(startDate + 'T23:59:59').toISOString();
            isAllDay = true;
          } else {
            continue;
          }

          const kairoEvt: CalendarEvent = {
            id: 'evt_g_' + gEvt.id.replace(/[^a-zA-Z0-9_]/g, '_'),
            calendarId: targetCalId,
            googleEventId: gEvt.id,
            recurringEventId: gEvt.recurringEventId || gEvt.recurring_event_id,
            title: gEvt.summary || '(No Title)',
            description: gEvt.description || '',
            location: gEvt.location || '',
            conferencingUrl: gEvt.hangoutLink || gEvt.hangout_link || '',
            conferencingProvider: 'google_meet',
            startTime,
            endTime,
            isAllDay,
            timeZone: gEvt.start?.timeZone || gEvt.start?.time_zone || 'GMT+5:30 Colombo',
            rrule: 'none',
            exdates: [],
            status: 'confirmed',
            busyStatus: gEvt.transparency === 'transparent' ? 'free' : 'busy',
            visibility: 'default',
            reminders: ['15m'],
            creatorEmail: savedAccount.email,
            participants: gEvt.attendees ? gEvt.attendees.map((a: any) => a.email).filter(Boolean) : [],
            attachments: [],
            syncStatus: 'synced',
            updatedAt: new Date().toISOString()
          };

          await persistUpsertEvent(kairoEvt);
        }
      }

      calendarState.calendars = await loadInitialCalendars();
      eventStore.events = await loadStoredEvents();

      this.close();
    } catch (err) {
      console.error('Google OAuth error:', err);
      alert(`Google Sign-In failed: ${err}`);
    } finally {
      this.isAuthenticating = false;
    }
  }

  async syncGoogleAccount(): Promise<void> {
    if (this.accounts.length === 0) return;
    const primary = this.accounts.find(a => a.isPrimary) || this.accounts[0];
    const token = await getAccountAccessToken(primary.id);
    if (!token) return;

    try {
      const [cals, events] = await invoke<any>('sync_google_calendar', {
        accessToken: token
      });

      await clearAllGoogleEvents();

      const calendarMap = new Map<string, string>();
      for (const cal of cals) {
        const calId = 'cal_' + cal.id.replace(/[^a-zA-Z0-9_]/g, '_');
        calendarMap.set(cal.id, calId);
        const newCal: CalendarCategory = {
          id: calId,
          accountId: primary.id,
          googleCalendarId: cal.id,
          name: cal.summary || primary.email,
          colorId: 'google',
          colorHex: cal.backgroundColor || cal.background_color || '#3b82f6',
          isPrimary: Boolean(cal.primary),
          isVisible: true
        };
        await persistCalendarCategory(newCal);
      }

      for (const gEvt of events) {
        if (gEvt.status === 'cancelled') continue;
        const targetCalId = calendarMap.get(gEvt.calendarId || gEvt.calendar_id || '') || calendarMap.values().next().value || 'cal_default';
        
        let startTime = '';
        let endTime = '';
        let isAllDay = false;

        const startDt = gEvt.start?.dateTime || gEvt.start?.date_time;
        const endDt = gEvt.end?.dateTime || gEvt.end?.date_time;
        const startDate = gEvt.start?.date;
        const endDate = gEvt.end?.date;

        if (startDt) {
          startTime = parseISO(startDt).toISOString();
          endTime = endDt ? parseISO(endDt).toISOString() : addMinutes(parseISO(startTime), 60).toISOString();
          isAllDay = false;
        } else if (startDate) {
          startTime = new Date(startDate + 'T00:00:00').toISOString();
          endTime = endDate ? new Date(endDate + 'T00:00:00').toISOString() : new Date(startDate + 'T23:59:59').toISOString();
          isAllDay = true;
        } else {
          continue;
        }

        const kairoEvt: CalendarEvent = {
          id: 'evt_g_' + gEvt.id.replace(/[^a-zA-Z0-9_]/g, '_'),
          calendarId: targetCalId,
          googleEventId: gEvt.id,
          recurringEventId: gEvt.recurringEventId || gEvt.recurring_event_id,
          title: gEvt.summary || '(No Title)',
          description: gEvt.description || '',
          location: gEvt.location || '',
          conferencingUrl: gEvt.hangoutLink || gEvt.hangout_link || '',
          conferencingProvider: 'google_meet',
          startTime,
          endTime,
          isAllDay,
          timeZone: gEvt.start?.timeZone || gEvt.start?.time_zone || 'GMT+5:30 Colombo',
          rrule: 'none',
          exdates: [],
          status: 'confirmed',
          busyStatus: gEvt.transparency === 'transparent' ? 'free' : 'busy',
          visibility: 'default',
          reminders: ['15m'],
          creatorEmail: primary.email,
          participants: gEvt.attendees ? gEvt.attendees.map((a: any) => a.email).filter(Boolean) : [],
          attachments: [],
          syncStatus: 'synced',
          updatedAt: new Date().toISOString()
        };

        await persistUpsertEvent(kairoEvt);
      }

      calendarState.calendars = await loadInitialCalendars();
      eventStore.events = await loadStoredEvents();
    } catch (e) {
      console.error('Failed to sync Google account:', e);
    }
  }

  async logout(): Promise<void> {
    this.isLoggedIn = false;
    this.preferredName = '';
    this.email = '';
    this.username = '';
    this.avatarUrl = '';
    await this.updateSetting('isLoggedIn', 'false');
  }

  async removeAccount(id: string): Promise<void> {
    const acc = this.accounts.find(a => a.id === id);
    if (!acc) return;
    this.accounts = this.accounts.filter(a => a.id !== id);
    calendarState.calendars = calendarState.calendars.filter(c => c.accountId !== id);
    await deleteDbAccount(id);
    if (this.accounts.length === 0) {
      await this.logout();
    }
  }

  async deleteAccountAndData(): Promise<void> {
    await clearAllDbAccounts();
    await this.logout();
    this.accounts = [];
    calendarState.calendars = [];
    eventStore.events = [];
  }

  async setPrimaryAccount(id: string): Promise<void> {
    this.accounts = this.accounts.map(a => ({
      ...a,
      isPrimary: a.id === id
    }));
    for (const a of this.accounts) {
      await persistDbAccount(a);
    }
    const primary = this.accounts.find(a => a.id === id);
    if (primary) {
      this.preferredName = primary.name;
      this.email = primary.email;
      this.username = primary.email.split('@')[0].toLowerCase();
      this.avatarUrl = primary.avatarUrl || '';
    }
  }
}

export const settingsStore = new SettingsStore();