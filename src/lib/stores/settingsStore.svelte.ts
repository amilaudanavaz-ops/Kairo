import { invoke } from '@tauri-apps/api/core';
import type { SettingsTab, UserAccount, CalendarCategory } from '../../types/event';
import { 
  loadDbSettings, 
  persistDbSetting, 
  loadDbAccounts, 
  persistDbAccount, 
  deleteDbAccount, 
  clearAllDbAccounts,
  persistCalendarCategory 
} from '../db/database';
import { calendarState } from './calendarState.svelte';
import { eventStore } from './eventStore.svelte';

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

  // General Preferences
  showWeekends = $state(true);
  showDeclinedEvents = $state(true);
  showWeekNumbers = $state(false);
  startWeekOn = $state<'Sunday' | 'Monday'>('Sunday');
  pressTAction = $state<'today' | 'selected'>('today');
  upcomingMeetingContext = $state<'15m' | '30m' | '1h' | '2h' | '4h'>('4h');
  language = $state('English');
  timeFormat = $state<'12h' | '24h'>('12h');
  theme = $state<'auto' | 'light' | 'dark'>('dark');

  // Notifications Preferences
  notificationsEnabled = $state(true);
  playNotificationSound = $state(true);
  defaultReminderOffset = $state('15m');

  // Menu bar Preferences
  menuBarEnabled = $state(true);
  menuBarDaysSpan = $state<'1 day' | '2 days' | '3 days' | '7 days'>('3 days');
  menuBarIncludeAllDay = $state(false);
  menuBarIncludeNoParticipants = $state(true);

  // Conferencing Preferences
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
        const primary = storedAccounts.find((a: UserAccount) => a.isPrimary) || storedAccounts[0];
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
    await this.addAccount(cleanEmail, cleanName);
  }

  async addAccount(email: string, name: string = 'Google User'): Promise<void> {
    if (!email.trim()) return;
    const exists = this.accounts.some((a: UserAccount) => a.email.toLowerCase() === email.toLowerCase());
    if (!exists) {
      const isPrimary = this.accounts.length === 0;
      const candidate: UserAccount = {
        id: 'acc_' + Date.now(),
        email: email.trim(),
        name: name.trim() || email.split('@')[0],
        provider: 'google',
        isPrimary,
        syncEnabled: true
      };
      
      const savedAccount = await persistDbAccount(candidate);
      this.accounts = [...this.accounts, savedAccount];

      const newCal: CalendarCategory = {
        id: 'cal_' + Date.now(),
        accountId: savedAccount.id,
        name: savedAccount.email,
        colorId: 'blue',
        colorHex: '#3b82f6',
        isPrimary,
        isVisible: true,
        accessRole: 'owner'
      };
      await persistCalendarCategory(newCal);
      calendarState.calendars = [...calendarState.calendars, newCal];
    }
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
      const isPrimaryAccount = this.accounts.length === 0;

      const candidate: UserAccount = {
        id: 'acc_' + profile.id,
        email: profile.email,
        name: profile.name || profile.email.split('@')[0],
        provider: 'google',
        avatarUrl: profile.picture,
        isPrimary: isPrimaryAccount,
        syncEnabled: true
      };

      const tokenAccess = authResult.accessToken || authResult.access_token;
      const tokenRefresh = authResult.refreshToken || authResult.refresh_token;

      const savedAccount = await persistDbAccount(candidate, tokenAccess, tokenRefresh);
      this.accounts = [...this.accounts.filter((a: UserAccount) => a.email !== savedAccount.email), savedAccount];

      this.isLoggedIn = true;
      await this.updateSetting('isLoggedIn', 'true');
      this.preferredName = savedAccount.name;
      this.email = savedAccount.email;
      this.username = savedAccount.email.split('@')[0].toLowerCase();
      this.avatarUrl = savedAccount.avatarUrl || '';

      const incomingCalendars = authResult.calendars || [];
      if (Array.isArray(incomingCalendars) && incomingCalendars.length > 0) {
        // Enforce strictly one default calendar: match Google's primary or the first calendar
        const hasExplicitPrimary = incomingCalendars.some((c: any) => c.primary === true);

        // If this is the primary account, clear any existing primary flags to maintain mutual exclusivity
        if (isPrimaryAccount) {
          calendarState.calendars = calendarState.calendars.map((c: CalendarCategory) => ({
            ...c,
            isPrimary: false
          }));
        }

        for (let i = 0; i < incomingCalendars.length; i++) {
          const cal = incomingCalendars[i];
          const calId = 'cal_' + cal.id.replace(/[^a-zA-Z0-9_]/g, '_');
          const colorHex = cal.backgroundColor || cal.background_color || '#3b82f6';
          const accessRole = cal.accessRole || cal.access_role || 'owner';
          
          const isCalPrimary = hasExplicitPrimary 
            ? Boolean(cal.primary) 
            : (i === 0 && isPrimaryAccount);

          const newCal: CalendarCategory = {
            id: calId,
            accountId: savedAccount.id,
            googleCalendarId: cal.id,
            name: cal.summary || savedAccount.email,
            colorId: 'google_custom',
            colorHex,
            isPrimary: isCalPrimary,
            isVisible: true,
            accessRole
          };

          await persistCalendarCategory(newCal);
          calendarState.calendars = [
            ...calendarState.calendars.filter((c: CalendarCategory) => c.id !== newCal.id && c.googleCalendarId !== newCal.googleCalendarId),
            newCal
          ];
        }
      }

      this.close();
      await eventStore.syncGoogleEvents();
    } catch (err) {
      console.error('Google OAuth error:', err);
      alert(`Google Sign-In error: ${err}`);
    } finally {
      this.isAuthenticating = false;
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
    const acc = this.accounts.find((a: UserAccount) => a.id === id);
    if (!acc || acc.isPrimary) return;
    this.accounts = this.accounts.filter((a: UserAccount) => a.id !== id);
    calendarState.calendars = calendarState.calendars.filter((c: CalendarCategory) => c.accountId !== id);
    await deleteDbAccount(id);
  }

  async deleteAccountAndData(): Promise<void> {
    await clearAllDbAccounts();
    await this.logout();
    this.accounts = [];
    calendarState.calendars = [];
  }

  async setPrimaryAccount(id: string): Promise<void> {
    this.accounts = this.accounts.map((a: UserAccount) => ({
      ...a,
      isPrimary: a.id === id
    }));
    for (const a of this.accounts) {
      await persistDbAccount(a);
    }
    const primary = this.accounts.find((a: UserAccount) => a.id === id);
    if (primary) {
      this.preferredName = primary.name;
      this.email = primary.email;
      this.username = primary.email.split('@')[0].toLowerCase();
      this.avatarUrl = primary.avatarUrl || '';
    }
  }
}

export const settingsStore = new SettingsStore();