import type { SettingsTab, UserAccount } from '../../types/event';
import { 
  loadDbSettings, 
  persistDbSetting, 
  loadDbAccounts, 
  persistDbAccount, 
  deleteDbAccount, 
  persistCalendarCategory 
} from '../db/database';
import { calendarState } from './calendarState.svelte';

class SettingsStore {
  isOpen = $state(false);
  activeTab = $state<SettingsTab>('general');
  isCommandMenuOpen = $state(false);

  // Authentication State (Loaded from SQLite)
  isLoggedIn = $state(false);
  preferredName = $state('');
  email = $state('');
  username = $state('');

  // General Preferences (Persisted & directly affects calendar views)
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
  customVideoTemplate = $state('');

  // Accounts List
  accounts = $state<UserAccount[]>([]);

  async init(): Promise<void> {
    try {
      // 1. Load settings from SQLite
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
      if (saved.customVideoTemplate) this.customVideoTemplate = saved.customVideoTemplate;

      // 2. Load accounts from SQLite
      const storedAccounts = await loadDbAccounts();
      this.accounts = storedAccounts;

      if (storedAccounts.length > 0) {
        const primary = storedAccounts.find(a => a.isPrimary) || storedAccounts[0];
        this.isLoggedIn = true;
        this.preferredName = primary.name;
        this.email = primary.email;
        this.username = primary.email.split('@')[0].toLowerCase();
      } else {
        this.isLoggedIn = false;
        this.preferredName = '';
        this.email = '';
        this.username = '';
      }
    } catch (err) {
      console.error('Failed to load settings from DB:', err);
    }
  }

  // Persist any setting update directly to SQLite
  async updateSetting(key: string, value: string): Promise<void> {
    try {
      await persistDbSetting(key, value);
    } catch (err) {
      console.error(`Failed to persist setting ${key}:`, err);
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
    await this.addAccount(cleanEmail, cleanName);
  }

  async logout(): Promise<void> {
    this.isLoggedIn = false;
    this.preferredName = '';
    this.email = '';
  }

  async addAccount(email: string, name: string = 'Google User'): Promise<void> {
    if (!email.trim()) return;
    const exists = this.accounts.some(a => a.email.toLowerCase() === email.toLowerCase());
    if (!exists) {
      const isPrimary = this.accounts.length === 0;
      const newAcc: UserAccount = {
        id: 'acc_' + Date.now(),
        email: email.trim(),
        name: name.trim() || email.split('@')[0],
        provider: 'google',
        isPrimary,
        syncEnabled: true
      };
      this.accounts = [...this.accounts, newAcc];
      await persistDbAccount(newAcc);

      // Create a default calendar category for this account
      const newCal = {
        id: 'cal_' + Date.now(),
        accountId: newAcc.id,
        name: newAcc.email,
        colorId: 'blue',
        colorHex: '#3b82f6',
        isPrimary,
        isVisible: true
      };
      calendarState.calendars = [...calendarState.calendars, newCal];
      await persistCalendarCategory(newCal);
    }
  }

  async removeAccount(id: string): Promise<void> {
    const acc = this.accounts.find(a => a.id === id);
    if (!acc || acc.isPrimary) return;
    this.accounts = this.accounts.filter(a => a.id !== id);
    calendarState.calendars = calendarState.calendars.filter(c => c.accountId !== id);
    await deleteDbAccount(id);
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
    }
  }
}

export const settingsStore = new SettingsStore();